import React, { useState, useEffect, useMemo } from 'react';
import {
  ProjetoComDetalhes,
  ApontamentoComOperador,
  Maquina,
  ViewTab,
} from '../types';
import {
  FolderKanban,
  AlertTriangle,
  PlayCircle,
  Clock,
  Cpu,
  User,
  ArrowRight,
  Calendar,
  Layers,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Truck,
  Send,
  PackageCheck,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { formatHours, formatDateBR, formatCurrencyBRL } from '../utils/formatters';

interface PainelViewProps {
  projetos: ProjetoComDetalhes[];
  maquinas: Maquina[];
  totalMaquinas: number;
  totalOperadores: number;
  apontamentos: ApontamentoComOperador[];
  onNavigateTab: (tab: ViewTab) => void;
  onRefresh?: () => void;
}

function calculateDiffDays(targetDateStr: string): number {
  if (!targetDateStr) return 0;
  const target = new Date(targetDateStr + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function formatStopwatch(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = safeSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const PainelView: React.FC<PainelViewProps> = ({
  projetos,
  maquinas,
  apontamentos,
  onNavigateTab,
}) => {
  // Live ticker para cronômetros de turnos em andamento (atualiza a cada 1s sem recarregar a página)
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthPrefix = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }, []);

  // 1. CARDS DE RESUMO
  // Projetos em andamento
  const projetosEmAndamento = useMemo(() => {
    return projetos.filter(
      (p) => p.status === 'Em andamento' || p.status === 'Em tryout'
    );
  }, [projetos]);

  // Projetos atrasados (prazo < hoje e status não concluído nem cancelado)
  const projetosAtrasados = useMemo(() => {
    return projetos.filter(
      (p) =>
        p.prazo &&
        p.prazo < todayStr &&
        p.status !== 'Concluído' &&
        p.status !== 'Cancelado'
    );
  }, [projetos, todayStr]);

  // Operações em andamento agora (apontamentos ativos no chão de fábrica)
  const apontamentosAtivos = useMemo(() => {
    return apontamentos.filter((a) => !a.fim);
  }, [apontamentos]);

  // Horas apontadas no mês vigente
  const horasApontadasNoMes = useMemo(() => {
    return apontamentos
      .filter((a) => a.inicio.startsWith(currentMonthPrefix))
      .reduce((acc, a) => acc + a.duracaoHoras, 0);
  }, [apontamentos, currentMonthPrefix]);

  // 2. LISTA "PRÓXIMAS ENTREGAS" (ordenadas por prazo asc)
  const proximasEntregas = useMemo(() => {
    return [...projetos]
      .filter((p) => p.status !== 'Concluído' && p.status !== 'Cancelado')
      .sort((a, b) => a.prazo.localeCompare(b.prazo));
  }, [projetos]);

  // 3. CARGA POR CENTRO DE CUSTO: Horas estimadas das operações pendentes (Apenas centros internos)
  const dadosCargaPorMaquina = useMemo(() => {
    // Apenas centros de custo internos entram no gráfico de carga de máquinas
    const centrosInternos = maquinas.filter((m) => m.origem !== 'terceirizado');
    const horasPendentesPorMaquina = new Map<string, number>();

    // Inicializa todos os centros internos com 0
    centrosInternos.forEach((m) => horasPendentesPorMaquina.set(m.id, 0));

    // Itera por projetos ativos
    projetos.forEach((proj) => {
      if (proj.status === 'Cancelado' || proj.status === 'Concluído') return;
      proj.componentes.forEach((comp) => {
        comp.operacoes.forEach((op) => {
          if (op.status === 'Pendente') {
            const centroId = op.centro_custo_id || op.maquina_id;
            if (centroId && horasPendentesPorMaquina.has(centroId)) {
              const current = horasPendentesPorMaquina.get(centroId) || 0;
              horasPendentesPorMaquina.set(
                centroId,
                current + (op.horas_estimadas || 0)
              );
            }
          }
        });
      });
    });

    return centrosInternos.map((m) => {
      const shortName = m.nome.length > 20 ? m.nome.substring(0, 18) + '...' : m.nome;
      const horas = horasPendentesPorMaquina.get(m.id) || 0;
      return {
        id: m.id,
        nome: shortName,
        nomeCompleto: m.nome,
        tipo: m.categoria || m.tipo || 'Geral',
        horasPendentes: horas,
      };
    });
  }, [maquinas, projetos]);

  // 3B. OPERAÇÕES EM TERCEIROS AGORA (Status === 'Enviada')
  const operacoesEmTerceiros = useMemo(() => {
    const list: Array<{
      opId: string;
      opDescricao: string;
      componenteNome: string;
      componenteCodigo?: string;
      projetoId: string;
      projetoCodigo: string;
      projetoDescricao: string;
      projetoPrazo: string;
      fornecedor: string;
      dataEnvio: string;
      retornoPrevisto: string;
      diasAtraso: number;
      afetaPrazoProjeto: boolean;
    }> = [];

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    projetos.forEach((proj) => {
      if (proj.status === 'Cancelado' || proj.status === 'Concluído') return;
      proj.componentes.forEach((comp) => {
        comp.operacoes.forEach((op) => {
          if (op.status === 'Enviada') {
            const cc = maquinas.find((m) => m.id === (op.centro_custo_id || op.maquina_id));
            const fornecedor = op.fornecedor || cc?.fornecedor_nome || 'Especializado';
            const dataEnvio = op.data_envio || '—';
            const retornoPrevisto = op.retorno_previsto || '—';

            let diasAtraso = 0;
            if (op.retorno_previsto) {
              const dtPrev = new Date(op.retorno_previsto);
              dtPrev.setHours(0, 0, 0, 0);
              const diffMs = hoje.getTime() - dtPrev.getTime();
              if (diffMs > 0) {
                diasAtraso = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
              }
            }

            let afetaPrazoProjeto = false;
            if (proj.prazo && op.retorno_previsto) {
              const dtProj = new Date(proj.prazo);
              dtProj.setHours(0, 0, 0, 0);
              const dtPrev = new Date(op.retorno_previsto);
              dtPrev.setHours(0, 0, 0, 0);
              if (dtPrev > dtProj || diasAtraso > 0) {
                afetaPrazoProjeto = true;
              }
            }

            list.push({
              opId: op.id,
              opDescricao: op.descricao,
              componenteNome: comp.nome,
              componenteCodigo: comp.codigo,
              projetoId: proj.id,
              projetoCodigo: proj.codigo,
              projetoDescricao: proj.descricao,
              projetoPrazo: proj.prazo,
              fornecedor,
              dataEnvio,
              retornoPrevisto,
              diasAtraso,
              afetaPrazoProjeto,
            });
          }
        });
      });
    });

    return list.sort((a, b) => b.diasAtraso - a.diasAtraso);
  }, [projetos, maquinas]);

  // 4. COMPARATIVO POR PROJETO: Horas estimadas x Horas apontadas
  const dadosComparativoProjetos = useMemo(() => {
    return projetos.map((proj) => {
      const estimadas = proj.horasEstimadasTotal;
      const apontadas = proj.horasApontadasTotal;
      const estourou = apontadas > estimadas;
      const delta = apontadas - estimadas;

      return {
        id: proj.id,
        codigo: proj.codigo,
        descricao: proj.descricao,
        estimadas,
        apontadas,
        estourou,
        delta,
      };
    });
  }, [projetos]);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. CARDS DE RESUMO (KPIs EXECUTIVOS)                                     */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 1. CARDS DE RESUMO (KPIs EXECUTIVOS)                                     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Card 1: Projetos em Andamento */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Projetos em Andamento</span>
              <FolderKanban className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold tracking-tight text-slate-900">
                {projetosEmAndamento.length}
              </span>
              <span className="text-xs text-slate-400">
                de {projetos.length} cadastrados
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
            <span className="text-slate-600">Moldes e estampos em fabricação</span>
            <button
              onClick={() => onNavigateTab('projetos')}
              className="font-semibold text-slate-900 hover:text-slate-700"
            >
              Ver todos →
            </button>
          </div>
        </div>

        {/* Card 2: Projetos Atrasados */}
        <div
          className={`flex flex-col justify-between rounded-2xl border p-5 shadow-2xs transition-all ${
            projetosAtrasados.length > 0
              ? 'border-rose-300 bg-rose-50/50'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Projetos Atrasados</span>
              <AlertTriangle
                className={`h-4 w-4 ${
                  projetosAtrasados.length > 0 ? 'text-rose-600' : 'text-slate-400'
                }`}
              />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span
                className={`font-mono text-3xl font-bold tracking-tight ${
                  projetosAtrasados.length > 0 ? 'text-rose-600' : 'text-slate-900'
                }`}
              >
                {projetosAtrasados.length}
              </span>
              <span className="text-xs text-slate-500">com prazo vencido</span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs">
            {projetosAtrasados.length > 0 ? (
              <span className="font-semibold text-rose-800">
                Atenção necessária no cronograma de usinagem
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold">
                Nenhum projeto com prazo vencido
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Operações em Andamento Agora */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Operações Internas</span>
              <PlayCircle className="h-4 w-4 text-emerald-600 animate-pulse" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold tracking-tight text-slate-900">
                {apontamentosAtivos.length}
              </span>
              <span className="text-xs text-slate-500">postos rodando</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
            <span className="text-emerald-700 font-medium">Turnos abertos no tablet</span>
            <button
              onClick={() => onNavigateTab('apontamento')}
              className="font-semibold text-slate-900 hover:text-slate-700"
            >
              Chão de fábrica →
            </button>
          </div>
        </div>

        {/* Card 4: Em Terceiros Agora */}
        <div className="flex flex-col justify-between rounded-2xl border border-purple-200 bg-purple-50/40 p-5 shadow-2xs">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-purple-900">
              <span>Em Terceiros Agora</span>
              <Truck className="h-4 w-4 text-purple-700" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold tracking-tight text-purple-950">
                {operacoesEmTerceiros.length}
              </span>
              <span className="text-xs text-purple-700">peças enviadas</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-purple-200/60 pt-3 text-xs">
            {operacoesEmTerceiros.some((o) => o.diasAtraso > 0) ? (
              <span className="text-rose-700 font-bold flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {operacoesEmTerceiros.filter((o) => o.diasAtraso > 0).length} com atraso
              </span>
            ) : (
              <span className="text-purple-800 font-medium">No prazo previsto</span>
            )}
            <button
              onClick={() => onNavigateTab('projetos')}
              className="font-semibold text-purple-900 hover:text-purple-950"
            >
              Projetos →
            </button>
          </div>
        </div>

        {/* Card 5: Horas Apontadas no Mês */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Horas Apontadas (Mês)</span>
              <Clock className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold tracking-tight text-slate-900">
                {formatHours(horasApontadasNoMes)}
              </span>
              <span className="text-xs text-slate-400">
                em {new Date().toLocaleDateString('pt-BR', { month: 'short' })}
              </span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
            Tempo real apurado
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. EM PRODUÇÃO AGORA (QUEM ESTÁ TRABALHANDO EM QUAL OPERAÇÃO E MÁQUINA)   */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-base font-bold text-slate-900">Em Produção Agora</h3>
            </div>
            <p className="text-xs text-slate-500">
              Operadores ativos no chão de fábrica e tempo de usinagem em tempo real
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('apontamento')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 self-start sm:self-auto"
          >
            <span>Ir para Tablet de Apontamento</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-4">
          {apontamentosAtivos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400">
              <Cpu className="h-8 w-8 text-slate-300 mb-2" />
              <p className="text-xs font-medium text-slate-600">
                Nenhum centro de custo em operação no momento.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Os operadores podem iniciar apontamentos a qualquer instante na tela de Apontamento.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {apontamentosAtivos.map((apt) => {
                const startMs = new Date(apt.inicio).getTime();
                const diffSec = Math.max(0, Math.floor((currentTimestamp - startMs) / 1000));

                return (
                  <div
                    key={apt.id}
                    className="flex flex-col justify-between rounded-xl border border-emerald-200 bg-slate-900 p-4 text-white shadow-xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-amber-400">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="block text-sm font-bold text-white">
                              {apt.operador?.nome || 'Operador'}
                            </span>
                            <span className="block text-[11px] text-slate-400">
                              Iniciou às {new Date(apt.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        {/* Cronômetro Dinâmico em Tempo Real */}
                        <div className="text-right">
                          <span className="font-mono text-lg font-extrabold text-emerald-400 tabular-nums">
                            {formatStopwatch(diffSec)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 rounded-lg bg-slate-800/80 p-2.5 text-xs">
                        <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                          <Cpu className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{apt.maquina?.nome}</span>
                        </div>
                        <div className="mt-1 font-medium text-slate-200 truncate">
                          {apt.operacao?.descricao}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400 truncate">
                          Peça: {apt.componente?.nome} ·{' '}
                          <span className="font-mono text-slate-300">{apt.projeto?.codigo}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-2 text-[11px] text-slate-400">
                      <span>Em execução contínua</span>
                      <button
                        onClick={() => onNavigateTab('apontamento')}
                        className="text-amber-400 hover:text-amber-300 font-semibold"
                      >
                        Abrir Apontamento →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2B. EM TERCEIROS AGORA (SERVIÇOS EXTERNOS EM ANDAMENTO)                   */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                <Truck className="h-4 w-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900">Em Terceiros Agora</h3>
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                {operacoesEmTerceiros.length} {operacoesEmTerceiros.length === 1 ? 'operação' : 'operações'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Peças e processos enviados para fornecedores terceirizados (status Enviada)
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('projetos')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 self-start sm:self-auto"
          >
            <span>Ver nos Projetos</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-4">
          {operacoesEmTerceiros.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400">
              <Truck className="h-8 w-8 text-slate-300 mb-2" />
              <p className="text-xs font-medium text-slate-600">
                Nenhuma peça enviada para terceiros no momento.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Operações de centros de custo terceirizados com status &quot;Enviada&quot; serão acompanhadas aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-4 py-3">Peça / Operação</th>
                    <th scope="col" className="px-4 py-3">Projeto</th>
                    <th scope="col" className="px-4 py-3">Fornecedor</th>
                    <th scope="col" className="px-4 py-3">Data Envio</th>
                    <th scope="col" className="px-4 py-3">Retorno Previsto</th>
                    <th scope="col" className="px-4 py-3">Situação / Atraso</th>
                    <th scope="col" className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {operacoesEmTerceiros.map((item) => (
                    <tr
                      key={item.opId}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        item.diasAtraso > 0 ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          <span className="font-mono text-slate-500 mr-1.5">{item.componenteCodigo}</span>
                          {item.componenteNome}
                        </div>
                        <div className="text-[11px] text-purple-700 font-medium">
                          {item.opDescricao}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono font-medium text-slate-800">
                          {item.projetoCodigo}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                          {item.projetoDescricao}
                        </div>
                        {item.afetaPrazoProjeto && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 rounded px-1.5 py-0.5 border border-rose-200 w-fit">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>Risco no prazo final</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-700">{item.fornecedor || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono">
                        {formatDateBR(item.dataEnvio)}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {item.retornoPrevisto ? (
                          <span className={item.diasAtraso > 0 ? 'font-bold text-rose-600' : 'text-slate-700'}>
                            {formatDateBR(item.retornoPrevisto)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.diasAtraso > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                            <AlertCircle className="h-3 w-3" />
                            Atrasado {item.diasAtraso} {item.diasAtraso === 1 ? 'dia' : 'dias'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                            <CheckCircle2 className="h-3 w-3" />
                            No prazo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onNavigateTab('projetos')}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-900"
                        >
                          <span>Ver</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. GRÁFICOS: CARGA POR MÁQUINA & COMPARATIVO POR PROJETO (RECHARTS)      */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gráfico 1: Carga por Máquina (Horas Estimadas Pendentes) */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Carga por Centro de Custo (Horas Pendentes)
                </h3>
                <p className="text-xs text-slate-500">
                  Horas estimadas de operações em fila de espera (status Pendente)
                </p>
              </div>
              <Cpu className="h-4 w-4 text-slate-400" />
            </div>

            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dadosCargaPorMaquina}
                  margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="nome"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    angle={-20}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    unit="h"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-md">
                            <span className="font-bold text-slate-900 block">
                              {data.nomeCompleto}
                            </span>
                            <span className="text-slate-500 text-[11px] block">
                              Tipo: {data.tipo}
                            </span>
                            <div className="mt-1.5 flex items-center gap-1.5 text-slate-900 font-semibold font-mono">
                              <span className="inline-block h-2 w-2 rounded-full bg-slate-900" />
                              <span>Carga Pendente: {formatHours(data.horasPendentes)}</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="horasPendentes"
                    name="Horas Pendentes"
                    fill="#0f172a"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <span>Identifica gargalos no parque fabril</span>
            <span className="font-mono font-semibold text-slate-900">
              Total Fila:{' '}
              {formatHours(
                dadosCargaPorMaquina.reduce((acc, m) => acc + m.horasPendentes, 0)
              )}
            </span>
          </div>
        </div>

        {/* Gráfico 2: Comparativo por Projeto (Estimadas x Apontadas com Destaque de Estouro) */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Comparativo de Horas por Projeto
                </h3>
                <p className="text-xs text-slate-500">
                  Horas estimadas vs horas apontadas (destaque em vermelho se estourar o orçamento)
                </p>
              </div>
              <TrendingUp className="h-4 w-4 text-slate-400" />
            </div>

            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dadosComparativoProjetos}
                  margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="codigo"
                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    unit="h"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-md space-y-1">
                            <span className="font-mono font-bold text-slate-900 block">
                              {data.codigo}
                            </span>
                            <span className="text-slate-500 text-[11px] block truncate max-w-xs">
                              {data.descricao}
                            </span>
                            <div className="mt-2 flex items-center justify-between gap-4 font-mono">
                              <span className="text-slate-500">Estimadas:</span>
                              <span className="font-semibold text-slate-900">
                                {formatHours(data.estimadas)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 font-mono">
                              <span className="text-slate-500">Apontadas:</span>
                              <span
                                className={`font-bold ${
                                  data.estourou ? 'text-rose-600' : 'text-blue-600'
                                }`}
                              >
                                {formatHours(data.apontadas)}
                              </span>
                            </div>
                            {data.estourou ? (
                              <div className="mt-1 rounded bg-rose-50 p-1 text-[11px] font-bold text-rose-700">
                                ⚠ Estouro de +{formatHours(data.delta)} acima do estimado!
                              </div>
                            ) : (
                              <div className="mt-1 text-[11px] text-emerald-700 font-semibold">
                                ✓ Dentro da estimativa prevista
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                  />
                  <Bar
                    dataKey="estimadas"
                    name="Horas Estimadas"
                    fill="#94a3b8"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="apontadas"
                    name="Horas Apontadas"
                    radius={[4, 4, 0, 0]}
                  >
                    {dadosComparativoProjetos.map((entry) => (
                      <Cell
                        key={`cell-${entry.id}`}
                        fill={entry.estourou ? '#dc2626' : '#2563eb'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
            <span className="text-slate-500">
              Barras vermelhas sinalizam horas apontadas excedentes
            </span>
            <span className="font-semibold text-slate-700">
              {dadosComparativoProjetos.filter((p) => p.estourou).length} projeto(s) com estouro
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. LISTA "PRÓXIMAS ENTREGAS" (ORDENADA POR PRAZO COM DIAS RESTANTES)      */}
      {/* ========================================================================= */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <div className="flex flex-col gap-2 p-5 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-600" />
              <h3 className="text-base font-bold text-slate-900">
                Próximas Entregas de Ferramental
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Projetos em fabricação ordenados por data de entrega com contagem de dias restantes
            </p>
          </div>

          <button
            onClick={() => onNavigateTab('projetos')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900"
          >
            <span>Ver todos os projetos</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-medium">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Cliente Industrial</th>
                <th className="py-3 px-4">Descrição da Ferramenta</th>
                <th className="py-3 px-4">Prazo de Entrega</th>
                <th className="py-3 px-4 text-center">Dias Restantes</th>
                <th className="py-3 px-4 min-w-[150px]">Progresso de Usinagem</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {proximasEntregas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Nenhum projeto ativo com entrega agendada.
                  </td>
                </tr>
              ) : (
                proximasEntregas.map((proj) => {
                  const diffDays = calculateDiffDays(proj.prazo);
                  const isOverdue = diffDays < 0;
                  const percent =
                    proj.totalOperacoes > 0
                      ? Math.round(
                          (proj.operacoesConcluidasCount / proj.totalOperacoes) * 100
                        )
                      : 0;

                  return (
                    <tr
                      key={proj.id}
                      className={`transition-colors ${
                        isOverdue
                          ? 'bg-rose-50/40 hover:bg-rose-50/80 border-l-2 border-l-rose-500'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {proj.codigo}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {proj.cliente?.nome || '-'}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-900 font-medium">
                        {proj.descricao}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Calendar
                            className={`h-3.5 w-3.5 ${
                              isOverdue ? 'text-rose-600' : 'text-slate-400'
                            }`}
                          />
                          <span className={isOverdue ? 'font-bold text-rose-700' : ''}>
                            {formatDateBR(proj.prazo)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isOverdue ? (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                            <AlertCircle className="h-3 w-3" />
                            <span>Venceu há {Math.abs(diffDays)} dias</span>
                          </span>
                        ) : diffDays === 0 ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                            <span>Entrega Hoje!</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-800">
                            <span>Em {diffDays} dias</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-mono text-slate-600">
                            {proj.operacoesConcluidasCount}/{proj.totalOperacoes}
                          </span>
                          <span className="font-mono font-bold text-slate-900">{percent}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full ${
                              percent === 100 ? 'bg-emerald-600' : 'bg-slate-900'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                            proj.status === 'Em andamento'
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : proj.status === 'Em tryout'
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : 'border-slate-200 bg-slate-100 text-slate-700'
                          }`}
                        >
                          {proj.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onNavigateTab('projetos')}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <span>Acessar</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
