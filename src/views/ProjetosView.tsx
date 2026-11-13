import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ProjetoComDetalhes,
  ComponenteComOperacoes,
  OperacaoComDetalhes,
  Cliente,
  Maquina,
  CentroCusto,
  Operacao,
  StatusProjeto,
  StatusComponente,
  StatusOperacao,
  ModeloComponente,
  ModeloOperacao,
  TipoComponente,
  ConfiguracoesSistema,
  ItemCompra,
  StatusItemCompra,
  ItemEstoqueComDetalhes,
} from '../types';
import { toolShopService } from '../services/toolShopService';
import { comprasService } from '../services/comprasService';
import { estoqueService } from '../services/estoqueService';
import { ProjetoComprasTab } from '../components/compras/ProjetoComprasTab';
import { RetirarMaterialModal } from '../components/projetos/RetirarMaterialModal';
import { RegistrarSobraModal } from '../components/estoque/RegistrarSobraModal';
import { Modal } from '../components/common/Modal';
import { ConfirmDeleteModal } from '../components/common/ConfirmDeleteModal';
import { FeedbackAlert } from '../components/common/FeedbackAlert';
import { EmptyState } from '../components/common/EmptyState';
import { FolhaProcessosModal } from '../components/common/FolhaProcessosModal';
import { calcularPesoBloco, formatarPesoKg } from '../utils/weightCalculator';
import { exportProjetosToCSV } from '../utils/csvExport';
import { useAuth } from '../auth/AuthContext';
import {
  downloadPlanilhaModeloComponentes,
  parseArquivoComponentes,
  LinhaImportComponente,
  BlocoProjetoPlanilha,
  normalizeString,
} from '../utils/excelImport';
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  Calendar,
  AlertTriangle,
  Clock,
  Cpu,
  Layers,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  CheckCircle2,
  Clock3,
  Check,
  AlertCircle,
  Download,
  FileSpreadsheet,
  Inbox,
  Wrench,
  Upload,
  BookOpen,
  Printer,
  FileText,
  RefreshCw,
  X,
  SlidersHorizontal,
  Send,
  Truck,
  PackageCheck,
  ShoppingCart,
  Scissors,
} from 'lucide-react';
import { formatDateBR, formatHours, formatCurrencyBRL } from '../utils/formatters';

interface ProjetosViewProps {
  projetos: ProjetoComDetalhes[];
  clientes: Cliente[];
  maquinas: Maquina[];
  onRefresh: () => void;
}

const STATUS_PROJETO_OPTIONS: StatusProjeto[] = [
  'Aguardando',
  'Em andamento',
  'Em tryout',
  'Concluído',
  'Cancelado',
];

const STATUS_COMPONENTE_OPTIONS: StatusComponente[] = [
  'Pendente',
  'Em produção',
  'Concluído',
];

const STATUS_OPERACAO_OPTIONS: StatusOperacao[] = [
  'Pendente',
  'Em andamento',
  'Concluída',
];

