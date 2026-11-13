import { collection, doc, getDocs, writeBatch, deleteField } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { syncStatusService } from '../services/syncStatusService';
import {
  Componente,
  Operacao,
  Apontamento,
  ItemCompra,
  ReservaEstoque,
  UnidadeEstoque,
} from '../types';

interface LoadedCollection<T extends { id: string }> {
  merged: T[];
  firestoreIds: Set<string>;
}

function readLocalArray<T>(storageKey: string): T[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalFiltered<T extends { id: string }>(
  storageKeys: string[],
  idsToRemove: Set<string>
): void {
  if (idsToRemove.size === 0) return;
  for (const key of storageKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      const filtered = parsed.filter((item: T) => item && !idsToRemove.has(item.id));
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch (err) {
      console.warn(`Erro ao limpar chave local ${key}:`, err);
    }
  }
}

async function loadMergedCollection<T extends { id: string }>(
  collectionName: string,
  localStorageKeys: string[]
): Promise<LoadedCollection<T>> {
  const byId = new Map<string, T>();
  const firestoreIds = new Set<string>();

  for (const key of localStorageKeys) {
    for (const item of readLocalArray<T>(key)) {
      if (item?.id) {
        byId.set(item.id, item);
      }
    }
  }

  if (auth.currentUser) {
    try {
      const snap = await getDocs(collection(db, collectionName));
      snap.forEach((d) => {
        const data = d.data() as T;
        const docId = data?.id || d.id;
        firestoreIds.add(docId);
        byId.set(docId, { ...data, id: docId });
      });
    } catch (err: any) {
      syncStatusService.recordError(err, `leitura ${collectionName}`);
      throw new Error(
        `Falha ao consultar ${collectionName} no servidor antes da exclusão: ${
          err?.message || 'erro de permissão ou conexão'
        }`
      );
    }
  }

  return {
    merged: Array.from(byId.values()),
    firestoreIds,
  };
}

type BatchOp =
  | { type: 'delete'; collectionName: string; id: string }
  | { type: 'updateUnidade'; id: string; payload: Record<string, any> };

async function commitBatchedOps(ops: BatchOp[], contextLabel: string): Promise<void> {
  if (!auth.currentUser || ops.length === 0) return;

  const CHUNK_SIZE = 400;
  try {
    for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
      const chunk = ops.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const op of chunk) {
        if (op.type === 'delete') {
          batch.delete(doc(db, op.collectionName, op.id));
        } else {
          batch.update(doc(db, 'unidades_estoque', op.id), op.payload);
        }
      }
      await batch.commit();
    }
    syncStatusService.recordSuccess(contextLabel);
  } catch (err: any) {
    syncStatusService.recordError(err, contextLabel);
    throw new Error(
      `Erro ao excluir dados vinculados no servidor: ${
        err?.message || 'verifique sua conexão ou permissões.'
      }`
    );
  }
}

function updateLocalUnidades(
  actions: Map<string, { releaseToAvailable: boolean; clearOrigin: boolean }>
): void {
  if (actions.size === 0) return;
  try {
    const raw = localStorage.getItem('toolshop_unidades_estoque');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    const updated = parsed.map((u: UnidadeEstoque) => {
      const act = actions.get(u.id);
      if (!act) return u;
      const next: UnidadeEstoque = { ...u };
      if (act.releaseToAvailable) {
        next.status = 'disponivel';
      }
      if (act.clearOrigin) {
        delete next.origem_projeto_id;
        delete next.origem_componente_id;
        delete next.origem_item_compra_id;
      }
      return next;
    });

    localStorage.setItem('toolshop_unidades_estoque', JSON.stringify(updated));
  } catch (err) {
    console.warn('Erro ao atualizar unidades locais após exclusão em cascata:', err);
  }
}

/**
 * Exclui um projeto e TUDO relativo a ele:
 * - Componentes do projeto
 * - Operações dos componentes
 * - Apontamentos das operações
 * - Necessidades / itens de compra vinculados ao projeto ou seus componentes
 * - Reservas de estoque vinculadas ao projeto ou seus componentes
 * - Libera unidades físicas reservadas pelo projeto e remove vínculos de origem apontando para o projeto excluído
 */
