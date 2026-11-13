import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ApontamentoComOperador,
  Operador,
  Maquina,
  CentroCusto,
  OperacaoComDetalhes,
  ConfiguracoesSistema,
} from '../types';
import { toolShopService } from '../services/toolShopService';
import { comprasService } from '../services/comprasService';
import { Modal } from '../components/common/Modal';
import { FeedbackAlert } from '../components/common/FeedbackAlert';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../auth/AuthContext';
import { isExampleItem } from '../data/seedData';
import {
  Play,
  Square,
  Clock,
  User,
  Cpu,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Layers,
  Edit2,
  Check,
  Search,
  Filter,
  ShieldAlert,
  ArrowRight,
  Info,
  CalendarDays,
  Hash,
  FileText,
  BookOpen,
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

  // Sanitiza as propriedades recebidas para nunca incluir resquícios de exemplos ou seeds
  const validOperadores = useMemo(
    () => (operadores || []).filter((o) => !isExampleItem(o)),
    [operadores]
  );
  const validMaquinas = useMemo(
    () => (maquinas || []).filter((m) => !isExampleItem(m)),
    [maquinas]
  );
  const validApontamentos = useMemo(
    () => (apontamentos || []).filter((a) => !isExampleItem(a)),
    [apontamentos]
  );

  // Se o usuário logado for operador e tiver operador_id associado, fixa nele
  const initialOpId = useMemo(() => {
    if (perfil === 'operador' && user?.operador_id) {
      return user.operador_id;
    }
    return validOperadores[0]?.id || '';
  }, [perfil, user, validOperadores]);

  // Operador ativo no tablet
  const [selectedOperadorId, setSelectedOperadorId] = useState<string>(initialOpId);

  useEffect(() => {
    if (perfil === 'operador' && user?.operador_id) {
      setSelectedOperadorId(user.operador_id);
    }
  }, [perfil, user]);

  // Purga imediata de resquícios de exemplos ao montar a aba de Apontamentos
  useEffect(() => {
    toolShopService.apagarDadosDeExemplo().catch(console.warn);
  }, []);

  // Operadores visíveis na seleção (operador só vê a si mesmo no tablet; líderes e gerência veem todos)
  const visibleOperadores = useMemo(() => {
    if (perfil === 'operador' && user?.operador_id) {
      const match = validOperadores.filter((op) => op.id === user.operador_id);
      if (match.length > 0) return match;
    }
    return validOperadores;
  }, [validOperadores, perfil, user]);

  // Operador atualmente selecionado
  const selectedOperador = useMemo(() => {
    return (
      validOperadores.find((o) => o.id === selectedOperadorId) ||
      (perfil === 'operador' && user?.operador_id
        ? validOperadores.find((o) => o.id === user.operador_id)
        : null) ||
      validOperadores[0] ||
      null
    );
  }, [validOperadores, selectedOperadorId, perfil, user]);

  // Postos de trabalho vinculados ao operador selecionado
  const [operatorWorkstationIds, setOperatorWorkstationIds] = useState<string[]>([]);
  const [isLoadingWorkstations, setIsLoadingWorkstations] = useState(false);

  const loadOperatorWorkstations = useCallback(async (opId: string) => {
    if (!opId) {
      setOperatorWorkstationIds([]);
      return;
    }
    setIsLoadingWorkstations(true);
    try {
      const postos = await toolShopService.getCentrosCustoDoOperador(opId);
      setOperatorWorkstationIds(postos);
    } catch (err) {
      console.error('Erro ao buscar postos do operador:', err);
    } finally {
      setIsLoadingWorkstations(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOperador?.id) {
      loadOperatorWorkstations(selectedOperador.id);
    }
  }, [selectedOperador?.id, loadOperatorWorkstations]);

  // Lista enriquecida de Centros de Custo que são postos vinculados
  const operatorWorkstations = useMemo(() => {
    const postosSet = new Set(operatorWorkstationIds);
    return validMaquinas.filter((m) => postosSet.has(m.id) && m.origem === 'interno');
  }, [validMaquinas, operatorWorkstationIds]);

  // Lista de operações disponíveis carregadas
  const [operacoesDisponiveis, setOperacoesDisponiveis] = useState<OperacaoComDetalhes[]>([]);
  const [isLoadingOps, setIsLoadingOps] = useState(false);
  const [searchOp, setSearchOp] = useState('');
  const [maquinaFilter, setMaquinaFilter] = useState<string>('Todas');

  // Configurações do sistema para verificação de avisos (ex.: material pendente)
  const [configuracoes, setConfiguracoes] = useState<ConfiguracoesSistema | null>(null);
  const [materialRecebidoSet, setMaterialRecebidoSet] = useState<Set<string>>(new Set());

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

  // Painel de Leitura de Instruções (Plano de Fabricação)
  const [leituraInstrucoes, setLeituraInstrucoes] = useState<{
    isOpen: boolean;
    op?: OperacaoComDetalhes;
    title: string;
    componenteNome?: string;
    projetoCodigo?: string;
    instrucoes: string;
    centroCustoNome?: string;
    sequencia?: number;
    horasEstimadas?: number;
  } | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Apontamento ativo do operador selecionado (se houver) - permanece visível e finalizável mesmo se o posto for desvinculado
  const activeApontamento = useMemo(() => {
    if (!selectedOperador) return null;
    return validApontamentos.find((a) => a.operador_id === selectedOperador.id && !a.fim) || null;
  }, [validApontamentos, selectedOperador]);

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

  // Carrega operações disponíveis respeitando regras de postos e perfil no serviço
  const loadOperacoesDisponiveis = useCallback(async () => {
    setIsLoadingOps(true);
    try {
      const targetOpId =
        perfil === 'operador' && user?.operador_id ? user.operador_id : selectedOperador?.id;
      const ops = await toolShopService.getOperacoesDisponiveis(undefined, user, targetOpId);
      setOperacoesDisponiveis(ops.filter((o) => !isExampleItem(o)));
    } catch (err) {
      console.error('Erro ao carregar operações disponíveis:', err);
    } finally {
      setIsLoadingOps(false);
    }
  }, [user, selectedOperador?.id, perfil]);

  useEffect(() => {
    loadOperacoesDisponiveis();
  }, [validApontamentos, selectedOperador?.id, loadOperacoesDisponiveis]);

  // Carrega configurações e status de recebimento de materiais para avisos visuais
  useEffect(() => {
    toolShopService.getConfiguracoes().then(setConfiguracoes).catch(console.warn);
    comprasService
      .getItensCompra()
      .then((itens) => {
        const recebidos = new Set<string>();
        itens.forEach((it) => {
          if (
            it.tipo === 'materia_prima' &&
            it.componente_id &&
            (it.status === 'recebido' || it.status === 'atendido_estoque')
          ) {
            recebidos.add(it.componente_id);
          }
        });
        setMaterialRecebidoSet(recebidos);
      })
      .catch((err) =>
        console.warn('Erro ao carregar status de matéria-prima para apontamento:', err)
      );
  }, []);

  // Histórico de apontamentos do dia do operador selecionado
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [mostrarApenasHoje, setMostrarApenasHoje] = useState(true);

  const historicoOperador = useMemo(() => {
    if (!selectedOperador) return [];
    return validApontamentos.filter((a) => {
      if (a.operador_id !== selectedOperador.id) return false;
      if (!mostrarApenasHoje) return true;
      const aptDate = a.inicio.split('T')[0];
      return aptDate === todayStr;
    });
  }, [validApontamentos, selectedOperador, mostrarApenasHoje, todayStr]);

  // Filtragem e Ordenação de operações disponíveis:
  // 1º critério de ordenação: Prazo do projeto (mais próximo primeiro)
  // 2º critério de ordenação: Sequência da operação (sequencia crescente)
  const filteredOperacoes = useMemo(() => {
    return operacoesDisponiveis
      .filter((op) => {
        const matchesSearch =
          !searchOp.trim() ||
          op.descricao.toLowerCase().includes(searchOp.toLowerCase()) ||
          (op.componente?.nome &&
            op.componente.nome.toLowerCase().includes(searchOp.toLowerCase())) ||
          (op.projeto?.codigo &&
            op.projeto.codigo.toLowerCase().includes(searchOp.toLowerCase()));

        if (!matchesSearch) return false;

        // Filtro de centro de custo para líder, gerente e admin
        if (perfil !== 'operador') {
          if (maquinaFilter === 'Todas') return true;
          if (maquinaFilter === 'sem_centro') {
            return !op.centro_custo_id && !op.maquina_id;
          }
          return op.centro_custo_id === maquinaFilter || op.maquina_id === maquinaFilter;
        }

        return true;
      })
      .sort((a, b) => {
        // Ordena por prazo do projeto primeiro (mais próximo / urgente primeiro)
        const prazoA = a.projeto?.prazo || '9999-12-31';
        const prazoB = b.projeto?.prazo || '9999-12-31';
        const diffPrazo = prazoA.localeCompare(prazoB);
        if (diffPrazo !== 0) return diffPrazo;

        // Em seguida pela sequência da operação
        return (a.sequencia || 0) - (b.sequencia || 0);
      });
  }, [operacoesDisponiveis, searchOp, maquinaFilter, perfil]);

  // Agrupamento por posto quando o perfil for operador e houver mais de um posto vinculado
  const operacoesAgrupadasPorPosto = useMemo(() => {
    if (perfil !== 'operador' || operatorWorkstations.length <= 1) {
      return null;
    }

    const groups: { centro: CentroCusto; operacoes: OperacaoComDetalhes[] }[] = [];

    operatorWorkstations.forEach((centro) => {
      const ops = filteredOperacoes.filter(
        (o) => (o.centro_custo_id || o.maquina_id) === centro.id
      );
      groups.push({ centro, operacoes: ops });
    });

    return groups;
  }, [perfil, operatorWorkstations, filteredOperacoes]);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

  // --- INICIAR APONTAMENTO (COM VERIFICAÇÃO DE VÍNCULO NO SERVIÇO) ---
  const handleIniciarApontamento = async (operacao: OperacaoComDetalhes) => {
    if (!selectedOperador) {
      showFeedback('error', 'Selecione um operador antes de iniciar.');
      return;
    }

    setIsSubmitting(true);
    try {
      await toolShopService.iniciarApontamento(operacao.id, selectedOperador.id, user);
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
    const toLocalDatetime = (isoStr: string) => {
      const d = new Date(isoStr);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
      )}:${pad(d.getMinutes())}`;
    };

    setAjusteModal({
      isOpen: true,
      apontamento: apt,
      inicioStr: toLocalDatetime(apt.inicio),
      fimStr: apt.fim ? toLocalDatetime(apt.fim) : '',
      motivo: apt.motivo_edicao || '',
      error: undefined,
    });
  };

  const handleSaveAjuste = async () => {
    if (!ajusteModal.apontamento) return;

    if (!ajusteModal.inicioStr) {
      setAjusteModal((prev) => ({ ...prev, error: 'Horário de início é obrigatório.' }));
      return;
    }

    if (!ajusteModal.motivo.trim()) {
      setAjusteModal((prev) => ({
        ...prev,
        error: 'A justificativa do ajuste manual é obrigatória para fins de auditoria.',
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

  // Componente que renderiza um card de operação elegível
  const renderOperationCard = (op: OperacaoComDetalhes) => (
    <div
      key={op.id}
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-slate-300 md:flex-row md:items-center md:justify-between"
    >
      <div className="space-y-1.5 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* Código do Projeto */}
          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            {op.projeto?.codigo || 'PROJETO'}
          </span>

          {/* Prazo do Projeto */}
          {op.projeto?.prazo && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
              <CalendarDays className="h-3 w-3 text-amber-600" />
              <span>Prazo: {op.projeto.prazo}</span>
            </span>
          )}

          {/* Peça / Componente */}
          <span className="text-xs font-semibold text-slate-700">
            Peça: <strong>{op.componente?.nome}</strong>
          </span>

          {/* Quantidade */}
          <span className="rounded bg-slate-100 text-slate-800 border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-bold">
            Qtd: {op.componente?.quantidade || 1} un
          </span>

          {/* Material */}
          {op.componente?.material && (
            <span className="rounded bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 border border-slate-100">
              {op.componente.material}
            </span>
          )}

          {/* Status */}
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              op.status === 'Em andamento'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            {op.status}
          </span>

          {/* Alerta de Material Pendente (quando configurado no sistema) */}
          {configuracoes?.avisar_operador_material_pendente &&
            op.componente?.tipo !== 'comprado' &&
            op.componente?.tipo !== 'estoque' &&
            !materialRecebidoSet.has(op.componente_id || op.componente?.id || '') && (
              <span
                className="inline-flex items-center gap-1 rounded bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-900"
                title="A matéria-prima desta peça ainda não consta como recebida no almoxarifado/compras"
              >
                <AlertTriangle className="h-3 w-3 text-amber-700 shrink-0" />
                <span>Material não recebido</span>
              </span>
            )}
        </div>

        {/* Descrição e Sequência */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-0.5 font-mono text-xs font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
            <Hash className="h-3 w-3 text-slate-400" />
            <span>{op.sequencia}</span>
          </span>
          <h4
            className={`text-sm font-bold text-slate-900 ${
              op.instrucoes ? 'cursor-pointer hover:text-amber-800' : ''
            }`}
            onClick={() => {
              if (op.instrucoes) {
                setLeituraInstrucoes({
                  isOpen: true,
                  op,
                  title: op.descricao,
                  componenteNome: op.componente?.nome,
                  projetoCodigo: op.projeto?.codigo,
                  instrucoes: op.instrucoes,
                  centroCustoNome: (op.centro_custo || op.maquina)?.nome,
                  sequencia: op.sequencia,
                  horasEstimadas: op.horas_estimadas,
                });
              }
            }}
          >
            {op.descricao}
          </h4>

          {op.instrucoes && (
            <button
              type="button"
              onClick={() =>
                setLeituraInstrucoes({
                  isOpen: true,
                  op,
                  title: op.descricao,
                  componenteNome: op.componente?.nome,
                  projetoCodigo: op.projeto?.codigo,
                  instrucoes: op.instrucoes || '',
                  centroCustoNome: (op.centro_custo || op.maquina)?.nome,
                  sequencia: op.sequencia,
                  horasEstimadas: op.horas_estimadas,
                })
              }
              className="inline-flex items-center gap-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 text-[11px] font-bold transition-colors"
              title="Ler instruções técnicas de fabricação"
            >
              <FileText className="h-3.5 w-3.5 text-amber-600" />
              <span>Instruções (Plano)</span>
            </button>
          )}
        </div>

        {/* Centro de Custo e Horas */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-0.5">
          <div className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-medium text-slate-700">
              {(op.centro_custo || op.maquina)?.nome || (
                <span className="text-amber-700 font-semibold italic">Sem centro de custo</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>Estimadas: {formatHours(op.horas_estimadas)}</span>
            <span>· Apontadas: {formatHours(op.horasApontadas)}</span>
          </div>
        </div>
      </div>

      {/* Ações da Operação */}
      <div className="flex items-center gap-2 shrink-0 self-stretch md:self-center">
        {op.instrucoes && (
          <button
            type="button"
            onClick={() =>
              setLeituraInstrucoes({
                isOpen: true,
                op,
                title: op.descricao,
                componenteNome: op.componente?.nome,
                projetoCodigo: op.projeto?.codigo,
                instrucoes: op.instrucoes || '',
                centroCustoNome: (op.centro_custo || op.maquina)?.nome,
                sequencia: op.sequencia,
                horasEstimadas: op.horas_estimadas,
              })
            }
            className="flex min-h-[50px] items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-xs font-bold text-amber-950 shadow-2xs hover:bg-amber-100 active:scale-98 transition-all"
            title="Visualizar instruções e plano de fabricação antes de iniciar"
          >
            <FileText className="h-4 w-4 text-amber-700" />
            <span className="hidden sm:inline">Ver Instruções</span>
          </button>
        )}

        {/* Botão Grande de Iniciar Apontamento */}
        <button
          type="button"
          onClick={() => handleIniciarApontamento(op)}
          disabled={isSubmitting}
          className="flex min-h-[50px] flex-1 md:flex-initial items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-xs font-bold text-white shadow-xs transition-transform hover:bg-slate-800 active:scale-98"
        >
          <Play className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span>Iniciar Apontamento</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Alerta de Feedback Padronizado */}
      <FeedbackAlert feedback={feedback} onClose={() => setFeedback(null)} />


      {/* ========================================================================= */}
      {/* SEÇÃO 1: CABEÇALHO DO OPERADOR OU SELETOR DE EQUIPE                      */}
      {/* ========================================================================= */}
      {perfil === 'operador' ? (
        /* Topo Focado para Operador: Nome e Postos Vinculados */
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-amber-400 shadow-xs">
                <User className="h-6 w-6" />
              </div>
              <div>
                <span className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  Terminal de Chão de Fábrica · Operador Conectado
                </span>
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                  {selectedOperador?.nome || user?.nome}
                </h2>
              </div>
            </div>

            {/* Postos de Trabalho Vinculados */}
            <div className="flex flex-col items-start sm:items-end gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Seus Postos de Trabalho:
              </span>
              {operatorWorkstations.length === 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  <span>Nenhum posto vinculado</span>
                </span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {operatorWorkstations.map((cc) => (
                    <span
                      key={cc.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-2xs"
                    >
                      <Cpu className="h-3.5 w-3.5 text-slate-500" />
                      <span>{cc.nome}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Topo para Líder, Gerente e Admin: Escolha do Operador para Apontamento */
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-3">
            <div>
              <span className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                Chão de Fábrica · Gestão de Apontamentos
              </span>
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                Apontar em nome de qual operador?
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              Selecione o operador para iniciar ou finalizar o turno
            </span>
          </div>

          {/* Grade de Operadores com Alvos de Toque Amplos */}
          {visibleOperadores.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
              <User className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="font-semibold text-slate-700">Nenhum operador cadastrado no sistema</p>
              <p className="mt-1 text-slate-500">
                Cadastre operadores na aba "Operadores" para iniciar ou registrar apontamentos no chão de fábrica.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {visibleOperadores.map((op) => {
                const isSelected = selectedOperador?.id === op.id;
                const hasShift = validApontamentos.some((a) => a.operador_id === op.id && !a.fim);

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
                        isSelected
                          ? 'bg-slate-800 text-amber-400'
                          : 'bg-white text-slate-600 shadow-2xs'
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
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEÇÃO 2: CRONÔMETRO EM TEMPO REAL OU LISTA DE OPERAÇÕES                   */}
      {/* ========================================================================= */}
      {activeApontamento ? (
        /* CARD DE APONTAMENTO EM ANDAMENTO COM CRONÔMETRO GIGANTE (SEMPRE FINALIZÁVEL) */
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
                    {activeApontamento.centro_custo?.nome || activeApontamento.maquina?.nome}
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

              {/* Botão de Instruções / Plano de Fabricação durante o apontamento */}
              {activeApontamento.operacao?.instrucoes ? (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setLeituraInstrucoes({
                        isOpen: true,
                        title: activeApontamento.operacao?.descricao || 'Operação',
                        componenteNome: activeApontamento.componente?.nome,
                        projetoCodigo: activeApontamento.projeto?.codigo,
                        instrucoes: activeApontamento.operacao?.instrucoes || '',
                        centroCustoNome:
                          (activeApontamento.centro_custo || activeApontamento.maquina)?.nome,
                        sequencia: activeApontamento.operacao?.sequencia,
                        horasEstimadas: activeApontamento.operacao?.horas_estimadas,
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-400 text-slate-950 px-4 py-2 text-xs font-bold shadow-md hover:bg-amber-300 transition-colors"
                  >
                    <FileText className="h-4 w-4 text-slate-950" />
                    <span>Ver Instruções / Plano de Fabricação Desta Peça</span>
                  </button>
                </div>
              ) : null}
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
      ) : perfil === 'operador' && operatorWorkstations.length === 0 ? (
        /* ALERTA OBRIGATÓRIO: OPERADOR SEM NENHUM POSTO VINCULADO */
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-8 text-center text-amber-900 shadow-2xs">
          <AlertCircle className="mx-auto h-12 w-12 text-amber-600 mb-3" />
          <h3 className="text-base font-bold text-amber-950 sm:text-lg">
            Nenhum posto de trabalho vinculado ao seu usuário. Fale com seu líder.
          </h3>
          <p className="mt-1.5 text-xs text-amber-800 max-w-md mx-auto">
            Para iniciar apontamentos de usinagem no chão de fábrica, seu líder ou gerente industrial
            precisa atribuir os postos de trabalho autorizados no seu cadastro de operador.
          </p>
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
                {perfil === 'operador'
                  ? 'Operações ordenadas por prazo de entrega do projeto e sequência técnica'
                  : 'Selecione a operação abaixo e clique em "Iniciar" para registrar o início de usinagem'}
              </p>
            </div>

            {/* Filtro Rápido por Centro de Custo para Líder, Gerente e Admin */}
            {perfil !== 'operador' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Centro de Custo:</span>
                <select
                  value={maquinaFilter}
                  onChange={(e) => setMaquinaFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 shadow-2xs focus:outline-none"
                >
                  <option value="Todas">Todos os Centros de Custo</option>
                  <option value="sem_centro">Sem centro de custo</option>
                  {validMaquinas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.origem === 'terceirizado' ? 'Terceiro' : 'Interno'})
                    </option>
                  ))}
                </select>
              </div>
            )}
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

          {/* Lista de Cards de Operações */}
          <div className="mt-4 space-y-4">
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
            ) : operacoesAgrupadasPorPosto ? (
              /* MODO AGRUPADO POR POSTO DE TRABALHO QUANDO O OPERADOR TEM MAIS DE 1 POSTO */
              <div className="space-y-6">
                {operacoesAgrupadasPorPosto.map(({ centro, operacoes }) => (
                  <div
                    key={centro.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-slate-700" />
                        <h4 className="text-sm font-bold text-slate-900">{centro.nome}</h4>
                        <span className="text-[11px] font-semibold text-slate-500">
                          ({centro.categoria})
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">
                        {operacoes.length} operação(ões) aguardando
                      </span>
                    </div>

                    {operacoes.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">
                        Nenhuma operação pendente para este posto no momento.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {operacoes.map(renderOperationCard)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* LISTA PADRÃO ORDENADA POR PRAZO E DEPOIS POR SEQUÊNCIA */
              <div className="space-y-3">
                {filteredOperacoes.map(renderOperationCard)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEÇÃO 3: HISTÓRICO DE APONTAMENTOS DO DIA DO OPERADOR                    */}
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
              actionLabel={mostrarApenasHoje ? 'Exibir Todo o Histórico' : undefined}
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
        subtitle="Confirme o encerramento da contagem de tempo para esta tarefa"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="text-xs text-slate-500 font-medium">Tarefa em Execução:</div>
            <div className="font-mono text-xs font-bold text-slate-900">
              {finalizarModal.apontamento?.projeto?.codigo} ·{' '}
              {finalizarModal.apontamento?.componente?.nome}
            </div>
            <div className="text-sm font-bold text-slate-900">
              {finalizarModal.apontamento?.operacao?.descricao}
            </div>
            <div className="text-xs text-slate-600">
              Operador: <strong>{selectedOperador?.nome}</strong> · Posto:{' '}
              <strong>
                {finalizarModal.apontamento?.centro_custo?.nome ||
                  finalizarModal.apontamento?.maquina?.nome}
              </strong>
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 hover:bg-slate-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={finalizarModal.concluirOperacao}
              onChange={(e) =>
                setFinalizarModal((prev) => ({ ...prev, concluirOperacao: e.target.checked }))
              }
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <div className="text-xs">
              <span className="font-bold text-slate-900 block">
                Marcar esta Operação como CONCLUÍDA
              </span>
              <span className="text-slate-500 block mt-0.5">
                Desmarque apenas se a operação precisará continuar em outro turno ou após parada.
              </span>
            </div>
          </label>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() =>
                setFinalizarModal({ isOpen: false, apontamento: null, concluirOperacao: true })
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmFinalizar}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Finalizando...' : 'Confirmar e Finalizar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL DE AJUSTE MANUAL DE HORÁRIO (COM AUDITORIA)                        */}
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
        title="Ajustar Horário de Apontamento"
        subtitle="Correção manual de horário em caso de esquecimento de início ou término de turno"
        maxWidth="md"
      >
        <div className="space-y-4">
          {ajusteModal.error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{ajusteModal.error}</span>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
            <div>
              Operador: <strong>{selectedOperador?.nome}</strong>
            </div>
            <div>
              Operação: <strong>{ajusteModal.apontamento?.operacao?.descricao}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Início do Turno <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={ajusteModal.inicioStr}
                onChange={(e) =>
                  setAjusteModal((prev) => ({ ...prev, inicioStr: e.target.value, error: undefined }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Término do Turno (ou deixe vazio se ainda em curso)
              </label>
              <input
                type="datetime-local"
                value={ajusteModal.fimStr}
                onChange={(e) =>
                  setAjusteModal((prev) => ({ ...prev, fimStr: e.target.value, error: undefined }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Justificativa do Ajuste Manual <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Operador iniciou usinagem às 08h mas esqueceu de registrar no tablet..."
              value={ajusteModal.motivo}
              onChange={(e) =>
                setAjusteModal((prev) => ({ ...prev, motivo: e.target.value, error: undefined }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Esta justificativa ficará gravada no log de auditoria do apontamento.
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
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSaveAjuste}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Ajuste'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL DE LEITURA DE INSTRUÇÕES DE EXECUÇÃO (PLANO DE FABRICAÇÃO)         */}
      {/* ========================================================================= */}
      {leituraInstrucoes && (
        <Modal
          isOpen={leituraInstrucoes.isOpen}
          onClose={() => setLeituraInstrucoes(null)}
          title={`Plano de Fabricação: ${leituraInstrucoes.title}`}
          subtitle={`Projeto: ${leituraInstrucoes.projetoCodigo || '—'} · Peça: ${leituraInstrucoes.componenteNome || '—'}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            {/* Cabeçalho Técnico da Operação */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-800 bg-white border border-slate-300 rounded px-2 py-0.5">
                  Seq {leituraInstrucoes.sequencia || '—'}
                </span>
                <span className="font-semibold text-slate-700">
                  {leituraInstrucoes.centroCustoNome ? `Posto: ${leituraInstrucoes.centroCustoNome}` : ''}
                </span>
              </div>
              {leituraInstrucoes.horasEstimadas ? (
                <div className="flex items-center gap-1 font-mono text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Tempo Estimado: {formatHours(leituraInstrucoes.horasEstimadas)}</span>
                </div>
              ) : null}
            </div>

            {/* Painel de Leitura com fonte legível, monospace e rolagem */}
            <div className="rounded-xl border-2 border-slate-800 bg-slate-900 p-4 text-slate-100 shadow-inner">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <span className="text-[11px] font-bold tracking-wider uppercase text-amber-400 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Instruções Técnicas de Execução</span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {leituraInstrucoes.instrucoes.length} caracteres
                </span>
              </div>

              {leituraInstrucoes.instrucoes ? (
                <div className="max-h-[55vh] overflow-y-auto pr-2 font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-wrap select-text text-amber-50">
                  {leituraInstrucoes.instrucoes}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-slate-400 italic">
                  Nenhuma instrução específica cadastrada para esta operação.
                </div>
              )}
            </div>

            {/* Botões do Rodapé */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setLeituraInstrucoes(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fechar Leitura
              </button>

              {leituraInstrucoes.op && !activeApontamento && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    const opToStart = leituraInstrucoes.op;
                    setLeituraInstrucoes(null);
                    if (opToStart) {
                      handleIniciarApontamento(opToStart);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 active:scale-98"
                >
                  <Play className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span>Iniciar Apontamento Desta Operação</span>
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
