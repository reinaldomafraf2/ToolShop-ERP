import {
  Apontamento,
  CentroCusto,
  Componente,
  ConfiguracoesSistema,
  ContagemPrazo,
  Operacao,
  PrazoOrigem,
  Projeto,
  ProjetoComDetalhes,
} from '../types';
import { calculateDurationHours, formatDateBR, formatDateTimeBR } from '../utils/formatters';
import {
  CalendarioTrabalhoNormalized,
  addCalendarDaysYMD,
  adicionarHorasCalendario,
  calcularDiasUteisRestantes,
  contarHorasCalendario,
  formatHorasCompactas,
  getLocalDateKey,
  getZonedParts,
  normalizarConfigCalendario,
  parseDateTimeToMs,
  snapFimExpediente,
  zonedDateTimeToUtcMs,
} from '../utils/calendarioTrabalho';

const FOCUS_PROJETO_KEY = 'toolshop_projeto_focus_id';

export function navigateToProjetoDetalhe(projetoId: string): void {
  if (!projetoId) return;
  try {
    sessionStorage.setItem(FOCUS_PROJETO_KEY, projetoId);
  } catch {
    // ignore storage quota errors
  }
  if (window.location.hash === '#projetos') {
    window.dispatchEvent(
      new CustomEvent('toolshop:focus-projeto', { detail: { projetoId } })
    );
  } else {
    window.location.hash = 'projetos';
  }
}

export function consumeFocusProjetoId(): string | null {
  try {
    const id = sessionStorage.getItem(FOCUS_PROJETO_KEY);
    if (id) {
      sessionStorage.removeItem(FOCUS_PROJETO_KEY);
      return id;
    }
  } catch {
    // ignore
  }
  return null;
}

export interface ProjetoAgregados {
  horas_consumidas: number;
  horas_estimadas_total: number;
  horas_a_executar: number;
  horas_a_executar_por_cc: Record<string, number>;
}

/**
 * Calcula agregados de horas de produção (somente centros de custo internos).
 * Para operação não concluída: horas_a_executar = max(horas_estimadas - horas_apontadas_nela, 0).
 * Operação Concluída/Retornada conta 0.
 */
export function calcularAgregadosProjeto(
  componentes: Componente[],
  operacoes: Operacao[],
  apontamentos: Apontamento[],
  centrosCusto: CentroCusto[]
): ProjetoAgregados {
  const ccMap = new Map(centrosCusto.map((c) => [c.id, c]));
  const compIds = new Set(componentes.map((c) => c.id));

  const aptsByOp = new Map<string, Apontamento[]>();
  for (const apt of apontamentos) {
    const list = aptsByOp.get(apt.operacao_id) || [];
    list.push(apt);
    aptsByOp.set(apt.operacao_id, list);
  }

  let horas_consumidas = 0;
  let horas_estimadas_total = 0;
  let horas_a_executar = 0;
  const horas_a_executar_por_cc: Record<string, number> = {};

  for (const op of operacoes) {
    if (!compIds.has(op.componente_id)) continue;
    const ccId = op.centro_custo_id || op.maquina_id || '';
    const cc = ccMap.get(ccId);
    if (cc?.origem === 'terceirizado') continue;

    const opApts = aptsByOp.get(op.id) || [];
    const apontadasOp = opApts.reduce(
      (acc, apt) => acc + calculateDurationHours(apt.inicio, apt.fim),
      0
    );

    const estimadasOp = Math.max(0, Number(op.horas_estimadas || 0));
    horas_consumidas += apontadasOp;
    horas_estimadas_total += estimadasOp;

    const concluida = op.status === 'Concluída' || op.status === 'Retornada';
    if (!concluida) {
      const restanteOp = Math.max(estimadasOp - apontadasOp, 0);
      if (restanteOp > 0 && ccId) {
        horas_a_executar += restanteOp;
        horas_a_executar_por_cc[ccId] =
          (horas_a_executar_por_cc[ccId] || 0) + restanteOp;
      }
    }
  }

  const porCcArredondado: Record<string, number> = {};
  for (const [ccId, val] of Object.entries(horas_a_executar_por_cc)) {
    const clean = Math.round(val * 10000) / 10000;
    if (clean > 0) {
      porCcArredondado[ccId] = clean;
    }
  }

  return {
    horas_consumidas: Math.round(horas_consumidas * 10000) / 10000,
    horas_estimadas_total: Math.round(horas_estimadas_total * 10000) / 10000,
    horas_a_executar: Math.round(horas_a_executar * 10000) / 10000,
    horas_a_executar_por_cc: porCcArredondado,
  };
}

