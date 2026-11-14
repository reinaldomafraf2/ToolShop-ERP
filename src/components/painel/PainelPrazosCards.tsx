import React, { useMemo } from 'react';
import {
  CentroCusto,
  ConfiguracoesSistema,
  ProjetoComDetalhes,
} from '../../types';
import {
  AvaliacaoPrazoProjeto,
  GargaloHorizonteMetrics,
  avaliarPrazoProjeto,
  calcularGargalosHorizontes,
  navigateToProjetoDetalhe,
} from '../../services/prazoProjetoService';
import { formatDateBR, formatHours } from '../../utils/formatters';
import {
  formatHorasCompactas,
  normalizarConfigCalendario,
} from '../../utils/calendarioTrabalho';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Cpu,
  Flame,
  Gauge,
  Info,
} from 'lucide-react';

interface PainelPrazosCardsProps {
  projetos: ProjetoComDetalhes[];
  centrosCusto: CentroCusto[];
  configuracoes?: ConfiguracoesSistema | null;
  nowMs: number;
}

interface ProjetoComAvaliacao {
  projeto: ProjetoComDetalhes;
  avaliacao: AvaliacaoPrazoProjeto;
}

const HorizonteCell: React.FC<{ metrics: GargaloHorizonteMetrics }> = ({ metrics }) => {
  const boxClass =
    metrics.status === 'estourado'
      ? 'border-rose-300 bg-rose-50 text-rose-900'
      : metrics.status === 'apertado'
      ? 'border-amber-300 bg-amber-50 text-amber-950'
      : 'border-slate-200 bg-slate-50/70 text-slate-800';

  const badgeClass =
    metrics.status === 'estourado'
      ? 'bg-rose-600 text-white'
      : metrics.status === 'apertado'
      ? 'bg-amber-500 text-white'
      : 'bg-emerald-100 text-emerald-800';

  return (
    <div className={`rounded-xl border px-3 py-2 ${boxClass}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-bold">
          {formatHours(metrics.cargaH)} / {formatHours(metrics.capacidadeH)}
        </span>
        <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${badgeClass}`}>
          {Number.isFinite(metrics.ocupacaoPercent)
            ? `${metrics.ocupacaoPercent.toLocaleString('pt-BR', {
                maximumFractionDigits: 1,
              })}%`
            : '∞'}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] opacity-80">
        <span>
          {metrics.projetosCount}{' '}
          {metrics.projetosCount === 1 ? 'projeto' : 'projetos'}
        </span>
        <span className="font-mono">
          {metrics.folgaH >= 0 ? 'Folga +' : 'Déficit '}
          {formatHorasCompactas(Math.abs(metrics.folgaH))}
        </span>
      </div>
    </div>
  );
};

