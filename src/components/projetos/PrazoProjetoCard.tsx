import React, { useEffect, useState } from 'react';
import {
  CentroCusto,
  ConfiguracoesSistema,
  Projeto,
  ProjetoComDetalhes,
} from '../../types';
import {
  AvaliacaoPrazoProjeto,
  avaliarPrazoProjeto,
  navigateToProjetoDetalhe,
} from '../../services/prazoProjetoService';
import { formatDateBR, formatDateTimeBR, formatHours } from '../../utils/formatters';
import {
  formatHorasCompactas,
  formatPrazoHorasComContagem,
  normalizarConfigCalendario,
} from '../../utils/calendarioTrabalho';
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  Flame,
  Gauge,
  HelpCircle,
  Info,
  Play,
  Truck,
} from 'lucide-react';

interface PrazoProjetoCardProps {
  projeto: ProjetoComDetalhes;
  projetosAtivos?: Array<Projeto | ProjetoComDetalhes>;
  configuracoes?: ConfiguracoesSistema | null;
  centrosCusto: CentroCusto[];
  canEditPrazo: boolean;
  onClickEditarPrazo?: () => void;
  onClickIniciarProducao?: () => void;
  iniciandoProducao?: boolean;
}

export const SeloCalendarioBadge: React.FC<{
  avaliacao: AvaliacaoPrazoProjeto;
  compact?: boolean;
}> = ({ avaliacao, compact = false }) => {
  const base = compact
    ? 'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold'
    : 'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-bold';

  switch (avaliacao.statusCalendario) {
    case 'atrasado':
      return (
        <span
          className={`${base} border-rose-300 bg-rose-600 text-white`}
          title={avaliacao.regraSeloCalendario}
        >
          <AlertTriangle className={compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />
          <span>{avaliacao.seloCalendarioLabel}</span>
        </span>
      );
    case 'atencao':
      return (
        <span
          className={`${base} border-amber-300 bg-amber-100 text-amber-900`}
          title={avaliacao.regraSeloCalendario}
        >
          <Clock className={compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />
          <span>{avaliacao.seloCalendarioLabel}</span>
        </span>
      );
    case 'no_prazo':
      return (
        <span
          className={`${base} border-emerald-200 bg-emerald-50 text-emerald-800`}
          title={avaliacao.regraSeloCalendario}
        >
          <CheckCircle2 className={compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />
          <span>{avaliacao.seloCalendarioLabel}</span>
        </span>
      );
    case 'concluido':
      return (
        <span
          className={`${base} border-emerald-200 bg-emerald-50 text-emerald-800`}
          title={avaliacao.regraSeloCalendario}
        >
          <CheckCircle2 className={compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />
          <span>Concluído</span>
        </span>
      );
    case 'cancelado':
      return (
        <span
          className={`${base} border-slate-200 bg-slate-100 text-slate-600`}
          title={avaliacao.regraSeloCalendario}
        >
          <span>Cancelado</span>
        </span>
      );
    default:
      return (
        <span
          className={`${base} border-slate-200 bg-slate-50 text-slate-500`}
          title={avaliacao.regraSeloCalendario}
        >
          <span>Sem entrega</span>
        </span>
      );
  }
};

export const SeloTempoHabilBadge: React.FC<{
  avaliacao: AvaliacaoPrazoProjeto;
  compact?: boolean;
}> = ({ avaliacao, compact = false }) => {
  const base = compact
    ? 'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold'
    : 'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-bold';

  switch (avaliacao.statusTempoHabil) {
    case 'nao':
      return (
        <span
          className={`${base} border-rose-300 bg-rose-50 text-rose-800`}
          title={avaliacao.regraSeloTempoHabil}
        >
          <Flame className={compact ? 'h-2.5 w-2.5 text-rose-600' : 'h-3.5 w-3.5 text-rose-600'} />
          <span>
            {compact
              ? `Sem tempo hábil (${avaliacao.gargaloNome || 'gargalo'}: -${formatHorasCompactas(
                  avaliacao.horasFaltantesGargalo
                )})`
              : `Tempo hábil: Não · Gargalo ${avaliacao.gargaloNome} (-${formatHorasCompactas(
                  avaliacao.horasFaltantesGargalo
                )})`}
          </span>
        </span>
      );
    case 'apertado':
      return (
        <span
          className={`${base} border-amber-300 bg-amber-50 text-amber-900`}
          title={avaliacao.regraSeloTempoHabil}
        >
          <Gauge className={compact ? 'h-2.5 w-2.5 text-amber-600' : 'h-3.5 w-3.5 text-amber-600'} />
          <span>Tempo hábil: Apertado</span>
        </span>
      );
    case 'sim':
      return (
        <span
          className={`${base} border-emerald-200 bg-emerald-50 text-emerald-800`}
          title={avaliacao.regraSeloTempoHabil}
        >
          <CheckCircle2 className={compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />
          <span>Tempo hábil: Sim</span>
        </span>
      );
    default:
      return (
        <span
          className={`${base} border-slate-200 bg-slate-50 text-slate-500`}
          title={avaliacao.regraSeloTempoHabil}
        >
          <HelpCircle className={compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />
          <span>Sem dados para calcular</span>
        </span>
      );
  }
};

export const PrazoListaCelula: React.FC<{
  projeto: ProjetoComDetalhes;
  projetosAtivos?: Array<Projeto | ProjetoComDetalhes>;
  configuracoes?: ConfiguracoesSistema | null;
  centrosCusto: CentroCusto[];
  nowMs: number;
}> = ({ projeto, projetosAtivos, configuracoes, centrosCusto, nowMs }) => {
  const aval = avaliarPrazoProjeto(
    projeto,
    configuracoes,
    centrosCusto,
    nowMs,
    projetosAtivos
  );
  const barColor =
    aval.statusCalendario === 'atrasado'
      ? 'bg-rose-600'
      : aval.statusCalendario === 'atencao'
      ? 'bg-amber-500'
      : aval.statusCalendario === 'concluido'
      ? 'bg-emerald-600'
      : 'bg-slate-900';

  return (
    <div className="space-y-1.5 min-w-[210px]">
      <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
        <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
          <Calendar
            className={`h-3 w-3 ${
              aval.statusCalendario === 'atrasado' ? 'text-rose-600' : 'text-slate-400'
            }`}
          />
          <span>
            {aval.dataEntrega ? formatDateBR(aval.dataEntrega) : formatDateBR(projeto.prazo)}
          </span>
        </span>
        {aval.dataEntrega &&
          aval.statusCalendario !== 'concluido' &&
          aval.statusCalendario !== 'cancelado' && (
            <span
              className={`font-bold ${
                aval.statusCalendario === 'atrasado'
                  ? 'text-rose-700'
                  : aval.statusCalendario === 'atencao'
                  ? 'text-amber-700'
                  : 'text-slate-600'
              }`}
            >
              {aval.statusCalendario === 'atrasado'
                ? `-${formatHorasCompactas(aval.horasAtraso)}`
                : `restam ${formatHorasCompactas(aval.tempo_restante_h)}`}
            </span>
          )}
      </div>

      {/* Mini barra de progresso do tempo decorrido */}
      {aval.tempo_total_h > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full transition-all ${barColor}`}
            style={{ width: `${Math.min(100, Math.round(aval.percentual_decorrido))}%` }}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1">
        <SeloCalendarioBadge avaliacao={aval} compact />
        <SeloTempoHabilBadge avaliacao={aval} compact />
      </div>
    </div>
  );
};

export const PrazoProjetoCard: React.FC<PrazoProjetoCardProps> = ({
  projeto,
  projetosAtivos,
  configuracoes,
  centrosCusto,
  canEditPrazo,
  onClickEditarPrazo,
  onClickIniciarProducao,
  iniciandoProducao = false,
}) => {
  // Atualiza ao vivo o tempo restante e decorrido a cada 15 segundos
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [showDetalhesCalculo, setShowDetalhesCalculo] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const cal = normalizarConfigCalendario(configuracoes);
  const aval = avaliarPrazoProjeto(
    projeto,
    configuracoes,
    centrosCusto,
    nowMs,
    projetosAtivos
  );

  const isAtivo = projeto.status !== 'Concluído' && projeto.status !== 'Cancelado';
  const isIniciarDestaque = !aval.dataInicioDefinida || projeto.status === 'Aguardando';

  const barColor =
    aval.statusCalendario === 'atrasado'
      ? 'bg-rose-600'
      : aval.statusCalendario === 'atencao'
      ? 'bg-amber-500'
      : aval.statusCalendario === 'concluido'
      ? 'bg-emerald-600'
      : 'bg-slate-900';

  return (
    <div className="space-y-4">
      {/* CARTÃO PRINCIPAL: PRAZO DO PROJETO */}
      <div
        className={`rounded-2xl border bg-white p-5 shadow-2xs ${
          aval.statusCalendario === 'atrasado' || aval.statusTempoHabil === 'nao'
            ? 'border-rose-300 ring-1 ring-rose-200'
            : aval.statusCalendario === 'atencao' || aval.statusTempoHabil === 'apertado'
            ? 'border-amber-300'
            : 'border-slate-200'
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Clock className="h-4 w-4 text-slate-700" />
              <h3 className="text-sm font-bold text-slate-900">Prazo do projeto</h3>
              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                Contagem:{' '}
                {cal.contagem_prazo === 'expediente'
                  ? `Expediente (${cal.expedienteInicio}–${cal.expedienteFim})`
                  : 'Horas corridas (24h)'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Janela de calendário entre o início do projeto e a data de entrega ao cliente
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SeloCalendarioBadge avaliacao={aval} />
            <SeloTempoHabilBadge avaliacao={aval} />
            {canEditPrazo && isAtivo && onClickIniciarProducao && (
              <button
                type="button"
                disabled={iniciandoProducao}
                onClick={onClickIniciarProducao}
                title="Grava data_inicio = agora e recalcula a entrega ou o prazo conforme configurado"
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                  isIniciarDestaque
                    ? 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-2xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Play className="h-3 w-3" />
                <span>
                  {iniciandoProducao
                    ? 'Iniciando...'
                    : isIniciarDestaque
                    ? 'Iniciar produção'
                    : 'Reiniciar início'}
                </span>
              </button>
            )}
            {canEditPrazo && onClickEditarPrazo && (
              <button
                type="button"
                onClick={onClickEditarPrazo}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Ajustar Prazo
              </button>
            )}
          </div>
        </div>

        {/* Métricas de tempo */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <span className="block text-[11px] font-medium text-slate-500">Início</span>
            {aval.dataInicio ? (
              <span className="mt-1 block font-mono text-xs font-bold text-slate-900">
                {formatDateTimeBR(aval.dataInicio)}
              </span>
            ) : (
              <span className="mt-1 block text-xs font-semibold text-amber-700">
                Não iniciada
              </span>
            )}
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <span className="block text-[11px] font-medium text-slate-500">Entrega</span>
            <span className="mt-1 block font-mono text-xs font-bold text-slate-900">
              {aval.dataEntrega ? formatDateTimeBR(aval.dataEntrega) : '—'}
            </span>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <span className="block text-[11px] font-medium text-slate-500">Prazo em horas</span>
            <span className="mt-1 block font-mono text-sm font-bold text-slate-900">
              {formatPrazoHorasComContagem(aval.prazoHorasCalculado, cal.contagem_prazo)}
            </span>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <span className="block text-[11px] font-medium text-slate-500">Tempo decorrido</span>
            <span className="mt-1 block font-mono text-base font-bold text-slate-800">
              {formatHours(aval.tempo_decorrido_h)}
            </span>
          </div>

          <div
            className={`rounded-xl border p-3 ${
              aval.statusCalendario === 'atrasado'
                ? 'border-rose-200 bg-rose-50/70'
                : aval.statusCalendario === 'atencao'
                ? 'border-amber-200 bg-amber-50/70'
                : 'border-slate-100 bg-slate-50/70'
            }`}
          >
            <span className="block text-[11px] font-medium text-slate-500">
              {aval.statusCalendario === 'atrasado'
                ? 'Atraso atual (ao vivo)'
                : 'Tempo restante (ao vivo)'}
            </span>
            <span
              className={`mt-1 block font-mono text-base font-bold ${
                aval.statusCalendario === 'atrasado'
                  ? 'text-rose-700'
                  : aval.statusCalendario === 'atencao'
                  ? 'text-amber-800'
                  : 'text-emerald-800'
              }`}
            >
              {aval.statusCalendario === 'atrasado'
                ? `-${formatHours(aval.horasAtraso)}`
                : formatHours(aval.tempo_restante_h)}
            </span>
          </div>
        </div>

        {/* Barra de progresso do tempo de calendário + link Ver detalhes do cálculo */}
        <div className="mt-4 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="font-medium text-slate-600">
              Progresso da janela de prazo ({Math.round(aval.percentual_decorrido)}% decorrido)
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-slate-500">
                Dias úteis restantes até entrega:{' '}
                <strong className="text-slate-800">
                  {aval.diasUteisRestantes.toLocaleString('pt-BR', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{' '}
                  d
                </strong>
              </span>
              <button
                type="button"
                onClick={() => setShowDetalhesCalculo((prev) => !prev)}
                className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900 hover:underline"
              >
                <span>
                  {showDetalhesCalculo ? 'Ocultar detalhes do cálculo' : 'Ver detalhes do cálculo'}
                </span>
                {showDetalhesCalculo ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full transition-all duration-300 ${barColor}`}
              style={{ width: `${Math.min(100, Math.round(aval.percentual_decorrido))}%` }}
            />
          </div>
        </div>

        {/* Painel expansível: Detalhes passo a passo do cálculo */}
        {showDetalhesCalculo && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/90 p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <span className="font-bold text-slate-800">
                Detalhes passo a passo do cálculo (America/Sao_Paulo)
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                agora = {formatDateTimeBR(aval.nowIso)}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 font-mono text-[11px]">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="block text-[10px] font-sans text-slate-500">data_inicio</span>
                <strong className="text-slate-900">
                  {aval.dataInicio ? formatDateTimeBR(aval.dataInicio) : 'Não definida'}
                </strong>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="block text-[10px] font-sans text-slate-500">data_entrega</span>
                <strong className="text-slate-900">
                  {aval.dataEntrega ? formatDateTimeBR(aval.dataEntrega) : '—'}
                </strong>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="block text-[10px] font-sans text-slate-500">prazo_horas</span>
                <strong className="text-slate-900">
                  {formatPrazoHorasComContagem(aval.prazoHorasCalculado, aval.contagemPrazo)}
                </strong>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="block text-[10px] font-sans text-slate-500">contagem_prazo</span>
                <strong className="text-slate-900">
                  {aval.contagemPrazo === 'expediente'
                    ? `expediente (${cal.expedienteInicio}–${cal.expedienteFim}, ${cal.horasExpedienteDia}h/dia)`
                    : 'corridas (24h/dia)'}
                </strong>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="block text-[10px] font-sans text-slate-500">tempo_total_h</span>
                <strong className="text-slate-900">{formatHours(aval.tempo_total_h)}</strong>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="block text-[10px] font-sans text-slate-500">tempo_decorrido_h</span>
                <strong className="text-slate-900">{formatHours(aval.tempo_decorrido_h)}</strong>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="block text-[10px] font-sans text-slate-500">tempo_restante_h</span>
                <strong className="text-slate-900">
                  {aval.statusCalendario === 'atrasado'
                    ? `0h (atraso: ${formatHours(aval.horasAtraso)})`
                    : formatHours(aval.tempo_restante_h)}
                </strong>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="block text-[10px] font-sans text-slate-500">
                  dias_uteis_restantes
                </span>
                <strong className="text-slate-900">
                  {aval.diasUteisRestantes.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} d
                </strong>
              </div>
            </div>

            <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-700">
              <p>
                <strong className="text-slate-900">Regra do selo de calendário:</strong>{' '}
                {aval.regraSeloCalendario}
              </p>
              <p>
                <strong className="text-slate-900">Regra do selo de tempo hábil:</strong>{' '}
                {aval.regraSeloTempoHabil}
              </p>
            </div>

            {aval.capacidadesCC.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5">
                <span className="block text-[11px] font-bold text-slate-800">
                  Resumo por centro de custo (capacidade vs carga até a entrega):
                </span>
                <ul className="space-y-1.5 font-mono text-[11px] text-slate-700">
                  {aval.capacidadesCC.map((cc) => (
                    <li key={cc.centroCustoId} className="border-b border-slate-100 pb-1.5 last:border-b-0 last:pb-0">
                      <div>
                        <strong>{cc.centroCustoNome}:</strong> carga deste projeto ={' '}
                        {formatHours(cc.cargaProjetoH)} · carga acumulada ={' '}
                        {formatHours(cc.cargaAcumuladaH)} · capacidade ={' '}
                        {formatHours(cc.capacidadeDisponivelH)} (
                        {aval.diasUteisRestantes.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}d ×{' '}
                        {cc.horasPorDia}h/dia × {cc.capacidadeParalela}x × {cc.disponibilidadePercent}%) →{' '}
                        <strong
                          className={
                            cc.folgaH < 0 ? 'text-rose-700' : 'text-emerald-700'
                          }
                        >
                          {cc.folgaH >= 0 ? `+${formatHours(cc.folgaH)}` : formatHours(cc.folgaH)}
                        </strong>
                      </div>
                      {cc.projetosContribuintes.length > 0 && (
                        <div className="mt-0.5 font-sans text-[10px] text-slate-500">
                          Fila considerada até {aval.dataEntrega ? formatDateBR(aval.dataEntrega) : 'a entrega'}:{' '}
                          {cc.projetosContribuintes
                            .map(
                              (c) =>
                                `${c.codigo} (${formatHours(c.horasNoCc)}, ent. ${formatDateBR(
                                  c.dataEntrega
                                )})`
                            )
                            .join(' + ')}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Alerta explícito de gargalo quando sem tempo hábil */}
        {aval.statusTempoHabil === 'nao' && aval.gargaloNome && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-900">
            <Flame className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span>{aval.regraSeloTempoHabil}</span>
              {cal.contagem_prazo === 'corridas' && aval.statusCalendario !== 'atrasado' && (
                <span className="block text-[11px] text-rose-800/90">
                  Observação: o prazo está em <strong>horas corridas (24h/dia)</strong>, mas a capacidade da máquina considera apenas os dias úteis e o expediente configurado ({cal.expedienteInicio}–{cal.expedienteFim}). Para contar o prazo do projeto em horas de expediente, altere em <strong>Configurações → Calendário de trabalho</strong>.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* TABELA: CAPACIDADE POR CENTRO DE CUSTO ATÉ A ENTREGA */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-slate-600" />
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                Capacidade por centro de custo até a entrega
              </h4>
              <p className="text-[11px] text-slate-500">
                Prioridade por data de entrega: soma a carga deste projeto e dos projetos ativos com entrega até esta data
              </p>
            </div>
          </div>
          <div className="font-mono text-[11px] text-slate-600">
            Deste projeto:{' '}
            <strong className="text-slate-900">{formatHours(aval.horasAExecutarInternas)}</strong>{' '}
            a executar de {formatHours(aval.horasEstimadasInternas)} est.
          </div>
        </div>

        {aval.statusTempoHabil === 'sem_dados' ? (
          <div className="p-5 text-center text-xs text-slate-500">
            Sem dados para calcular — defina a data de entrega e adicione operações internas com horas estimadas.
          </div>
        ) : aval.capacidadesCC.length === 0 ? (
          <div className="p-5 text-center text-xs text-emerald-700 font-medium">
            Nenhuma carga restante pendente nos centros de custo internos.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-semibold">
                  <th className="py-2.5 px-4">Centro de Custo</th>
                  <th className="py-2.5 px-4 text-right">Carga deste projeto</th>
                  <th className="py-2.5 px-4 text-right">
                    Carga acumulada (projetos com entrega até esta data)
                  </th>
                  <th className="py-2.5 px-4 text-right">Capacidade até entrega</th>
                  <th className="py-2.5 px-4 text-right">Ocupação</th>
                  <th className="py-2.5 px-4 text-right">Folga / Déficit</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {aval.capacidadesCC.map((row) => {
                  const rowBg =
                    row.isGargalo && row.statusLinha === 'estourado'
                      ? 'bg-rose-50/80'
                      : row.isGargalo && row.statusLinha === 'apertado'
                      ? 'bg-amber-50/70'
                      : row.isGargalo
                      ? 'bg-slate-50/60'
                      : '';

                  return (
                    <tr key={row.centroCustoId} className={rowBg}>
                      <td className="py-2.5 px-4 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {row.centroCustoNome}
                          </span>
                          {row.isGargalo && row.statusLinha !== 'ok' && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                row.statusLinha === 'estourado'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-amber-500 text-white'
                              }`}
                            >
                              Gargalo
                            </span>
                          )}
                          {row.isGargalo && row.statusLinha === 'ok' && (
                            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                              Principal fila
                            </span>
                          )}
                        </div>
                        <span className="block text-[10px] text-slate-500 font-mono">
                          {row.capacidadeParalela}x paralelo · {row.horasPorDia}h/dia ·{' '}
                          {row.disponibilidadePercent}% disp.
                        </span>

                        {row.isGargalo && row.projetosContribuintes.length > 0 && (
                          <div className="mt-2 rounded-lg border border-slate-200/80 bg-white/90 p-2 space-y-1">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Projetos que mais contribuem para a carga ({row.projetosContribuintes.length}):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {row.projetosContribuintes.slice(0, 6).map((contrib) => {
                                const isCurrent = contrib.projetoId === projeto.id;
                                return (
                                  <button
                                    key={contrib.projetoId}
                                    type="button"
                                    onClick={() => navigateToProjetoDetalhe(contrib.projetoId)}
                                    title={`${contrib.codigo} — ${contrib.descricao} (Entrega: ${formatDateBR(
                                      contrib.dataEntrega
                                    )})`}
                                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-mono transition-colors ${
                                      isCurrent
                                        ? 'border-slate-900 bg-slate-900 text-white font-bold'
                                        : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-900'
                                    }`}
                                  >
                                    <span>{contrib.codigo}</span>
                                    <span className="opacity-75">·</span>
                                    <span className="font-bold">{formatHours(contrib.horasNoCc)}</span>
                                    {isCurrent ? (
                                      <span className="text-[9px] font-sans uppercase opacity-80">
                                        (atual)
                                      </span>
                                    ) : (
                                      <ArrowUpRight className="h-3 w-3 opacity-60" />
                                    )}
                                  </button>
                                );
                              })}
                              {row.projetosContribuintes.length > 6 && (
                                <span className="inline-flex items-center px-1.5 text-[10px] font-medium text-slate-500">
                                  +{row.projetosContribuintes.length - 6} outro(s)
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-right align-top font-mono font-semibold text-slate-700">
                        {formatHours(row.cargaProjetoH)}
                      </td>

                      <td className="py-2.5 px-4 text-right align-top font-mono font-bold text-slate-900">
                        {formatHours(row.cargaAcumuladaH)}
                      </td>

                      <td className="py-2.5 px-4 text-right align-top font-mono text-slate-700">
                        {formatHours(row.capacidadeDisponivelH)}
                      </td>

                      <td className="py-2.5 px-4 text-right align-top font-mono font-bold">
                        <span
                          className={
                            row.statusLinha === 'estourado'
                              ? 'text-rose-700'
                              : row.statusLinha === 'apertado'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }
                        >
                          {Number.isFinite(row.ocupacaoPercent)
                            ? `${row.ocupacaoPercent.toLocaleString('pt-BR', {
                                maximumFractionDigits: 1,
                              })}%`
                            : '∞ (sem cap.)'}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-right align-top font-mono font-bold">
                        <span
                          className={
                            row.folgaH < 0
                              ? 'text-rose-700'
                              : row.statusLinha === 'apertado'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }
                        >
                          {row.folgaH >= 0 ? '+' : ''}
                          {formatHours(row.folgaH)}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-center align-top">
                        {row.statusLinha === 'estourado' ? (
                          <span className="inline-flex rounded border border-rose-300 bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                            Capacidade excedida
                          </span>
                        ) : row.statusLinha === 'apertado' ? (
                          <span className="inline-flex rounded border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                            Apertado
                          </span>
                        ) : (
                          <span className="inline-flex rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Texto explicativo sobre estimativa de capacidade */}
        <div className="flex items-start gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-[11px] text-slate-600">
          <Info className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
          <span>
            <strong>Nota sobre o cálculo:</strong> esta é uma{' '}
            <strong>estimativa de capacidade por centro de custo</strong> (não um sequenciamento
            completo da produção). Ela soma as horas a executar dos projetos ativos com entrega até
            esta data e <strong>ignora dependências entre operações e disponibilidade de material</strong>.
          </span>
        </div>
      </div>

      {/* OPERAÇÕES TERCEIRIZADAS PENDENTES */}
      {aval.terceirosPendentes.length > 0 && (
        <div
          className={`rounded-2xl border overflow-hidden shadow-2xs ${
            aval.terceiroAtrasaEntrega
              ? 'border-rose-300 bg-rose-50/40'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div
            className={`flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between px-5 py-3 border-b ${
              aval.terceiroAtrasaEntrega
                ? 'border-rose-200 bg-rose-100/60'
                : 'border-slate-100 bg-purple-50/40'
            }`}
          >
            <div className="flex items-center gap-2">
              <Truck
                className={`h-4 w-4 ${
                  aval.terceiroAtrasaEntrega ? 'text-rose-700' : 'text-purple-700'
                }`}
              />
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  Operações terceirizadas pendentes ({aval.terceirosPendentes.length})
                </h4>
                {aval.terceiroAtrasaEntrega && aval.retornoTerceiroMaisTardio && (
                  <p className="text-[11px] font-bold text-rose-700">
                    Alerta: retorno previsto mais tardio ({formatDateBR(aval.retornoTerceiroMaisTardio)}) é posterior à data de entrega do projeto!
                  </p>
                )}
              </div>
            </div>
            {aval.retornoTerceiroMaisTardio && (
              <span
                className={`font-mono text-[11px] font-bold ${
                  aval.terceiroAtrasaEntrega ? 'text-rose-700' : 'text-purple-900'
                }`}
              >
                Retorno mais tardio: {formatDateBR(aval.retornoTerceiroMaisTardio)}
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100 bg-white">
            {aval.terceirosPendentes.map((t) => (
              <div
                key={t.operacaoId}
                className={`flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between px-5 py-2.5 text-xs ${
                  t.atrasaEntrega ? 'bg-rose-50/80 text-rose-900' : ''
                }`}
              >
                <div className="min-w-0">
                  <span className="font-semibold">
                    {t.componenteCodigo ? `${t.componenteCodigo} · ` : ''}
                    {t.componenteNome}
                  </span>
                  <span className="text-slate-400 mx-1.5">—</span>
                  <span className="text-slate-700">{t.descricao}</span>
                  <span className="block text-[11px] text-slate-500">
                    Fornecedor: {t.fornecedor} · Status: {t.status}
                  </span>
                </div>
                <div className="font-mono text-[11px] shrink-0 text-right">
                  {t.retornoPrevisto ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-bold ${
                        t.atrasaEntrega
                          ? 'bg-rose-600 text-white'
                          : 'bg-purple-100 text-purple-900'
                      }`}
                    >
                      {t.atrasaEntrega && <AlertTriangle className="h-3 w-3" />}
                      <span>Retorno prev.: {formatDateBR(t.retornoPrevisto)}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Sem retorno previsto</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