export function recalcularCamposPrazoProjeto(
  params: {
    data_inicio?: string;
    referencia_inicio?: string;
    data_entrega?: string;
    prazo?: string;
    prazo_horas?: number;
    prazo_origem?: PrazoOrigem;
  },
  cfg?: Partial<ConfiguracoesSistema> | null
): {
  data_inicio?: string;
  data_entrega: string;
  prazo: string;
  prazo_horas: number;
  prazo_origem: PrazoOrigem;
} {
  const cal = normalizarConfigCalendario(cfg);
  const parsedInicioMs = params.data_inicio ? parseDateTimeToMs(params.data_inicio) : NaN;
  const data_inicio = Number.isFinite(parsedInicioMs)
    ? new Date(parsedInicioMs).toISOString()
    : undefined;

  const parsedRefMs = params.referencia_inicio
    ? parseDateTimeToMs(params.referencia_inicio)
    : NaN;
  const anchorInicio =
    data_inicio ||
    (Number.isFinite(parsedRefMs) ? new Date(parsedRefMs).toISOString() : new Date().toISOString());

  const origem: PrazoOrigem = params.prazo_origem === 'horas' ? 'horas' : 'data';

  if (
    origem === 'horas' &&
    params.prazo_horas !== undefined &&
    Number.isFinite(params.prazo_horas)
  ) {
    const safeHoras = Math.max(0, Number(params.prazo_horas));
    const data_entrega = adicionarHorasCalendario(anchorInicio, safeHoras, cal);
    const prazo = getLocalDateKey(data_entrega) || data_entrega.slice(0, 10);
    return {
      data_inicio,
      data_entrega,
      prazo,
      prazo_horas: Math.round(safeHoras * 100) / 100,
      prazo_origem: 'horas',
    };
  }

  let data_entrega = '';
  const parsedEntregaMs = params.data_entrega ? parseDateTimeToMs(params.data_entrega) : NaN;
  if (Number.isFinite(parsedEntregaMs)) {
    data_entrega = new Date(parsedEntregaMs).toISOString();
  } else if (params.prazo) {
    data_entrega = snapFimExpediente(params.prazo, cal);
  }

  if (!data_entrega) {
    data_entrega = anchorInicio;
  }

  const prazo = getLocalDateKey(data_entrega) || params.prazo || data_entrega.slice(0, 10);
  const prazo_horas =
    Math.round(contarHorasCalendario(anchorInicio, data_entrega, cal) * 100) / 100;

  return {
    data_inicio,
    data_entrega,
    prazo,
    prazo_horas,
    prazo_origem: origem,
  };
}

export type StatusCalendario =
  | 'atrasado'
  | 'atencao'
  | 'no_prazo'
  | 'concluido'
  | 'cancelado'
  | 'sem_dados';

export type StatusTempoHabil = 'nao' | 'apertado' | 'sim' | 'sem_dados';

export interface ProjetoContribuinteCarga {
  projetoId: string;
  codigo: string;
  clienteNome?: string;
  descricao: string;
  dataEntrega: string;
  horasNoCc: number;
}

export interface CapacidadeCentroCustoLinha {
  centroCustoId: string;
  centroCustoNome: string;
  categoria: string;
  cargaProjetoH: number;
  cargaAcumuladaH: number;
  cargaRestanteH: number;
  capacidadeDisponivelH: number;
  ocupacaoPercent: number; // 0..Infinity (baseado na cargaAcumuladaH)
  folgaH: number; // capacidadeDisponivelH - cargaAcumuladaH
  capacidadeParalela: number;
  horasPorDia: number;
  disponibilidadePercent: number;
  isGargalo: boolean;
  statusLinha: 'ok' | 'apertado' | 'estourado';
  projetosContribuintes: ProjetoContribuinteCarga[];
}

export interface OperacaoTerceirizadaPrazo {
  operacaoId: string;
  componenteNome: string;
  componenteCodigo?: string;
  descricao: string;
  fornecedor: string;
  status: string;
  dataEnvio?: string;
  retornoPrevisto?: string;
  atrasaEntrega: boolean;
}

export interface AvaliacaoPrazoProjeto {
  nowIso: string;
  contagemPrazo: ContagemPrazo;
  dataInicio?: string;
  dataInicioDefinida: boolean;
  dataEntrega?: string;
  prazoHorasCalculado: number;
  tempo_total_h: number;
  tempo_decorrido_h: number;
  tempo_restante_h: number;
  percentual_decorrido: number;
  horasAtraso: number;
  statusCalendario: StatusCalendario;
  seloCalendarioLabel: string;
  regraSeloCalendario: string;

  diasUteisRestantes: number;
  horasEstimadasInternas: number;
  horasConsumidasInternas: number;
  horasAExecutarInternas: number;
  competicaoAtivaCount: number;
  capacidadesCC: CapacidadeCentroCustoLinha[];
  statusTempoHabil: StatusTempoHabil;
  seloTempoHabilLabel: string;
  regraSeloTempoHabil: string;
  gargaloNome?: string;
  horasFaltantesGargalo: number;
  piorFolgaHoras: number;

  terceirosPendentes: OperacaoTerceirizadaPrazo[];
  retornoTerceiroMaisTardio?: string;
  terceiroAtrasaEntrega: boolean;
}

export type HorizonteGargaloDias = 7 | 14 | 30;

export interface GargaloHorizonteMetrics {
  dias: HorizonteGargaloDias;
  cargaH: number;
  capacidadeH: number;
  ocupacaoPercent: number;
  folgaH: number;
  status: 'ok' | 'apertado' | 'estourado';
  projetosCount: number;
}