export const ProjetosView: React.FC<ProjetosViewProps> = ({
  projetos,
  clientes,
  maquinas,
  onRefresh,
}) => {
  const { user, perfil, can } = useAuth();
  const canCreate = can('criar', 'projetos');
  const canEdit = can('editar', 'projetos');
  const canDelete = can('excluir', 'projetos');
  const canViewCustos = can('ver', 'custos');
  const canImport = can('importar', 'projetos');
  const canManageTerceiros = user?.perfil === 'admin' || user?.perfil === 'gerente' || user?.perfil === 'lider';

  // Biblioteca de modelos para reconhecimento e auto-preenchimento
  const [modelosBiblioteca, setModelosBiblioteca] = useState<ModeloComponente[]>([]);

  useEffect(() => {
    toolShopService.getModelos().then(setModelosBiblioteca).catch(console.error);
  }, []);

  // Navegação: null = lista de projetos, string = ID do projeto em detalhe
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Aba ativa dentro do projeto selecionado: 'componentes' | 'compras'
  const [abaProjeto, setAbaProjeto] = useState<'componentes' | 'compras'>('componentes');
  const [materialStatusMap, setMaterialStatusMap] = useState<
    Map<string, { status: StatusItemCompra; atrasado: boolean; item: ItemCompra }>
  >(new Map());

  // Atualiza mapa de status de materiais ao selecionar projeto
  useEffect(() => {
    if (!selectedProjectId) {
      setMaterialStatusMap(new Map());
      setAbaProjeto('componentes');
      setCustoMaterialEstoque(0);
      return;
    }
    comprasService
      .getMapStatusMaterialComponentes(selectedProjectId)
      .then((map) => setMaterialStatusMap(map))
      .catch((err) => console.error('Erro ao carregar status de material:', err));

    carregarDadosEstoqueProjeto(selectedProjectId);
  }, [selectedProjectId]);

  // Estados para integração Estoque & Produção
  const [custoMaterialEstoque, setCustoMaterialEstoque] = useState<number>(0);
  const [retirarMaterialComponente, setRetirarMaterialComponente] = useState<ComponenteComOperacoes | null>(null);
  const [sobraComponente, setSobraComponente] = useState<ComponenteComOperacoes | null>(null);
  const [itensEstoqueDisponiveis, setItensEstoqueDisponiveis] = useState<ItemEstoqueComDetalhes[]>([]);

  const carregarDadosEstoqueProjeto = async (projId: string) => {
    try {
      const [custo, itens] = await Promise.all([
        estoqueService.getCustoMaterialProjeto(projId),
        estoqueService.getItensComDetalhes(),
      ]);
      setCustoMaterialEstoque(custo);
      setItensEstoqueDisponiveis(itens);
    } catch (err) {
      console.warn('Erro ao carregar dados de estoque do projeto:', err);
    }
  };

  const renderMaterialStatusBadge = (componenteId: string) => {
    const mat = materialStatusMap.get(componenteId);
    if (!mat) {
      return (
        <span className="inline-block rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
          Material: Pendente
        </span>
      );
    }

    if (mat.atrasado) {
      return (
        <span className="inline-flex items-center gap-1 rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">
          <AlertTriangle className="h-2.5 w-2.5 text-rose-600 shrink-0" />
          <span>Material: Atrasado</span>
        </span>
      );
    }

    switch (mat.status) {
      case 'recebido':
        return (
          <span className="inline-block rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800">
            Material: Recebido
          </span>
        );
      case 'comprado':
        return (
          <span className="inline-block rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-900">
            Material: Comprado
          </span>
        );
      case 'solicitado':
        return (
          <span className="inline-block rounded border border-blue-300 bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-800">
            Material: Solicitado
          </span>
        );
      case 'atendido_estoque':
        return (
          <span className="inline-block rounded border border-teal-300 bg-teal-50 px-1.5 py-0.5 text-[9px] font-semibold text-teal-800">
            Material: Estoque
          </span>
        );
      case 'a_solicitar':
      default:
        return (
          <span className="inline-block rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
            Material: Pendente
          </span>
        );
    }
  };

  // Estados de Filtro e Busca na Lista
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | StatusProjeto>('Todos');
  const [clienteFilter, setClienteFilter] = useState<string>('Todos');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Componentes expandidos no Detalhe do Projeto (map de componenteId -> boolean)
  const [expandedComponents, setExpandedComponents] = useState<Record<string, boolean>>({});

  // --- CONFIGURAÇÃO DA EMPRESA (FOLHA DE PROCESSOS) ---
  const [configEmpresa, setConfigEmpresa] = useState<ConfiguracoesSistema | null>(null);

  useEffect(() => {
    toolShopService.getConfiguracoes().then(setConfigEmpresa).catch(console.warn);
  }, []);

  // --- MODAIS DE PROJETO ---
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjetoComDetalhes | null>(null);
  const [projectForm, setProjectForm] = useState({
    codigo: '',
    orcamento_codigo: '',
    planejador: '',
    cliente_id: '',
    descricao: '',
    prazo: '',
    status: 'Aguardando' as StatusProjeto,
  });
  const [projectErrors, setProjectErrors] = useState<{ [key: string]: string }>({});

  // --- MODAIS DE COMPONENTE ---
  const [isComponentModalOpen, setIsComponentModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<{
    projetoId: string;
    componente?: ComponenteComOperacoes;
  } | null>(null);
  const [componentForm, setComponentForm] = useState({
    codigo: '',
    nome: '',
    quantidade: '1',
    material: '',
    formato: 'BLOCO',
    dimensoes: '',
    peso_kg: '',
    peso_calculado: false,
    tratamento: '',
    observacoes: '',
    status: 'Pendente' as StatusComponente,
    modeloOrigemId: '',
  });
  const [componentErrors, setComponentErrors] = useState<{ [key: string]: string }>({});

  // --- MODAL DE IMPORTAÇÃO DE COMPONENTES (.XLSX / .CSV) ---
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isParsingImport, setIsParsingImport] = useState(false);
  const [isSavingImport, setIsSavingImport] = useState(false);
  const [importLinhas, setImportLinhas] = useState<LinhaImportComponente[]>([]);
  const [importErrosGerais, setImportErrosGerais] = useState<string[]>([]);
  const [importBlocoProjeto, setImportBlocoProjeto] = useState<BlocoProjetoPlanilha | null>(null);
  const [confirmDivergenciaOS, setConfirmDivergenciaOS] = useState<boolean>(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // --- MODAL FOLHA DE PROCESSOS TÉCNICA (PROJETO OU COMPONENTE) ---
  const [folhaProcessoTarget, setFolhaProcessoTarget] = useState<{
    tipo: 'projeto' | 'componente';
    projeto: ProjetoComDetalhes;
    componente?: ComponenteComOperacoes;
  } | null>(null);

  // --- MODAIS DE OPERAÇÃO ---
  const [isOperationModalOpen, setIsOperationModalOpen] = useState(false);
  const [editingOperation, setEditingOperation] = useState<{
    componenteId: string;
    operacao?: OperacaoComDetalhes;
  } | null>(null);
  const [operationForm, setOperationForm] = useState({
    descricao: '',
    instrucoes: '',
    maquina_id: '',
    horas_estimadas: '',
    sequencia: '',
    status: 'Pendente' as StatusOperacao,
    prazo_dias: '',
    peso_kg: '',
    fornecedor: '',
    valor_orcado: '',
    observacoes: '',
  });
  const [operationErrors, setOperationErrors] = useState<{ [key: string]: string }>({});
  const [expandedInstructions, setExpandedInstructions] = useState<Record<string, boolean>>({});

  // Modais de Envio e Retorno para Centros Terceirizados
  const [envioModal, setEnvioModal] = useState<{
    isOpen: boolean;
    componente: ComponenteComOperacoes;
    operacao: OperacaoComDetalhes;
    data_envio: string;
    documento: string;
    prazo_dias: string;
    fornecedor: string;
    observacoes: string;
  } | null>(null);

  const [retornoModal, setRetornoModal] = useState<{
    isOpen: boolean;
    componente: ComponenteComOperacoes;
    operacao: OperacaoComDetalhes;
    data_retorno_real: string;
    valor_real: string;
    documento: string;
    observacoes: string;
  } | null>(null);

  // --- MODAL DE EXCLUSÃO GENÉRICA ---
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    type: 'projeto' | 'componente' | 'operacao';
    id: string;
    name: string;
    reason?: string | null;
  }>({
    isOpen: false,
    type: 'projeto',
    id: '',
    name: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data atual de referência para cálculo de atraso
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const isProjectOverdue = (prazo: string, status: StatusProjeto) => {
    if (!prazo) return false;
    if (status === 'Concluído' || status === 'Cancelado') return false;
    return prazo < todayStr;
  };

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Projeto atualmente selecionado em detalhes
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projetos.find((p) => p.id === selectedProjectId) || null;
  }, [projetos, selectedProjectId]);

  // Filtragem da Lista de Projetos
  const filteredProjetos = useMemo(() => {
    return projetos.filter((proj) => {
      const matchSearch =
        proj.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        proj.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (proj.cliente?.nome && proj.cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchStatus = statusFilter === 'Todos' || proj.status === statusFilter;
      const matchCliente = clienteFilter === 'Todos' || proj.cliente_id === clienteFilter;
      return matchSearch && matchStatus && matchCliente;
    });
  }, [projetos, searchTerm, statusFilter, clienteFilter]);

  // --- CONTROLE DE VISUALIZAÇÃO E FILTRAGEM DE COMPONENTES ---
  const [selectedComponentIdForDetail, setSelectedComponentIdForDetail] = useState<string | null>(null);
  const [compSearchTerm, setCompSearchTerm] = useState('');
  const [compGrupoFilter, setCompGrupoFilter] = useState('Todos');
  const [compTipoFilter, setCompTipoFilter] = useState<'Todos' | TipoComponente>('Todos');
  const [compStatusFilter, setCompStatusFilter] = useState<'Todos' | StatusComponente>('Todos');
  const [compSemOperacoesFilter, setCompSemOperacoesFilter] = useState(false);
  const [isGroupedByGrupo, setIsGroupedByGrupo] = useState(false);
  const [collapsedGrupos, setCollapsedGrupos] = useState<Record<string, boolean>>({});
  const [compSortField, setCompSortField] = useState<
    'codigo' | 'nome' | 'tipo' | 'quantidade' | 'material' | 'dimensoes' | 'status' | 'operacoes' | 'horas'
  >('codigo');
  const [compSortDirection, setCompSortDirection] = useState<'asc' | 'desc'>('asc');

  // Helper para obter o grupo do componente (grupo || id_refer_pai || 'Geral')
  const getComponenteGrupo = (comp: ComponenteComOperacoes): string => {
    return (comp as any).grupo || comp.id_refer_pai || 'Geral';
  };

  // Grupos únicos disponíveis no projeto atual
  const gruposDisponiveis = useMemo(() => {
    if (!selectedProject) return [];
    const set = new Set<string>();
    selectedProject.componentes.forEach((c) => {
      set.add(getComponenteGrupo(c));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [selectedProject]);

  // Contadores analíticos dos componentes
  const compCounters = useMemo(() => {
    if (!selectedProject) {
      return { total: 0, fabricados: 0, comprados: 0, estoque: 0, fabricadosSemOperacoes: 0 };
    }
    const total = selectedProject.componentes.length;
    let fabricados = 0;
    let comprados = 0;
    let estoque = 0;
    let fabricadosSemOperacoes = 0;

    selectedProject.componentes.forEach((c) => {
      const isFabricado = !c.tipo || c.tipo === 'fabricado';
      if (isFabricado) {
        fabricados++;
        if (c.operacoes.length === 0) {
          fabricadosSemOperacoes++;
        }
      } else if (c.tipo === 'comprado') {
        comprados++;
      } else if (c.tipo === 'estoque') {
        estoque++;
      }
    });

    return { total, fabricados, comprados, estoque, fabricadosSemOperacoes };
  }, [selectedProject]);

  // Lista filtrada e ordenada de componentes
  const filteredComponentes = useMemo(() => {
    if (!selectedProject) return [];

    return selectedProject.componentes
      .filter((comp) => {
        // 1. Busca por código ou nome
        const q = compSearchTerm.trim().toLowerCase();
        if (q) {
          const matchCod = (comp.codigo || '').toLowerCase().includes(q);
          const matchNome = (comp.nome || '').toLowerCase().includes(q);
          if (!matchCod && !matchNome) return false;
        }

        // 2. Filtro por grupo
        if (compGrupoFilter !== 'Todos') {
          if (getComponenteGrupo(comp) !== compGrupoFilter) return false;
        }

        // 3. Filtro por tipo
        if (compTipoFilter !== 'Todos') {
          const t = comp.tipo || 'fabricado';
          if (t !== compTipoFilter) return false;
        }

        // 4. Filtro por status
        if (compStatusFilter !== 'Todos') {
          if (comp.status !== compStatusFilter) return false;
        }

        // 5. Somente sem operações (apenas fabricados sem operações)
        if (compSemOperacoesFilter) {
          const isFabricado = !comp.tipo || comp.tipo === 'fabricado';
          if (!isFabricado || comp.operacoes.length > 0) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        switch (compSortField) {
          case 'codigo': {
            const codA = a.codigo || '';
            const codB = b.codigo || '';
            cmp = codA.localeCompare(codB, 'pt-BR', { numeric: true, sensitivity: 'base' });
            break;
          }
          case 'nome':
            cmp = a.nome.localeCompare(b.nome, 'pt-BR');
            break;
          case 'tipo': {
            const tA = a.tipo || 'fabricado';
            const tB = b.tipo || 'fabricado';
            cmp = tA.localeCompare(tB, 'pt-BR');
            break;
          }
          case 'quantidade':
            cmp = (a.quantidade || 1) - (b.quantidade || 1);
            break;
          case 'material':
            cmp = (a.material || '').localeCompare(b.material || '', 'pt-BR');
            break;
          case 'dimensoes':
            cmp = (a.dimensoes || '').localeCompare(b.dimensoes || '', 'pt-BR');
            break;
          case 'status':
            cmp = (a.status || '').localeCompare(b.status || '', 'pt-BR');
            break;
          case 'operacoes':
            cmp = a.operacoes.length - b.operacoes.length;
            break;
          case 'horas': {
            const hA = a.operacoes.reduce((acc, o) => acc + (o.horas_estimadas || 0), 0);
            const hB = b.operacoes.reduce((acc, o) => acc + (o.horas_estimadas || 0), 0);
            cmp = hA - hB;
            break;
          }
        }
        return compSortDirection === 'asc' ? cmp : -cmp;
      });
  }, [
    selectedProject,
    compSearchTerm,
    compGrupoFilter,
    compTipoFilter,
    compStatusFilter,
    compSemOperacoesFilter,
    compSortField,
    compSortDirection,
  ]);

  // Agrupamento por grupo quando ativado
  const groupedComponentes = useMemo(() => {
    if (!isGroupedByGrupo) return null;
    const map = new Map<string, ComponenteComOperacoes[]>();
    filteredComponentes.forEach((c) => {
      const g = getComponenteGrupo(c);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(c);
    });
    return Array.from(map.entries()).sort(([g1], [g2]) => g1.localeCompare(g2, 'pt-BR'));
  }, [filteredComponentes, isGroupedByGrupo]);

  // Componente atualmente selecionado para exibição no painel lateral à direita
  const selectedComponentForDetail = useMemo(() => {
    if (!selectedComponentIdForDetail || !selectedProject) return null;
    return selectedProject.componentes.find((c) => c.id === selectedComponentIdForDetail) || null;
  }, [selectedProject, selectedComponentIdForDetail]);

  const currentCompIndex = useMemo(() => {
    if (!selectedComponentIdForDetail) return -1;
    return filteredComponentes.findIndex((c) => c.id === selectedComponentIdForDetail);
  }, [filteredComponentes, selectedComponentIdForDetail]);

  const hasPrevComp = currentCompIndex > 0;
  const hasNextComp = currentCompIndex >= 0 && currentCompIndex < filteredComponentes.length - 1;

  const handlePrevComp = () => {
    if (hasPrevComp) {
      setSelectedComponentIdForDetail(filteredComponentes[currentCompIndex - 1].id);
    }
  };

  const handleNextComp = () => {
    if (hasNextComp) {
      setSelectedComponentIdForDetail(filteredComponentes[currentCompIndex + 1].id);
    }
  };

  const handleToggleSort = (
    field: 'codigo' | 'nome' | 'tipo' | 'quantidade' | 'material' | 'dimensoes' | 'status' | 'operacoes' | 'horas'
  ) => {
    if (compSortField === field) {
      setCompSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setCompSortField(field);
      setCompSortDirection('asc');
    }
  };

  const toggleGroupCollapse = (grupoNome: string) => {
    setCollapsedGrupos((prev) => ({
      ...prev,
      [grupoNome]: !prev[grupoNome],
    }));
  };

  // Limpa seleção e filtros ao alternar projeto
  useEffect(() => {
    setSelectedComponentIdForDetail(null);
    setCompSearchTerm('');
    setCompGrupoFilter('Todos');
    setCompTipoFilter('Todos');
    setCompStatusFilter('Todos');
    setCompSemOperacoesFilter(false);
  }, [selectedProjectId]);

  // Tecla Escape para fechar o painel lateral
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (
          !isOperationModalOpen &&
          !isComponentModalOpen &&
          !deleteModalState.isOpen &&
          !folhaProcessoTarget &&
          !isImportModalOpen
        ) {
          setSelectedComponentIdForDetail(null);
        }
      }
    };
    if (selectedComponentIdForDetail) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [
    selectedComponentIdForDetail,
    isOperationModalOpen,
    isComponentModalOpen,
    deleteModalState.isOpen,
    folhaProcessoTarget,
    isImportModalOpen,
  ]);

  // --- HANDLERS DE PROJETO ---
  const handleOpenCreateProject = () => {
    setEditingProject(null);
    setProjectForm({
      codigo: `PRJ-${new Date().getFullYear()}-${String(projetos.length + 1).padStart(3, '0')}`,
      orcamento_codigo: '',
      planejador: '',
      cliente_id: clientes[0]?.id || '',
      descricao: '',
      prazo: '',
      status: 'Aguardando',
    });
    setProjectErrors({});
    setIsProjectModalOpen(true);
  };

  const handleOpenEditProject = (proj: ProjetoComDetalhes, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingProject(proj);
    setProjectForm({
      codigo: proj.codigo,
      orcamento_codigo: proj.orcamento_codigo || '',
      planejador: proj.planejador || '',
      cliente_id: proj.cliente_id,
      descricao: proj.descricao,
      prazo: proj.prazo,
      status: proj.status,
    });
    setProjectErrors({});
    setIsProjectModalOpen(true);
  };

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};
    if (!projectForm.codigo.trim()) errors.codigo = 'Código é obrigatório.';
    if (!projectForm.descricao.trim()) errors.descricao = 'Descrição é obrigatória.';
    if (!projectForm.cliente_id) errors.cliente_id = 'Selecione um cliente.';
    if (!projectForm.prazo) errors.prazo = 'Prazo de entrega é obrigatório.';

    if (Object.keys(errors).length > 0) {
      setProjectErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingProject) {
        await toolShopService.updateProjeto(editingProject.id, {
          codigo: projectForm.codigo.trim(),
          orcamento_codigo: projectForm.orcamento_codigo.trim() || undefined,
          planejador: projectForm.planejador.trim() || undefined,
          cliente_id: projectForm.cliente_id,
          descricao: projectForm.descricao.trim(),
          prazo: projectForm.prazo,
          status: projectForm.status,
        });
        showFeedback('success', `Projeto "${projectForm.codigo}" atualizado com sucesso!`);
      } else {
        const novo = await toolShopService.createProjeto({
          codigo: projectForm.codigo.trim(),
          orcamento_codigo: projectForm.orcamento_codigo.trim() || undefined,
          planejador: projectForm.planejador.trim() || undefined,
          cliente_id: projectForm.cliente_id,
          descricao: projectForm.descricao.trim(),
          prazo: projectForm.prazo,
          status: projectForm.status,
        });
        showFeedback('success', `Projeto "${novo.codigo}" criado com sucesso!`);
        setSelectedProjectId(novo.id);
      }
      setIsProjectModalOpen(false);
      onRefresh();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao salvar projeto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- HANDLERS DE COMPONENTE ---
  const handleOpenCreateComponent = (projetoId: string) => {
    setEditingComponent({ projetoId });
    setComponentForm({
      codigo: '',
      nome: '',
      quantidade: '1',
      material: 'Aço P20 Beneficiado',
      formato: 'BLOCO',
      dimensoes: '',
      peso_kg: '',
      peso_calculado: false,
      tratamento: '',
      observacoes: '',
      status: 'Pendente',
      modeloOrigemId: '',
    });
    setComponentErrors({});
    setIsComponentModalOpen(true);
  };

  const handleOpenEditComponent = (projetoId: string, comp: ComponenteComOperacoes) => {
    setEditingComponent({ projetoId, componente: comp });
    setComponentForm({
      codigo: comp.codigo || '',
      nome: comp.nome,
      quantidade: String(comp.quantidade || 1),
      material: comp.material,
      formato: comp.formato || 'BLOCO',
      dimensoes: comp.dimensoes || '',
      peso_kg: comp.peso_kg !== undefined ? String(comp.peso_kg).replace('.', ',') : '',
      peso_calculado: comp.peso_calculado ?? false,
      tratamento: comp.tratamento || '',
      observacoes: comp.observacoes || '',
      status: comp.status,
      modeloOrigemId: comp.modelo_origem_id || '',
    });
    setComponentErrors({});
    setIsComponentModalOpen(true);
  };

  const handleComponentDimensoesChange = (val: string) => {
    setComponentForm((prev) => {
      const calc = calcularPesoBloco(prev.formato, val);
      if (calc !== null) {
        return {
          ...prev,
          dimensoes: val,
          peso_kg: String(calc).replace('.', ','),
          peso_calculado: true,
        };
      }
      return {
        ...prev,
        dimensoes: val,
      };
    });
  };

  const handleComponentFormatoChange = (formatoVal: string) => {
    setComponentForm((prev) => {
      const calc = calcularPesoBloco(formatoVal, prev.dimensoes);
      if (calc !== null) {
        return {
          ...prev,
          formato: formatoVal,
          peso_kg: String(calc).replace('.', ','),
          peso_calculado: true,
        };
      }
      return {
        ...prev,
        formato: formatoVal,
      };
    });
  };

  const handleSelectModeloInForm = (modeloId: string) => {
    const mod = modelosBiblioteca.find((m) => m.id === modeloId);
    if (!mod) return;
    setComponentForm((prev) => {
      const formato = mod.formato || prev.formato;
      const dimensoes = mod.dimensoes || prev.dimensoes;
      let peso_kg = prev.peso_kg;
      let peso_calculado = prev.peso_calculado;

      if (mod.peso_kg !== undefined) {
        peso_kg = String(mod.peso_kg).replace('.', ',');
        peso_calculado = mod.peso_calculado ?? false;
      } else if (formato === 'BLOCO' && dimensoes) {
        const calc = calcularPesoBloco(formato, dimensoes);
        if (calc !== null) {
          peso_kg = String(calc).replace('.', ',');
          peso_calculado = true;
        }
      }

      return {
        ...prev,
        codigo: mod.codigo,
        nome: mod.nome,
        material: mod.material || prev.material,
        formato,
        dimensoes,
        peso_kg,
        peso_calculado,
        tratamento: mod.tratamento || prev.tratamento,
        observacoes: mod.observacoes || prev.observacoes,
        modeloOrigemId: mod.id,
      };
    });
  };

  const handleSubmitComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComponent) return;

    const errors: { [key: string]: string } = {};
    if (!componentForm.nome.trim()) errors.nome = 'Nome do componente é obrigatório.';
    if (!componentForm.material.trim()) errors.material = 'Material é obrigatório.';

    const qtdNum = parseInt(componentForm.quantidade, 10);
    if (isNaN(qtdNum) || qtdNum < 1) {
      errors.quantidade = 'A quantidade deve ser um número inteiro igual ou maior que 1.';
    }

    if (Object.keys(errors).length > 0) {
      setComponentErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      let parsedPeso: number | undefined = undefined;
      if (componentForm.peso_kg.trim()) {
        const num = parseFloat(componentForm.peso_kg.replace(',', '.'));
        if (!isNaN(num) && num >= 0) {
          parsedPeso = Math.round(num * 100) / 100;
        }
      }

      if (editingComponent.componente) {
        await toolShopService.updateComponente(editingComponent.componente.id, {
          codigo: componentForm.codigo.trim() || undefined,
          nome: componentForm.nome.trim(),
          quantidade: qtdNum,
          material: componentForm.material.trim(),
          formato: componentForm.formato || undefined,
          dimensoes: componentForm.dimensoes.trim() || undefined,
          peso_kg: parsedPeso,
          peso_calculado: componentForm.peso_calculado,
          tratamento: componentForm.tratamento.trim() || undefined,
          observacoes: componentForm.observacoes.trim() || undefined,
          status: componentForm.status,
        });
        showFeedback('success', `Componente "${componentForm.nome}" atualizado!`);
      } else {
        const novoComp = await toolShopService.createComponente({
          projeto_id: editingComponent.projetoId,
          codigo: componentForm.codigo.trim() || undefined,
          nome: componentForm.nome.trim(),
          quantidade: qtdNum,
          material: componentForm.material.trim(),
          formato: componentForm.formato || undefined,
          dimensoes: componentForm.dimensoes.trim() || undefined,
          peso_kg: parsedPeso,
          peso_calculado: componentForm.peso_calculado,
          tratamento: componentForm.tratamento.trim() || undefined,
          observacoes: componentForm.observacoes.trim() || undefined,
          status: componentForm.status,
          modelo_origem_id: componentForm.modeloOrigemId || undefined,
        });

        // Se foi criado a partir de um modelo da biblioteca, copia as operações
        if (componentForm.modeloOrigemId) {
          const mod = modelosBiblioteca.find((m) => m.id === componentForm.modeloOrigemId);
          if (mod && mod.operacoes.length > 0) {
            const maquinasDisponiveis = await toolShopService.getMaquinas();
            for (const op of mod.operacoes) {
              const maq =
                maquinasDisponiveis.find(
                  (m) =>
                    m.tipo === op.tipo_maquina ||
                    m.categoria === op.tipo_maquina ||
                    m.categoria === op.categoria
                ) || maquinasDisponiveis[0];
              if (maq) {
                const isTerceiro = maq.origem === 'terceirizado';
                let valorOrcado: number | undefined = op.valor_orcado;
                if (isTerceiro && valorOrcado === undefined && maq.valor_unitario) {
                  if (maq.modelo_custo === 'peca') {
                    valorOrcado = maq.valor_unitario * (novoComp.quantidade || 1);
                  } else if (maq.modelo_custo === 'kg') {
                    valorOrcado = maq.valor_unitario * (op.peso_kg || 0);
                  } else if (maq.modelo_custo === 'hora') {
                    valorOrcado = maq.valor_unitario * (op.horas_estimadas || 0);
                  } else if (maq.modelo_custo === 'servico') {
                    valorOrcado = maq.valor_unitario;
                  }
                }
                await toolShopService.createOperacao({
                  componente_id: novoComp.id,
                  centro_custo_id: maq.id,
                  maquina_id: maq.id,
                  sequencia: op.sequencia,
                  descricao: op.descricao,
                  instrucoes: op.instrucoes || undefined,
                  horas_estimadas: op.horas_estimadas ?? 0,
                  prazo_dias: op.prazo_dias ?? maq.prazo_padrao_dias,
                  fornecedor: op.fornecedor ?? maq.fornecedor_nome,
                  peso_kg: op.peso_kg,
                  valor_orcado: valorOrcado,
                  status: 'Pendente',
                });
              }
            }
          }
        }

        showFeedback('success', `Componente "${componentForm.nome}" adicionado ao projeto!`);
      }
      setIsComponentModalOpen(false);
      onRefresh();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao salvar componente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- HANDLERS DE IMPORTAÇÃO DE COMPONENTES (.XLSX / .CSV) ---
  const handleOpenImportModal = () => {
    setImportFile(null);
    setImportLinhas([]);
    setImportErrosGerais([]);
    setImportBlocoProjeto(null);
    setConfirmDivergenciaOS(false);
    setIsImportModalOpen(true);
  };

  const handleSelectImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setIsParsingImport(true);
    setImportErrosGerais([]);
    setImportLinhas([]);
    setImportBlocoProjeto(null);
    setConfirmDivergenciaOS(false);

    try {
      // Recarrega biblioteca atualizada
      const mods = await toolShopService.getModelos();
      setModelosBiblioteca(mods);

      const { linhas, blocoProjeto, errosGerais } = await parseArquivoComponentes(file, mods);
      setImportLinhas(linhas);
      setImportBlocoProjeto(blocoProjeto);
      setConfirmDivergenciaOS(false);
      setImportErrosGerais(errosGerais);
    } catch (err) {
      setImportErrosGerais([
        `Erro ao ler arquivo: ${err instanceof Error ? err.message : 'Planilha inválida ou corrompida.'}`,
      ]);
    } finally {
      setIsParsingImport(false);
    }
  };

  const handleChangeLinhaTipo = (index: number, novoTipo: TipoComponente) => {
    setImportLinhas((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        tipo: novoTipo,
      };
      return copy;
    });
  };

  const handleChangeLinhaAcao = (
    index: number,
    acao: 'branco' | 'escolher_modelo' | 'ignorar',
    modeloEscolhidoId?: string
  ) => {
    setImportLinhas((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        acaoNaoEncontrado: acao,
        modeloEscolhidoId: modeloEscolhidoId !== undefined ? modeloEscolhidoId : copy[index].modeloEscolhidoId,
      };
      return copy;
    });
  };

  const handleConfirmImportComponents = async () => {
    if (!selectedProject || !user || importLinhas.length === 0) return;

    // Checagem de divergência de O.S.
    const osPlanilha = importBlocoProjeto?.osFerramentaria?.trim();
    const osProjeto = selectedProject.codigo?.trim();
    const hasDivergenciaOS = Boolean(
      osPlanilha &&
      osProjeto &&
      normalizeString(osPlanilha).replace(/[^a-z0-9]/g, '') !==
      normalizeString(osProjeto).replace(/[^a-z0-9]/g, '')
    );

    if (hasDivergenciaOS && !confirmDivergenciaOS) {
      showFeedback('error', 'Por favor confirme a divergência entre a O.S. da planilha e o projeto de destino antes de importar.');
      return;
    }

    // Filtra apenas linhas válidas (não Erro e não ignoradas)
    const linhasParaGravar = importLinhas.filter(
      (l) => l.status !== 'Erro' && l.acaoNaoEncontrado !== 'ignorar'
    );

    if (linhasParaGravar.length === 0) {
      showFeedback('error', 'Nenhum componente válido selecionado para importação.');
      return;
    }

    setIsSavingImport(true);
    try {
      const payloadItens = linhasParaGravar.map((linha) => {
        let modeloFinal = linha.modeloEncontrado;

        if (linha.status === 'Não encontrado' && linha.acaoNaoEncontrado === 'escolher_modelo') {
          modeloFinal = modelosBiblioteca.find((m) => m.id === linha.modeloEscolhidoId);
        }

        // Material e quantidade da planilha sobrescrevem os padrões do modelo
        const materialFinal = linha.materialLido || modeloFinal?.material || 'Aço P20';
        const qtdFinal = linha.quantidadeLida || 1;

        // Regra Reg-103: itens comprados ou em estoque NÃO recebem operações
        const operacoesParaCopiar =
          linha.tipo === 'fabricado' && modeloFinal
            ? modeloFinal.operacoes.map((op) => ({
                sequencia: op.sequencia,
                descricao: op.descricao,
                instrucoes: op.instrucoes || undefined,
                tipo_maquina: op.tipo_maquina,
                horas_estimadas: op.horas_estimadas ?? 0,
              }))
            : [];

        return {
          codigo: linha.codigoLido || modeloFinal?.codigo,
          nome: linha.nomeLido,
          quantidade: qtdFinal,
          material: materialFinal,
          observacoes: linha.observacoesLidas || modeloFinal?.observacoes,
          modeloOrigemId: modeloFinal?.id,
          operacoes: operacoesParaCopiar,
          tipo: linha.tipo,
          dimensoes: linha.dimensoes,
          tratamento: linha.tratamentoLido,
          id_refer_pai: linha.idReferPai,
          num_lista: linha.numLista,
        };
      });

      const resultado = await toolShopService.importarComponentesParaProjeto({
        projetoId: selectedProject.id,
        itens: payloadItens,
        usuario: { id: user.id, nome: user.nome },
        arquivoNome: importFile?.name || 'importacao_componentes.xlsx',
      });

      showFeedback(
        'success',
        `Importação concluída! ${resultado.totalImportados} peça(s) e ${resultado.totalOperacoesCriadas} operações adicionadas a ${selectedProject.codigo}.`
      );

      setIsImportModalOpen(false);
      setImportFile(null);
      setImportLinhas([]);
      setImportBlocoProjeto(null);
      setConfirmDivergenciaOS(false);
      onRefresh();
    } catch (err: any) {
      showFeedback('error', `Falha ao importar: ${err.message || 'Erro desconhecido.'}`);
    } finally {
      setIsSavingImport(false);
    }
  };


  // --- HANDLERS DE OPERAÇÃO ---
  const calculateEstimatedOutsourcedCost = (
    centro: CentroCusto | undefined,
    compQty: number,
    pesoKgStr: string,
    horasStr: string
  ): string => {
    if (!centro || centro.origem !== 'terceirizado') return '';
    const unit = centro.valor_unitario ?? centro.custo_hora ?? 0;
    if (centro.modelo_custo === 'peca') {
      return String((unit * compQty).toFixed(2)).replace('.', ',');
    }
    if (centro.modelo_custo === 'servico') {
      return String(unit.toFixed(2)).replace('.', ',');
    }
    if (centro.modelo_custo === 'kg') {
      const p = parseFloat(pesoKgStr.replace(',', '.'));
      if (!isNaN(p) && p > 0) {
        return String((unit * p).toFixed(2)).replace('.', ',');
      }
      return '';
    }
    if (centro.modelo_custo === 'hora') {
      const h = parseFloat(horasStr.replace(',', '.'));
      if (!isNaN(h) && h > 0) {
        return String((unit * h).toFixed(2)).replace('.', ',');
      }
      return '';
    }
    return '';
  };

  const handleOpenCreateOperation = (componente: ComponenteComOperacoes) => {
    const nextSeq = (componente.operacoes.length + 1) * 10;
    const firstCentro = maquinas[0];
    const isTerc = firstCentro?.origem === 'terceirizado';
    const initOrcado = calculateEstimatedOutsourcedCost(
      firstCentro,
      componente.quantidade || 1,
      '',
      isTerc ? '' : '4,0'
    );

    setEditingOperation({ componenteId: componente.id });
    setOperationForm({
      descricao: '',
      instrucoes: '',
      maquina_id: firstCentro?.id || '',
      horas_estimadas: isTerc ? '' : '4,0',
      sequencia: String(nextSeq),
      status: 'Pendente',
      prazo_dias: isTerc && firstCentro?.prazo_padrao_dias ? String(firstCentro.prazo_padrao_dias) : '5',
      peso_kg: '',
      fornecedor: isTerc && firstCentro?.fornecedor_nome ? firstCentro.fornecedor_nome : '',
      valor_orcado: initOrcado,
      observacoes: '',
    });
    setOperationErrors({});
    setIsOperationModalOpen(true);
  };

  const handleOpenEditOperation = (componenteId: string, op: OperacaoComDetalhes) => {
    const ccId = op.centro_custo_id || op.maquina_id || '';
    const cc = maquinas.find((m) => m.id === ccId);
    setEditingOperation({ componenteId, operacao: op });
    setOperationForm({
      descricao: op.descricao,
      instrucoes: op.instrucoes || '',
      maquina_id: ccId,
      horas_estimadas:
        op.horas_estimadas !== undefined && op.horas_estimadas !== null && op.horas_estimadas > 0
          ? String(op.horas_estimadas).replace('.', ',')
          : '',
      sequencia: String(op.sequencia),
      status: op.status,
      prazo_dias:
        op.prazo_dias !== undefined && op.prazo_dias !== null
          ? String(op.prazo_dias)
          : cc?.prazo_padrao_dias
          ? String(cc.prazo_padrao_dias)
          : '',
      peso_kg:
        op.peso_kg !== undefined && op.peso_kg !== null ? String(op.peso_kg).replace('.', ',') : '',
      fornecedor: op.fornecedor || cc?.fornecedor_nome || '',
      valor_orcado:
        op.valor_orcado !== undefined && op.valor_orcado !== null
          ? String(op.valor_orcado).replace('.', ',')
          : '',
      observacoes: op.observacoes || '',
    });
    setOperationErrors({});
    setIsOperationModalOpen(true);
  };

  const handleSubmitOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOperation) return;

    const errors: { [key: string]: string } = {};
    if (!operationForm.descricao.trim()) errors.descricao = 'Descrição é obrigatória.';
    if (!operationForm.maquina_id) errors.maquina_id = 'Selecione um centro de custo.';

    const canEditInstrucoes = perfil === 'gerente' || perfil === 'admin';
    if (operationForm.instrucoes && operationForm.instrucoes.length > 5000) {
      errors.instrucoes = 'As instruções de execução não podem exceder 5.000 caracteres.';
    }

    const selectedCentro = maquinas.find((m) => m.id === operationForm.maquina_id);
    const isTerceirizado = selectedCentro?.origem === 'terceirizado';

    let horasNum = 0;
    const rawHoras = operationForm.horas_estimadas.trim().replace(',', '.');
    if (rawHoras) {
      const parsed = parseFloat(rawHoras);
      if (isNaN(parsed) || parsed < 0) {
        errors.horas_estimadas = 'Informe um tempo válido maior que zero (ex: 0,25; 1,5; 37,75; 120).';
      } else {
        horasNum = parsed;
      }
    } else if (!isTerceirizado) {
      errors.horas_estimadas = 'Informe o tempo estimado em horas.';
    }

    const seqNum = parseInt(operationForm.sequencia, 10);
    if (isNaN(seqNum) || seqNum <= 0) {
      errors.sequencia = 'Sequência deve ser um número positivo.';
    }

    let prazoDiasNum: number | undefined = undefined;
    if (operationForm.prazo_dias) {
      const p = parseInt(operationForm.prazo_dias, 10);
      if (isNaN(p) || p < 0) {
        errors.prazo_dias = 'Prazo em dias inválido.';
      } else {
        prazoDiasNum = p;
      }
    } else if (isTerceirizado && selectedCentro?.prazo_padrao_dias) {
      prazoDiasNum = selectedCentro.prazo_padrao_dias;
    }

    let pesoKgNum: number | undefined = undefined;
    if (operationForm.peso_kg) {
      const pkg = parseFloat(operationForm.peso_kg.replace(',', '.'));
      if (isNaN(pkg) || pkg <= 0) {
        errors.peso_kg = 'Peso em kg inválido.';
      } else {
        pesoKgNum = pkg;
      }
    }

    let valorOrcadoNum: number | undefined = undefined;
    if (operationForm.valor_orcado) {
      const vorc = parseFloat(operationForm.valor_orcado.replace(',', '.'));
      if (isNaN(vorc) || vorc < 0) {
        errors.valor_orcado = 'Valor orçado inválido.';
      } else {
        valorOrcadoNum = vorc;
      }
    }

    if (Object.keys(errors).length > 0) {
      setOperationErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<Operacao> = {
        descricao: operationForm.descricao.trim(),
        instrucoes: canEditInstrucoes
          ? operationForm.instrucoes.trim() || undefined
          : editingOperation.operacao?.instrucoes,
        centro_custo_id: operationForm.maquina_id,
        maquina_id: operationForm.maquina_id,
        horas_estimadas: horasNum,
        sequencia: seqNum,
        status: operationForm.status,
        prazo_dias: prazoDiasNum,
        peso_kg: pesoKgNum,
        fornecedor: operationForm.fornecedor.trim() || undefined,
        valor_orcado: valorOrcadoNum,
        observacoes: operationForm.observacoes.trim() || undefined,
      };

      if (editingOperation.operacao) {
        await toolShopService.updateOperacao(editingOperation.operacao.id, payload);
        showFeedback('success', 'Operação atualizada com sucesso!');
      } else {
        await toolShopService.createOperacao({
          componente_id: editingOperation.componenteId,
          descricao: payload.descricao!,
          instrucoes: payload.instrucoes,
          centro_custo_id: payload.centro_custo_id!,
          maquina_id: payload.maquina_id,
          horas_estimadas: payload.horas_estimadas,
          sequencia: payload.sequencia!,
          status: payload.status!,
          prazo_dias: payload.prazo_dias,
          peso_kg: payload.peso_kg,
          fornecedor: payload.fornecedor,
          valor_orcado: payload.valor_orcado,
          observacoes: payload.observacoes,
        });
        showFeedback('success', 'Operação adicionada ao componente!');
      }
      setIsOperationModalOpen(false);
      onRefresh();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao salvar operação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reordenação de Operações (Subir / Descer)
  const handleMoveOperation = async (
    componente: ComponenteComOperacoes,
    opIndex: number,
    direction: 'up' | 'down'
  ) => {
    const newIndex = direction === 'up' ? opIndex - 1 : opIndex + 1;
    if (newIndex < 0 || newIndex >= componente.operacoes.length) return;

    const opIds = componente.operacoes.map((o) => o.id);
    // Troca os elementos
    const temp = opIds[opIndex];
    opIds[opIndex] = opIds[newIndex];
    opIds[newIndex] = temp;

    try {
      await toolShopService.reorderOperacoes(componente.id, opIds);
      showFeedback('success', 'Sequência de operações reordenada!');
      onRefresh();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao reordenar operações.');
    }
  };

  // --- EXCLUSÃO CONFIRMAÇÃO ---
  const handleConfirmDelete = async () => {
    setIsSubmitting(true);
    try {
      if (deleteModalState.type === 'projeto') {
        await toolShopService.deleteProjeto(deleteModalState.id);
        showFeedback('success', `Projeto "${deleteModalState.name}" excluído.`);
        if (selectedProjectId === deleteModalState.id) {
          setSelectedProjectId(null);
        }
      } else if (deleteModalState.type === 'componente') {
        await toolShopService.deleteComponente(deleteModalState.id);
        showFeedback('success', `Componente "${deleteModalState.name}" removido.`);
        if (selectedComponentIdForDetail === deleteModalState.id) {
          setSelectedComponentIdForDetail(null);
        }
      } else if (deleteModalState.type === 'operacao') {
        await toolShopService.deleteOperacao(deleteModalState.id);
        showFeedback('success', `Operação "${deleteModalState.name}" removida.`);
      }
      setDeleteModalState({ ...deleteModalState, isOpen: false });
      onRefresh();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao excluir item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper de badges de status
  const getProjectStatusStyle = (status: StatusProjeto, isOverdue: boolean) => {
    if (isOverdue) {
      return 'border-rose-300 bg-rose-50 text-rose-700';
    }
    switch (status) {
      case 'Em andamento':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'Em tryout':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'Concluído':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'Aguardando':
        return 'border-slate-200 bg-slate-100 text-slate-700';
      case 'Cancelado':
        return 'border-rose-200 bg-rose-50 text-rose-700';
      default:
        return 'border-slate-200 bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Padronizado */}
      <FeedbackAlert feedback={feedback} onClose={() => setFeedback(null)} />

      {/* ========================================================================= */}
      {/* VISTA 1: DETALHE DO PROJETO SELECIONADO                                   */}
      {/* ========================================================================= */}
      {selectedProject ? (
        <div className="space-y-6">
          {/* Barra Superior de Retorno */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setSelectedProjectId(null)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar para Lista de Projetos</span>
            </button>

            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleOpenEditProject(selectedProject)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Editar Projeto</span>
                </button>
              )}
              {canCreate && (
                <button
                  type="button"
                  onClick={() => handleOpenCreateComponent(selectedProject.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
                >
                  <Plus className="h-3.5 w-3.5 text-amber-400" />
                  <span>Novo Componente</span>
                </button>
              )}
            </div>
          </div>

          {/* Cabeçalho do Projeto */}
          <div
            className={`rounded-2xl border p-6 bg-white shadow-2xs transition-all ${
              isProjectOverdue(selectedProject.prazo, selectedProject.status)
                ? 'border-rose-300 ring-1 ring-rose-300'
                : 'border-slate-200'
            }`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-xl font-bold tracking-tight text-slate-900">
                    {selectedProject.codigo}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-sm font-semibold text-slate-700">
                    {selectedProject.cliente?.nome || 'Cliente não definido'}
                  </span>
                  <span
                    className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${getProjectStatusStyle(
                      selectedProject.status,
                      isProjectOverdue(selectedProject.prazo, selectedProject.status)
                    )}`}
                  >
                    {selectedProject.status}
                  </span>
                  {isProjectOverdue(selectedProject.prazo, selectedProject.status) && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Prazo Vencido</span>
                    </span>
                  )}
                </div>

                <h2 className="mt-2 text-base font-semibold text-slate-900 sm:text-lg">
                  {selectedProject.descricao}
                </h2>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5 font-mono">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Entrega: {formatDateBR(selectedProject.prazo)}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-slate-400" />
                    <span>{selectedProject.totalComponentes} componentes</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5 text-slate-400" />
                    <span>{selectedProject.totalOperacoes} operações de usinagem</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Painel de Resumo / KPIs do Projeto (Estimadas, Apontadas, Custo Interno, Custo Terceiros, Custo Total e Progresso) */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 border-t border-slate-100 pt-5">
              {/* Horas Estimadas */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="block text-[11px] font-medium text-slate-500">
                  Horas Est. Internas
                </span>
                <span className="mt-1 block font-mono text-xl font-bold text-slate-900">
                  {formatHours(selectedProject.horasEstimadasTotal)}
                </span>
                <span className="mt-1 block text-[11px] text-slate-400">
                  Previstas no roteiro
                </span>
              </div>

              {/* Horas Apontadas */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="block text-[11px] font-medium text-slate-500">
                  Horas Apontadas
                </span>
                <span className="mt-1 block font-mono text-xl font-bold text-slate-900">
                  {formatHours(selectedProject.horasApontadasTotal)}
                </span>
                <span className="mt-1 block text-[11px] text-slate-400">
                  Trabalhadas no chão
                </span>
              </div>

              {/* Custo Interno */}
              {canViewCustos ? (
                <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3.5">
                  <span className="block text-[11px] font-medium text-blue-900">
                    Custo Interno
                  </span>
                  <span className="mt-1 block font-mono text-xl font-bold text-blue-950">
                    {formatCurrencyBRL(selectedProject.custoInterno || 0)}
                  </span>
                  <span className="mt-1 block text-[11px] text-blue-700 truncate" title="Σ(horas apontadas × taxa horária interna)">
                    Σ(horas apontadas × taxa)
                  </span>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <span className="block text-[11px] font-medium text-slate-500">
                    Custo Interno
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">
                    Restrito à Gerência & Admin
                  </span>
                </div>
              )}

              {/* Custo de Terceiros */}
              {canViewCustos ? (
                <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="block text-[11px] font-medium text-purple-900">
                      Custo de Terceiros
                    </span>
                    {(selectedProject.custoTerceirosEstimado || 0) > 0 && (
                      <span className="rounded bg-purple-200/80 px-1 py-0.2 text-[9px] font-bold text-purple-800" title="Contém valores orçados estimados">
                        Estimado
                      </span>
                    )}
                  </div>
                  <span className="mt-1 block font-mono text-xl font-bold text-purple-950">
                    {formatCurrencyBRL(selectedProject.custoTerceiros || 0)}
                  </span>
                  <span className="mt-1 block text-[10px] text-purple-700 truncate" title={`Real: ${formatCurrencyBRL(selectedProject.custoTerceirosReal || 0)} · Orçado: ${formatCurrencyBRL(selectedProject.custoTerceirosEstimado || 0)}`}>
                    Real: {formatCurrencyBRL(selectedProject.custoTerceirosReal || 0)} · Orç: {formatCurrencyBRL(selectedProject.custoTerceirosEstimado || 0)}
                  </span>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <span className="block text-[11px] font-medium text-slate-500">
                    Custo de Terceiros
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">
                    Restrito à Gerência & Admin
                  </span>
                </div>
              )}

              {/* Custo de Material Retirado do Estoque */}
              {canViewCustos ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3.5">
                  <span className="block text-[11px] font-medium text-amber-900">
                    Custo de Material (Estoque)
                  </span>
                  <span className="mt-1 block font-mono text-xl font-bold text-amber-950">
                    {formatCurrencyBRL(custoMaterialEstoque)}
                  </span>
                  <span className="mt-1 block text-[11px] text-amber-700">
                    Material retirado p/ produção
                  </span>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <span className="block text-[11px] font-medium text-slate-500">
                    Custo de Material
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">
                    Restrito à Gerência & Admin
                  </span>
                </div>
              )}

              {/* Custo Total Acumulado */}
              {canViewCustos ? (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5">
                  <span className="block text-[11px] font-medium text-emerald-800">
                    Custo Total Acumulado
                  </span>
                  <span className="mt-1 block font-mono text-xl font-bold text-emerald-900">
                    {formatCurrencyBRL((selectedProject.custoRealAcumulado || 0) + (custoMaterialEstoque || 0))}
                  </span>
                  <span className="mt-1 block text-[11px] text-emerald-700">
                    Interno + Terceiros + Material
                  </span>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <span className="block text-[11px] font-medium text-slate-500">
                    Custo Total Acumulado
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">
                    Restrito à Gerência & Admin
                  </span>
                </div>
              )}

              {/* Progresso de Conclusão */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span>Progresso de Usinagem</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedProject.operacoesConcluidasCount}/{selectedProject.totalOperacoes}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-300"
                    style={{
                      width: `${
                        selectedProject.totalOperacoes > 0
                          ? (selectedProject.operacoesConcluidasCount / selectedProject.totalOperacoes) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="mt-1 block text-[11px] text-slate-400 text-right font-mono">
                  {selectedProject.totalOperacoes > 0
                    ? Math.round(
                        (selectedProject.operacoesConcluidasCount / selectedProject.totalOperacoes) * 100
                      )
                    : 0}
                  % concluído
                </span>
              </div>
            </div>
          </div>

          {/* Abas de Navegação Interna do Projeto */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setAbaProjeto('componentes')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
                abaProjeto === 'componentes'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Componentes & Roteiro</span>
              <span
                className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                  abaProjeto === 'componentes'
                    ? 'bg-slate-800 text-slate-200'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {selectedProject.componentes.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAbaProjeto('compras')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
                abaProjeto === 'compras'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              <span>Compras & Materiais</span>
            </button>
          </div>

          {abaProjeto === 'compras' ? (
            <ProjetoComprasTab
              projeto={selectedProject}
              onRefresh={() => {
                onRefresh();
                if (selectedProjectId) {
                  comprasService
                    .getMapStatusMaterialComponentes(selectedProjectId)
                    .then((map) => setMaterialStatusMap(map))
                    .catch((err) =>
                      console.error('Erro ao atualizar status de material:', err)
                    );
                }
              }}
            />
          ) : (
            /* Lista de Componentes do Projeto */
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Componentes & Roteiro de Usinagem ({selectedProject.componentes.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Estrutura detalhada de peças do molde/estampo com operações sequenciadas
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Botão Folha de Processos Geral do Projeto */}
                <button
                  type="button"
                  onClick={() =>
                    setFolhaProcessoTarget({
                      tipo: 'projeto',
                      projeto: selectedProject,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
                  title="Visualizar e imprimir a Folha de Processos completa de todas as peças desta ferramenta"
                >
                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                  <span>Folha de Processos</span>
                </button>

                {/* Botão Importar Lista de Componentes (Restrito a Gerente e Admin) */}
                {canImport && (
                  <button
                    type="button"
                    onClick={handleOpenImportModal}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors"
                    title="Importar lista de componentes via planilha Excel (.xlsx) ou CSV"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Importar lista de componentes</span>
                  </button>
                )}

                {/* Botão Adicionar Peça Manual */}
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => handleOpenCreateComponent(selectedProject.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
                  >
                    <Plus className="h-3.5 w-3.5 text-amber-500" />
                    <span>Adicionar Peça</span>
                  </button>
                )}
              </div>
            </div>

            {/* ===================================================================== */}
            {/* BARRA DE FILTROS E CONTADORES                                         */}
            {/* ===================================================================== */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3 shadow-2xs">
              {/* Linha de Contadores (Badges) */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                  Resumo:
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                  <span>Total:</span>
                  <strong className="font-mono font-bold text-slate-900">{compCounters.total}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 border border-slate-200 px-2.5 py-1 font-medium text-slate-700">
                  <span>Fabricados:</span>
                  <strong className="font-mono font-bold text-slate-900">{compCounters.fabricados}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-50 border border-purple-200 px-2.5 py-1 font-medium text-purple-700">
                  <span>Comprados:</span>
                  <strong className="font-mono font-bold text-purple-900">{compCounters.comprados}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-teal-50 border border-teal-200 px-2.5 py-1 font-medium text-teal-700">
                  <span>Estoque:</span>
                  <strong className="font-mono font-bold text-teal-900">{compCounters.estoque}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setCompSemOperacoesFilter((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
                    compSemOperacoesFilter
                      ? 'bg-amber-600 text-white ring-2 ring-amber-400 font-bold'
                      : compCounters.fabricadosSemOperacoes > 0
                      ? 'bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100'
                      : 'bg-slate-50 border border-slate-200 text-slate-500'
                  }`}
                  title="Filtrar componentes fabricados sem operações de usinagem"
                >
                  {compCounters.fabricadosSemOperacoes > 0 && (
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                  <span>Sem operações:</span>
                  <strong className="font-mono font-bold">
                    {compCounters.fabricadosSemOperacoes}
                  </strong>
                </button>
              </div>

              {/* Controles de Busca e Filtros */}
              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  {/* Busca por Código ou Nome */}
                  <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar código ou nome..."
                      value={compSearchTerm}
                      onChange={(e) => setCompSearchTerm(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-1.5 pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-slate-400 focus:outline-none"
                    />
                    {compSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setCompSearchTerm('')}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                        title="Limpar busca"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filtro por Grupo */}
                  {gruposDisponiveis.length > 0 && (
                    <select
                      value={compGrupoFilter}
                      onChange={(e) => setCompGrupoFilter(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-700 focus:border-slate-400 focus:outline-none"
                      title="Filtrar por grupo / ID Referência Pai"
                    >
                      <option value="Todos">Grupo: Todos ({gruposDisponiveis.length})</option>
                      {gruposDisponiveis.map((grp) => (
                        <option key={grp} value={grp}>
                          {grp}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Filtro por Tipo */}
                  <select
                    value={compTipoFilter}
                    onChange={(e) => setCompTipoFilter(e.target.value as any)}
                    className="rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-700 focus:border-slate-400 focus:outline-none"
                  >
                    <option value="Todos">Tipo: Todos</option>
                    <option value="fabricado">Fabricado</option>
                    <option value="comprado">Comprado</option>
                    <option value="estoque">Estoque</option>
                  </select>

                  {/* Filtro por Status */}
                  <select
                    value={compStatusFilter}
                    onChange={(e) => setCompStatusFilter(e.target.value as any)}
                    className="rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-700 focus:border-slate-400 focus:outline-none"
                  >
                    <option value="Todos">Status: Todos</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Em produção">Em produção</option>
                    <option value="Concluído">Concluído</option>
                  </select>

                  {/* Checkbox Somente sem operações */}
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={compSemOperacoesFilter}
                      onChange={(e) => setCompSemOperacoesFilter(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>Somente sem operações</span>
                  </label>
                </div>

                {/* Alternador de Agrupamento */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsGroupedByGrupo((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isGroupedByGrupo
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    title="Agrupar componentes por Grupo (PORTA MOLDE, MOVIMENTO, etc.)"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>{isGroupedByGrupo ? 'Visão Plana' : 'Agrupar por grupo'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ===================================================================== */}
            {/* TABELA COMPACTA DE COMPONENTES                                        */}
            {/* ===================================================================== */}
            {selectedProject.componentes.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="Nenhum componente nesta ferramenta"
                description="Adicione peças como cavidade, macho, placa extratora ou punção para estruturar o roteiro de usinagem e apontamento."
                actionLabel="+ Adicionar Primeiro Componente"
                onAction={() => handleOpenCreateComponent(selectedProject.id)}
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
                <div className="max-h-[580px] overflow-x-auto overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 z-10 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-2.5 w-10 text-center">#</th>
                        {/* 2. Código */}
                        <th
                          onClick={() => handleToggleSort('codigo')}
                          className="py-2.5 px-2.5 w-24 cursor-pointer hover:bg-slate-200/80 transition-colors select-none"
                          title="Ordenar por Código"
                        >
                          <div className="inline-flex items-center gap-1">
                            <span>Código</span>
                            {compSortField === 'codigo' ? (
                              compSortDirection === 'asc' ? (
                                <ArrowUp className="h-3 w-3 text-slate-900" />
                              ) : (
                                <ArrowDown className="h-3 w-3 text-slate-900" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-40 hover:opacity-100" />
                            )}
                          </div>
                        </th>

                        {/* 3. Nome */}
                        <th
                          onClick={() => handleToggleSort('nome')}
                          className="py-2.5 px-2.5 cursor-pointer hover:bg-slate-200/80 transition-colors select-none"
                          title="Ordenar por Nome"
                        >
                          <div className="inline-flex items-center gap-1">
                            <span>Nome</span>
                            {compSortField === 'nome' ? (
                              compSortDirection === 'asc' ? (
                                <ArrowUp className="h-3 w-3 text-slate-900" />
                              ) : (
                                <ArrowDown className="h-3 w-3 text-slate-900" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-40 hover:opacity-100" />
                            )}
                          </div>
                        </th>

                        {/* 4. Tipo */}
                        <th
                          onClick={() => handleToggleSort('tipo')}
                          className="py-2.5 px-2.5 w-24 cursor-pointer hover:bg-slate-200/80 transition-colors select-none"
                          title="Ordenar por Tipo"
                        >
                          <div className="inline-flex items-center gap-1">
                            <span>Tipo</span>
                            {compSortField === 'tipo' ? (
                              compSortDirection === 'asc' ? (
                                <ArrowUp className="h-3 w-3 text-slate-900" />
                              ) : (
                                <ArrowDown className="h-3 w-3 text-slate-900" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-40 hover:opacity-100" />
                            )}
                          </div>
                        </th>

                        {/* 5. Qtd */}
                        <th
                          onClick={() => handleToggleSort('quantidade')}
                          className="py-2.5 px-2.5 w-14 text-center cursor-pointer hover:bg-slate-200/80 transition-colors select-none"
                          title="Ordenar por Quantidade"
                        >
                          <div className="inline-flex items-center gap-1 justify-center">
                            <span>Qtd</span>
                            {compSortField === 'quantidade' ? (
                              compSortDirection === 'asc' ? (
                                <ArrowUp className="h-3 w-3 text-slate-900" />
                              ) : (
                                <ArrowDown className="h-3 w-3 text-slate-900" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-40 hover:opacity-100" />
                            )}
                          </div>
                        </th>

                        {/* 6. Material (oculto em telas estreitas) */}
                        <th
                          onClick={() => handleToggleSort('material')}
                          className="py-2.5 px-2.5 hidden md:table-cell cursor-pointer hover:bg-slate-200/80 transition-colors select-none"
                          title="Ordenar por Material"
                        >
                          <div className="inline-flex items-center gap-1">
                            <span>Material</span>
                            {compSortField === 'material' ? (
                              compSortDirection === 'asc' ? (
                                <ArrowUp className="h-3 w-3 text-slate-900" />
                              ) : (
                                <ArrowDown className="h-3 w-3 text-slate-900" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-40 hover:opacity-100" />
                            )}
                          </div>
                        </th>

                        {/* 7. Dimensões (bruto) (oculto em telas estreitas) */}
                        <th
                          onClick={() => handleToggleSort('dimensoes')}
                          className="py-2.5 px-2.5 hidden lg:table-cell cursor-pointer hover:bg-slate-200/80 transition-colors select-none"
                          title="Ordenar por Dimensões"
                        >
                          <div className="inline-flex items-center gap-1">
                            <span>Dimensões (bruto)</span>
                            {compSortField === 'dimensoes' ? (
                              compSortDirection === 'asc' ? (
                                <ArrowUp className="h-3 w-3 text-slate-900" />
                              ) : (
                                <ArrowDown className="h-3 w-3 text-slate-900" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-40 hover:opacity-100" />
                            )}
                          </div>
                        </th>

                        {/* 8. Status */}
                        <th
                          onClick={() => handleToggleSort('status')}
                          className="py-2.5 px-2.5 w-28 cursor-pointer hover:bg-slate-200/80 transition-colors select-none"
                          title="Ordenar por Status"
                        >
                          <div className="inline-flex items-center gap-1">
                            <span>Status</span>
                            {compSortField === 'status' ? (
                              compSortDirection === 'asc' ? (
                                <ArrowUp className="h-3 w-3 text-slate-900" />
                              ) : (
                                <ArrowDown className="h-3 w-3 text-slate-900" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-40 hover:opacity-100" />
                            )}
                          </div>
                        </th>

                        {/* 9. Nº de operações */}
                        <th
                          onClick={() => handleToggleSort('operacoes')}
                          className="py-2.5 px-2.5 w-28 text-center cursor-pointer hover:bg-slate-200/80 transition-colors select-none"
                          title="Ordenar por Nº de Operações"
                        >
                          <div className="inline-flex items-center gap-1 justify-center">
                            <span>Nº Operações</span>
                            {compSortField === 'operacoes' ? (
                              compSortDirection === 'asc' ? (
                                <ArrowUp className="h-3 w-3 text-slate-900" />
                              ) : (
                                <ArrowDown className="h-3 w-3 text-slate-900" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-40 hover:opacity-100" />
                            )}
                          </div>
                        </th>

                        {/* 10. Horas estimadas totais (oculto em telas estreitas) */}
                        <th
                          onClick={() => handleToggleSort('horas')}
                          className="py-2.5 px-2.5 w-24 text-right hidden md:table-cell cursor-pointer hover:bg-slate-200/80 transition-colors select-none"
                          title="Ordenar por Horas Estimadas Totais"
                        >
                          <div className="inline-flex items-center gap-1 justify-end">
                            <span>Horas Est.</span>
                            {compSortField === 'horas' ? (
                              compSortDirection === 'asc' ? (
                                <ArrowUp className="h-3 w-3 text-slate-900" />
                              ) : (
                                <ArrowDown className="h-3 w-3 text-slate-900" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-40 hover:opacity-100" />
                            )}
                          </div>
                        </th>

                        {/* 11. Ações */}
                        <th className="py-2.5 px-2.5 w-24 text-right pr-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredComponentes.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="py-12 text-center text-slate-500 text-xs">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Filter className="h-6 w-6 text-slate-300" />
                              <span className="font-semibold text-slate-700">
                                Nenhum componente corresponde aos filtros selecionados
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setCompSearchTerm('');
                                  setCompGrupoFilter('Todos');
                                  setCompTipoFilter('Todos');
                                  setCompStatusFilter('Todos');
                                  setCompSemOperacoesFilter(false);
                                }}
                                className="mt-1 text-xs font-semibold text-blue-600 hover:underline"
                              >
                                Limpar todos os filtros
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : isGroupedByGrupo && groupedComponentes ? (
                        groupedComponentes.map(([grupoNome, componentesDoGrupo]) => {
                          const isCollapsed = Boolean(collapsedGrupos[grupoNome]);
                          const grupoHorasTotal = componentesDoGrupo.reduce(
                            (acc, c) =>
                              acc +
                              c.operacoes.reduce((opAcc, o) => opAcc + (o.horas_estimadas || 0), 0),
                            0
                          );
                          return (
                            <React.Fragment key={grupoNome}>
                              <tr
                                onClick={() => toggleGroupCollapse(grupoNome)}
                                className="bg-slate-100/90 hover:bg-slate-200/80 transition-colors border-y border-slate-200 cursor-pointer text-xs font-bold text-slate-800 select-none"
                              >
                                <td colSpan={11} className="py-2 px-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {isCollapsed ? (
                                        <ChevronRight className="h-4 w-4 text-slate-500" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4 text-slate-500" />
                                      )}
                                      <span className="uppercase tracking-wider text-slate-700 font-bold">
                                        {grupoNome}
                                      </span>
                                      <span className="rounded bg-white border border-slate-300 px-2 py-0.5 text-[11px] font-mono text-slate-600">
                                        {componentesDoGrupo.length}{' '}
                                        {componentesDoGrupo.length === 1 ? 'item' : 'itens'}
                                      </span>
                                    </div>
                                    <div className="text-[11px] font-mono text-slate-500 pr-3">
                                      Total do grupo:{' '}
                                      <strong className="text-slate-800 font-bold">
                                        {formatHours(grupoHorasTotal)}
                                      </strong>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                              {!isCollapsed &&
                                componentesDoGrupo.map((comp, idx) => {
                                  const totalHorasComp = comp.operacoes.reduce(
                                    (acc, o) => acc + (o.horas_estimadas || 0),
                                    0
                                  );
                                  const isSelected = selectedComponentIdForDetail === comp.id;

                                  return (
                                    <tr
                                      key={comp.id}
                                      onClick={() => setSelectedComponentIdForDetail(comp.id)}
                                      className={`h-10 min-h-[40px] text-xs transition-colors border-b border-slate-100 cursor-pointer ${
                                        isSelected ? 'bg-blue-50/80 font-medium' : 'hover:bg-slate-50/90'
                                      }`}
                                    >
                                      {/* 1. # */}
                                      <td className="py-2 px-2.5 text-center text-[11px] font-mono text-slate-400 w-10">
                                        {idx + 1}
                                      </td>

                                      {/* 2. Código */}
                                      <td className="py-2 px-2.5 font-mono text-xs font-bold text-slate-800 w-24">
                                        {comp.codigo ? (
                                          <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                            {comp.codigo}
                                          </span>
                                        ) : (
                                          <span className="text-slate-300">—</span>
                                        )}
                                      </td>

                                      {/* 3. Nome (clicável) */}
                                      <td className="py-2 px-2.5 font-medium text-slate-900">
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedComponentIdForDetail(comp.id);
                                            }}
                                            className="font-semibold text-slate-900 hover:text-blue-600 hover:underline truncate max-w-[200px] sm:max-w-xs text-left"
                                            title="Clique para ver detalhes e operações"
                                          >
                                            {comp.nome}
                                          </button>
                                          {comp.observacoes && (
                                            <span className="text-[10px] text-slate-400 italic truncate max-w-[120px] hidden xl:inline">
                                              ({comp.observacoes})
                                            </span>
                                          )}
                                        </div>
                                      </td>

                                      {/* 4. Tipo */}
                                      <td className="py-2 px-2.5 w-24">
                                        {comp.tipo === 'comprado' ? (
                                          <span className="rounded bg-purple-50 border border-purple-200 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">
                                            Comprado
                                          </span>
                                        ) : comp.tipo === 'estoque' ? (
                                          <span className="rounded bg-teal-50 border border-teal-200 px-1.5 py-0.5 text-[10px] font-bold text-teal-700">
                                            Estoque
                                          </span>
                                        ) : (
                                          <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                                            Fabricado
                                          </span>
                                        )}
                                      </td>

                                      {/* 5. Qtd */}
                                      <td className="py-2 px-2.5 text-center font-mono text-xs font-semibold text-slate-700 w-14">
                                        {comp.quantidade || 1} un
                                      </td>

                                      {/* 6. Material (oculto em telas estreitas) */}
                                      <td className="py-2 px-2.5 text-slate-600 hidden md:table-cell truncate max-w-[150px]">
                                        {comp.material || '—'}
                                      </td>

                                      {/* 7. Dimensões (bruto) (oculto em telas estreitas) */}
                                      <td className="py-2 px-2.5 font-mono text-[11px] text-slate-500 hidden lg:table-cell truncate max-w-[150px]">
                                        {comp.dimensoes || '—'}
                                      </td>

                                      {/* 8. Status */}
                                      <td className="py-2 px-2.5 w-32">
                                        <div className="flex flex-col gap-1 items-start">
                                          <span
                                            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                                              comp.status === 'Concluído'
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                : comp.status === 'Em produção'
                                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                                : 'border-slate-200 bg-slate-100 text-slate-700'
                                            }`}
                                          >
                                            {comp.status}
                                          </span>
                                          {comp.tipo !== 'comprado' && comp.tipo !== 'estoque' && (
                                            renderMaterialStatusBadge(comp.id)
                                          )}
                                        </div>
                                      </td>

                                      {/* 9. Nº de operações com alerta para fabricado sem operações */}
                                      <td className="py-2 px-2.5 text-center w-28">
                                        {comp.tipo === 'comprado' || comp.tipo === 'estoque' ? (
                                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                                        ) : comp.operacoes.length === 0 ? (
                                          <span
                                            className="inline-flex items-center gap-1.5 text-amber-700 font-bold text-xs"
                                            title="Peça fabricada sem roteiro de usinagem definido"
                                          >
                                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                            <span>0 ops</span>
                                          </span>
                                        ) : (
                                          <span className="font-mono text-slate-700 font-medium">
                                            {comp.operacoes.length}{' '}
                                            {comp.operacoes.length === 1 ? 'op' : 'ops'}
                                          </span>
                                        )}
                                      </td>

                                      {/* 10. Horas estimadas totais (oculto em telas estreitas) */}
                                      <td className="py-2 px-2.5 text-right font-mono text-xs text-slate-700 font-semibold hidden md:table-cell w-24">
                                        {comp.tipo === 'comprado' || comp.tipo === 'estoque' ? (
                                          <span className="text-slate-400 font-mono">—</span>
                                        ) : (
                                          formatHours(totalHorasComp)
                                        )}
                                      </td>

                                      {/* 11. Ações (apenas Folha, Editar, Excluir) */}
                                      <td className="py-2 px-2.5 text-right w-24 pr-3">
                                        <div
                                          className="flex items-center justify-end gap-1"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {(!comp.tipo || comp.tipo === 'fabricado' || comp.operacoes.length > 0) && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setFolhaProcessoTarget({
                                                  tipo: 'componente',
                                                  projeto: selectedProject,
                                                  componente: comp,
                                                })
                                              }
                                              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                              title="Folha de Processos técnica desta peça"
                                            >
                                              <FileText className="h-3.5 w-3.5" />
                                            </button>
                                          )}

                                          {/* Retirar material do estoque */}
                                          <button
                                            type="button"
                                            onClick={() => setRetirarMaterialComponente(comp)}
                                            className="p-1.5 rounded-md text-amber-600 hover:text-amber-800 hover:bg-amber-50 transition-colors"
                                            title="Retirar material do estoque para produção"
                                          >
                                            <PackageCheck className="h-3.5 w-3.5" />
                                          </button>

                                          {/* Registrar sobra de usinagem */}
                                          {(!comp.tipo || comp.tipo === 'fabricado') && (
                                            <button
                                              type="button"
                                              onClick={() => setSobraComponente(comp)}
                                              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                              title="Registrar sobra de usinagem"
                                            >
                                              <Scissors className="h-3.5 w-3.5" />
                                            </button>
                                          )}

                                          {canEdit && (
                                            <button
                                              type="button"
                                              onClick={() => handleOpenEditComponent(selectedProject.id, comp)}
                                              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                              title="Editar componente"
                                            >
                                              <Edit2 className="h-3.5 w-3.5" />
                                            </button>
                                          )}

                                          {canDelete && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setDeleteModalState({
                                                  isOpen: true,
                                                  type: 'componente',
                                                  id: comp.id,
                                                  name: comp.nome,
                                                })
                                              }
                                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                              title="Excluir componente"
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </React.Fragment>
                          );
                        })
                      ) : (
                        filteredComponentes.map((comp, idx) => {
                          const totalHorasComp = comp.operacoes.reduce(
                            (acc, o) => acc + (o.horas_estimadas || 0),
                            0
                          );
                          const isSelected = selectedComponentIdForDetail === comp.id;

                          return (
                            <tr
                              key={comp.id}
                              onClick={() => setSelectedComponentIdForDetail(comp.id)}
                              className={`h-10 min-h-[40px] text-xs transition-colors border-b border-slate-100 cursor-pointer ${
                                isSelected ? 'bg-blue-50/80 font-medium' : 'hover:bg-slate-50/90'
                              }`}
                            >
                              {/* 1. # */}
                              <td className="py-2 px-2.5 text-center text-[11px] font-mono text-slate-400 w-10">
                                {idx + 1}
                              </td>

                              {/* 2. Código */}
                              <td className="py-2 px-2.5 font-mono text-xs font-bold text-slate-800 w-24">
                                {comp.codigo ? (
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                    {comp.codigo}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>

                              {/* 3. Nome (clicável) */}
                              <td className="py-2 px-2.5 font-medium text-slate-900">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedComponentIdForDetail(comp.id);
                                    }}
                                    className="font-semibold text-slate-900 hover:text-blue-600 hover:underline truncate max-w-[200px] sm:max-w-xs text-left"
                                    title="Clique para ver detalhes e operações"
                                  >
                                    {comp.nome}
                                  </button>
                                  {comp.observacoes && (
                                    <span className="text-[10px] text-slate-400 italic truncate max-w-[120px] hidden xl:inline">
                                      ({comp.observacoes})
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 4. Tipo */}
                              <td className="py-2 px-2.5 w-24">
                                {comp.tipo === 'comprado' ? (
                                  <span className="rounded bg-purple-50 border border-purple-200 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">
                                    Comprado
                                  </span>
                                ) : comp.tipo === 'estoque' ? (
                                  <span className="rounded bg-teal-50 border border-teal-200 px-1.5 py-0.5 text-[10px] font-bold text-teal-700">
                                    Estoque
                                  </span>
                                ) : (
                                  <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                                    Fabricado
                                  </span>
                                )}
                              </td>

                              {/* 5. Qtd */}
                              <td className="py-2 px-2.5 text-center font-mono text-xs font-semibold text-slate-700 w-14">
                                {comp.quantidade || 1} un
                              </td>

                              {/* 6. Material (oculto em telas estreitas) */}
                              <td className="py-2 px-2.5 text-slate-600 hidden md:table-cell truncate max-w-[150px]">
                                {comp.material || '—'}
                              </td>

                              {/* 7. Dimensões (bruto) (oculto em telas estreitas) */}
                              <td className="py-2 px-2.5 font-mono text-[11px] text-slate-500 hidden lg:table-cell truncate max-w-[150px]">
                                {comp.dimensoes || '—'}
                              </td>

                              {/* 8. Status */}
                              <td className="py-2 px-2.5 w-32">
                                <div className="flex flex-col gap-1 items-start">
                                  <span
                                    className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                                      comp.status === 'Concluído'
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                        : comp.status === 'Em produção'
                                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                                        : 'border-slate-200 bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {comp.status}
                                  </span>
                                  {comp.tipo !== 'comprado' && comp.tipo !== 'estoque' && (
                                    renderMaterialStatusBadge(comp.id)
                                  )}
                                </div>
                              </td>

                              {/* 9. Nº de operações com alerta para fabricado sem operações */}
                              <td className="py-2 px-2.5 text-center w-28">
                                {comp.tipo === 'comprado' || comp.tipo === 'estoque' ? (
                                  <span className="text-slate-400 font-mono text-[11px]">—</span>
                                ) : comp.operacoes.length === 0 ? (
                                  <span
                                    className="inline-flex items-center gap-1.5 text-amber-700 font-bold text-xs"
                                    title="Peça fabricada sem roteiro de usinagem definido"
                                  >
                                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                    <span>0 ops</span>
                                  </span>
                                ) : (
                                  <span className="font-mono text-slate-700 font-medium">
                                    {comp.operacoes.length}{' '}
                                    {comp.operacoes.length === 1 ? 'op' : 'ops'}
                                  </span>
                                )}
                              </td>

                              {/* 10. Horas estimadas totais (oculto em telas estreitas) */}
                              <td className="py-2 px-2.5 text-right font-mono text-xs text-slate-700 font-semibold hidden md:table-cell w-24">
                                {comp.tipo === 'comprado' || comp.tipo === 'estoque' ? (
                                  <span className="text-slate-400 font-mono">—</span>
                                ) : (
                                  formatHours(totalHorasComp)
                                )}
                              </td>

                              {/* 11. Ações (apenas Folha, Editar, Excluir) */}
                              <td className="py-2 px-2.5 text-right w-24 pr-3">
                                <div
                                  className="flex items-center justify-end gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {(!comp.tipo || comp.tipo === 'fabricado' || comp.operacoes.length > 0) && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setFolhaProcessoTarget({
                                          tipo: 'componente',
                                          projeto: selectedProject,
                                          componente: comp,
                                        })
                                      }
                                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                      title="Folha de Processos técnica desta peça"
                                    >
                                      <FileText className="h-3.5 w-3.5" />
                                    </button>
                                  )}

                                  {/* Retirar material do estoque */}
                                  <button
                                    type="button"
                                    onClick={() => setRetirarMaterialComponente(comp)}
                                    className="p-1.5 rounded-md text-amber-600 hover:text-amber-800 hover:bg-amber-50 transition-colors"
                                    title="Retirar material do estoque para produção"
                                  >
                                    <PackageCheck className="h-3.5 w-3.5" />
                                  </button>

                                  {/* Registrar sobra de usinagem */}
                                  {(!comp.tipo || comp.tipo === 'fabricado') && (
                                    <button
                                      type="button"
                                      onClick={() => setSobraComponente(comp)}
                                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                      title="Registrar sobra de usinagem"
                                    >
                                      <Scissors className="h-3.5 w-3.5" />
                                    </button>
                                  )}

                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditComponent(selectedProject.id, comp)}
                                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                      title="Editar componente"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}

                                  {canDelete && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDeleteModalState({
                                          isOpen: true,
                                          type: 'componente',
                                          id: comp.id,
                                          name: comp.nome,
                                        })
                                      }
                                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                      title="Excluir componente"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* PAINEL LATERAL À DIREITA (DRAWER DE DETALHES DO COMPONENTE E OPERAÇÕES)   */}
            {/* ========================================================================= */}
            {selectedComponentForDetail && (
              <div
                className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end"
                onClick={() => setSelectedComponentIdForDetail(null)}
              >
                <div
                  className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl h-full bg-white shadow-2xl flex flex-col z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* 1. Barra de Navegação e Fechamento */}
                  <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3 bg-slate-50">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePrevComp}
                        disabled={!hasPrevComp}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs transition-colors"
                        title="Componente anterior (lista filtrada)"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span>Anterior</span>
                      </button>
                      <span className="text-xs font-mono font-medium text-slate-500 px-1">
                        {currentCompIndex + 1} de {filteredComponentes.length}
                      </span>
                      <button
                        type="button"
                        onClick={handleNextComp}
                        disabled={!hasNextComp}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs transition-colors"
                        title="Próximo componente (lista filtrada)"
                      >
                        <span>Próximo</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedComponentIdForDetail(null)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                      title="Fechar painel (Esc)"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* 2. Cabeçalho de Identificação do Componente */}
                  <div className="border-b border-slate-200 px-6 py-4 bg-white">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {selectedComponentForDetail.codigo && (
                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-200 px-2 py-0.5 rounded border border-slate-300">
                          {selectedComponentForDetail.codigo}
                        </span>
                      )}

                      {/* Badges Tipo */}
                      {selectedComponentForDetail.tipo === 'comprado' && (
                        <span className="rounded bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-bold text-purple-700">
                          Comprado
                        </span>
                      )}
                      {selectedComponentForDetail.tipo === 'estoque' && (
                        <span className="rounded bg-teal-50 border border-teal-200 px-2 py-0.5 text-[11px] font-bold text-teal-700">
                          Estoque
                        </span>
                      )}
                      {(!selectedComponentForDetail.tipo ||
                        selectedComponentForDetail.tipo === 'fabricado') && (
                        <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          Fabricado
                        </span>
                      )}

                      {/* Badge Status */}
                      <span
                        className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${
                          selectedComponentForDetail.status === 'Concluído'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : selectedComponentForDetail.status === 'Em produção'
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-slate-100 text-slate-700'
                        }`}
                      >
                        {selectedComponentForDetail.status}
                      </span>

                      {/* Quantidade */}
                      <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-800">
                        Qtd: {selectedComponentForDetail.quantidade || 1} un
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900">
                      {selectedComponentForDetail.nome}
                    </h3>

                    {/* Botões de Ações do Componente no Topo do Painel */}
                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                      {canCreate &&
                        (!selectedComponentForDetail.tipo ||
                          selectedComponentForDetail.tipo === 'fabricado') && (
                          <button
                            type="button"
                            onClick={() => handleOpenCreateOperation(selectedComponentForDetail)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5 text-amber-500" />
                            <span>Nova Operação</span>
                          </button>
                        )}

                      {(!selectedComponentForDetail.tipo ||
                        selectedComponentForDetail.tipo === 'fabricado') && (
                        <button
                          type="button"
                          onClick={() =>
                            setFolhaProcessoTarget({
                              tipo: 'componente',
                              projeto: selectedProject,
                              componente: selectedComponentForDetail,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                          title="Visualizar Folha de Processos técnica desta peça"
                        >
                          <FileText className="h-3.5 w-3.5 text-slate-500" />
                          <span>Folha de Processos</span>
                        </button>
                      )}

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenEditComponent(selectedProject.id, selectedComponentForDetail)
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                          <span>Editar Componente</span>
                        </button>
                      )}

                      {/* Retirar material do estoque para produção */}
                      <button
                        type="button"
                        onClick={() => setRetirarMaterialComponente(selectedComponentForDetail)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors shadow-2xs"
                        title="Baixar matéria-prima ou item das reservas do projeto ou estoque geral"
                      >
                        <PackageCheck className="h-3.5 w-3.5 text-amber-700" />
                        <span>Retirar Material</span>
                      </button>

                      {/* Registrar sobra aproveitável de usinagem */}
                      {(!selectedComponentForDetail.tipo ||
                        selectedComponentForDetail.tipo === 'fabricado') && (
                        <button
                          type="button"
                          onClick={() => setSobraComponente(selectedComponentForDetail)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                          title="Cadastrar retalho ou sobra resultante da usinagem"
                        >
                          <Scissors className="h-3.5 w-3.5 text-slate-600" />
                          <span>Registrar Sobra</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 3. Conteúdo Rolável (Dados Técnicos e Roteiro de Operações) */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Card de Dados Técnicos do Componente */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Especificações Técnicas
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Grupo / ID Ref. Pai:</span>
                          <strong className="text-slate-800 font-medium">
                            {getComponenteGrupo(selectedComponentForDetail)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Material:</span>
                          <strong className="text-slate-800 font-mono">
                            {selectedComponentForDetail.material || '—'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Formato:</span>
                          <strong className="text-slate-800">
                            {(selectedComponentForDetail as any).formato || '—'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Dimensões (bruto):</span>
                          <strong className="text-slate-800 font-mono">
                            {selectedComponentForDetail.dimensoes || '—'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Tratamento / Acabamento:</span>
                          <strong className="text-slate-800">
                            {selectedComponentForDetail.tratamento || '—'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Fornecedor:</span>
                          <strong className="text-slate-800">
                            {(selectedComponentForDetail as any).fornecedor ||
                              (selectedComponentForDetail.tipo === 'comprado'
                                ? 'Item Comercial / Externo'
                                : 'Interno')}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">N° Lista:</span>
                          <strong className="text-slate-800 font-mono">
                            {selectedComponentForDetail.num_lista || '—'}
                          </strong>
                        </div>
                        <div className="col-span-2 sm:col-span-2">
                          <span className="text-slate-400 block text-[11px]">Observações:</span>
                          <span className="text-slate-700 italic">
                            {selectedComponentForDetail.observacoes || 'Sem observações registradas.'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Roteiro de Usinagem & Operações */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">
                            Roteiro de Usinagem ({selectedComponentForDetail.operacoes.length})
                          </h4>
                          {selectedComponentForDetail.operacoes.length > 0 && (
                            <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                              Carga Total:{' '}
                              {formatHours(
                                selectedComponentForDetail.operacoes.reduce(
                                  (acc, o) => acc + (o.horas_estimadas || 0),
                                  0
                                )
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      {selectedComponentForDetail.tipo === 'comprado' ||
                      selectedComponentForDetail.tipo === 'estoque' ? (
                        <div className="rounded-xl bg-slate-50 p-6 border border-dashed border-slate-300 text-center text-xs text-slate-600">
                          <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
                          <p className="font-semibold text-slate-800">
                            Item{' '}
                            {selectedComponentForDetail.tipo === 'comprado'
                              ? 'adquirido externamente'
                              : 'fornecido do estoque'}
                          </p>
                          <p className="text-slate-500 mt-1">
                            Esta peça não requer operações de usinagem interna na ferramentaria.
                          </p>
                        </div>
                      ) : selectedComponentForDetail.operacoes.length === 0 ? (
                        <div className="rounded-xl bg-amber-50/70 p-6 border border-amber-200 text-center text-xs">
                          <AlertTriangle className="h-6 w-6 text-amber-600 mx-auto mb-2" />
                          <p className="font-bold text-amber-900">
                            Nenhuma operação definida para esta peça
                          </p>
                          <p className="text-amber-700 mt-1 mb-4 max-w-sm mx-auto">
                            Cadastre as operações sequenciais de usinagem (ex: Fresa, CNC, Eletroerosão, Torno) para viabilizar os apontamentos no chão de fábrica.
                          </p>
                          {canCreate && (
                            <button
                              type="button"
                              onClick={() => handleOpenCreateOperation(selectedComponentForDetail)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                            >
                              <Plus className="h-3.5 w-3.5 text-amber-500" />
                              <span>Adicionar Operação</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                          <table className="w-full text-left text-xs">
                            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                              <tr>
                                <th className="py-2.5 px-3 w-14 text-center">Seq.</th>
                                <th className="py-2.5 px-2 w-14 text-center">Ordem</th>
                                <th className="py-2.5 px-3">Operação</th>
                                <th className="py-2.5 px-3">Centro de Custo</th>
                                <th className="py-2.5 px-3 text-right">Tempo Est.</th>
                                <th className="py-2.5 px-3 text-right">Apontado</th>
                                {canViewCustos && <th className="py-2.5 px-3 text-right">Custo</th>}
                                <th className="py-2.5 px-3 text-center">Status</th>
                                <th className="py-2.5 px-3 text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                              {selectedComponentForDetail.operacoes.map((op, opIdx) => (
                                <tr key={op.id} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900 text-center">
                                    #{op.sequencia}
                                  </td>
                                  <td className="py-2.5 px-2 text-center">
                                    <div className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white p-0.5">
                                      <button
                                        type="button"
                                        disabled={opIdx === 0}
                                        onClick={() =>
                                          handleMoveOperation(selectedComponentForDetail, opIdx, 'up')
                                        }
                                        className="p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-20"
                                        title="Subir sequência"
                                      >
                                        <ArrowUp className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={
                                          opIdx === selectedComponentForDetail.operacoes.length - 1
                                        }
                                        onClick={() =>
                                          handleMoveOperation(selectedComponentForDetail, opIdx, 'down')
                                        }
                                        className="p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-20"
                                        title="Descer sequência"
                                      >
                                        <ArrowDown className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </td>
                                  {(() => {
                                    const cc = op.centro_custo || op.maquina;
                                    const isTerc = cc?.origem === 'terceirizado';
                                    let diasAtraso = 0;
                                    if (op.status === 'Enviada' && op.retorno_previsto) {
                                      const dtPrev = new Date(op.retorno_previsto);
                                      dtPrev.setHours(0, 0, 0, 0);
                                      const hoje = new Date();
                                      hoje.setHours(0, 0, 0, 0);
                                      const diff = hoje.getTime() - dtPrev.getTime();
                                      if (diff > 0) {
                                        diasAtraso = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                      }
                                    }

                                    return (
                                      <>
                                        <td className="py-2.5 px-3 font-medium text-slate-900">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span>{op.descricao}</span>
                                            {op.instrucoes && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setExpandedInstructions((prev) => ({
                                                    ...prev,
                                                    [op.id]: !prev[op.id],
                                                  }))
                                                }
                                                className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                                                title="Esta operação possui instruções de execução detalhadas"
                                              >
                                                <FileText className="h-3 w-3 text-indigo-600" />
                                                <span>
                                                  {expandedInstructions[op.id]
                                                    ? 'Ocultar Instruções'
                                                    : 'Ver Instruções'}
                                                </span>
                                              </button>
                                            )}
                                          </div>

                                          {/* Instruções de execução expandidas */}
                                          {op.instrucoes && expandedInstructions[op.id] && (
                                            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] leading-relaxed text-slate-800 whitespace-pre-wrap select-text shadow-2xs">
                                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                <FileText className="h-3 w-3 text-indigo-500" />
                                                <span>Instruções de Execução (Plano de Fabricação):</span>
                                              </div>
                                              {op.instrucoes}
                                            </div>
                                          )}

                                          {isTerc && (
                                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                                              <span className="font-semibold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                                Fornecedor: {op.fornecedor || cc?.fornecedor_nome || 'A definir'}
                                              </span>
                                              {op.documento && (
                                                <span className="text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                  Doc: {op.documento}
                                                </span>
                                              )}
                                              {op.data_envio && (
                                                <span className="text-slate-600">
                                                  Envio: {formatDateBR(op.data_envio)} · Previsto: {op.retorno_previsto ? formatDateBR(op.retorno_previsto) : '—'}
                                                </span>
                                              )}
                                              {op.status === 'Enviada' && diasAtraso > 0 && (
                                                <span className="font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 animate-pulse">
                                                  Atrasado {diasAtraso}d
                                                </span>
                                              )}
                                              {op.status === 'Retornada' && op.data_retorno_real && (
                                                <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                  Retorno: {formatDateBR(op.data_retorno_real)}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-600">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-semibold block">{cc?.nome || '—'}</span>
                                            {isTerc && (
                                              <span className="rounded bg-purple-100 px-1.5 py-0.2 text-[9px] font-bold text-purple-800">
                                                Terceiro
                                              </span>
                                            )}
                                          </div>
                                          {cc && (
                                            <span className="text-[10px] text-slate-400 font-mono">
                                              {cc.categoria || cc.tipo}
                                              {canViewCustos &&
                                                ` · ${formatCurrencyBRL(cc.valor_unitario ?? cc.custo_hora ?? 0)}/${cc.modelo_custo === 'peca' ? 'peça' : cc.modelo_custo === 'kg' ? 'kg' : cc.modelo_custo === 'servico' ? 'serviço' : 'h'}`}
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                          {isTerc ? (
                                            <span className="font-semibold text-purple-900">
                                              {op.prazo_dias ?? cc?.prazo_padrao_dias ?? 5} dias
                                            </span>
                                          ) : (
                                            formatHours(op.horas_estimadas)
                                          )}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                          {isTerc ? <span className="text-slate-300 font-normal">—</span> : formatHours(op.horasApontadas)}
                                        </td>
                                        {canViewCustos && (
                                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                                            {isTerc ? (
                                              <div>
                                                <span className={op.valor_real !== undefined ? 'text-emerald-800' : 'text-purple-800'}>
                                                  {formatCurrencyBRL(op.valor_real ?? op.valor_orcado ?? 0)}
                                                </span>
                                                <span className="block text-[9px] text-slate-400 font-normal">
                                                  {op.valor_real !== undefined ? '(real)' : '(orçado)'}
                                                </span>
                                              </div>
                                            ) : (
                                              <span className="text-emerald-800">{formatCurrencyBRL(op.custoAcumulado)}</span>
                                            )}
                                          </td>
                                        )}
                                        <td className="py-2.5 px-3 text-center">
                                          <span
                                            className={`inline-flex items-center gap-1 font-semibold text-[11px] rounded-full px-2 py-0.5 ${
                                              op.status === 'Concluída' || op.status === 'Retornada'
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : op.status === 'Enviada'
                                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                                : op.status === 'Em andamento'
                                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                                            }`}
                                          >
                                            {op.status === 'Concluída' || op.status === 'Retornada' ? (
                                              <CheckCircle2 className="h-3 w-3" />
                                            ) : op.status === 'Enviada' ? (
                                              <Send className="h-3 w-3" />
                                            ) : (
                                              <Clock3 className="h-3 w-3" />
                                            )}
                                            <span>{op.status}</span>
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-right">
                                          <div className="flex items-center justify-end gap-1">
                                            {/* Ações específicas de Terceiro */}
                                            {isTerc && canManageTerceiros && (
                                              <>
                                                {(op.status === 'Pendente' || !op.data_envio) && (
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setEnvioModal({
                                                        isOpen: true,
                                                        componente: selectedComponentForDetail,
                                                        operacao: op,
                                                        data_envio: new Date().toISOString().split('T')[0],
                                                        documento: op.documento || '',
                                                        prazo_dias: String(op.prazo_dias ?? cc?.prazo_padrao_dias ?? 5),
                                                        fornecedor: op.fornecedor || cc?.fornecedor_nome || '',
                                                        observacoes: op.observacoes || '',
                                                      })
                                                    }
                                                    className="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors"
                                                    title="Registrar envio para terceiro"
                                                  >
                                                    <Send className="h-3 w-3" />
                                                    <span>Enviar</span>
                                                  </button>
                                                )}

                                                {op.status === 'Enviada' && (
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setRetornoModal({
                                                        isOpen: true,
                                                        componente: selectedComponentForDetail,
                                                        operacao: op,
                                                        data_retorno_real: new Date().toISOString().split('T')[0],
                                                        valor_real:
                                                          op.valor_real !== undefined
                                                            ? String(op.valor_real).replace('.', ',')
                                                            : op.valor_orcado !== undefined
                                                            ? String(op.valor_orcado).replace('.', ',')
                                                            : '',
                                                        documento: '',
                                                        observacoes: '',
                                                      })
                                                    }
                                                    className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                                                    title="Registrar retorno de terceiro"
                                                  >
                                                    <PackageCheck className="h-3 w-3" />
                                                    <span>Retorno</span>
                                                  </button>
                                                )}
                                              </>
                                            )}

                                            {canEdit && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleOpenEditOperation(selectedComponentForDetail.id, op)
                                                }
                                                className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded"
                                                title="Editar operação"
                                              >
                                                <Edit2 className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                            {canDelete && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setDeleteModalState({
                                                    isOpen: true,
                                                    type: 'operacao',
                                                    id: op.id,
                                                    name: `${op.sequencia} - ${op.descricao}`,
                                                  })
                                                }
                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                                title="Excluir operação"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </>
                                    );
                                  })()}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* VISTA 2: LISTAGEM DE PROJETOS EM TABELA                                   */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Topo da Lista */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                Projetos de Ferramentaria
              </h2>
              <p className="text-xs text-slate-500">
                Acompanhamento completo de moldes e estampos, prazos e progresso de usinagem
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportProjetosToCSV(filteredProjetos)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-900"
                title="Exportar lista de projetos para planilha CSV compatível com Excel"
              >
                <Download className="h-4 w-4 text-slate-500" />
                <span>Exportar CSV</span>
              </button>

              {canCreate && (
                <button
                  type="button"
                  onClick={handleOpenCreateProject}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4 text-amber-400" />
                  <span>Novo Projeto</span>
                </button>
              )}
            </div>
          </div>

          {/* Filtros e Busca */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Input de Busca */}
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por código, descrição ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-slate-900 focus:outline-none"
              />
            </div>

            {/* Dropdowns de Filtro */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
                <span className="font-semibold text-slate-500">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-transparent font-medium text-slate-900 focus:outline-none"
                >
                  <option value="Todos">Todos os Status</option>
                  {STATUS_PROJETO_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
                <span className="font-semibold text-slate-500">Cliente:</span>
                <select
                  value={clienteFilter}
                  onChange={(e) => setClienteFilter(e.target.value)}
                  className="bg-transparent font-medium text-slate-900 focus:outline-none max-w-[180px] truncate"
                >
                  <option value="Todos">Todos os Clientes</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tabela de Projetos ou Estado Vazio */}
          {projetos.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="Nenhum projeto ainda"
              description="Sua ferramentaria ainda não possui ferramentas cadastradas. Comece criando seu primeiro projeto de molde, estampo ou dispositivo."
              actionLabel="Cadastrar Primeiro Projeto"
              onAction={handleOpenCreateProject}
            />
          ) : filteredProjetos.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhum projeto encontrado"
              description={`Nenhum projeto corresponde ao termo "${searchTerm}" ou aos filtros de status/cliente selecionados.`}
              actionLabel="Limpar Filtros e Busca"
              onAction={() => {
                setSearchTerm('');
                setStatusFilter('Todos');
                setClienteFilter('Todos');
              }}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-medium">
                      <th className="py-3.5 px-4">Código</th>
                      <th className="py-3.5 px-4">Cliente</th>
                      <th className="py-3.5 px-4">Descrição da Ferramenta</th>
                      <th className="py-3.5 px-4">Prazo de Entrega</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 min-w-[160px]">Progresso de Usinagem</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredProjetos.map((proj) => {
                      const overdue = isProjectOverdue(proj.prazo, proj.status);
                      const percent =
                        proj.totalOperacoes > 0
                          ? Math.round(
                              (proj.operacoesConcluidasCount / proj.totalOperacoes) * 100
                            )
                          : 0;

                      return (
                        <tr
                          key={proj.id}
                          onClick={() => setSelectedProjectId(proj.id)}
                          className={`cursor-pointer transition-colors ${
                            overdue
                              ? 'bg-rose-50/40 hover:bg-rose-50/80 border-l-2 border-l-rose-500'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          {/* Código */}
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>{proj.codigo}</span>
                            </div>
                          </td>

                          {/* Cliente */}
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            {proj.cliente?.nome || '-'}
                          </td>

                          {/* Descrição */}
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="truncate font-medium text-slate-900">
                              {proj.descricao}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {proj.totalComponentes} componentes · {proj.totalOperacoes} operações
                            </div>
                          </td>

                          {/* Prazo com Destaque Vermelho se Vencido */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 font-mono">
                              <Calendar
                                className={`h-3.5 w-3.5 ${
                                  overdue ? 'text-rose-600' : 'text-slate-400'
                                }`}
                              />
                              <span
                                className={`font-semibold ${
                                  overdue ? 'text-rose-700' : 'text-slate-700'
                                }`}
                              >
                                {formatDateBR(proj.prazo)}
                              </span>
                            </div>
                            {overdue && (
                              <span className="inline-block mt-0.5 rounded bg-rose-100 px-1.5 py-0.2 font-mono text-[10px] font-bold text-rose-800">
                                Prazo Vencido
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getProjectStatusStyle(
                                proj.status,
                                overdue
                              )}`}
                            >
                              {proj.status}
                            </span>
                          </td>

                          {/* Barra de Progresso */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-mono text-slate-600">
                                {proj.operacoesConcluidasCount}/{proj.totalOperacoes} concluídas
                              </span>
                              <span className="font-mono font-semibold text-slate-900">
                                {percent}%
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  percent === 100 ? 'bg-emerald-600' : 'bg-slate-900'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </td>

                          {/* Ações */}
                          <td
                            className="py-3.5 px-4 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedProjectId(proj.id)}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                                title="Ver árvore e detalhes"
                              >
                                <span>Detalhes</span>
                                <ChevronRight className="h-3 w-3" />
                              </button>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenEditProject(proj, e)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                                  title="Editar projeto"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteModalState({
                                      isOpen: true,
                                      type: 'projeto',
                                      id: proj.id,
                                      name: proj.codigo,
                                    })
                                  }
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                                  title="Excluir projeto"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: FORMULÁRIO DE PROJETO (CRIAR / EDITAR)                            */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        title={editingProject ? 'Editar Projeto' : 'Novo Projeto de Ferramentaria'}
        subtitle={
          editingProject
            ? `Atualize dados gerais de ${editingProject.codigo}`
            : 'Cadastre um novo molde, estampo ou dispositivo para usinagem'
        }
        maxWidth="md"
      >
        <form onSubmit={handleSubmitProject} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Código do Projeto <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: PRJ-2026-003"
                value={projectForm.codigo}
                onChange={(e) => {
                  setProjectForm({ ...projectForm, codigo: e.target.value });
                  if (projectErrors.codigo) setProjectErrors({ ...projectErrors, codigo: '' });
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              />
              {projectErrors.codigo && (
                <p className="mt-1 text-xs text-rose-600">{projectErrors.codigo}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Cliente Industrial <span className="text-rose-500">*</span>
              </label>
              <select
                value={projectForm.cliente_id}
                onChange={(e) => {
                  setProjectForm({ ...projectForm, cliente_id: e.target.value });
                  if (projectErrors.cliente_id)
                    setProjectErrors({ ...projectErrors, cliente_id: '' });
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              >
                <option value="">Selecione o Cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              {projectErrors.cliente_id && (
                <p className="mt-1 text-xs text-rose-600">{projectErrors.cliente_id}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Descrição da Ferramenta <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Molde de Injeção Plástica para Tampa do Filtro de Ar"
              value={projectForm.descricao}
              onChange={(e) => {
                setProjectForm({ ...projectForm, descricao: e.target.value });
                if (projectErrors.descricao) setProjectErrors({ ...projectErrors, descricao: '' });
              }}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
            />
            {projectErrors.descricao && (
              <p className="mt-1 text-xs text-rose-600">{projectErrors.descricao}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Cód. Orçamento (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: ORC-2026-482"
                value={projectForm.orcamento_codigo}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, orcamento_codigo: e.target.value })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Planejador Técnico (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Eng. Roberto Santos"
                value={projectForm.planejador}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, planejador: e.target.value })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Prazo de Entrega <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={projectForm.prazo}
                onChange={(e) => {
                  setProjectForm({ ...projectForm, prazo: e.target.value });
                  if (projectErrors.prazo) setProjectErrors({ ...projectErrors, prazo: '' });
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              />
              {projectErrors.prazo && (
                <p className="mt-1 text-xs text-rose-600">{projectErrors.prazo}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Status</label>
              <select
                value={projectForm.status}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, status: e.target.value as StatusProjeto })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              >
                {STATUS_PROJETO_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsProjectModalOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : editingProject ? 'Salvar Alterações' : 'Criar Projeto'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: FORMULÁRIO DE COMPONENTE (ADICIONAR / EDITAR)                     */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isComponentModalOpen}
        onClose={() => setIsComponentModalOpen(false)}
        title={editingComponent?.componente ? 'Editar Componente' : 'Novo Componente'}
        subtitle="Defina o código, quantidade, nome da peça e o tipo de aço utilizado"
        maxWidth="md"
      >
        <form onSubmit={handleSubmitComponent} className="space-y-4">
          {/* Seletor rápido de modelo da biblioteca se for novo componente */}
          {!editingComponent?.componente && modelosBiblioteca.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Preencher a partir de modelo da biblioteca (opcional):
              </label>
              <select
                value={componentForm.modeloOrigemId}
                onChange={(e) => handleSelectModeloInForm(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
              >
                <option value="">Nenhum (criar peça personalizada)</option>
                {modelosBiblioteca.map((m) => (
                  <option key={m.id} value={m.id}>
                    [{m.codigo}] {m.nome} ({m.operacoes.length} operações padrão)
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Ao selecionar um modelo, o roteiro de operações padrão será copiado para este componente.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Código da Peça / Tag
              </label>
              <input
                type="text"
                placeholder="Ex: MOD-PLACA-SUP ou CMP-01"
                value={componentForm.codigo}
                onChange={(e) => setComponentForm({ ...componentForm, codigo: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-xs uppercase text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Quantidade <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={componentForm.quantidade}
                onChange={(e) => {
                  setComponentForm({ ...componentForm, quantidade: e.target.value });
                  if (componentErrors.quantidade) setComponentErrors({ ...componentErrors, quantidade: '' });
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-xs font-bold text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              />
              {componentErrors.quantidade && (
                <p className="mt-1 text-xs text-rose-600">{componentErrors.quantidade}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Nome do Componente / Peça <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Placa Cavidade Superior Postiçada"
              value={componentForm.nome}
              onChange={(e) => {
                setComponentForm({ ...componentForm, nome: e.target.value });
                if (componentErrors.nome) setComponentErrors({ ...componentErrors, nome: '' });
              }}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
            />
            {componentErrors.nome && (
              <p className="mt-1 text-xs text-rose-600">{componentErrors.nome}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Material / Aço <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Aço P20, Aço H13, VC131, 1045"
                value={componentForm.material}
                onChange={(e) => {
                  setComponentForm({ ...componentForm, material: e.target.value });
                  if (componentErrors.material)
                    setComponentErrors({ ...componentErrors, material: '' });
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              />
              {componentErrors.material && (
                <p className="mt-1 text-xs text-rose-600">{componentErrors.material}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Status da Peça</label>
              <select
                value={componentForm.status}
                onChange={(e) =>
                  setComponentForm({
                    ...componentForm,
                    status: e.target.value as StatusComponente,
                  })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              >
                {STATUS_COMPONENTE_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Formato do Bruto
              </label>
              <select
                value={componentForm.formato}
                onChange={(e) => handleComponentFormatoChange(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              >
                <option value="BLOCO">BLOCO</option>
                <option value="REDONDO">REDONDO</option>
                <option value="TUBO">TUBO</option>
                <option value="CHAPA">CHAPA</option>
                <option value="PERFIL">PERFIL</option>
                <option value="OUTRO">OUTRO</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Dimensões do Bruto (mm)
              </label>
              <input
                type="text"
                placeholder="Ex: 605 X 689 X 65"
                value={componentForm.dimensoes}
                onChange={(e) => handleComponentDimensoesChange(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              />
              <span className="mt-0.5 block text-[10px] text-slate-400">
                Padrão: A X B X C (mm)
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Peso Unitário (kg)
                </label>
                {componentForm.peso_calculado && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    Calculado
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="Ex: 212,70"
                value={componentForm.peso_kg}
                onChange={(e) =>
                  setComponentForm({
                    ...componentForm,
                    peso_kg: e.target.value,
                    peso_calculado: false,
                  })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Tratamento Térmico / Superficial (opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Niquelação Química, Têmpera e Revenimento 52 HRC..."
              value={componentForm.tratamento}
              onChange={(e) =>
                setComponentForm({ ...componentForm, tratamento: e.target.value })
              }
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Observações Técnicas
            </label>
            <textarea
              rows={2}
              placeholder="Instruções de usinagem, tolerâncias, acabamentos..."
              value={componentForm.observacoes}
              onChange={(e) => setComponentForm({ ...componentForm, observacoes: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsComponentModalOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
            >
              {isSubmitting
                ? 'Salvando...'
                : editingComponent?.componente
                ? 'Salvar Alterações'
                : 'Adicionar Componente'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: FORMULÁRIO DE OPERAÇÃO (ADICIONAR / EDITAR)                       */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isOperationModalOpen}
        onClose={() => setIsOperationModalOpen(false)}
        title={editingOperation?.operacao ? 'Editar Operação' : 'Nova Operação de Usinagem'}
        subtitle="Aloque o centro de custo necessário e estime o tempo para execução"
        maxWidth="md"
      >
        <form onSubmit={handleSubmitOperation} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Descrição do Processo / Operação <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Usinagem CNC de desbaste e cavidades 3D"
              value={operationForm.descricao}
              onChange={(e) => {
                setOperationForm({ ...operationForm, descricao: e.target.value });
                if (operationErrors.descricao)
                  setOperationErrors({ ...operationErrors, descricao: '' });
              }}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
            />
            {operationErrors.descricao && (
              <p className="mt-1 text-xs text-rose-600">{operationErrors.descricao}</p>
            )}
          </div>

          {/* Seletor de Centro de Custo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Centro de Custo Destinado <span className="text-rose-500">*</span>
            </label>
            <select
              value={operationForm.maquina_id}
              onChange={(e) => {
                const newId = e.target.value;
                const m = maquinas.find((x) => x.id === newId);
                const isTerc = m?.origem === 'terceirizado';
                const comp = selectedComponentForDetail;
                const compQty = comp?.quantidade || 1;
                const autoOrcado = calculateEstimatedOutsourcedCost(
                  m,
                  compQty,
                  operationForm.peso_kg,
                  operationForm.horas_estimadas
                );
                setOperationForm({
                  ...operationForm,
                  maquina_id: newId,
                  fornecedor: isTerc && m?.fornecedor_nome ? m.fornecedor_nome : operationForm.fornecedor,
                  prazo_dias: isTerc && m?.prazo_padrao_dias ? String(m.prazo_padrao_dias) : operationForm.prazo_dias,
                  valor_orcado: autoOrcado || operationForm.valor_orcado,
                  status: isTerc && operationForm.status === 'Em andamento' ? 'Pendente' : operationForm.status,
                });
                if (operationErrors.maquina_id)
                  setOperationErrors({ ...operationErrors, maquina_id: '' });
              }}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
            >
              <option value="">Selecione um centro de custo</option>
              {maquinas.map((m) => {
                const isTerceiro = m.origem === 'terceirizado';
                const cat = m.categoria || m.tipo || 'Geral';
                const val = m.valor_unitario ?? m.custo_hora ?? 0;
                const mod =
                  m.modelo_custo === 'peca'
                    ? 'peça'
                    : m.modelo_custo === 'kg'
                    ? 'kg'
                    : m.modelo_custo === 'servico'
                    ? 'serviço'
                    : 'h';
                return (
                  <option key={m.id} value={m.id}>
                    {m.nome} ({isTerceiro ? 'Terceiro' : 'Interno'} · {cat}
                    {canViewCustos ? ` · ${formatCurrencyBRL(val)}/${mod}` : ''})
                  </option>
                );
              })}
            </select>
            {operationErrors.maquina_id && (
              <p className="mt-1 text-xs text-rose-600">{operationErrors.maquina_id}</p>
            )}
          </div>

          {/* Configuração Específica de Terceirizados */}
          {(() => {
            const selectedCentro = maquinas.find((m) => m.id === operationForm.maquina_id);
            const isTerceiro = selectedCentro?.origem === 'terceirizado';
            const comp = selectedComponentForDetail;
            const compQty = comp?.quantidade || 1;

            if (isTerceiro) {
              return (
                <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-4 w-4 text-purple-700" />
                      <span>Configuração de Serviço Terceirizado</span>
                    </div>
                    <span className="text-[11px] font-mono text-purple-800">
                      Modelo: {selectedCentro?.modelo_custo === 'peca' ? 'Por Peça' : selectedCentro?.modelo_custo === 'kg' ? 'Por Peso (kg)' : selectedCentro?.modelo_custo === 'servico' ? 'Por Serviço' : 'Por Hora'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Prazo Estimado (dias)
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Ex: 5"
                        value={operationForm.prazo_dias}
                        onChange={(e) =>
                          setOperationForm({ ...operationForm, prazo_dias: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Peso da Peça (kg) <span className="text-slate-400 font-normal">(opcional)</span>
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Ex: 12,5"
                        value={operationForm.peso_kg}
                        onChange={(e) => {
                          const val = e.target.value;
                          const newOrc = calculateEstimatedOutsourcedCost(
                            selectedCentro,
                            compQty,
                            val,
                            operationForm.horas_estimadas
                          );
                          setOperationForm({
                            ...operationForm,
                            peso_kg: val,
                            valor_orcado: newOrc || operationForm.valor_orcado,
                          });
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Valor Orçado (R$)
                      </label>
                      <div className="relative mt-1">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-slate-400">
                          R$
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={operationForm.valor_orcado}
                          onChange={(e) =>
                            setOperationForm({ ...operationForm, valor_orcado: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-2.5 text-xs font-mono font-bold text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Fornecedor / Especialista Indicado
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Têmpera e Tratamentos Térmicos Mauá"
                      value={operationForm.fornecedor}
                      onChange={(e) =>
                        setOperationForm({ ...operationForm, fornecedor: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Horas, Sequência e Status */}
          {(() => {
            const selectedCentro = maquinas.find((m) => m.id === operationForm.maquina_id);
            const isTerceiro = selectedCentro?.origem === 'terceirizado';
            const statusOptions: StatusOperacao[] = isTerceiro
              ? ['Pendente', 'Enviada', 'Retornada']
              : ['Pendente', 'Em andamento', 'Concluída'];

            return (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Horas Estimadas {isTerceiro ? <span className="text-slate-400 font-normal">(Opcional)</span> : <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={isTerceiro ? '0,0' : '4,0'}
                    value={operationForm.horas_estimadas}
                    onChange={(e) => {
                      const val = e.target.value;
                      const comp = selectedComponentForDetail;
                      const compQty = comp?.quantidade || 1;
                      const autoOrc = isTerceiro
                        ? calculateEstimatedOutsourcedCost(
                            selectedCentro,
                            compQty,
                            operationForm.peso_kg,
                            val
                          )
                        : '';
                      setOperationForm({
                        ...operationForm,
                        horas_estimadas: val,
                        valor_orcado: autoOrc || operationForm.valor_orcado,
                      });
                      if (operationErrors.horas_estimadas)
                        setOperationErrors({ ...operationErrors, horas_estimadas: '' });
                    }}
                    onBlur={(e) => {
                      const raw = e.target.value.trim().replace(',', '.');
                      const n = parseFloat(raw);
                      if (!isNaN(n) && n > 0) {
                        setOperationForm({
                          ...operationForm,
                          horas_estimadas: String(raw).replace('.', ','),
                        });
                      }
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
                  />
                  {operationErrors.horas_estimadas && (
                    <p className="mt-1 text-xs text-rose-600">{operationErrors.horas_estimadas}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Sequência (Ordem)
                  </label>
                  <input
                    type="number"
                    step="10"
                    min="1"
                    placeholder="10"
                    value={operationForm.sequencia}
                    onChange={(e) =>
                      setOperationForm({ ...operationForm, sequencia: e.target.value })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Status</label>
                  <select
                    value={operationForm.status}
                    onChange={(e) =>
                      setOperationForm({
                        ...operationForm,
                        status: e.target.value as StatusOperacao,
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
                  >
                    {statusOptions.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })()}

          {/* Campo de Instruções de Execução (Plano de Fabricação) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <FileText className="h-4 w-4 text-indigo-600" />
                <span>Instruções de Execução (Plano de Fabricação)</span>
              </label>
              <span
                className={`font-mono text-[11px] font-semibold ${
                  operationForm.instrucoes.length > 5000
                    ? 'text-rose-600 font-bold'
                    : operationForm.instrucoes.length > 4500
                    ? 'text-amber-600'
                    : 'text-slate-400'
                }`}
              >
                {operationForm.instrucoes.length.toLocaleString('pt-BR')} / 5.000 caracteres
              </span>
            </div>

            <p className="text-[11px] text-slate-500">
              Texto longo multilinha preservando quebras de linha e seções técnicas, visível para o operador no tablet antes e durante a usinagem.
            </p>

            <textarea
              rows={6}
              disabled={perfil !== 'gerente' && perfil !== 'admin'}
              value={operationForm.instrucoes}
              onChange={(e) => {
                setOperationForm({ ...operationForm, instrucoes: e.target.value });
                if (operationErrors.instrucoes) {
                  setOperationErrors({ ...operationErrors, instrucoes: '' });
                }
              }}
              placeholder={`Exemplo de conteúdo com seções e quebras de linha:\n\nLADO SUPERIOR:\n#CALÇO#\n_facear;\n_usinar contorno pronto;\n_furação de rosca e passagens pronto;`}
              className={`w-full rounded-xl border p-3 font-mono text-xs text-slate-800 shadow-2xs whitespace-pre-wrap leading-relaxed focus:outline-none ${
                perfil !== 'gerente' && perfil !== 'admin'
                  ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                  : 'bg-white border-slate-300 focus:border-slate-900'
              }`}
            />
            {operationErrors.instrucoes && (
              <p className="text-xs text-rose-600 font-medium">{operationErrors.instrucoes}</p>
            )}
            {perfil !== 'gerente' && perfil !== 'admin' && (
              <p className="text-[11px] text-amber-700 italic">
                * Apenas usuários com perfil Gerente ou Administrador podem editar as instruções de execução.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsOperationModalOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
            >
              {isSubmitting
                ? 'Salvando...'
                : editingOperation?.operacao
                ? 'Salvar Alterações'
                : 'Adicionar Operação'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3B: REGISTRAR ENVIO PARA CENTRO DE CUSTO TERCEIRIZADO               */}
      {/* ========================================================================= */}
      {envioModal && (
        <Modal
          isOpen={envioModal.isOpen}
          onClose={() => setEnvioModal(null)}
          title="Registrar Envio para Terceiro"
          subtitle={`Peça: ${envioModal.componente.nome} (${envioModal.componente.codigo || 'S/C'}) · Operação: ${envioModal.operacao.descricao}`}
          maxWidth="md"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await toolShopService.registrarEnvioTerceiro(envioModal.operacao.id, {
                  data_envio: envioModal.data_envio,
                  documento: envioModal.documento,
                  prazo_dias: parseInt(envioModal.prazo_dias, 10) || 5,
                  fornecedor: envioModal.fornecedor,
                  observacoes: envioModal.observacoes,
                });
                showFeedback('success', 'Envio para terceiro registrado com sucesso!');
                setEnvioModal(null);
                onRefresh();
              } catch (err: any) {
                showFeedback('error', err.message || 'Erro ao registrar envio.');
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Data de Envio <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={envioModal.data_envio}
                  onChange={(e) => setEnvioModal({ ...envioModal, data_envio: e.target.value })}
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Prazo de Execução (dias) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={envioModal.prazo_dias}
                  onChange={(e) => setEnvioModal({ ...envioModal, prazo_dias: e.target.value })}
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Fornecedor / Prestador de Serviço
              </label>
              <input
                type="text"
                placeholder="Ex: Têmpera ABC Ltda"
                value={envioModal.fornecedor}
                onChange={(e) => setEnvioModal({ ...envioModal, fornecedor: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Documento de Remessa (Nota Fiscal / Pedido)
              </label>
              <input
                type="text"
                placeholder="Ex: NF-e 10542 / Pedido Compras 882"
                value={envioModal.documento}
                onChange={(e) => setEnvioModal({ ...envioModal, documento: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              />
            </div>

            {/* Previsão de Retorno Calculada */}
            <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-3 text-xs flex items-center justify-between">
              <span className="font-semibold text-purple-900">Previsão Calculada de Retorno:</span>
              <span className="font-mono font-bold text-purple-950 text-sm">
                {(() => {
                  try {
                    const dt = new Date(envioModal.data_envio);
                    const p = parseInt(envioModal.prazo_dias, 10) || 5;
                    dt.setDate(dt.getDate() + p);
                    return dt.toLocaleDateString('pt-BR');
                  } catch {
                    return '—';
                  }
                })()}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Observações de Envio / Instruções Especiais
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Dureza final requerida 52-54 HRC, preservar superfícies retificadas..."
                value={envioModal.observacoes}
                onChange={(e) => setEnvioModal({ ...envioModal, observacoes: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEnvioModal(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-purple-800"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Confirmar Envio</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3C: REGISTRAR RETORNO DE CENTRO DE CUSTO TERCEIRIZADO               */}
      {/* ========================================================================= */}
      {retornoModal && (
        <Modal
          isOpen={retornoModal.isOpen}
          onClose={() => setRetornoModal(null)}
          title="Registrar Retorno de Terceiro"
          subtitle={`Peça: ${retornoModal.componente.nome} (${retornoModal.componente.codigo || 'S/C'}) · Operação: ${retornoModal.operacao.descricao}`}
          maxWidth="md"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const valorNum = retornoModal.valor_real.trim()
                  ? parseFloat(retornoModal.valor_real.replace(',', '.'))
                  : undefined;
                await toolShopService.registrarRetornoTerceiro(retornoModal.operacao.id, {
                  data_retorno_real: retornoModal.data_retorno_real,
                  valor_real: valorNum,
                  documento: retornoModal.documento,
                  observacoes: retornoModal.observacoes,
                });
                showFeedback('success', 'Retorno de terceiro registrado com sucesso!');
                setRetornoModal(null);
                onRefresh();
              } catch (err: any) {
                showFeedback('error', err.message || 'Erro ao registrar retorno.');
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Data de Retorno Efetivo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={retornoModal.data_retorno_real}
                  onChange={(e) =>
                    setRetornoModal({ ...retornoModal, data_retorno_real: e.target.value })
                  }
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
                />
              </div>

              {canViewCustos && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Valor Real Cobrado (R$)
                  </label>
                  <div className="relative mt-1.5">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-400">
                      R$
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Ex: 280,00"
                      value={retornoModal.valor_real}
                      onChange={(e) =>
                        setRetornoModal({ ...retornoModal, valor_real: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3.5 text-xs font-mono font-bold text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Documento de Retorno / Nota Fiscal do Prestador
              </label>
              <input
                type="text"
                placeholder="Ex: NF-e Entrada 20491 / Fatura 7712"
                value={retornoModal.documento}
                onChange={(e) => setRetornoModal({ ...retornoModal, documento: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Laudo / Inspeção de Recebimento / Observações
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Certificado de tratamento térmico anexo, dureza conferida 53 HRC..."
                value={retornoModal.observacoes}
                onChange={(e) => setRetornoModal({ ...retornoModal, observacoes: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRetornoModal(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Confirmar Retorno</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleteModalState.isOpen && (
        <ConfirmDeleteModal
          isOpen={deleteModalState.isOpen}
          onClose={() => setDeleteModalState({ ...deleteModalState, isOpen: false })}
          onConfirm={handleConfirmDelete}
          title={`Excluir ${
            deleteModalState.type === 'projeto'
              ? 'Projeto'
              : deleteModalState.type === 'componente'
              ? 'Componente'
              : 'Operação'
          }`}
          itemName={deleteModalState.name}
          entityTypeLabel={
            deleteModalState.type === 'projeto'
              ? 'o projeto'
              : deleteModalState.type === 'componente'
              ? 'o componente'
              : 'a operação'
          }
          blockedReason={deleteModalState.reason}
          isDeleting={isSubmitting}
        />
      )}
      {/* ========================================================================= */}
      {/* MODAL 5: IMPORTAÇÃO DE COMPONENTES (.XLSX / .CSV)                          */}
      {/* ========================================================================= */}
      {(() => {
        const osPlanilha = importBlocoProjeto?.osFerramentaria?.trim();
        const osProjeto = selectedProject?.codigo?.trim();
        const hasDivergenciaOS = Boolean(
          osPlanilha &&
          osProjeto &&
          normalizeString(osPlanilha).replace(/[^a-z0-9]/g, '') !==
          normalizeString(osProjeto).replace(/[^a-z0-9]/g, '')
        );
        const isBlockedByOSDivergence = hasDivergenciaOS && !confirmDivergenciaOS;
        const totalProntos = importLinhas.filter(
          (l) => l.status !== 'Erro' && l.acaoNaoEncontrado !== 'ignorar'
        ).length;

        const importModalFooter = (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
            <div className="text-xs text-slate-600">
              {hasDivergenciaOS && !confirmDivergenciaOS ? (
                <span className="inline-flex items-center gap-1.5 font-bold text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  Marque a caixa de confirmação de divergência de O.S. acima para habilitar
                </span>
              ) : importLinhas.length > 0 ? (
                <span className="font-medium text-slate-700">
                  <strong className="text-slate-900">{totalProntos}</strong> de {importLinhas.length} peça(s) selecionada(s) para gravação no projeto.
                </span>
              ) : (
                <span className="text-slate-400">Nenhuma planilha carregada ainda.</span>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={importLinhas.length === 0 || isSavingImport || isBlockedByOSDivergence}
                onClick={handleConfirmImportComponents}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title={
                  isBlockedByOSDivergence
                    ? 'Confirme a divergência de O.S. para prosseguir'
                    : 'Gravar componentes no projeto'
                }
              >
                {isSavingImport ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Gravando no Projeto...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 text-emerald-200" />
                    <span>Concluir Importação</span>
                  </>
                )}
              </button>
            </div>
          </div>
        );

        return (
          <Modal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            title="Importar Lista de Materiais e Componentes"
            subtitle={
              selectedProject
                ? `Carga de peças e roteiros técnicos para ${selectedProject.codigo} - ${selectedProject.descricao}`
                : 'Selecione uma planilha para carregar os componentes'
            }
            maxWidth="5xl"
            footer={importModalFooter}
          >
            <div className="space-y-4">
              {/* Instruções e Download de Modelo (Compacto quando arquivo já selecionado) */}
              {importLinhas.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <strong className="block font-semibold text-slate-900">
                        Formato da Lista de Materiais e Serviços (Reg-103 OS 1842):
                      </strong>
                      <p className="mt-0.5 text-slate-600 leading-relaxed">
                        Compatível com o layout de ferramentaria (linhas 1-2 com Cliente, Produto, O.S., Projetista e cabeçalho a partir de <strong>CÓDIGO, DESCRIÇÃO, QTDE</strong>) ou com o formato simples.
                        Itens com <em>ID. Refer. PAI = FINANCEIRO</em> ou menção a <em>estoque</em> são automaticamente classificados como comprados/estoque sem operações de usinagem.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={downloadPlanilhaModeloComponentes}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 shadow-2xs"
                    >
                      <Download className="h-3.5 w-3.5 text-slate-600" />
                      <span>Baixar Modelo (.xlsx)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-3.5 py-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-slate-900">{importFile?.name || 'Planilha Carregada'}</span>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono text-slate-500 text-[11px]">{importLinhas.length} linha(s) lidas</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => importFileInputRef.current?.click()}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      Trocar Arquivo
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={downloadPlanilhaModeloComponentes}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Baixar Modelo</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Upload do Arquivo (Oculto se já carregado, acessível por ref) */}
              <div className={importLinhas.length > 0 ? 'hidden' : 'block'}>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Selecione a planilha (.xlsx ou .csv):
                </label>
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleSelectImportFile}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Limite de até 500 linhas e 5 MB. Separadores decimais aceitam vírgula ou ponto. Zeros à esquerda em códigos são preservados.
                </p>
              </div>

              {/* Erros Gerais / Diagnóstico */}
              {importErrosGerais.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>Avisos ou falhas na leitura da planilha:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {importErrosGerais.map((err, idx) => (
                      <li key={idx} className="whitespace-pre-line">{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Bloco de Metadados do Projeto Lido na Planilha (Reg-103) - Versão Compacta */}
              {importBlocoProjeto && (importBlocoProjeto.osFerramentaria || importBlocoProjeto.cliente || importBlocoProjeto.produto || importBlocoProjeto.projetista || importBlocoProjeto.data) && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/80 px-3.5 py-2.5 text-xs text-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-blue-950">
                      <FileSpreadsheet className="h-4 w-4 text-blue-700 shrink-0" />
                      <span>Identificado na Planilha:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                      {importBlocoProjeto.osFerramentaria && (
                        <div>
                          <span className="text-slate-500">O.S.: </span>
                          <strong className="font-mono text-slate-900 bg-white px-1.5 py-0.5 rounded border border-blue-200">{importBlocoProjeto.osFerramentaria}</strong>
                        </div>
                      )}
                      {importBlocoProjeto.cliente && (
                        <div>
                          <span className="text-slate-500">Cliente: </span>
                          <strong className="text-slate-900">{importBlocoProjeto.cliente}</strong>
                        </div>
                      )}
                      {importBlocoProjeto.produto && (
                        <div>
                          <span className="text-slate-500">Produto: </span>
                          <strong className="text-slate-900">{importBlocoProjeto.produto}</strong>
                        </div>
                      )}
                      {importBlocoProjeto.projetista && (
                        <div>
                          <span className="text-slate-500">Projetista: </span>
                          <strong className="text-slate-900">{importBlocoProjeto.projetista}</strong>
                        </div>
                      )}
                      {importBlocoProjeto.data && (
                        <div>
                          <span className="text-slate-500">Data: </span>
                          <strong className="font-mono text-slate-900">{importBlocoProjeto.data}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Alerta e Confirmação de Divergência de O.S. */}
              {hasDivergenciaOS && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h5 className="font-bold text-amber-950">Aviso: Divergência entre O.S. da Planilha e Projeto de Destino</h5>
                    <p className="mt-0.5 text-amber-900 text-xs leading-relaxed">
                      A planilha indica <strong>O.S. Ferramentaria: "{osPlanilha}"</strong>, mas você está importando para o projeto <strong>"{osProjeto} - {selectedProject?.descricao}"</strong>.
                    </p>
                    <label className="mt-2.5 inline-flex items-center gap-2 font-semibold text-amber-950 cursor-pointer select-none bg-white/70 px-3 py-1.5 rounded-lg border border-amber-300">
                      <input
                        type="checkbox"
                        checked={confirmDivergenciaOS}
                        onChange={(e) => setConfirmDivergenciaOS(e.target.checked)}
                        className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                      />
                      <span>Confirmo que desejo importar estes componentes para o projeto {osProjeto} mesmo com a O.S. divergente.</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Spinner de Parsing */}
              {isParsingImport && (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
                  <RefreshCw className="h-5 w-5 animate-spin text-slate-700" />
                  <span>Analisando planilha e reconhecendo componentes na biblioteca técnica...</span>
                </div>
              )}

              {/* PRÉ-VISUALIZAÇÃO / TABELA DE CONFERÊNCIA ANTES DE GRAVAR */}
              {!isParsingImport && importLinhas.length > 0 && (
                <div className="space-y-3">
                  {/* Barra de Resumo */}
                  {(() => {
                    const total = importLinhas.length;
                    const reconhecidas = importLinhas.filter((l) => l.status === 'Reconhecido').length;
                    const naoEncontradas = importLinhas.filter((l) => l.status === 'Não encontrado').length;
                    const erros = importLinhas.filter((l) => l.status === 'Erro').length;
                    const compradasEstoque = importLinhas.filter((l) => l.tipo === 'comprado' || l.tipo === 'estoque').length;

                    // Cálculo total de horas estimadas a adicionar (apenas peças fabricadas)
                    let totalHorasAdicionar = 0;
                    importLinhas.forEach((linha) => {
                      if (linha.status === 'Erro' || linha.acaoNaoEncontrado === 'ignorar' || linha.tipo !== 'fabricado') return;
                      let mod = linha.modeloEncontrado;
                      if (linha.status === 'Não encontrado' && linha.acaoNaoEncontrado === 'escolher_modelo') {
                        mod = modelosBiblioteca.find((m) => m.id === linha.modeloEscolhidoId);
                      }
                      if (mod) {
                        const somaHorasMod = mod.operacoes.reduce(
                          (acc, o) => acc + (o.horas_estimadas || 0),
                          0
                        );
                        totalHorasAdicionar += somaHorasMod;
                      }
                    });

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <span className="block text-[11px] text-slate-500">Total Linhas</span>
                          <strong className="text-sm font-bold text-slate-900">{total}</strong>
                        </div>
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                          <span className="block text-[11px] text-emerald-700">Reconhecidas</span>
                          <strong className="text-sm font-bold text-emerald-800">{reconhecidas}</strong>
                        </div>
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                          <span className="block text-[11px] text-amber-700">Não Encontradas</span>
                          <strong className="text-sm font-bold text-amber-800">{naoEncontradas}</strong>
                        </div>
                        <div className="rounded-lg border border-purple-200 bg-purple-50 p-2">
                          <span className="block text-[11px] text-purple-700">Comprado/Estoque</span>
                          <strong className="text-sm font-bold text-purple-800">{compradasEstoque}</strong>
                        </div>
                        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2">
                          <span className="block text-[11px] text-rose-700">Com Erro</span>
                          <strong className="text-sm font-bold text-rose-800">{erros}</strong>
                        </div>
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 col-span-2 sm:col-span-1">
                          <span className="block text-[11px] text-blue-700">Horas a Usinar</span>
                          <strong className="text-sm font-bold text-blue-800">
                            {formatHours(totalHorasAdicionar)}
                          </strong>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Tabela de Conferência Linha a Linha com Altura Controlada e Scroll Suave */}
                  <div className="max-h-[380px] overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 font-semibold text-slate-700">
                        <tr>
                          <th className="py-2.5 px-3 w-12 text-center">Linha</th>
                          <th className="py-2.5 px-3 min-w-[200px]">Dados Lidos (Código / Peça)</th>
                          <th className="py-2.5 px-3 w-32">Tipo</th>
                          <th className="py-2.5 px-3 w-14 text-center">Qtd</th>
                          <th className="py-2.5 px-3 min-w-[120px]">Material</th>
                          <th className="py-2.5 px-3 w-28 text-center">Status</th>
                          <th className="py-2.5 px-3 min-w-[220px]">Roteiro / Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {importLinhas.map((linha, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                              #{linha.linhaNumero}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {linha.codigoLido && (
                                  <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] border border-slate-200">
                                    {linha.codigoLido}
                                  </span>
                                )}
                                <span className="font-semibold text-slate-900">{linha.nomeLido}</span>
                                {linha.descricaoOriginal && linha.descricaoOriginal !== linha.nomeLido && (
                                  <span className="text-[10px] text-slate-400" title="Descrição bruta na planilha">
                                    ({linha.descricaoOriginal})
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                                {linha.idReferPai && (
                                  <span className="font-mono text-purple-700 font-medium bg-purple-50 px-1 rounded">
                                    Ref. Pai: {linha.idReferPai}
                                  </span>
                                )}
                                {linha.dimensoes && (
                                  <span className="font-mono text-slate-600 bg-slate-50 px-1 rounded">
                                    Dim: {linha.dimensoes}
                                  </span>
                                )}
                                {linha.tratamentoLido && (
                                  <span className="text-amber-700 font-medium bg-amber-50 px-1 rounded">
                                    Trat: {linha.tratamentoLido}
                                  </span>
                                )}
                                {linha.observacoesLidas && (
                                  <span className="italic text-slate-400">
                                    Obs: {linha.observacoesLidas}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              {/* Seleção do Tipo de Item (Fabricado / Comprado / Estoque) */}
                              <select
                                value={linha.tipo}
                                onChange={(e) =>
                                  handleChangeLinhaTipo(idx, e.target.value as TipoComponente)
                                }
                                className={`w-full rounded-lg border py-1 px-1.5 text-[11px] font-semibold focus:outline-none transition-colors ${
                                  linha.tipo === 'comprado'
                                    ? 'border-purple-300 bg-purple-50 text-purple-800'
                                    : linha.tipo === 'estoque'
                                    ? 'border-teal-300 bg-teal-50 text-teal-800'
                                    : 'border-slate-300 bg-white text-slate-800'
                                }`}
                              >
                                <option value="fabricado">Fabricado</option>
                                <option value="comprado">Comprado</option>
                                <option value="estoque">Estoque</option>
                              </select>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                              {linha.quantidadeLida}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 font-mono text-[11px]">
                              {linha.materialLido || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {linha.status === 'Reconhecido' && (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                                  <Check className="h-3 w-3 text-emerald-600" />
                                  Reconhecido
                                </span>
                              )}
                              {linha.status === 'Não encontrado' && (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                                  <AlertTriangle className="h-3 w-3 text-amber-600" />
                                  Não encontrado
                                </span>
                              )}
                              {linha.status === 'Erro' && (
                                <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-800 border border-rose-200">
                                  <AlertCircle className="h-3 w-3 text-rose-600" />
                                  Erro
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {/* Se for Comprado ou Estoque, não aplica roteiro de usinagem */}
                              {linha.tipo === 'comprado' || linha.tipo === 'estoque' ? (
                                <span className="text-[11px] text-purple-700 italic font-medium">
                                  {linha.tipo === 'comprado' ? 'Item comprado' : 'Item em estoque'} (sem operações)
                                </span>
                              ) : linha.status === 'Reconhecido' && linha.modeloEncontrado ? (
                                <div className="space-y-0.5">
                                  <div className="text-slate-800 font-medium">
                                    <strong className="text-slate-900">
                                      [{linha.modeloEncontrado.codigo}]
                                    </strong>{' '}
                                    {linha.modeloEncontrado.nome}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    Copiará {linha.modeloEncontrado.operacoes.length} operações (
                                    {formatHours(
                                      linha.modeloEncontrado.operacoes.reduce(
                                        (acc, o) => acc + (o.horas_estimadas || 0),
                                        0
                                      )
                                    )}
                                    )
                                  </div>
                                </div>
                              ) : linha.status === 'Não encontrado' ? (
                                <div className="space-y-1.5">
                                  <select
                                    value={linha.acaoNaoEncontrado || 'branco'}
                                    onChange={(e) =>
                                      handleChangeLinhaAcao(
                                        idx,
                                        e.target.value as 'branco' | 'escolher_modelo' | 'ignorar'
                                      )
                                    }
                                    className="w-full rounded border border-slate-300 py-1 px-2 text-[11px] font-semibold text-slate-700 focus:outline-none focus:border-slate-900"
                                  >
                                    <option value="branco">Criar componente em branco</option>
                                    <option value="escolher_modelo">
                                      Escolher outro modelo da biblioteca
                                    </option>
                                    <option value="ignorar">Ignorar esta linha</option>
                                  </select>

                                  {linha.acaoNaoEncontrado === 'escolher_modelo' && (
                                    <select
                                      value={linha.modeloEscolhidoId || ''}
                                      onChange={(e) =>
                                        handleChangeLinhaAcao(idx, 'escolher_modelo', e.target.value)
                                      }
                                      className="w-full rounded border border-blue-300 bg-blue-50/50 py-1 px-2 text-[11px] text-slate-800 focus:outline-none focus:border-blue-500"
                                    >
                                      <option value="">Selecione o modelo...</option>
                                      {modelosBiblioteca.map((m) => (
                                        <option key={m.id} value={m.id}>
                                          [{m.codigo}] {m.nome} ({m.operacoes.length} ops)
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              ) : linha.status === 'Erro' ? (
                                <span className="text-[11px] text-rose-600 font-medium">
                                  {linha.erroMotivo}
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL 6: FOLHA DE PROCESSOS TÉCNICA (PLANO DE FABRICAÇÃO A4 P&B)          */}
      {/* ========================================================================= */}
      {folhaProcessoTarget && (
        <FolhaProcessosModal
          isOpen={Boolean(folhaProcessoTarget)}
          onClose={() => setFolhaProcessoTarget(null)}
          tipo={folhaProcessoTarget.tipo}
          projeto={folhaProcessoTarget.projeto}
          componente={folhaProcessoTarget.componente}
          configEmpresa={configEmpresa}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: RETIRADA DE MATERIAL DO ESTOQUE PARA PRODUÇÃO                     */}
      {/* ========================================================================= */}
      {retirarMaterialComponente && selectedProject && (
        <RetirarMaterialModal
          isOpen={Boolean(retirarMaterialComponente)}
          onClose={() => setRetirarMaterialComponente(null)}
          projeto={selectedProject}
          componente={retirarMaterialComponente}
          onSuccess={(msg) => {
            setRetirarMaterialComponente(null);
            showFeedback('success', msg);
            onRefresh();
            if (selectedProject?.id) {
              carregarDadosEstoqueProjeto(selectedProject.id);
            }
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: REGISTRO DE SOBRA APROVEITÁVEL DE USINAGEM                        */}
      {/* ========================================================================= */}
      {sobraComponente && selectedProject && (
        <RegistrarSobraModal
          isOpen={Boolean(sobraComponente)}
          onClose={() => setSobraComponente(null)}
          itensDisponiveis={itensEstoqueDisponiveis}
          projetos={projetos}
          defaultProjetoId={selectedProject.id}
          defaultComponenteId={sobraComponente.id}
          defaultMaterial={sobraComponente.material}
          defaultFormato={(sobraComponente as any).formato || 'BLOCO'}
          onSuccess={(msg) => {
            setSobraComponente(null);
            showFeedback('success', msg);
            onRefresh();
            if (selectedProject?.id) {
              carregarDadosEstoqueProjeto(selectedProject.id);
            }
          }}
        />
      )}
    </div>
  );
};