export async function executeCascadeDeleteProjeto(projetoId: string): Promise<boolean> {
  const [compData, opData, aptData, comprasData, reservasData, unidadesData] = await Promise.all([
    loadMergedCollection<Componente>('componentes', [
      'toolshop_componentes_v1',
      'toolshop_componentes',
    ]),
    loadMergedCollection<Operacao>('operacoes', ['toolshop_operacoes_v1', 'toolshop_operacoes']),
    loadMergedCollection<Apontamento>('apontamentos', [
      'toolshop_apontamentos_v1',
      'toolshop_apontamentos',
    ]),
    loadMergedCollection<ItemCompra>('itens_compra', ['toolshop_itens_compra']),
    loadMergedCollection<ReservaEstoque>('reservas_estoque', ['toolshop_reservas_estoque']),
    loadMergedCollection<UnidadeEstoque>('unidades_estoque', ['toolshop_unidades_estoque']),
  ]);

  const compIds = new Set(
    compData.merged.filter((c) => c.projeto_id === projetoId).map((c) => c.id)
  );
  const opIds = new Set(
    opData.merged.filter((op) => compIds.has(op.componente_id)).map((op) => op.id)
  );
  const aptIds = new Set(
    aptData.merged.filter((a) => opIds.has(a.operacao_id)).map((a) => a.id)
  );
  const itemCompraIds = new Set(
    comprasData.merged
      .filter(
        (ic) => ic.projeto_id === projetoId || (ic.componente_id && compIds.has(ic.componente_id))
      )
      .map((ic) => ic.id)
  );
  const reservasDoProjeto = reservasData.merged.filter(
    (r) => r.projeto_id === projetoId || (r.componente_id && compIds.has(r.componente_id))
  );
  const reservaIds = new Set(reservasDoProjeto.map((r) => r.id));

  const reservedUnitIdsByProject = new Set(
    reservasDoProjeto
      .filter((r) => r.status === 'ativa' && r.unidade_id)
      .map((r) => r.unidade_id!)
  );
  const otherActiveReservedUnitIds = new Set(
    reservasData.merged
      .filter((r) => !reservaIds.has(r.id) && r.status === 'ativa' && r.unidade_id)
      .map((r) => r.unidade_id!)
  );

  const unidadeActions = new Map<string, { releaseToAvailable: boolean; clearOrigin: boolean }>();
  for (const u of unidadesData.merged) {
    const clearOrigin =
      u.origem_projeto_id === projetoId ||
      Boolean(u.origem_componente_id && compIds.has(u.origem_componente_id)) ||
      Boolean(u.origem_item_compra_id && itemCompraIds.has(u.origem_item_compra_id));
    const releaseToAvailable =
      u.status === 'reservada' &&
      !otherActiveReservedUnitIds.has(u.id) &&
      (reservedUnitIdsByProject.has(u.id) || clearOrigin);

    if (clearOrigin || releaseToAvailable) {
      unidadeActions.set(u.id, { releaseToAvailable, clearOrigin });
    }
  }

  // 1. Executa exclusões e liberações no Firestore em lote (quando conectado)
  const ops: BatchOp[] = [];
  for (const [uid, act] of unidadeActions.entries()) {
    if (!unidadesData.firestoreIds.has(uid)) continue;
    const payload: Record<string, any> = {};
    if (act.releaseToAvailable) {
      payload.status = 'disponivel';
    }
    if (act.clearOrigin) {
      payload.origem_projeto_id = deleteField();
      payload.origem_componente_id = deleteField();
      payload.origem_item_compra_id = deleteField();
    }
    if (Object.keys(payload).length > 0) {
      ops.push({ type: 'updateUnidade', id: uid, payload });
    }
  }

  for (const id of aptIds) {
    if (aptData.firestoreIds.has(id)) ops.push({ type: 'delete', collectionName: 'apontamentos', id });
  }
  for (const id of opIds) {
    if (opData.firestoreIds.has(id)) ops.push({ type: 'delete', collectionName: 'operacoes', id });
  }
  for (const id of compIds) {
    if (compData.firestoreIds.has(id)) ops.push({ type: 'delete', collectionName: 'componentes', id });
  }
  for (const id of itemCompraIds) {
    if (comprasData.firestoreIds.has(id)) ops.push({ type: 'delete', collectionName: 'itens_compra', id });
  }
  for (const id of reservaIds) {
    if (reservasData.firestoreIds.has(id)) ops.push({ type: 'delete', collectionName: 'reservas_estoque', id });
  }
  ops.push({ type: 'delete', collectionName: 'projetos', id: projetoId });

  await commitBatchedOps(ops, 'exclusão em cascata projeto');

  // 2. Atualiza localStorage após confirmação (ou direto em modo offline/local)
  updateLocalUnidades(unidadeActions);
  writeLocalFiltered(['toolshop_apontamentos_v1', 'toolshop_apontamentos'], aptIds);
  writeLocalFiltered(['toolshop_operacoes_v1', 'toolshop_operacoes'], opIds);
  writeLocalFiltered(['toolshop_componentes_v1', 'toolshop_componentes'], compIds);
  writeLocalFiltered(['toolshop_itens_compra'], itemCompraIds);
  writeLocalFiltered(['toolshop_reservas_estoque'], reservaIds);
  writeLocalFiltered(['toolshop_projetos_v1', 'toolshop_projetos'], new Set([projetoId]));

  return true;
}