export interface GargaloCentroCustoLinha {
  centroCustoId: string;
  centroCustoNome: string;
  categoria: string;
  capacidadeParalela: number;
  horasPorDia: number;
  disponibilidadePercent: number;
  horizonte7: GargaloHorizonteMetrics;
  horizonte14: GargaloHorizonteMetrics;
  horizonte30: GargaloHorizonteMetrics;
  maxOcupacaoPercent: number;
  topProjetos30d: ProjetoContribuinteCarga[];
}

export function resolverDatasEfetivasProjeto(
  projeto: Partial<Projeto>,
  cal: CalendarioTrabalhoNormalized
): { dataInicio?: string; dataEntrega?: string } {
  let dataEntrega: string | undefined;
  if (projeto.data_entrega) {
    const ms = parseDateTimeToMs(projeto.data_entrega);
    if (Number.isFinite(ms)) dataEntrega = new Date(ms).toISOString();
  } else if (projeto.prazo) {
    const snapped = snapFimExpediente(projeto.prazo, cal);
    if (snapped) dataEntrega = snapped;
  }

  let dataInicio: string | undefined;
  if (projeto.data_inicio) {
    const ms = parseDateTimeToMs(projeto.data_inicio);
    if (Number.isFinite(ms)) dataInicio = new Date(ms).toISOString();
  }

  return { dataInicio, dataEntrega };
}

export function isProjetoAtrasado(
  projeto: Partial<Projeto>,
  cfg?: Partial<ConfiguracoesSistema> | null,
  nowMs: number = Date.now()
): boolean {
  if (projeto.status === 'Concluído' || projeto.status === 'Cancelado') {
    return false;
  }
  const cal = normalizarConfigCalendario(cfg);
  const { dataEntrega } = resolverDatasEfetivasProjeto(projeto, cal);
  if (dataEntrega) {
    const entregaMs = parseDateTimeToMs(dataEntrega);
    if (Number.isFinite(entregaMs)) {
      return nowMs > entregaMs;
    }
  }
  if (!projeto.prazo) return false;
  const todayLocal = getLocalDateKey(nowMs);
  return Boolean(todayLocal && projeto.prazo < todayLocal);
}

function getClienteNomeOptional(projeto: Projeto | ProjetoComDetalhes): string | undefined {
  const maybeComDetalhes = projeto as ProjetoComDetalhes;
  return maybeComDetalhes.cliente?.nome || undefined;
}

