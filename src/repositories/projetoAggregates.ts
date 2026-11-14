import { collection, doc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { auth, cleanFirestoreData, db } from '../firebase/config';
import { syncStatusService } from '../services/syncStatusService';
import { calcularAgregadosProjeto, ProjetoAgregados } from '../services/prazoProjetoService';
import { Apontamento, CentroCusto, Componente, Operacao, Projeto } from '../types';
import { DEFAULT_EMPRESA_ID, generateUUID } from '../utils/uuid';

const LOCAL_KEYS = {
  PROJETOS: ['toolshop_projetos_v1', 'toolshop_projetos'],
  COMPONENTES: ['toolshop_componentes_v1', 'toolshop_componentes'],
  OPERACOES: ['toolshop_operacoes_v1', 'toolshop_operacoes'],
  APONTAMENTOS: ['toolshop_apontamentos_v1', 'toolshop_apontamentos'],
  CENTROS_CUSTO: ['toolshop_centros_custo_v1', 'toolshop_centros_custo'],
};

function readLocalList<T>(keys: string[]): T[] {
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {
      // ignore parse error
    }
  }
  return [];
}

function writeLocalList<T>(keys: string[], items: T[]): void {
  const serialized = JSON.stringify(items);
  for (const key of keys) {
    try {
      if (key === keys[0] || localStorage.getItem(key) !== null) {
        localStorage.setItem(key, serialized);
      }
    } catch {
      // ignore quota errors
    }
  }
}

function formatFirestoreWriteError(err: any, fallback: string): Error {
  const code = err?.code || '';
  const rawMsg = err?.message || '';
  if (code === 'permission-denied' || rawMsg.includes('Missing or insufficient permissions')) {
    return new Error(
      `${fallback}: Permissão negada ou sessão Google expirada no servidor (${rawMsg}).`
    );
  }
  return new Error(`${fallback}: ${rawMsg || 'falha de comunicação com o servidor.'}`);
}

export async function resolveProjetoIdForComponente(
  componenteId: string,
  empresaId: string = DEFAULT_EMPRESA_ID
): Promise<string | null> {
  const localComps = readLocalList<Componente>(LOCAL_KEYS.COMPONENTES);
  const localHit = localComps.find((c) => c.id === componenteId);
  if (localHit?.projeto_id) return localHit.projeto_id;

  if (auth.currentUser) {
    try {
      const snap = await getDocs(
        query(collection(db, 'componentes'), where('id', '==', componenteId))
      );
      if (!snap.empty) {
        const comp = snap.docs[0].data() as Componente;
        return comp.projeto_id || null;
      }
    } catch (err) {
      console.warn('Falha ao resolver projeto_id por componente:', err);
    }
  }
  void empresaId;
  return null;
}

export async function resolveContextoPorOperacao(
  operacaoId: string
): Promise<{ operacao: Operacao | null; componenteId: string | null; projetoId: string | null }> {
  const localOps = readLocalList<Operacao>(LOCAL_KEYS.OPERACOES);
  let op = localOps.find((o) => o.id === operacaoId) || null;
  if (!op && auth.currentUser) {
    try {
      const snap = await getDocs(
        query(collection(db, 'operacoes'), where('id', '==', operacaoId))
      );
      if (!snap.empty) op = snap.docs[0].data() as Operacao;
    } catch {
      // ignore
    }
  }
  const componenteId = op?.componente_id || null;
  const projetoId = componenteId ? await resolveProjetoIdForComponente(componenteId) : null;
  return { operacao: op, componenteId, projetoId };
}

/**
 * Executa criação de Operação e atualização dos agregados do Projeto na mesma transação.
 */