/**
 * Exclui um componente e tudo relativo a ele:
 * - Operações do componente
 * - Apontamentos das operações
 * - Necessidades / itens de compra vinculados ao componente
 * - Reservas de estoque vinculadas ao componente
 * - Libera unidades físicas reservadas e limpa referências ao componente excluído
 */
export async function executeCascadeDeleteComponente(componenteId: string): Promise<boolean> {
  const [opData, aptData, comprasData, reservasData, unidadesData] = await Promise.all([
    loadMergedCollection<Operacao>('operacoes', ['toolshop_operacoes_v1', 'toolshop_operacoes']),
    loadMergedCollection<Apontamento>('apontamentos', [
      'toolshop_apontamentos_v1',
      'toolshop_apontamentos',
    ]),
    loadMergedCollection<ItemCompra>('itens_compra', ['toolshop_itens_compra']),
    loadMergedCollection<ReservaEstoque>('reservas_estoque', ['toolshop_reservas_estoque']),
    loadMergedCollection<UnidadeEstoque>('unidades_estoque', ['toolshop_unidades_estoque']),
  ]);

  const opIds = new Set(
    opData.merged.filter((op) => op.componente_id === componenteId).map((op) => op.id)
  );
  const aptIds = new Set(
    aptData.merged.filter((a) => opIds.has(a.operacao_id)).map((a) => a.id)
  );
  const itemCompraIds = new Set(
    comprasData.merged.filter((ic) => ic.componente_id === componenteId).map((ic) => ic.id)
  );
  const reservasDoComp = reservasData.merged.filter((r) => r.componente_id === componenteId);
  const reservaIds = new Set(reservasDoComp.map((r) => r.id));

  const reservedUnitIdsByComp = new Set(
    reservasDoComp.filter((r) => r.status === 'ativa' && r.unidade_id).map((r) => r.unidade_id!)
  );
  const otherActiveReservedUnitIds = new Set(
    reservasData.merged
      .filter((r) => !reservaIds.has(r.id) && r.status === 'ativa' && r.unidade_id)
      .map((r) => r.unidade_id!)
  );

  const unidadeActions = new Map<string, { releaseToAvailable: boolean; clearOrigin: boolean }>();
  for (const u of unidadesData.merged) {
    const clearOrigin =
      u.origem_componente_id === componenteId ||
      Boolean(u.origem_item_compra_id && itemCompraIds.has(u.origem_item_compra_id));
    const releaseToAvailable =
      u.status === 'reservada' &&
      !otherActiveReservedUnitIds.has(u.id) &&
      (reservedUnitIdsByComp.has(u.id) || clearOrigin);

    if (clearOrigin || releaseToAvailable) {
      unidadeActions.set(u.id, { releaseToAvailable, clearOrigin });
    }
  }

  const ops: BatchOp[] = [];
  for (const [uid, act] of unidadeActions.entries()) {
    if (!unidadesData.firestoreIds.has(uid)) continue;
    const payload: Record<string, any> = {};
    if (act.releaseToAvailable) {
      payload.status = 'disponivel';
    }
    if (act.clearOrigin) {
      payload.origem_componente_id = deleteField();
      payload.origem_item_compra_id = deleteField();
    }
    if (Object.keys(payload).length > 0) {
      ops.push({ type: 'updateUnidade', id: uid, payload });
    }
  }

  for (const id of aptIds) {
    if (aptData.firestoreIds.has(id)) ops.push({ type: 'delete', collectionName: 'apontamentos', id });
  }
  for (const id of opIds) {
    if (opData.firestoreIds.has(id)) ops.push({ type: 'delete', collectionName: 'operacoes', id });
  }
  for (const id of itemCompraIds) {
    if (comprasData.firestoreIds.has(id)) ops.push({ type: 'delete', collectionName: 'itens_compra', id });
  }
  for (const id of reservaIds) {
    if (reservasData.firestoreIds.has(id)) ops.push({ type: 'delete', collectionName: 'reservas_estoque', id });
  }
  ops.push({ type: 'delete', collectionName: 'componentes', id: componenteId });

  await commitBatchedOps(ops, 'exclusão em cascata componente');

  updateLocalUnidades(unidadeActions);
  writeLocalFiltered(['toolshop_apontamentos_v1', 'toolshop_apontamentos'], aptIds);
  writeLocalFiltered(['toolshop_operacoes_v1', 'toolshop_operacoes'], opIds);
  writeLocalFiltered(['toolshop_itens_compra'], itemCompraIds);
  writeLocalFiltered(['toolshop_reservas_estoque'], reservaIds);
  writeLocalFiltered(['toolshop_componentes_v1', 'toolshop_componentes'], new Set([componenteId]));

  return true;
}