function formatNumHorasRegra(horas: number): string {
  if (!Number.isFinite(horas)) return '0';
  const rounded = Math.round(horas * 10) / 10;
  return rounded.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

export function avaliarPrazoProjeto(
  projeto: Projeto | ProjetoComDetalhes,
  cfg: Partial<ConfiguracoesSistema> | null | undefined,
  centrosCusto: CentroCusto[],
  nowMs: number = Date.now(),
  projetosAtivosInput?: Array<Projeto | ProjetoComDetalhes>
): AvaliacaoPrazoProjeto {
  const cal = normalizarConfigCalendario(cfg);
  const ccMap = new Map(centrosCusto.map((c) => [c.id, c]));
  const { dataInicio, dataEntrega } = resolverDatasEfetivasProjeto(projeto, cal);
  const nowIso = new Date(nowMs).toISOString();
  const contagemLabel =
    cal.contagem_prazo === 'expediente' ? 'horas de expediente' : 'horas corridas';

  const isConcluido = projeto.status === 'Concluído';
  const isCancelado = projeto.status === 'Cancelado';
  const dataInicioDefinida = Boolean(dataInicio);

  let tempo_total_h = 0;
  let tempo_decorrido_h = 0;
  let tempo_restante_h = 0;
  let percentual_decorrido = 0;
  let horasAtraso = 0;
  let statusCalendario: StatusCalendario = 'sem_dados';
  let seloCalendarioLabel = 'Sem entrega definida';
  let regraSeloCalendario = 'Sem data de entrega definida no projeto.';

  const entregaMs = dataEntrega ? parseDateTimeToMs(dataEntrega) : NaN;
  const inicioMs = dataInicio ? parseDateTimeToMs(dataInicio) : NaN;

  if (Number.isFinite(entregaMs) && dataEntrega) {
    if (Number.isFinite(inicioMs)) {
      tempo_total_h = contarHorasCalendario(inicioMs, entregaMs, cal);
      tempo_decorrido_h = contarHorasCalendario(inicioMs, Math.min(nowMs, entregaMs), cal);
      tempo_restante_h = nowMs >= entregaMs ? 0 : contarHorasCalendario(nowMs, entregaMs, cal);
      percentual_decorrido =
        tempo_total_h > 0
          ? Math.min(100, Math.max(0, (tempo_decorrido_h / tempo_total_h) * 100))
          : nowMs >= entregaMs
          ? 100
          : 0;
    } else {
      tempo_restante_h = nowMs >= entregaMs ? 0 : contarHorasCalendario(nowMs, entregaMs, cal);
      tempo_total_h =
        projeto.prazo_horas !== undefined && Number.isFinite(projeto.prazo_horas)
          ? Number(projeto.prazo_horas)
          : tempo_restante_h;
      tempo_decorrido_h = 0;
      percentual_decorrido = nowMs >= entregaMs ? 100 : 0;
    }

    if (isConcluido) {
      statusCalendario = 'concluido';
      seloCalendarioLabel = 'Concluído';
      regraSeloCalendario = 'Projeto marcado como Concluído.';
    } else if (isCancelado) {
      statusCalendario = 'cancelado';
      seloCalendarioLabel = 'Cancelado';
      regraSeloCalendario = 'Projeto marcado como Cancelado.';
    } else if (nowMs > entregaMs) {
      statusCalendario = 'atrasado';
      const delayCounted = contarHorasCalendario(entregaMs, nowMs, cal);
      horasAtraso = delayCounted > 0 ? delayCounted : (nowMs - entregaMs) / 3_600_000;
      seloCalendarioLabel = `Atrasado há ${formatHorasCompactas(horasAtraso)}`;
      regraSeloCalendario = `Atrasado: agora (${formatDateTimeBR(
        nowIso
      )}) já passou da entrega (${formatDateTimeBR(dataEntrega)}), com atraso de ${formatNumHorasRegra(
        horasAtraso
      )} h (${contagemLabel}).${
        !dataInicioDefinida ? ' Produção ainda não foi iniciada.' : ''
      }`;
    } else if (
      tempo_total_h > 0 &&
      tempo_restante_h < (cal.atencao_percentual / 100) * tempo_total_h
    ) {
      statusCalendario = 'atencao';
      seloCalendarioLabel = 'Atenção';
      regraSeloCalendario = `Atenção: restam ${formatNumHorasRegra(
        tempo_restante_h
      )} h até a entrega (${formatDateTimeBR(dataEntrega)}), abaixo da margem de ${
        cal.atencao_percentual
      }% do prazo total de ${formatNumHorasRegra(tempo_total_h)} h (${contagemLabel}).`;
    } else {
      statusCalendario = 'no_prazo';
      seloCalendarioLabel = 'No prazo';
      regraSeloCalendario = dataInicioDefinida
        ? `No prazo: restam ${formatNumHorasRegra(tempo_restante_h)} h de ${formatNumHorasRegra(
            tempo_total_h
          )} h (${Math.round(percentual_decorrido)}% decorrido em ${contagemLabel}) até ${formatDateTimeBR(
            dataEntrega
          )}.`
        : `No prazo (produção não iniciada): faltam ${formatNumHorasRegra(
            tempo_restante_h
          )} h (${contagemLabel}) até a entrega em ${formatDateTimeBR(dataEntrega)}.`;
    }
  } else if (isConcluido) {
    statusCalendario = 'concluido';
    seloCalendarioLabel = 'Concluído';
    regraSeloCalendario = 'Projeto marcado como Concluído.';
  } else if (isCancelado) {
    statusCalendario = 'cancelado';
    seloCalendarioLabel = 'Cancelado';
    regraSeloCalendario = 'Projeto marcado como Cancelado.';
  }

  // Agregados internos de P: se detalhes.componentes já está em memória, calcula ao vivo (sem leituras extras);
  // caso contrário usa os agregados persistidos no documento do projeto.
  let cargaPorCc: Record<string, number> = {};
  let horasEstimadasInternas = 0;
  let horasConsumidasInternas = 0;
  let horasAExecutarInternas = 0;

  const detalhes = projeto as ProjetoComDetalhes;
  if (Array.isArray(detalhes.componentes)) {
    const allOps = detalhes.componentes.flatMap((c) => c.operacoes || []);
    const allApts = allOps.flatMap((o) => o.apontamentos || []);
    const calc = calcularAgregadosProjeto(detalhes.componentes, allOps, allApts, centrosCusto);
    cargaPorCc = calc.horas_a_executar_por_cc;
    horasEstimadasInternas = calc.horas_estimadas_total;
    horasConsumidasInternas = calc.horas_consumidas;
    horasAExecutarInternas = calc.horas_a_executar;
  } else if (
    projeto.horas_a_executar_por_cc !== undefined &&
    projeto.horas_a_executar_por_cc !== null
  ) {
    cargaPorCc = { ...(projeto.horas_a_executar_por_cc || {}) };
    horasEstimadasInternas = Number(projeto.horas_estimadas_total || 0);
    horasConsumidasInternas = Number(projeto.horas_consumidas || 0);
    horasAExecutarInternas =
      projeto.horas_a_executar !== undefined
        ? Number(projeto.horas_a_executar)
        : Object.values(cargaPorCc).reduce((a, b) => a + Number(b || 0), 0);
  }

  // Monta conjunto de projetos ativos competindo até a data_entrega de P
  // Usa estritamente horas_a_executar_por_cc dos documentos dos outros projetos ativos (ou os detalhes já carregados em memória)
  interface CompetidorInfo {
    projetoId: string;
    codigo: string;
    clienteNome?: string;
    descricao: string;
    dataEntrega: string;
    porCc: Record<string, number>;
  }

  const competidores: CompetidorInfo[] = [];
  if (!isConcluido && !isCancelado && Number.isFinite(entregaMs) && dataEntrega) {
    const seenIds = new Set<string>();
    const listaBase = projetosAtivosInput || [projeto];

    for (const q of listaBase) {
      if (!q || !q.id) continue;
      if (q.status === 'Concluído' || q.status === 'Cancelado') continue;
      if (seenIds.has(q.id)) continue;

      if (q.id === projeto.id) {
        seenIds.add(q.id);
        competidores.push({
          projetoId: projeto.id,
          codigo: projeto.codigo,
          clienteNome: getClienteNomeOptional(projeto),
          descricao: projeto.descricao,
          dataEntrega,
          porCc: cargaPorCc,
        });
        continue;
      }

      const { dataEntrega: entregaQ } = resolverDatasEfetivasProjeto(q, cal);
      const entregaQMs = entregaQ ? parseDateTimeToMs(entregaQ) : NaN;
      if (!Number.isFinite(entregaQMs) || !entregaQ || entregaQMs > entregaMs) continue;

      const qDetalhes = q as ProjetoComDetalhes;
      let qPorCc: Record<string, number> = q.horas_a_executar_por_cc || {};
      if (Array.isArray(qDetalhes.componentes)) {
        const qOps = qDetalhes.componentes.flatMap((c) => c.operacoes || []);
        const qApts = qOps.flatMap((o) => o.apontamentos || []);
        qPorCc = calcularAgregadosProjeto(
          qDetalhes.componentes,
          qOps,
          qApts,
          centrosCusto
        ).horas_a_executar_por_cc;
      }

      seenIds.add(q.id);
      competidores.push({
        projetoId: q.id,
        codigo: q.codigo,
        clienteNome: getClienteNomeOptional(q),
        descricao: q.descricao,
        dataEntrega: entregaQ,
        porCc: qPorCc,
      });
    }

    if (!seenIds.has(projeto.id)) {
      competidores.push({
        projetoId: projeto.id,
        codigo: projeto.codigo,
        clienteNome: getClienteNomeOptional(projeto),
        descricao: projeto.descricao,
        dataEntrega,
        porCc: cargaPorCc,
      });
    }
  }

  const diasUteisRestantes =
    Number.isFinite(entregaMs) && !isConcluido && !isCancelado
      ? calcularDiasUteisRestantes(nowMs, entregaMs, cal)
      : 0;

  const apertadoLimitePercent = 100 - cal.atencao_percentual;
  const capacidadesCC: CapacidadeCentroCustoLinha[] = [];

  if (Number.isFinite(entregaMs) && !isConcluido && !isCancelado) {
    for (const [ccId, cargaRaw] of Object.entries(cargaPorCc)) {
      const cargaProjeto = Number(cargaRaw || 0);
      if (cargaProjeto <= 0) continue;
      const cc = ccMap.get(ccId);
      if (cc?.origem === 'terceirizado') continue;

      let cargaAcumulada = 0;
      const projetosContribuintes: ProjetoContribuinteCarga[] = [];

      for (const comp of competidores) {
        const horasComp = Number(comp.porCc[ccId] || 0);
        if (horasComp <= 0) continue;
        cargaAcumulada += horasComp;
        projetosContribuintes.push({
          projetoId: comp.projetoId,
          codigo: comp.codigo,
          clienteNome: comp.clienteNome,
          descricao: comp.descricao,
          dataEntrega: comp.dataEntrega,
          horasNoCc: Math.round(horasComp * 100) / 100,
        });
      }

      projetosContribuintes.sort((a, b) => {
        if (b.horasNoCc !== a.horasNoCc) return b.horasNoCc - a.horasNoCc;
        if (a.dataEntrega !== b.dataEntrega) return a.dataEntrega.localeCompare(b.dataEntrega);
        return a.codigo.localeCompare(b.codigo, 'pt-BR');
      });

      const capParalela =
        cc?.capacidade_paralela && cc.capacidade_paralela > 0
          ? Number(cc.capacidade_paralela)
          : 1;
      const horasPorDia =
        cc?.horas_por_dia && cc.horas_por_dia > 0
          ? Number(cc.horas_por_dia)
          : cal.horasExpedienteDia;
      const dispPct =
        cc?.disponibilidade_percentual !== undefined && cc?.disponibilidade_percentual !== null
          ? Number(cc.disponibilidade_percentual)
          : cal.disponibilidade_percentual_padrao;

      const capacidadeDisponivelH =
        diasUteisRestantes * horasPorDia * capParalela * (dispPct / 100);
      const ocupacaoPercent =
        capacidadeDisponivelH > 0
          ? (cargaAcumulada / capacidadeDisponivelH) * 100
          : cargaAcumulada > 0
          ? Infinity
          : 0;
      const folgaH = capacidadeDisponivelH - cargaAcumulada;

      const statusLinha: 'ok' | 'apertado' | 'estourado' =
        ocupacaoPercent > 100
          ? 'estourado'
          : ocupacaoPercent > apertadoLimitePercent
          ? 'apertado'
          : 'ok';

      capacidadesCC.push({
        centroCustoId: ccId,
        centroCustoNome: cc?.nome || 'Centro de Custo',
        categoria: cc?.categoria || cc?.tipo || 'Interno',
        cargaProjetoH: Math.round(cargaProjeto * 100) / 100,
        cargaAcumuladaH: Math.round(cargaAcumulada * 100) / 100,
        cargaRestanteH: Math.round(cargaProjeto * 100) / 100,
        capacidadeDisponivelH: Math.round(capacidadeDisponivelH * 100) / 100,
        ocupacaoPercent: Number.isFinite(ocupacaoPercent)
          ? Math.round(ocupacaoPercent * 10) / 10
          : Infinity,
        folgaH: Math.round(folgaH * 100) / 100,
        capacidadeParalela: capParalela,
        horasPorDia: Math.round(horasPorDia * 100) / 100,
        disponibilidadePercent: dispPct,
        isGargalo: false,
        statusLinha,
        projetosContribuintes,
      });
    }
  }

  // Ordena por pior folga primeiro (menor folga / maior ocupação acumulada)
  capacidadesCC.sort((a, b) => {
    if (a.folgaH !== b.folgaH) return a.folgaH - b.folgaH;
    return b.ocupacaoPercent - a.ocupacaoPercent;
  });

  let statusTempoHabil: StatusTempoHabil = 'sem_dados';
  let seloTempoHabilLabel = 'Sem dados para calcular';
  let regraSeloTempoHabil =
    'Sem dados para calcular: defina a data de entrega e adicione operações internas com horas estimadas.';
  let gargaloNome: string | undefined;
  let horasFaltantesGargalo = 0;
  let piorFolgaHoras = Number.POSITIVE_INFINITY;

  const hasDadosSuficientes =
    Number.isFinite(entregaMs) && horasEstimadasInternas > 0;

  if (isConcluido) {
    statusTempoHabil = 'sim';
    seloTempoHabilLabel = 'Sim';
    regraSeloTempoHabil = 'Projeto concluído.';
  } else if (isCancelado) {
    regraSeloTempoHabil = 'Projeto cancelado.';
  } else if (hasDadosSuficientes) {
    if (capacidadesCC.length === 0) {
      // Operações internas estimadas já estão todas concluídas
      statusTempoHabil = 'sim';
      seloTempoHabilLabel = 'Sim';
      piorFolgaHoras = diasUteisRestantes * cal.horasExpedienteDia;
      regraSeloTempoHabil =
        'Tempo hábil confirmado: todas as operações internas pendentes já foram concluídas (0 h restantes).';
    } else {
      const gargalo = capacidadesCC[0];
      piorFolgaHoras = gargalo.folgaH;
      const temEstourado = capacidadesCC.some((c) => c.ocupacaoPercent > 100);
      const temApertado = capacidadesCC.some(
        (c) => c.ocupacaoPercent > apertadoLimitePercent
      );

      const outrosProjetosH = Math.max(0, gargalo.cargaAcumuladaH - gargalo.cargaProjetoH);
      const detalheDisputa =
        outrosProjetosH > 0.05 && dataEntrega
          ? ` (${formatNumHorasRegra(gargalo.cargaProjetoH)} h deste projeto + ${formatNumHorasRegra(
              outrosProjetosH
            )} h de outros projetos até ${formatDateBR(dataEntrega)})`
          : '';

      if (temEstourado) {
        gargalo.isGargalo = true;
        gargaloNome = gargalo.centroCustoNome;
        horasFaltantesGargalo = Math.max(0, Math.round(Math.abs(gargalo.folgaH) * 10) / 10);
        statusTempoHabil = 'nao';
        seloTempoHabilLabel = `Não · ${gargalo.centroCustoNome} (-${formatHorasCompactas(
          horasFaltantesGargalo
        )})`;
        regraSeloTempoHabil = `Sem tempo hábil: ${gargalo.centroCustoNome} precisa de ${formatNumHorasRegra(
          gargalo.cargaAcumuladaH
        )} h${detalheDisputa} e só tem ${formatNumHorasRegra(
          gargalo.capacidadeDisponivelH
        )} h de capacidade até a entrega.`;
      } else if (temApertado) {
        gargalo.isGargalo = true;
        gargaloNome = gargalo.centroCustoNome;
        statusTempoHabil = 'apertado';
        seloTempoHabilLabel = 'Apertado';
        regraSeloTempoHabil = `Tempo hábil apertado: ${gargalo.centroCustoNome} precisa de ${formatNumHorasRegra(
          gargalo.cargaAcumuladaH
        )} h${detalheDisputa} e tem ${formatNumHorasRegra(
          gargalo.capacidadeDisponivelH
        )} h de capacidade até a entrega (${Math.round(
          gargalo.ocupacaoPercent
        )}% de ocupação, acima de ${Math.round(apertadoLimitePercent)}%).`;
      } else {
        if (capacidadesCC[0].projetosContribuintes.length > 0) {
          gargalo.isGargalo = true;
        }
        statusTempoHabil = 'sim';
        seloTempoHabilLabel = 'Sim';
        regraSeloTempoHabil = `Tempo hábil suficiente: ${gargalo.centroCustoNome} precisa de ${formatNumHorasRegra(
          gargalo.cargaAcumuladaH
        )} h${detalheDisputa} e tem ${formatNumHorasRegra(
          gargalo.capacidadeDisponivelH
        )} h de capacidade até a entrega (${Math.round(gargalo.ocupacaoPercent)}% de ocupação).`;
      }
    }
  }

  // Terceirizados pendentes (apenas do próprio projeto quando detalhes estiver disponível)
  const terceirosPendentes: OperacaoTerceirizadaPrazo[] = [];
  const entregaDateKey = Number.isFinite(entregaMs) ? getLocalDateKey(entregaMs) : '';
  let retornoTerceiroMaisTardio: string | undefined;
  let terceiroAtrasaEntrega = false;

  if (Array.isArray(detalhes.componentes)) {
    for (const comp of detalhes.componentes) {
      for (const op of comp.operacoes || []) {
        const ccId = op.centro_custo_id || op.maquina_id || '';
        const cc = op.centro_custo || ccMap.get(ccId);
        if (cc?.origem !== 'terceirizado') continue;
        if (op.status === 'Concluída' || op.status === 'Retornada') continue;

        const ret = op.retorno_previsto
          ? op.retorno_previsto.includes('T')
            ? getLocalDateKey(op.retorno_previsto)
            : op.retorno_previsto.slice(0, 10)
          : undefined;
        const atrasaEntrega = Boolean(ret && entregaDateKey && ret > entregaDateKey);

        if (ret && (!retornoTerceiroMaisTardio || ret > retornoTerceiroMaisTardio)) {
          retornoTerceiroMaisTardio = ret;
        }
        if (atrasaEntrega) {
          terceiroAtrasaEntrega = true;
        }

        terceirosPendentes.push({
          operacaoId: op.id,
          componenteNome: comp.nome,
          componenteCodigo: comp.codigo,
          descricao: op.descricao,
          fornecedor: op.fornecedor || cc?.fornecedor_nome || 'Terceirizado',
          status: op.status,
          dataEnvio: op.data_envio,
          retornoPrevisto: ret,
          atrasaEntrega,
        });
      }
    }
  }

  terceirosPendentes.sort((a, b) => {
    if (a.retornoPrevisto && b.retornoPrevisto) {
      return b.retornoPrevisto.localeCompare(a.retornoPrevisto);
    }
    return a.retornoPrevisto ? -1 : 1;
  });

  if (!Number.isFinite(piorFolgaHoras)) {
    piorFolgaHoras = statusCalendario === 'atrasado' ? -horasAtraso : 0;
  }

  const prazoHorasCalculado =
    projeto.prazo_horas !== undefined && Number.isFinite(projeto.prazo_horas)
      ? Number(projeto.prazo_horas)
      : Math.round(tempo_total_h * 100) / 100;

  return {
    nowIso,
    contagemPrazo: cal.contagem_prazo,
    dataInicio,
    dataInicioDefinida,
    dataEntrega,
    prazoHorasCalculado,
    tempo_total_h,
    tempo_decorrido_h,
    tempo_restante_h,
    percentual_decorrido,
    horasAtraso,
    statusCalendario,
    seloCalendarioLabel,
    regraSeloCalendario,
    diasUteisRestantes,
    horasEstimadasInternas,
    horasConsumidasInternas,
    horasAExecutarInternas,
    competicaoAtivaCount: competidores.length,
    capacidadesCC,
    statusTempoHabil,
    seloTempoHabilLabel,
    regraSeloTempoHabil,
    gargaloNome,
    horasFaltantesGargalo,
    piorFolgaHoras,
    terceirosPendentes,
    retornoTerceiroMaisTardio,
    terceiroAtrasaEntrega,
  };
}

function getHorizonEndMs(nowMs: number, dias: HorizonteGargaloDias): number {
  const parts = getZonedParts(nowMs);
  if (!parts) return nowMs + dias * 24 * 3_600_000;
  const target = addCalendarDaysYMD(parts.year, parts.month, parts.day, dias);
  return zonedDateTimeToUtcMs(target.year, target.month, target.day, 23, 59, 59, 999);
}

/**
 * Calcula a ocupação acumulada por centro de custo interno nas próximas entregas (7, 14 e 30 dias),
 * usando exclusivamente os agregados (`horas_a_executar_por_cc`) dos documentos de projetos ativos.
 */
export function calcularGargalosHorizontes(
  projetosAtivosInput: Array<Projeto | ProjetoComDetalhes>,
  centrosCusto: CentroCusto[],
  cfg: Partial<ConfiguracoesSistema> | null | undefined,
  nowMs: number = Date.now()
): GargaloCentroCustoLinha[] {
  const cal = normalizarConfigCalendario(cfg);
  const apertadoLimitePercent = 100 - cal.atencao_percentual;

  const end7 = getHorizonEndMs(nowMs, 7);
  const end14 = getHorizonEndMs(nowMs, 14);
  const end30 = getHorizonEndMs(nowMs, 30);

  const diasUteis7 = calcularDiasUteisRestantes(nowMs, end7, cal);
  const diasUteis14 = calcularDiasUteisRestantes(nowMs, end14, cal);
  const diasUteis30 = calcularDiasUteisRestantes(nowMs, end30, cal);

  // Filtra apenas projetos ativos com data_entrega válida dentro de até 30 dias (inclui atrasados ativos)
  const projetosComEntrega = projetosAtivosInput
    .filter((p) => p.status !== 'Concluído' && p.status !== 'Cancelado')
    .map((p) => {
      const { dataEntrega } = resolverDatasEfetivasProjeto(p, cal);
      const entregaMs = dataEntrega ? new Date(dataEntrega).getTime() : NaN;
      return {
        projeto: p,
        dataEntrega,
        entregaMs,
        porCc: p.horas_a_executar_por_cc || {},
      };
    })
    .filter((item) => Number.isFinite(item.entregaMs) && Boolean(item.dataEntrega));

  const centrosInternos = centrosCusto.filter(
    (cc) => cc.origem !== 'terceirizado' && cc.ativo !== false
  );

  const linhas: GargaloCentroCustoLinha[] = centrosInternos.map((cc) => {
    const capParalela =
      cc.capacidade_paralela && cc.capacidade_paralela > 0
        ? Number(cc.capacidade_paralela)
        : 1;
    const horasPorDia =
      cc.horas_por_dia && cc.horas_por_dia > 0
        ? Number(cc.horas_por_dia)
        : cal.horasExpedienteDia;
    const dispPct =
      cc.disponibilidade_percentual !== undefined && cc.disponibilidade_percentual !== null
        ? Number(cc.disponibilidade_percentual)
        : cal.disponibilidade_percentual_padrao;

    const calcHorizonte = (
      dias: HorizonteGargaloDias,
      cutoffMs: number,
      diasUteis: number
    ): GargaloHorizonteMetrics => {
      let carga = 0;
      let count = 0;
      for (const item of projetosComEntrega) {
        if (item.entregaMs <= cutoffMs) {
          const h = Number(item.porCc[cc.id] || 0);
          if (h > 0) {
            carga += h;
            count++;
          }
        }
      }
      const capacidade = diasUteis * horasPorDia * capParalela * (dispPct / 100);
      const ocupacaoRaw =
        capacidade > 0 ? (carga / capacidade) * 100 : carga > 0 ? Infinity : 0;
      const ocupacaoPercent = Number.isFinite(ocupacaoRaw)
        ? Math.round(ocupacaoRaw * 10) / 10
        : Infinity;
      const folgaH = capacidade - carga;
      const status: 'ok' | 'apertado' | 'estourado' =
        ocupacaoPercent > 100
          ? 'estourado'
          : ocupacaoPercent > apertadoLimitePercent
          ? 'apertado'
          : 'ok';

      return {
        dias,
        cargaH: Math.round(carga * 100) / 100,
        capacidadeH: Math.round(capacidade * 100) / 100,
        ocupacaoPercent,
        folgaH: Math.round(folgaH * 100) / 100,
        status,
        projetosCount: count,
      };
    };

    const h7 = calcHorizonte(7, end7, diasUteis7);
    const h14 = calcHorizonte(14, end14, diasUteis14);
    const h30 = calcHorizonte(30, end30, diasUteis30);

    const topProjetos30d: ProjetoContribuinteCarga[] = [];
    for (const item of projetosComEntrega) {
      if (item.entregaMs <= end30 && item.dataEntrega) {
        const h = Number(item.porCc[cc.id] || 0);
        if (h > 0) {
          topProjetos30d.push({
            projetoId: item.projeto.id,
            codigo: item.projeto.codigo,
            clienteNome: getClienteNomeOptional(item.projeto),
            descricao: item.projeto.descricao,
            dataEntrega: item.dataEntrega,
            horasNoCc: Math.round(h * 100) / 100,
          });
        }
      }
    }
    topProjetos30d.sort((a, b) => {
      if (b.horasNoCc !== a.horasNoCc) return b.horasNoCc - a.horasNoCc;
      return a.dataEntrega.localeCompare(b.dataEntrega);
    });

    const maxOcupacaoPercent = Math.max(
      h7.ocupacaoPercent,
      h14.ocupacaoPercent,
      h30.ocupacaoPercent
    );

    return {
      centroCustoId: cc.id,
      centroCustoNome: cc.nome,
      categoria: cc.categoria || cc.tipo || 'Interno',
      capacidadeParalela: capParalela,
      horasPorDia: Math.round(horasPorDia * 100) / 100,
      disponibilidadePercent: dispPct,
      horizonte7: h7,
      horizonte14: h14,
      horizonte30: h30,
      maxOcupacaoPercent,
      topProjetos30d,
    };
  });

  linhas.sort((a, b) => {
    if (b.maxOcupacaoPercent !== a.maxOcupacaoPercent) {
      return b.maxOcupacaoPercent - a.maxOcupacaoPercent;
    }
    if (b.horizonte7.ocupacaoPercent !== a.horizonte7.ocupacaoPercent) {
      return b.horizonte7.ocupacaoPercent - a.horizonte7.ocupacaoPercent;
    }
    return a.centroCustoNome.localeCompare(b.centroCustoNome, 'pt-BR');
  });

  return linhas;
}