export async function transactionalCreateOperacao(
  data: Omit<Operacao, 'id' | 'empresa_id'> & { id?: string; empresa_id?: string }
): Promise<Operacao> {
  const novoId = data.id || generateUUID();
  const empresaId = data.empresa_id || DEFAULT_EMPRESA_ID;
  const novaOp: Operacao = {
    ...data,
    id: novoId,
    empresa_id: empresaId,
  } as Operacao;

  const projetoId = await resolveProjetoIdForComponente(data.componente_id, empresaId);

  if (auth.currentUser) {
    await executeProjetoTransaction(
      projetoId,
      empresaId,
      'criação de operação',
      ({ ops, tx }) => {
        tx.set(doc(db, 'operacoes', novoId), cleanFirestoreData(novaOp));
        ops.set(novoId, novaOp);
      }
    );
  }

  const localOps = readLocalList<Operacao>(LOCAL_KEYS.OPERACOES);
  localOps.push(novaOp);
  writeLocalList(LOCAL_KEYS.OPERACOES, localOps);

  if (projetoId) {
    updateLocalProjetoAggregates(projetoId);
  }

  return novaOp;
}

/**
 * Executa atualização de Operação (ex.: horas estimadas, centro de custo, status)
 * e atualização dos agregados do Projeto na mesma transação.
 */
export async function transactionalUpdateOperacao(
  operacaoId: string,
  updates: Partial<Operacao>,
  autoConcluirComponente?: boolean
): Promise<Operacao> {
  const ctx = await resolveContextoPorOperacao(operacaoId);
  const empresaId = ctx.operacao?.empresa_id || DEFAULT_EMPRESA_ID;
  let updatedOp: Operacao | null = null;
  let componentMarkedDone = false;

  if (auth.currentUser) {
    await executeProjetoTransaction(
      ctx.projetoId,
      empresaId,
      'atualização de operação',
      ({ ops, comps, tx }) => {
        const current = ops.get(operacaoId) || ctx.operacao;
        if (!current) {
          throw new Error('Operação não encontrada no servidor.');
        }
        updatedOp = { ...current, ...updates };
        tx.update(doc(db, 'operacoes', operacaoId), cleanFirestoreData(updates as Record<string, any>));
        ops.set(operacaoId, updatedOp);

        if (autoConcluirComponente && updatedOp.componente_id) {
          const opsComp = Array.from(ops.values()).filter(
            (o) => o.componente_id === updatedOp!.componente_id
          );
          const todas =
            opsComp.length > 0 &&
            opsComp.every((o) => o.status === 'Concluída' || o.status === 'Retornada');
          if (todas && comps.has(updatedOp.componente_id)) {
            tx.update(doc(db, 'componentes', updatedOp.componente_id), { status: 'Concluído' });
            componentMarkedDone = true;
          }
        }
      }
    );
  }

  const localOps = readLocalList<Operacao>(LOCAL_KEYS.OPERACOES);
  const idx = localOps.findIndex((o) => o.id === operacaoId);
  if (idx !== -1) {
    updatedOp = { ...localOps[idx], ...updates };
    localOps[idx] = updatedOp;
    writeLocalList(LOCAL_KEYS.OPERACOES, localOps);
  } else if (updatedOp) {
    localOps.push(updatedOp);
    writeLocalList(LOCAL_KEYS.OPERACOES, localOps);
  }

  if (componentMarkedDone && updatedOp?.componente_id) {
    const localComps = readLocalList<Componente>(LOCAL_KEYS.COMPONENTES);
    const cIdx = localComps.findIndex((c) => c.id === updatedOp!.componente_id);
    if (cIdx !== -1) {
      localComps[cIdx] = { ...localComps[cIdx], status: 'Concluído' };
      writeLocalList(LOCAL_KEYS.COMPONENTES, localComps);
    }
  }

  if (ctx.projetoId) {
    updateLocalProjetoAggregates(ctx.projetoId);
  }

  if (!updatedOp) {
    throw new Error('Operação não encontrada.');
  }
  return updatedOp;
}

/**
 * Executa exclusão de Operação e seus Apontamentos + atualização dos agregados do Projeto na mesma transação.
 */