export const PainelPrazosCards: React.FC<PainelPrazosCardsProps> = ({
  projetos,
  centrosCusto,
  configuracoes,
  nowMs,
}) => {
  const cal = useMemo(() => normalizarConfigCalendario(configuracoes), [configuracoes]);
  const apertadoLimitePercent = Math.round((100 - cal.atencao_percentual) * 10) / 10;

  const { atrasados, semTempoHabil, apertados, gargalosLinhas } = useMemo(() => {
    const ativos = projetos.filter(
      (p) => p.status !== 'Concluído' && p.status !== 'Cancelado'
    );
    const avaliados: ProjetoComAvaliacao[] = ativos.map((projeto) => ({
      projeto,
      avaliacao: avaliarPrazoProjeto(projeto, configuracoes, centrosCusto, nowMs, ativos),
    }));

    const sortByPiorFolga = (a: ProjetoComAvaliacao, b: ProjetoComAvaliacao) =>
      a.avaliacao.piorFolgaHoras - b.avaliacao.piorFolgaHoras;

    return {
      atrasados: avaliados
        .filter((x) => x.avaliacao.statusCalendario === 'atrasado')
        .sort(sortByPiorFolga),
      semTempoHabil: avaliados
        .filter((x) => x.avaliacao.statusTempoHabil === 'nao')
        .sort(sortByPiorFolga),
      apertados: avaliados
        .filter((x) => x.avaliacao.statusTempoHabil === 'apertado')
        .sort(sortByPiorFolga),
      gargalosLinhas: calcularGargalosHorizontes(
        ativos,
        centrosCusto,
        configuracoes,
        nowMs
      ),
    };
  }, [projetos, centrosCusto, configuracoes, nowMs]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Card 1: Entregas atrasadas */}
        <div
          className={`flex flex-col justify-between rounded-2xl border p-5 shadow-2xs ${
            atrasados.length > 0
              ? 'border-rose-300 bg-rose-50/30'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Entregas atrasadas</h3>
                  <p className="text-xs text-slate-500">
                    Prazo vencido (ordenado pela pior folga)
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-rose-100 border border-rose-200 px-2.5 py-0.5 text-xs font-bold text-rose-800 font-mono">
                {atrasados.length}
              </span>
            </div>

            <div className="mt-4">
              {atrasados.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 flex items-center gap-2 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Nenhuma entrega com prazo vencido no momento.</span>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {atrasados.map(({ projeto, avaliacao }) => (
                    <button
                      key={projeto.id}
                      type="button"
                      onClick={() => navigateToProjetoDetalhe(projeto.id)}
                      className="w-full text-left flex items-center justify-between rounded-xl border border-rose-200 bg-white p-2.5 text-xs hover:bg-rose-50 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900">
                            {projeto.codigo}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="truncate font-medium text-slate-700">
                            {projeto.cliente?.nome || projeto.descricao}
                          </span>
                        </div>
                        <span className="block text-[11px] text-slate-500 truncate mt-0.5">
                          Entrega:{' '}
                          {avaliacao.dataEntrega
                            ? formatDateBR(avaliacao.dataEntrega)
                            : formatDateBR(projeto.prazo)}
                          {avaliacao.gargaloNome ? ` · Gargalo: ${avaliacao.gargaloNome}` : ''}
                        </span>
                      </div>
                      <div className="shrink-0 text-right flex flex-col items-end gap-0.5">
                        <span className="rounded bg-rose-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                          {avaliacao.seloCalendarioLabel}
                        </span>
                        <span className="font-mono text-[10px] font-bold text-rose-700 flex items-center gap-0.5">
                          <span>Folga {formatHorasCompactas(avaliacao.piorFolgaHoras)}</span>
                          <ArrowRight className="h-2.5 w-2.5" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Sem tempo hábil */}
        <div
          className={`flex flex-col justify-between rounded-2xl border p-5 shadow-2xs ${
            semTempoHabil.length > 0
              ? 'border-rose-300 bg-rose-50/20'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                  <Flame className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Sem tempo hábil</h3>
                  <p className="text-xs text-slate-500">
                    Carga acumulada excede capacidade até entrega
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-rose-100 border border-rose-200 px-2.5 py-0.5 text-xs font-bold text-rose-800 font-mono">
                {semTempoHabil.length}
              </span>
            </div>

            <div className="mt-4">
              {semTempoHabil.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 flex items-center gap-2 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Todos os projetos cabem na capacidade disponível.</span>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {semTempoHabil.map(({ projeto, avaliacao }) => (
                    <button
                      key={projeto.id}
                      type="button"
                      onClick={() => navigateToProjetoDetalhe(projeto.id)}
                      className="w-full text-left flex items-center justify-between rounded-xl border border-rose-200 bg-white p-2.5 text-xs hover:bg-rose-50 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900">
                            {projeto.codigo}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="truncate font-medium text-slate-700">
                            {projeto.cliente?.nome || projeto.descricao}
                          </span>
                        </div>
                        <span className="block text-[11px] text-rose-700 font-medium truncate mt-0.5">
                          Gargalo: {avaliacao.gargaloNome || 'Centro interno'}
                        </span>
                      </div>
                      <div className="shrink-0 text-right flex flex-col items-end gap-0.5">
                        <span className="rounded bg-rose-100 border border-rose-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-800">
                          -{formatHours(avaliacao.horasFaltantesGargalo)}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 flex items-center gap-0.5">
                          <span>Abrir</span>
                          <ArrowRight className="h-2.5 w-2.5" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Apertados */}
        <div
          className={`flex flex-col justify-between rounded-2xl border p-5 shadow-2xs ${
            apertados.length > 0
              ? 'border-amber-300 bg-amber-50/20'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <Gauge className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Apertados</h3>
                  <p className="text-xs text-slate-500">
                    Ocupação acumulada na zona de atenção
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-900 font-mono">
                {apertados.length}
              </span>
            </div>

            <div className="mt-4">
              {apertados.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex items-center gap-2 text-xs text-slate-600">
                  <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>Nenhum projeto com capacidade apertada.</span>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {apertados.map(({ projeto, avaliacao }) => (
                    <button
                      key={projeto.id}
                      type="button"
                      onClick={() => navigateToProjetoDetalhe(projeto.id)}
                      className="w-full text-left flex items-center justify-between rounded-xl border border-amber-200 bg-white p-2.5 text-xs hover:bg-amber-50 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900">
                            {projeto.codigo}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="truncate font-medium text-slate-700">
                            {projeto.cliente?.nome || projeto.descricao}
                          </span>
                        </div>
                        <span className="block text-[11px] text-slate-500 truncate mt-0.5">
                          Restante: {formatHours(avaliacao.tempo_restante_h)} ·{' '}
                          {avaliacao.gargaloNome
                            ? `Maior carga: ${avaliacao.gargaloNome}`
                            : 'No limite'}
                        </span>
                      </div>
                      <div className="shrink-0 text-right flex flex-col items-end gap-0.5">
                        <span className="rounded bg-amber-100 border border-amber-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-900">
                          Folga +{formatHorasCompactas(avaliacao.piorFolgaHoras)}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 flex items-center gap-0.5">
                          <span>Abrir</span>
                          <ArrowRight className="h-2.5 w-2.5" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* PAINEL "GARGALOS" — OCUPAÇÃO ACUMULADA POR CENTRO (7, 14 e 30 DIAS)  */}
      {/* ===================================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-amber-400">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Gargalos</h3>
              <p className="text-xs text-slate-500">
                Ocupação acumulada dos centros de custo internos nas próximas entregas (próximos 7, 14 e 30 dias)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold text-amber-900">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Amarelo &gt; {apertadoLimitePercent}%
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 font-semibold text-rose-800">
              <span className="h-2 w-2 rounded-full bg-rose-600" />
              Vermelho &gt; 100%
            </span>
          </div>
        </div>

        {gargalosLinhas.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            Nenhum centro de custo interno ativo cadastrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Centro de Custo Interno</th>
                  <th className="py-3 px-4">Próximos 7 dias (Carga / Cap. · Ocup.)</th>
                  <th className="py-3 px-4">Próximos 14 dias (Carga / Cap. · Ocup.)</th>
                  <th className="py-3 px-4">Próximos 30 dias (Carga / Cap. · Ocup.)</th>
                  <th className="py-3 px-4">Principais projetos (até 30d)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gargalosLinhas.map((linha) => (
                  <tr key={linha.centroCustoId} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 align-top min-w-[200px]">
                      <div className="font-bold text-slate-900">{linha.centroCustoNome}</div>
                      <div className="text-[11px] text-slate-500">{linha.categoria}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                        {linha.capacidadeParalela}x paralelo · {linha.horasPorDia}h/d ·{' '}
                        {linha.disponibilidadePercent}% disp.
                      </div>
                    </td>

                    <td className="py-3 px-4 align-top min-w-[195px]">
                      <HorizonteCell metrics={linha.horizonte7} />
                    </td>

                    <td className="py-3 px-4 align-top min-w-[195px]">
                      <HorizonteCell metrics={linha.horizonte14} />
                    </td>

                    <td className="py-3 px-4 align-top min-w-[195px]">
                      <HorizonteCell metrics={linha.horizonte30} />
                    </td>

                    <td className="py-3 px-4 align-top min-w-[220px]">
                      {linha.topProjetos30d.length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic">
                          Sem carga prevista em 30d
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {linha.topProjetos30d.slice(0, 3).map((proj) => (
                            <button
                              key={proj.projetoId}
                              type="button"
                              onClick={() => navigateToProjetoDetalhe(proj.projetoId)}
                              title={`${proj.codigo} — ${proj.descricao} (Entrega: ${formatDateBR(
                                proj.dataEntrega
                              )})`}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-800 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-900 transition-colors"
                            >
                              <span className="font-bold">{proj.codigo}</span>
                              <span className="text-slate-400">·</span>
                              <span>{formatHours(proj.horasNoCc)}</span>
                              <ArrowUpRight className="h-3 w-3 text-slate-400" />
                            </button>
                          ))}
                          {linha.topProjetos30d.length > 3 && (
                            <span className="text-[10px] text-slate-500 self-center">
                              +{linha.topProjetos30d.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Texto de ajuda obrigatório */}
        <div className="flex items-start gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-[11px] text-slate-600">
          <Info className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
          <span>
            <strong>Estimativa de capacidade:</strong> esta análise não é um sequenciamento completo
            da produção — ela acumula a carga restante dos projetos ativos por ordem de entrega para
            indicar disputas por máquina e <strong>ignora dependências entre operações e disponibilidade de material</strong>.
          </span>
        </div>
      </div>
    </div>
  );
};

