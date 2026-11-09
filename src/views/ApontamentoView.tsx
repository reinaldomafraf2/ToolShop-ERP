import React, { useState, useEffect, useMemo } from 'react';
import {
  ApontamentoComOperador,
  Operador,
  Maquina,
  OperacaoComDetalhes,
} from '../types';
import { toolShopService } from '../services/toolShopService';
import { Modal } from '../components/common/Modal';
import { FeedbackAlert } from '../components/common/FeedbackAlert';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../auth/AuthContext';
import {
  Play,
  Square,
  Clock,
  User,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  Edit2,
  Check,
  Search,
  Filter,
  ShieldAlert,
  ArrowRight,
  Info,
} from 'lucide-react';
import { formatDateTimeBR, formatHours } from '../utils/formatters';

interface ApontamentoViewProps {
  apontamentos: ApontamentoComOperador[];
  operadores: Operador[];
  maquinas: Maquina[];
  onRefresh: () => void;
}

function formatStopwatch(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = safeSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const ApontamentoView: React.FC<ApontamentoViewProps> = ({
  apontamentos,
  operadores,
  maquinas,
  onRefresh,
}) => {
  const { user, perfil, can } = useAuth();

  // Se o usuário logado for operador e tiver operador_id associado, fixa nele
  const initialOpId = useMemo(() => {
    if (perfil === 'operador' && user?.operador_id) {
      return user.operador_id;
    }
    return operadores[0]?.id || '';
  }, [perfil, user, operadores]);

  // Operador ativo no tablet
  const [selectedOperadorId, setSelectedOperadorId] = useState<string>(initialOpId);

  useEffect(() => {
    if (perfil === 'operador' && user?.operador_id) {
      setSelectedOperadorId(user.operador_id);
    }
  }, [perfil, user]);

  // Operadores visíveis na seleção (operador só vê a si mesmo no tablet; líderes e gerência veem todos)
  const visibleOperadores = useMemo(() => {
    if (perfil === 'operador' && user?.operador_id) {
      const match = operadores.filter((op) => op.id === user.operador_id);
      if (match.length > 0) return match;
    }
    return operadores;
  }, [operadores, perfil, user]);

  // Lista de operações disponíveis carregadas
  const [operacoesDisponiveis, setOperacoesDisponiveis] = useState<OperacaoComDetalhes[]>([]);
  const [isLoadingOps, setIsLoadingOps] = useState(false);
  const [searchOp, setSearchOp] = useState('');
  const [maquinaFilter, setMaquinaFilter] = useState<string>('Todas');

  // Estado do cronômetro em tempo real (segundos decorridos)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Modal de Finalização de Apontamento
  const [finalizarModal, setFinalizarModal] = useState<{
    isOpen: boolean;
    apontamento: ApontamentoComOperador | null;
    concluirOperacao: boolean;
  }>({
    isOpen: false,
    apontamento: null,
    concluirOperacao: true,
  });

  // Modal de Ajuste Manual de Horário
  const [ajusteModal, setAjusteModal] = useState<{
    isOpen: boolean;
    apontamento: ApontamentoComOperador | null;
    inicioStr: string;
    fimStr: string;
    motivo: string;
    error?: string;
  }>({
    isOpen: false,
    apontamento: null,
    inicioStr: '',
    fimStr: '',
    motivo: '',
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Operador atualmente selecionado
  const selectedOperador = useMemo(() => {
    return operadores.find((o) => o.id === selectedOperadorId) || operadores[0] || null;
  }, [operadores, selectedOperadorId]);

  // Apontamento ativo do operador selecionado (se houver)
  const activeApontamento = useMemo(() => {
    if (!selectedOperador) return null;
    return apontamentos.find((a) => a.operador_id === selectedOperador.id && !a.fim) || null;
  }, [apontamentos, selectedOperador]);

  // Atualiza cronômetro em tempo real a cada 1 segundo se houver apontamento ativo
  useEffect(() => {
    if (!activeApontamento || !activeApontamento.inicio) {
      setElapsedSeconds(0);
      return;
    }

    const calculateElapsed = () => {
      const startMs = new Date(activeApontamento.inicio).getTime();
      const nowMs = Date.now();
      const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setElapsedSeconds(diffSec);
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeApontamento]);

  // Carrega operações disponíveis (Pendente ou Em andamento)
  const loadOperacoesDisponiveis = async () => {
    setIsLoadingOps(true);
    try {
      const ops = await toolShopService.getOperacoesDisponiveis();
      setOperacoesDisponiveis(ops);
    } catch (err) {
      console.error('Erro ao carregar operações disponíveis:', err);
    } finally {
      setIsLoadingOps(false);
    }
  };

  useEffect(() => {
    loadOperacoesDisponiveis();
  }, [apontamentos]);

  // Histórico de apontamentos do dia do operador selecionado
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [mostrarApenasHoje, setMostrarApenasHoje] = useState(true);

  const historicoOperador = useMemo(() => {
    if (!selectedOperador) return [];
    return apontamentos.filter((a) => {
      if (a.operador_id !== selectedOperador.id) return false;
      if (!mostrarApenasHoje) return true;
      const aptDate = a.inicio.split('T')[0];
      return aptDate === todayStr;
    });
  }, [apontamentos, selectedOperador, mostrarApenasHoje, todayStr]);

  // Filtragem de operações disponíveis
  const filteredOperacoes = useMemo(() => {
    return operacoesDisponiveis.filter((op) => {
      const matchesSearch =
        op.descricao.toLowerCase().includes(searchOp.toLowerCase()) ||
        (op.componente?.nome && op.componente.nome.toLowerCase().includes(searchOp.toLowerCase())) ||
        (op.projeto?.codigo && op.projeto.codigo.toLowerCase().includes(searchOp.toLowerCase()));

      const matchesMaquina =
        maquinaFilter === 'Todas' ||
        op.centro_custo_id === maquinaFilter ||
        op.maquina_id === maquinaFilter;

      return matchesSearch && matchesMaquina;
    });
  }, [operacoesDisponiveis, searchOp, maquinaFilter]);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

  // --- INICIAR APONTAMENTO ---
  const handleIniciarApontamento = async (operacao: OperacaoComDetalhes) => {
    if (!selectedOperador) {
      showFeedback('error', 'Selecione um operador antes de iniciar.');
      return;
    }

    setIsSubmitting(true);
    try {
      await toolShopService.iniciarApontamento(operacao.id, selectedOperador.id);
      showFeedback(
        'success',
        `Apontamento iniciado para ${selectedOperador.nome} na operação "${operacao.descricao}"!`
      );
      onRefresh();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao iniciar apontamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- FINALIZAR APONTAMENTO ---
  const handleOpenFinalizarModal = () => {
    if (!activeApontamento) return;
    setFinalizarModal({
      isOpen: true,
      apontamento: activeApontamento,
      concluirOperacao: true,
    });
  };

  const handleConfirmFinalizar = async () => {
    if (!finalizarModal.apontamento) return;

    setIsSubmitting(true);
    try {
      await toolShopService.finalizarApontamento(
        finalizarModal.apontamento.id,
        finalizarModal.concluirOperacao
      );
      showFeedback(
        'success',
        `Turno finalizado com sucesso! ${
          finalizarModal.concluirOperacao ? 'Operação marcada como Concluída.' : ''
        }`
      );
      setFinalizarModal({ isOpen: false, apontamento: null, concluirOperacao: true });
      onRefresh();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao finalizar apontamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- AJUSTE MANUAL ---
  const handleOpenAjusteModal = (apt: ApontamentoComOperador) => {
    // Formata ISO para o formato aceito por input datetime-local: YYYY-MM-DDTHH:mm
    const toInputVal = (isoStr: string | null) => {
      if (!isoStr) return '';
      const d = new Date(isoStr);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
      )}:${pad(d.getMinutes())}`;
    };

    setAjusteModal({
      isOpen: true,
      apontamento: apt,
      inicioStr: toInputVal(apt.inicio),
      fimStr: toInputVal(apt.fim),
      motivo: apt.motivo_edicao || '',
      error: undefined,
    });
  };

  const handleConfirmAjuste = async () => {
    if (!ajusteModal.apontamento) return;

    if (!ajusteModal.inicioStr) {
      setAjusteModal((prev) => ({ ...prev, error: 'Horário de início é obrigatório.' }));
      return;
    }

    if (!ajusteModal.motivo.trim()) {
      setAjusteModal((prev) => ({
        ...prev,
        error: 'Informe o motivo do ajuste manual (ex: esquecimento de bater ponto).',
      }));
      return;
    }

    const isoInicio = new Date(ajusteModal.inicioStr).toISOString();
    const isoFim = ajusteModal.fimStr ? new Date(ajusteModal.fimStr).toISOString() : null;

    if (isoFim && new Date(isoFim).getTime() <= new Date(isoInicio).getTime()) {
      setAjusteModal((prev) => ({
        ...prev,
        error: 'O horário de término deve ser posterior ao horário de início.',
      }));
      return;
    }

    setIsSubmitting(true);
    try {
      await toolShopService.ajustarApontamento(
        ajusteModal.apontamento.id,
        isoInicio,
        isoFim,
        ajusteModal.motivo.trim()
      );
      showFeedback('success', 'Horário de apontamento ajustado e registrado com sucesso!');
      setAjusteModal({
        isOpen: false,
        apontamento: null,
        inicioStr: '',
        fimStr: '',
        motivo: '',
      });
      onRefresh();
    } catch (err: any) {
      setAjusteModal((prev) => ({ ...prev, error: err.message || 'Erro ao ajustar horário.' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alerta de Feedback Padronizado */}
      <FeedbackAlert feedback={feedback} onClose={() => setFeedback(null)} />

      {/* ========================================================================= */}
      {/* ETAPA 1: ESCOLHA DO OPERADOR (BOTÕES GRANDES PARA TABLET)                */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-3">
          <div>
            <span className="text-xs font-bold tracking-wider text-slate-500 uppercase">
              Chão de Fábrica · Tablet Operacional
            </span>
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">
              Quem está operando esta estação?
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Toque no seu nome para carregar suas tarefas e apontamento
          </span>
        </div>

        {/* Grade de Operadores com Alvos de Toque Amplos */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {visibleOperadores.map((op) => {
            const isSelected = selectedOperador?.id === op.id;
            const hasShift = apontamentos.some((a) => a.operador_id === op.id && !a.fim);

            return (
              <button
                key={op.id}
                type="button"
                onClick={() => setSelectedOperadorId(op.id)}
                className={`relative flex min-h-[58px] items-center gap-3 rounded-xl p-3 text-left transition-all ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-md ring-2 ring-amber-400'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isSelected ? 'bg-slate-800 text-amber-400' : 'bg-white text-slate-600 shadow-2xs'
                  }`}
                >
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold sm:text-sm">{op.nome}</div>
                  <div
                    className={`truncate text-[11px] font-medium ${
                      hasShift
                        ? isSelected
                          ? 'text-amber-300'
                          : 'text-emerald-700 font-semibold'
                        : isSelected
                        ? 'text-slate-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {hasShift ? '● Em Usinagem' : 'Disponível'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ETAPA 2: CRONÔMETRO EM TEMPO REAL OU LISTA DE OPERAÇÕES                   */}
      {/* ========================================================================= */}
      {activeApontamento ? (
        /* CARD DE APONTAMENTO EM ANDAMENTO COM CRONÔMETRO GIGANTE */
        <div className="rounded-2xl border-2 border-emerald-500 bg-slate-900 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Informações da Tarefa */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Usinagem em Execução Agora</span>
              </div>

              <div>
                <span className="font-mono text-xs text-amber-400 font-semibold">
                  {activeApontamento.projeto?.codigo || 'PROJETO'}
                </span>
                <h3 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {activeApontamento.operacao?.descricao}
                </h3>
                <p className="mt-1 text-sm text-slate-300">
                  Peça: <strong className="text-white">{activeApontamento.componente?.nome}</strong>{' '}
                  ({activeApontamento.componente?.material})
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Cpu className="h-4 w-4 text-amber-400" />
                  <span className="font-semibold text-white">
                    {activeApontamento.maquina?.nome}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-slate-400" />
                  <span>Operador: {selectedOperador?.nome}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span>Iniciado às {formatDateTimeBR(activeApontamento.inicio)}</span>
                </div>
              </div>
            </div>

            {/* Cronômetro e Botão Gigante de Finalizar */}
            <div className="flex flex-col items-start gap-4 rounded-xl bg-slate-800/80 p-5 sm:items-center sm:flex-row lg:flex-col lg:items-end">
              <div className="text-left sm:text-center lg:text-right">
                <span className="block text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  Tempo Decorrido Nesta Etapa
                </span>
                <div className="font-mono text-4xl font-extrabold tracking-tight text-emerald-400 sm:text-5xl tabular-nums">
                  {formatStopwatch(elapsedSeconds)}
                </div>
              </div>

              {/* Botão Grande de Finalizar para Tablet */}
              <button
                type="button"
                onClick={handleOpenFinalizarModal}
                className="flex min-h-[58px] w-full items-center justify-center gap-3 rounded-xl bg-rose-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:bg-rose-500 active:scale-98 sm:w-auto"
              >
                <Square className="h-5 w-5 fill-white" />
                <span>Finalizar Apontamento</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* LISTA DE OPERAÇÕES DISPONÍVEIS PARA INICIAR */
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                <h3 className="text-base font-bold text-slate-900">
                  Operações Prontas para Início
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Selecione a operação abaixo e toque em <strong>"Iniciar"</strong> para ligar o
                cronômetro de horas
              </p>
            </div>

            {/* Filtro Rápido por Centro de Custo */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Centro de Custo:</span>
              <select
                value={maquinaFilter}
                onChange={(e) => setMaquinaFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 shadow-2xs focus:outline-none"
              >
                <option value="Todas">Todos os Centros de Custo</option>
                {maquinas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Busca Rápida */}
          <div className="mt-4 relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por código do projeto, peça ou operação..."
              value={searchOp}
              onChange={(e) => setSearchOp(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
            />
          </div>

          {/* Lista de Cards de Operações com Botões Grandes */}
          <div className="mt-4 space-y-3">
            {isLoadingOps ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Carregando operações disponíveis...
              </div>
            ) : filteredOperacoes.length === 0 ? (
              operacoesDisponiveis.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Todas as operações estão concluídas ou em execução!"
                  description="Não há operações pendentes ou aguardando início no chão de fábrica no momento."
                />
              ) : (
                <EmptyState
                  icon={Search}
                  title="Nenhuma operação encontrada"
                  description="Nenhuma operação corresponde ao filtro de centro de custo ou termo de busca informado."
                  actionLabel="Limpar Filtros"
                  onAction={() => {
                    setSearchOp('');
                    setMaquinaFilter('Todas');
                  }}
                />
              )
            ) : (
              filteredOperacoes.map((op) => (
                <div
                  key={op.id}
                  className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-slate-300 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {op.projeto?.codigo}
                      </span>
                      <span className="text-slate-300">·</span>
                      {op.componente?.codigo && (
                        <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {op.componente.codigo}
                        </span>
                      )}
                      <span className="text-xs font-semibold text-slate-700">
                        {op.componente?.nome}
                      </span>
                      <span className="rounded bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 font-mono text-[10px] font-bold">
                        Qtd: {op.componente?.quantidade || 1} un
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                        {op.componente?.material}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          op.status === 'Em andamento'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {op.status}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900">
                      Seq #{op.sequencia}: {op.descricao}
                    </h4>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Cpu className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-medium text-slate-700">{(op.centro_custo || op.maquina)?.nome}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>Estimadas: {formatHours(op.horas_estimadas)}</span>
                        <span>· Já apontadas: {formatHours(op.horasApontadas)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Botão Grande de Iniciar Apontamento */}
                  <button
                    type="button"
                    onClick={() => handleIniciarApontamento(op)}
                    disabled={isSubmitting}
                    className="flex min-h-[50px] shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-xs font-bold text-white shadow-xs transition-transform hover:bg-slate-800 active:scale-98 md:w-auto"
                  >
                    <Play className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span>Iniciar Apontamento</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ETAPA 3: HISTÓRICO DE APONTAMENTOS DO DIA DO OPERADOR                    */}
      {/* ========================================================================= */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <div className="flex flex-col gap-2 p-5 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 sm:text-base">
              Histórico de Apontamentos · {selectedOperador?.nome}
            </h3>
            <p className="text-xs text-slate-500">
              Registros computados no chão de fábrica com opção de ajuste manual por esquecimento
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMostrarApenasHoje(!mostrarApenasHoje)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                mostrarApenasHoje
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {mostrarApenasHoje ? 'Exibindo Apontamentos de Hoje' : 'Exibindo Todo o Histórico'}
            </button>
          </div>
        </div>

        {historicoOperador.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Clock}
              title="Nenhum apontamento registrado hoje"
              description={`O operador ${selectedOperador?.nome || ''} ainda não possui registros de início ou término computados para este filtro.`}
              actionLabel={mostrarApenasHoje ? "Exibir Todo o Histórico" : undefined}
              onAction={mostrarApenasHoje ? () => setMostrarApenasHoje(false) : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-medium">
                  <th className="py-3 px-4">Projeto & Peça</th>
                  <th className="py-3 px-4">Operação</th>
                  <th className="py-3 px-4">Centro de Custo</th>
                  <th className="py-3 px-4">Início</th>
                  <th className="py-3 px-4">Fim</th>
                  <th className="py-3 px-4 text-right">Duração</th>
                  <th className="py-3 px-4 text-center">Status / Registro</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {historicoOperador.map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-slate-900">
                        {apt.projeto?.codigo || '-'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {apt.componente?.nome || '-'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900 max-w-xs truncate">
                      {apt.operacao?.descricao || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Cpu className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{(apt.centro_custo || apt.maquina)?.nome || '-'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {formatDateTimeBR(apt.inicio)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {formatDateTimeBR(apt.fim)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatHours(apt.duracaoHoras)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {apt.fim ? (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            <span>Concluído</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 animate-pulse">
                            <span>Em curso</span>
                          </span>
                        )}
                        {apt.editado_manualmente && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded bg-amber-50 border border-amber-200 px-1.5 py-0.2 text-[10px] font-semibold text-amber-800"
                            title={`Ajuste manual: ${apt.motivo_edicao || 'Horário alterado'}`}
                          >
                            <Info className="h-2.5 w-2.5 text-amber-600" />
                            <span>Ajustado Manualmente</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {can('ajustar', 'apontamento') ? (
                        <button
                          type="button"
                          onClick={() => handleOpenAjusteModal(apt)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                          title="Ajustar horário de início/fim em caso de esquecimento"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>Ajustar</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL DE FINALIZAÇÃO DE APONTAMENTO                                       */}
      {/* ========================================================================= */}
      <Modal
        isOpen={finalizarModal.isOpen}
        onClose={() =>
          setFinalizarModal({ isOpen: false, apontamento: null, concluirOperacao: true })
        }
        title="Finalizar Apontamento de Usinagem"
        subtitle="Confirme o encerramento do turno neste centro de custo"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Tempo Registrado Nesta Etapa:</span>
              <span className="font-mono text-base font-bold text-slate-900">
                {formatStopwatch(elapsedSeconds)}
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-700">
              <strong>Operação:</strong> {finalizarModal.apontamento?.operacao?.descricao}
            </div>
            <div className="text-xs text-slate-500">
              Peça: {finalizarModal.apontamento?.componente?.nome} ·{' '}
              {(finalizarModal.apontamento?.centro_custo || finalizarModal.apontamento?.maquina)?.nome}
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
            <span className="block text-xs font-bold text-blue-900">
              A operação foi concluída nesta etapa?
            </span>
            <p className="mt-0.5 text-xs text-blue-700">
              Indique se a usinagem da operação foi 100% finalizada ou se ainda necessitará de
              novos apontamentos posteriormente.
            </p>

            <div className="mt-3 space-y-2">
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-blue-200 bg-white p-3 transition-colors hover:bg-blue-50/50">
                <input
                  type="radio"
                  name="conclusao"
                  checked={finalizarModal.concluirOperacao === true}
                  onChange={() =>
                    setFinalizarModal((prev) => ({ ...prev, concluirOperacao: true }))
                  }
                  className="mt-0.5"
                />
                <div className="text-xs">
                  <strong className="block font-bold text-slate-900">
                    Sim, operação concluída 100%
                  </strong>
                  <span className="text-slate-500">
                    O status passará para "Concluída". Se todas as operações desta peça forem
                    concluídas, o componente será marcado como Concluído automaticamente.
                  </span>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50">
                <input
                  type="radio"
                  name="conclusao"
                  checked={finalizarModal.concluirOperacao === false}
                  onChange={() =>
                    setFinalizarModal((prev) => ({ ...prev, concluirOperacao: false }))
                  }
                  className="mt-0.5"
                />
                <div className="text-xs">
                  <strong className="block font-bold text-slate-900">
                    Não, operação continua Em Andamento
                  </strong>
                  <span className="text-slate-500">
                    Pausa para refeição, troca de turno ou aguardo de nova ferramenta. A operação
                    permanecerá disponível para novos apontamentos.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() =>
                setFinalizarModal({ isOpen: false, apontamento: null, concluirOperacao: true })
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmFinalizar}
              disabled={isSubmitting}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
            >
              <Square className="h-4 w-4 fill-white" />
              <span>Confirmar e Registrar Término</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL DE AJUSTE MANUAL DE INÍCIO / FIM (ESQUECIMENTO)                     */}
      {/* ========================================================================= */}
      <Modal
        isOpen={ajusteModal.isOpen}
        onClose={() =>
          setAjusteModal({
            isOpen: false,
            apontamento: null,
            inicioStr: '',
            fimStr: '',
            motivo: '',
          })
        }
        title="Ajuste Manual de Horário"
        subtitle="Corrija horários de início ou fim em caso de esquecimento de acionamento do tablet"
        maxWidth="md"
      >
        <div className="space-y-4">
          {ajusteModal.error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-semibold">
              {ajusteModal.error}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <div>
              <strong>Operador:</strong> {ajusteModal.apontamento?.operador?.nome}
            </div>
            <div>
              <strong>Centro de Custo:</strong> {(ajusteModal.apontamento?.centro_custo || ajusteModal.apontamento?.maquina)?.nome}
            </div>
            <div>
              <strong>Operação:</strong> {ajusteModal.apontamento?.operacao?.descricao}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Horário de Início <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={ajusteModal.inicioStr}
                onChange={(e) =>
                  setAjusteModal({ ...ajusteModal, inicioStr: e.target.value, error: undefined })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Horário de Término
              </label>
              <input
                type="datetime-local"
                value={ajusteModal.fimStr}
                onChange={(e) =>
                  setAjusteModal({ ...ajusteModal, fimStr: e.target.value, error: undefined })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400">Deixe em branco se ainda em curso</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Motivo do Ajuste Manual <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Esquecimento de acionar o tablet no início do turno"
              value={ajusteModal.motivo}
              onChange={(e) =>
                setAjusteModal({ ...ajusteModal, motivo: e.target.value, error: undefined })
              }
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              O ajuste será auditado e sinalizado no histórico como "Ajustado Manualmente".
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() =>
                setAjusteModal({
                  isOpen: false,
                  apontamento: null,
                  inicioStr: '',
                  fimStr: '',
                  motivo: '',
                })
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmAjuste}
              disabled={isSubmitting}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              <span>Salvar Ajuste de Horário</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