export async function transactionalDeleteOperacao(operacaoId: string): Promise<boolean> {
  const ctx = await resolveContextoPorOperacao(operacaoId);
  const empresaId = ctx.operacao?.empresa_id || DEFAULT_EMPRESA_ID;

  if (auth.currentUser) {
    await executeProjetoTransaction(
      ctx.projetoId,
      empresaId,
      'exclusão de operação',
      ({ ops, apts, tx }) => {
        for (const [aptId, apt] of Array.from(apts.entries())) {
          if (apt.operacao_id === operacaoId) {
            tx.delete(doc(db, 'apontamentos', aptId));
            apts.delete(aptId);
          }
        }
        tx.delete(doc(db, 'operacoes', operacaoId));
        ops.delete(operacaoId);
      }
    );
  }

  const localApts = readLocalList<Apontamento>(LOCAL_KEYS.APONTAMENTOS).filter(
    (a) => a.operacao_id !== operacaoId
  );
  writeLocalList(LOCAL_KEYS.APONTAMENTOS, localApts);

  const localOps = readLocalList<Operacao>(LOCAL_KEYS.OPERACOES).filter(
    (o) => o.id !== operacaoId
  );
  writeLocalList(LOCAL_KEYS.OPERACOES, localOps);

  if (ctx.projetoId) {
    updateLocalProjetoAggregates(ctx.projetoId);
  }
  return true;
}

/**
 * Finaliza apontamento, opcionalmente conclui operação/componente e atualiza agregados do Projeto na mesma transação.
 */
export async function transactionalFinalizarApontamento(
  apontamentoId: string,
  concluirOperacao: boolean
): Promise<Apontamento> {
  const localApts = readLocalList<Apontamento>(LOCAL_KEYS.APONTAMENTOS);
  let targetApt = localApts.find((a) => a.id === apontamentoId) || null;
  if (!targetApt && auth.currentUser) {
    const snap = await getDocs(
      query(collection(db, 'apontamentos'), where('id', '==', apontamentoId))
    );
    if (!snap.empty) targetApt = snap.docs[0].data() as Apontamento;
  }
  if (!targetApt) {
    throw new Error('Apontamento não encontrado.');
  }

  const ctx = await resolveContextoPorOperacao(targetApt.operacao_id);
  const empresaId = targetApt.empresa_id || DEFAULT_EMPRESA_ID;
  const fimIso = new Date().toISOString();
  let updatedApt: Apontamento = { ...targetApt, fim: fimIso };
  let componentMarkedDone = false;

  if (auth.currentUser) {
    await executeProjetoTransaction(
      ctx.projetoId,
      empresaId,
      'finalização de apontamento',
      ({ ops, apts, comps, tx }) => {
        const aptTx = apts.get(apontamentoId) || targetApt!;
        updatedApt = { ...aptTx, fim: fimIso };
        tx.update(doc(db, 'apontamentos', apontamentoId), { fim: fimIso });
        apts.set(apontamentoId, updatedApt);

        if (concluirOperacao && aptTx.operacao_id) {
          const opTx = ops.get(aptTx.operacao_id) || ctx.operacao;
          if (opTx) {
            const nextOp: Operacao = { ...opTx, status: 'Concluída' };
            tx.update(doc(db, 'operacoes', opTx.id), { status: 'Concluída' });
            ops.set(opTx.id, nextOp);

            if (nextOp.componente_id) {
              const opsComp = Array.from(ops.values()).filter(
                (o) => o.componente_id === nextOp.componente_id
              );
              const todas =
                opsComp.length > 0 &&
                opsComp.every((o) => o.status === 'Concluída' || o.status === 'Retornada');
              if (todas && comps.has(nextOp.componente_id)) {
                tx.update(doc(db, 'componentes', nextOp.componente_id), {
                  status: 'Concluído',
                });
                componentMarkedDone = true;
              }
            }
          }
        }
      }
    );
  }

  const idx = localApts.findIndex((a) => a.id === apontamentoId);
  if (idx !== -1) {
    localApts[idx] = updatedApt;
  } else {
    localApts.push(updatedApt);
  }
  writeLocalList(LOCAL_KEYS.APONTAMENTOS, localApts);

  if (concluirOperacao && updatedApt.operacao_id) {
    const localOps = readLocalList<Operacao>(LOCAL_KEYS.OPERACOES);
    const oIdx = localOps.findIndex((o) => o.id === updatedApt.operacao_id);
    if (oIdx !== -1) {
      localOps[oIdx] = { ...localOps[oIdx], status: 'Concluída' };
      writeLocalList(LOCAL_KEYS.OPERACOES, localOps);
    }
    const compId = ctx.componenteId;
    if (compId) {
      const opsComp = localOps.filter((o) => o.componente_id === compId);
      const todas =
        opsComp.length > 0 &&
        opsComp.every((o) => o.status === 'Concluída' || o.status === 'Retornada');
      if (todas || componentMarkedDone) {
        const localComps = readLocalList<Componente>(LOCAL_KEYS.COMPONENTES);
        const cIdx = localComps.findIndex((c) => c.id === compId);
        if (cIdx !== -1) {
          localComps[cIdx] = { ...localComps[cIdx], status: 'Concluído' };
          writeLocalList(LOCAL_KEYS.COMPONENTES, localComps);
        }
      }
    }
  }

  if (ctx.projetoId) {
    updateLocalProjetoAggregates(ctx.projetoId);
  }

  return updatedApt;
}

/**
 * Ajusta apontamento manualmente e atualiza agregados do Projeto na mesma transação.
 */
export async function transactionalAjustarApontamento(
  apontamentoId: string,
  inicio: string,
  fim: string | null,
  motivo: string
): Promise<Apontamento> {
  const localApts = readLocalList<Apontamento>(LOCAL_KEYS.APONTAMENTOS);
  let targetApt = localApts.find((a) => a.id === apontamentoId) || null;
  if (!targetApt && auth.currentUser) {
    const snap = await getDocs(
      query(collection(db, 'apontamentos'), where('id', '==', apontamentoId))
    );
    if (!snap.empty) targetApt = snap.docs[0].data() as Apontamento;
  }
  if (!targetApt) {
    throw new Error('Apontamento não encontrado.');
  }

  const ctx = await resolveContextoPorOperacao(targetApt.operacao_id);
  const empresaId = targetApt.empresa_id || DEFAULT_EMPRESA_ID;
  const updates = {
    inicio,
    fim,
    editado_manualmente: true,
    motivo_edicao: motivo.trim(),
  };
  let updatedApt: Apontamento = { ...targetApt, ...updates };

  if (auth.currentUser) {
    await executeProjetoTransaction(
      ctx.projetoId,
      empresaId,
      'ajuste de apontamento',
      ({ apts, tx }) => {
        const aptTx = apts.get(apontamentoId) || targetApt!;
        updatedApt = { ...aptTx, ...updates };
        tx.update(doc(db, 'apontamentos', apontamentoId), cleanFirestoreData(updates));
        apts.set(apontamentoId, updatedApt);
      }
    );
  }

  const idx = localApts.findIndex((a) => a.id === apontamentoId);
  if (idx !== -1) {
    localApts[idx] = updatedApt;
  } else {
    localApts.push(updatedApt);
  }
  writeLocalList(LOCAL_KEYS.APONTAMENTOS, localApts);

  if (ctx.projetoId) {
    updateLocalProjetoAggregates(ctx.projetoId);
  }
  return updatedApt;
}

/**
 * Exclui apontamento e atualiza agregados do Projeto na mesma transação.
 */
export async function transactionalDeleteApontamento(apontamentoId: string): Promise<boolean> {
  const localApts = readLocalList<Apontamento>(LOCAL_KEYS.APONTAMENTOS);
  let targetApt = localApts.find((a) => a.id === apontamentoId) || null;
  if (!targetApt && auth.currentUser) {
    const snap = await getDocs(
      query(collection(db, 'apontamentos'), where('id', '==', apontamentoId))
    );
    if (!snap.empty) targetApt = snap.docs[0].data() as Apontamento;
  }
  if (!targetApt) return false;

  const ctx = await resolveContextoPorOperacao(targetApt.operacao_id);
  const empresaId = targetApt.empresa_id || DEFAULT_EMPRESA_ID;

  if (auth.currentUser) {
    await executeProjetoTransaction(
      ctx.projetoId,
      empresaId,
      'exclusão de apontamento',
      ({ apts, tx }) => {
        tx.delete(doc(db, 'apontamentos', apontamentoId));
        apts.delete(apontamentoId);
      }
    );
  }

  writeLocalList(
    LOCAL_KEYS.APONTAMENTOS,
    localApts.filter((a) => a.id !== apontamentoId)
  );
  if (ctx.projetoId) {
    updateLocalProjetoAggregates(ctx.projetoId);
  }
  return true;
}

/**
 * Recalcula e persiste agregados de um projeto (útil após importação em lote ou exclusão de componente).
 */
export async function recomputeAndPersistProjetoAggregates(
  projetoId: string,
  empresaId: string = DEFAULT_EMPRESA_ID
): Promise<ProjetoAgregados> {
  if (auth.currentUser) {
    return executeProjetoTransaction(
      projetoId,
      empresaId,
      'atualização de agregados do projeto',
      () => {}
    );
  }
  return updateLocalProjetoAggregates(projetoId);
}

/**
 * Core helper que carrega as referências do projeto, lê tudo dentro de runTransaction(db),
 * aplica a mutação fornecida e grava os agregados atualizados no documento `projetos/{projetoId}`.
 */
async function executeProjetoTransaction(
  projetoId: string | null,
  empresaId: string,
  contextLabel: string,
  applyMutation: (state: {
    ops: Map<string, Operacao>;
    apts: Map<string, Apontamento>;
    comps: Map<string, Componente>;
    tx: any;
  }) => void
): Promise<ProjetoAgregados> {
  // Pré-carrega os IDs envolvidos antes da transação (queries não são permitidas dentro do callback tx)
  let compIds: string[] = [];
  let opIds: string[] = [];
  let aptIds: string[] = [];
  let ccIds: string[] = [];

  try {
    if (projetoId) {
      const [compSnap, ccSnap] = await Promise.all([
        getDocs(query(collection(db, 'componentes'), where('projeto_id', '==', projetoId))),
        getDocs(query(collection(db, 'centros_custo'), where('empresa_id', '==', empresaId))),
      ]);
      compIds = compSnap.docs.map((d) => d.id);
      ccIds = ccSnap.docs.map((d) => d.id);

      // Complementa com IDs locais caso algum componente ainda não tenha subido
      for (const lc of readLocalList<Componente>(LOCAL_KEYS.COMPONENTES)) {
        if (lc.projeto_id === projetoId && !compIds.includes(lc.id)) {
          compIds.push(lc.id);
        }
      }

      if (compIds.length > 0) {
        const compSet = new Set(compIds);
        const opSnap = await getDocs(
          query(collection(db, 'operacoes'), where('empresa_id', '==', empresaId))
        );
        opIds = opSnap.docs
          .filter((d) => compSet.has((d.data() as Operacao).componente_id))
          .map((d) => d.id);
        for (const lo of readLocalList<Operacao>(LOCAL_KEYS.OPERACOES)) {
          if (compSet.has(lo.componente_id) && !opIds.includes(lo.id)) {
            opIds.push(lo.id);
          }
        }
      }

      if (opIds.length > 0) {
        const opSet = new Set(opIds);
        const aptSnap = await getDocs(
          query(collection(db, 'apontamentos'), where('empresa_id', '==', empresaId))
        );
        aptIds = aptSnap.docs
          .filter((d) => opSet.has((d.data() as Apontamento).operacao_id))
          .map((d) => d.id);
        for (const la of readLocalList<Apontamento>(LOCAL_KEYS.APONTAMENTOS)) {
          if (opSet.has(la.operacao_id) && !aptIds.includes(la.id)) {
            aptIds.push(la.id);
          }
        }
      }
    }

    let computed: ProjetoAgregados = {
      horas_consumidas: 0,
      horas_estimadas_total: 0,
      horas_a_executar: 0,
      horas_a_executar_por_cc: {},
    };

    await runTransaction(db, async (tx) => {
      // 1. TODAS AS LEITURAS PRIMEIRO
      const projSnap = projetoId ? await tx.get(doc(db, 'projetos', projetoId)) : null;
      const compSnaps = await Promise.all(
        compIds.map((id) => tx.get(doc(db, 'componentes', id)))
      );
      const opSnaps = await Promise.all(
        opIds.map((id) => tx.get(doc(db, 'operacoes', id)))
      );
      const aptSnaps = await Promise.all(
        aptIds.map((id) => tx.get(doc(db, 'apontamentos', id)))
      );
      const ccSnaps = await Promise.all(
        ccIds.map((id) => tx.get(doc(db, 'centros_custo', id)))
      );

      const compsMap = new Map<string, Componente>();
      for (const s of compSnaps) {
        if (s.exists()) compsMap.set(s.id, s.data() as Componente);
      }
      const opsMap = new Map<string, Operacao>();
      for (const s of opSnaps) {
        if (s.exists()) opsMap.set(s.id, s.data() as Operacao);
      }
      const aptsMap = new Map<string, Apontamento>();
      for (const s of aptSnaps) {
        if (s.exists()) aptsMap.set(s.id, s.data() as Apontamento);
      }
      const centrosCusto: CentroCusto[] = [];
      for (const s of ccSnaps) {
        if (s.exists()) centrosCusto.push(s.data() as CentroCusto);
      }

      // 2. APLICA A MUTAÇÃO SOBRE A TRANSAÇÃO E MAPS EM MEMÓRIA
      applyMutation({ ops: opsMap, apts: aptsMap, comps: compsMap, tx });

      // 3. CALCULA E PERSISTE OS AGREGADOS NO PROJETO NA MESMA TRANSAÇÃO
      computed = calcularAgregadosProjeto(
        Array.from(compsMap.values()),
        Array.from(opsMap.values()),
        Array.from(aptsMap.values()),
        centrosCusto
      );

      if (projetoId && projSnap?.exists()) {
        tx.update(
          doc(db, 'projetos', projetoId),
          cleanFirestoreData({
            horas_consumidas: computed.horas_consumidas,
            horas_estimadas_total: computed.horas_estimadas_total,
            horas_a_executar: computed.horas_a_executar,
            horas_a_executar_por_cc: computed.horas_a_executar_por_cc,
            atualizado_em: new Date().toISOString(),
          })
        );
      }
    });

    syncStatusService.recordSuccess(contextLabel);
    return computed;
  } catch (err) {
    syncStatusService.recordError(err, contextLabel);
    throw formatFirestoreWriteError(err, `Erro ao gravar ${contextLabel}`);
  }
}

export function updateLocalProjetoAggregates(projetoId: string): ProjetoAgregados {
  const projetos = readLocalList<Projeto>(LOCAL_KEYS.PROJETOS);
  const componentes = readLocalList<Componente>(LOCAL_KEYS.COMPONENTES).filter(
    (c) => c.projeto_id === projetoId
  );
  const operacoes = readLocalList<Operacao>(LOCAL_KEYS.OPERACOES);
  const apontamentos = readLocalList<Apontamento>(LOCAL_KEYS.APONTAMENTOS);
  const centrosCusto = readLocalList<CentroCusto>(LOCAL_KEYS.CENTROS_CUSTO);

  const agregados = calcularAgregadosProjeto(
    componentes,
    operacoes,
    apontamentos,
    centrosCusto
  );

  const idx = projetos.findIndex((p) => p.id === projetoId);
  if (idx !== -1) {
    projetos[idx] = {
      ...projetos[idx],
      horas_consumidas: agregados.horas_consumidas,
      horas_estimadas_total: agregados.horas_estimadas_total,
      horas_a_executar: agregados.horas_a_executar,
      horas_a_executar_por_cc: agregados.horas_a_executar_por_cc,
      atualizado_em: new Date().toISOString(),
    };
    writeLocalList(LOCAL_KEYS.PROJETOS, projetos);
  }
  return agregados;
}
