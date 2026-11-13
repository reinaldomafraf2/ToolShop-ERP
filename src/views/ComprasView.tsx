import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ItemCompraComDetalhes,
  Fornecedor,
  StatusItemCompra,
  TipoItemCompra,
  ConfiguracoesSistema,
  ProjetoComDetalhes,
  ItemEstoqueComDetalhes,
} from '../types';
import { comprasService, SnapshotDesfazer } from '../services/comprasService';
import { estoqueService } from '../services/estoqueService';
import { toolShopService } from '../services/toolShopService';
import { useAuth } from '../auth/AuthContext';
import { formatDateBR } from '../utils/formatters';
import { navigateToEstoqueItem } from '../utils/estoqueNavigation';
import {
  getQuantidadeRecebidaItem,
  getQuantidadePendenteItem,
  isRecebimentoParcial,
} from '../utils/materialStatus';
import { ItemCompraDetalhesDrawer } from '../components/compras/ItemCompraDetalhesDrawer';
import { DarEntradaRecebimentoModal } from '../components/compras/DarEntradaRecebimentoModal';
import { BatchActionModal, TipoBatchAction } from '../components/compras/BatchActionModal';
import { FornecedoresModal } from '../components/compras/FornecedoresModal';
import { SolicitacaoCompraPdfModal } from '../components/compras/SolicitacaoCompraPdfModal';
import { ConfirmDeleteModal } from '../components/common/ConfirmDeleteModal';
import { Modal } from '../components/common/Modal';
import { exportComprasToExcel } from '../utils/comprasExport';
import {
  ShoppingCart,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShoppingBag,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Building2,
  Package,
  Layers,
  ArrowUpDown,
  SlidersHorizontal,
  Trash2,
  PackagePlus,
  ExternalLink,
  Tag,
} from 'lucide-react';

export type ModoAgrupamento = 'nenhum' | 'fornecedor' | 'lista' | 'projeto';
export type AbaCompras = 'pendentes' | 'recebidos' | 'cancelados' | 'todos';

export const ComprasView: React.FC = () => {
  const { user, perfil } = useAuth();
  const canManage = perfil === 'gerente' || perfil === 'admin';
  const canReceber = canManage || perfil === 'lider';

  const [itens, setItens] = useState<ItemCompraComDetalhes[]>([]);
  const [itensEstoque, setItensEstoque] = useState<ItemEstoqueComDetalhes[]>([]);
  const [projetos, setProjetos] = useState<ProjetoComDetalhes[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [configEmpresa, setConfigEmpresa] = useState<ConfiguracoesSistema | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Aba principal (Pendentes por padrão para a lista se limpar automaticamente após recebimento)
  const [abaAtiva, setAbaAtiva] = useState<AbaCompras>('pendentes');

  // Filtros
  const [search, setSearch] = useState('');
  const [projetoFilter, setProjetoFilter] = useState('todos');
  const [fornecedorFilter, setFornecedorFilter] = useState('todos');
  const [listaFilter, setListaFilter] = useState('todos');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [somenteAtrasados, setSomenteAtrasados] = useState(false);

  // Agrupamento com seções recolhíveis
  const [modoAgrupamento, setModoAgrupamento] = useState<ModoAgrupamento>('nenhum');
  const [secoesAbertas, setSecoesAbertas] = useState<Record<string, boolean>>({});

  // Seleção múltipla
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modais e gavetas
  const [itemDrawer, setItemDrawer] = useState<ItemCompraComDetalhes | null>(null);
  const [itemParaReceber, setItemParaReceber] = useState<ItemCompraComDetalhes | null>(null);
  const [itemParaEstornar, setItemParaEstornar] = useState<ItemCompraComDetalhes | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState('');
  const [erroEstorno, setErroEstorno] = useState<string | null>(null);
  const [isEstornando, setIsEstornando] = useState(false);

  const [batchActionType, setBatchActionType] = useState<TipoBatchAction | null>(null);
  const [isFornecedoresModalOpen, setIsFornecedoresModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    ids: string[];
    itemName: string;
    isBatch?: boolean;
  }>({
    isOpen: false,
    ids: [],
    itemName: '',
    isBatch: false,
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast Desfazer (15s)
  const [undoState, setUndoState] = useState<{
    mensagem: string;
    snapshots: SnapshotDesfazer[];
    timerId: any;
  } | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [itensList, estoqueList, projList, fornList, config] = await Promise.all([
        comprasService.getItensCompraComDetalhes(),
        estoqueService.getItensComDetalhes().catch(() => []),
        toolShopService.getProjetosComDetalhes(),
        comprasService.getFornecedores(),
        toolShopService.getConfiguracoes().catch(() => null),
      ]);
      setItens(itensList);
      setItensEstoque(estoqueList);
      setProjetos(projList);
      setFornecedores(fornList);
      if (config) setConfigEmpresa(config);
      setItemDrawer((prev) =>
        prev ? itensList.find((x) => x.id === prev.id) || null : null
      );
    } catch (err: any) {
      console.error('Erro ao carregar módulo de compras:', err);
      setFeedback({ type: 'error', message: err.message || 'Erro ao carregar dados de compras.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    return () => {
      if (undoState?.timerId) clearTimeout(undoState.timerId);
    };
  }, [undoState]);

  // Listas únicas de opções de filtro
  const listasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    itens.forEach((i) => {
      if (i.numero_lista) set.add(i.numero_lista);
    });
    return Array.from(set).sort();
  }, [itens]);

  // Contadores no topo por status e por aba
  const contadores = useMemo(() => {
    const total = itens.length;
    const a_solicitar = itens.filter((i) => i.status === 'a_solicitar').length;
    const solicitados = itens.filter((i) => i.status === 'solicitado').length;
    const comprados = itens.filter((i) => i.status === 'comprado').length;
    const recebidos = itens.filter(
      (i) => i.status === 'recebido' || i.status === 'atendido_estoque'
    ).length;
    const cancelados = itens.filter((i) => i.status === 'cancelado').length;
    const pendentes = a_solicitar + solicitados + comprados;
    const atrasados = itens.filter((i) => i.atrasado).length;

    return {
      total,
      pendentes,
      a_solicitar,
      solicitados,
      comprados,
      recebidos,
      cancelados,
      atrasados,
    };
  }, [itens]);

  const handleSelectAba = (aba: AbaCompras) => {
    setAbaAtiva(aba);
    setStatusFilter('todos');
    setSomenteAtrasados(false);
    setSelectedIds(new Set());
  };

  // Filtragem
  const filteredItens = useMemo(() => {
    return itens.filter((i) => {
      if (abaAtiva === 'pendentes') {
        if (i.status !== 'a_solicitar' && i.status !== 'solicitado' && i.status !== 'comprado') {
          return false;
        }
      } else if (abaAtiva === 'recebidos') {
        if (i.status !== 'recebido' && i.status !== 'atendido_estoque') {
          return false;
        }
      } else if (abaAtiva === 'cancelados') {
        if (i.status !== 'cancelado') {
          return false;
        }
      }

      if (search) {
        const q = search.toLowerCase();
        const matchDesc = i.descricao.toLowerCase().includes(q);
        const matchSpec = i.especificacao?.toLowerCase().includes(q);
        const matchComp =
          i.componente?.nome?.toLowerCase().includes(q) ||
          i.componente?.codigo?.toLowerCase().includes(q);
        const matchProj =
          i.projeto?.codigo?.toLowerCase().includes(q) ||
          i.projeto?.descricao?.toLowerCase().includes(q);
        const matchForn = i.fornecedor?.nome?.toLowerCase().includes(q);
        const matchLista = i.numero_lista?.toLowerCase().includes(q);
        const matchNf = i.nota_fiscal?.toLowerCase().includes(q);

        if (
          !matchDesc &&
          !matchSpec &&
          !matchComp &&
          !matchProj &&
          !matchForn &&
          !matchLista &&
          !matchNf
        ) {
          return false;
        }
      }

      if (projetoFilter !== 'todos' && i.projeto_id !== projetoFilter) return false;
      if (fornecedorFilter !== 'todos' && i.fornecedor_id !== fornecedorFilter) return false;
      if (listaFilter !== 'todos' && i.numero_lista !== listaFilter) return false;
      if (tipoFilter !== 'todos' && i.tipo !== tipoFilter) return false;
      if (statusFilter !== 'todos' && i.status !== statusFilter) return false;
      if (somenteAtrasados && !i.atrasado) return false;

      return true;
    });
  }, [
    itens,
    abaAtiva,
    search,
    projetoFilter,
    fornecedorFilter,
    listaFilter,
    tipoFilter,
    statusFilter,
    somenteAtrasados,
  ]);

  // Agrupamento
  const gruposItens = useMemo(() => {
    if (modoAgrupamento === 'nenhum') {
      return [{ key: 'todos', label: 'Todos os Itens', itens: filteredItens }];
    }

    const mapa = new Map<string, { label: string; itens: ItemCompraComDetalhes[] }>();

    filteredItens.forEach((item) => {
      let chave = '';
      let label = '';

      if (modoAgrupamento === 'fornecedor') {
        chave = item.fornecedor_id || 'sem_fornecedor';
        label = item.fornecedor?.nome || 'Sem Fornecedor Definido';
      } else if (modoAgrupamento === 'lista') {
        chave = item.numero_lista || 'sem_lista';
        label = item.numero_lista ? `Lista: ${item.numero_lista}` : 'Sem Lista Informada';
      } else if (modoAgrupamento === 'projeto') {
        chave = item.projeto_id || 'sem_projeto';
        label = item.projeto
          ? `${item.projeto.codigo} - ${item.projeto.descricao}`
          : 'Projeto Não Vinculado';
      }

      if (!mapa.has(chave)) {
        mapa.set(chave, { label, itens: [] });
      }
      mapa.get(chave)!.itens.push(item);
    });

    return Array.from(mapa.entries()).map(([key, val]) => ({
      key,
      label: val.label,
      itens: val.itens,
    }));
  }, [filteredItens, modoAgrupamento]);

  const toggleSecao = (key: string) => {
    setSecoesAbertas((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key],
    }));
  };

  // Seleção múltipla
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItens.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItens.map((i) => i.id)));
    }
  };

  const toggleSelectItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Ações em Lote com Desfazer (15s)
  const handleConfirmBatchAction = async (dados: any) => {
    const ids = Array.from(selectedIds);
    try {
      let snapshots: SnapshotDesfazer[] = [];

      if (batchActionType === 'fornecedor') {
        snapshots = await comprasService.alterarFornecedorLote(ids, dados.fornecedorId);
      } else if (dados.status) {
        snapshots = await comprasService.updateStatusLote(ids, dados.status, dados);
      }

      setSelectedIds(new Set());
      await loadData();

      if (undoState?.timerId) clearTimeout(undoState.timerId);

      const timer = setTimeout(() => {
        setUndoState(null);
      }, 15000);

      setUndoState({
        mensagem: `${ids.length} item(ns) atualizado(s) em lote!`,
        snapshots,
        timerId: timer,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao processar ação em lote.' });
    }
  };

  const handleDesfazer = async () => {
    if (!undoState) return;
    try {
      clearTimeout(undoState.timerId);
      await comprasService.desfazerAlteracaoLote(undoState.snapshots);
      setUndoState(null);
      setFeedback({ type: 'success', message: 'Alteração em lote desfeita com sucesso!' });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao desfazer alteração.' });
    }
  };

  // Salvar no Drawer
  const handleSaveItemDrawer = async (id: string, updates: any) => {
    try {
      await comprasService.updateItemCompra(id, updates);
      setFeedback({ type: 'success', message: 'Item de compra atualizado com sucesso!' });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao salvar item.' });
      throw err;
    }
  };

  const handleDeleteItemDrawer = async (id: string) => {
    try {
      await comprasService.deleteItemCompra(id);
      setFeedback({ type: 'success', message: 'Item excluído com sucesso!' });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao excluir item.' });
      throw err;
    }
  };

  const handleOpenDeleteSingle = (item: ItemCompraComDetalhes) => {
    const nomeItem = item.componente?.nome ? `${item.componente.nome} (${item.descricao})` : item.descricao;
    setDeleteConfirmState({
      isOpen: true,
      ids: [item.id],
      itemName: nomeItem,
      isBatch: false,
    });
  };

  const handleOpenDeleteBatch = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    setDeleteConfirmState({
      isOpen: true,
      ids: Array.from(selectedIds),
      itemName: `${count} item(ns) de compra selecionado(s)`,
      isBatch: true,
    });
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmState.ids.length === 0) return;
    setIsDeleting(true);
    try {
      if (deleteConfirmState.isBatch) {
        const deleted = await comprasService.deleteItensLote(deleteConfirmState.ids);
        setSelectedIds(new Set());
        setFeedback({ type: 'success', message: `${deleted} necessidade(s) de compra excluída(s) com sucesso!` });
      } else {
        await comprasService.deleteItemCompra(deleteConfirmState.ids[0]);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(deleteConfirmState.ids[0]);
          return next;
        });
        setFeedback({ type: 'success', message: 'Necessidade de compra excluída com sucesso!' });
      }
      setDeleteConfirmState({ isOpen: false, ids: [], itemName: '', isBatch: false });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao excluir item(ns).' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Estornar Recebimento (gerente / admin)
  const handleConfirmEstorno = async () => {
    if (!itemParaEstornar) return;
    setIsEstornando(true);
    setErroEstorno(null);
    try {
      await estoqueService.estornarRecebimentoItemCompra(
        itemParaEstornar.id,
        {
          id: user?.id || 'sistema',
          nome: user?.nome || 'Administrador',
          perfil: user?.perfil || 'admin',
        },
        undefined,
        motivoEstorno.trim() || undefined
      );
      setFeedback({
        type: 'success',
        message: `Recebimento de "${itemParaEstornar.descricao}" estornado e devolvido ao estado anterior!`,
      });
      setItemParaEstornar(null);
      setMotivoEstorno('');
      await loadData();
    } catch (err: any) {
      const msg = err?.message || 'Erro ao estornar recebimento.';
      setErroEstorno(msg);
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsEstornando(false);
    }
  };

  // Fornecedores CRUD
  const handleCreateFornecedor = async (data: any) => {
    await comprasService.createFornecedor(data);
    await loadData();
  };

  const handleUpdateFornecedor = async (id: string, updates: any) => {
    await comprasService.updateFornecedor(id, updates);
    await loadData();
  };

  const handleDeleteFornecedor = async (id: string) => {
    await comprasService.deleteFornecedor(id);
    await loadData();
  };

  const statusBadgeStyle = (status: StatusItemCompra) => {
    switch (status) {
      case 'a_solicitar':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'solicitado':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'comprado':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'recebido':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'atendido_estoque':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'cancelado':
        return 'bg-rose-50 text-rose-700 border-rose-200';
    }
  };

  const statusLabel = (status: StatusItemCompra) => {
    switch (status) {
      case 'a_solicitar':
        return 'A Solicitar';
      case 'solicitado':
        return 'Solicitado';
      case 'comprado':
        return 'Comprado';
      case 'recebido':
        return 'Recebido';
      case 'atendido_estoque':
        return 'Estoque';
      case 'cancelado':
        return 'Cancelado';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast de Desfazer por 15 segundos */}
      {undoState && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-2xl animate-in slide-in-from-bottom-3">
          <span>{undoState.mensagem}</span>
          <button
            type="button"
            onClick={handleDesfazer}
            className="inline-flex items-center gap-1 rounded bg-amber-400 px-2.5 py-1 text-slate-900 font-bold hover:bg-amber-300 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Desfazer (15s)</span>
          </button>
        </div>
      )}

      {/* Alerta de Feedback */}
      {feedback && (
        <div
          className={`rounded-xl border p-3 flex items-center justify-between text-xs ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="font-bold text-slate-500 hover:text-slate-800 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* =========================================================================
          CABEÇALHO PRINCIPAL DA TELA DE COMPRAS
      ========================================================================= */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-slate-800" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Compras e Materiais
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestão integrada de aço bruto, matéria-prima e componentes comerciais para a usinagem
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFornecedoresModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
            title="Cadastrar e gerenciar fornecedores industriais"
          >
            <Building2 className="h-4 w-4 text-slate-600" />
            <span>Fornecedores ({fornecedores.length})</span>
          </button>

          <button
            type="button"
            onClick={() => exportComprasToExcel(filteredItens, 'relatorio_compras_geral')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
            title="Exportar itens selecionados ou filtrados para Excel (.xlsx)"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            <span>Exportar Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPdfModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
            title="Visualizar e imprimir Solicitação de Compra formal em PDF A4"
          >
            <Printer className="h-4 w-4" />
            <span>Solicitação PDF</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          CONTADORES NO TOPO POR STATUS (CARDS KPIS)
      ========================================================================= */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 text-xs">
        <div
          onClick={() => {
            setAbaAtiva('todos');
            setStatusFilter('todos');
            setSomenteAtrasados(false);
          }}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            abaAtiva === 'todos' && statusFilter === 'todos' && !somenteAtrasados
              ? 'border-slate-900 bg-slate-900 text-white shadow-md'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <span className="block text-[11px] font-bold uppercase tracking-wider opacity-70">
            Total Itens
          </span>
          <span className="mt-1 block font-mono text-2xl font-bold">{contadores.total}</span>
        </div>

        <div
          onClick={() => {
            setAbaAtiva('pendentes');
            setStatusFilter('a_solicitar');
            setSomenteAtrasados(false);
          }}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            abaAtiva === 'pendentes' && statusFilter === 'a_solicitar'
              ? 'border-slate-700 bg-slate-800 text-white shadow-md'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <span className="block text-[11px] font-bold uppercase tracking-wider opacity-70">
            A Solicitar
          </span>
          <span className="mt-1 block font-mono text-2xl font-bold">{contadores.a_solicitar}</span>
        </div>

        <div
          onClick={() => {
            setAbaAtiva('pendentes');
            setStatusFilter('solicitado');
            setSomenteAtrasados(false);
          }}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            abaAtiva === 'pendentes' && statusFilter === 'solicitado'
              ? 'border-blue-600 bg-blue-600 text-white shadow-md'
              : 'border-blue-100 bg-blue-50/50 text-blue-950 hover:border-blue-300 shadow-2xs'
          }`}
        >
          <span className="block text-[11px] font-bold uppercase tracking-wider opacity-75">
            Solicitados
          </span>
          <span className="mt-1 block font-mono text-2xl font-bold">{contadores.solicitados}</span>
        </div>

        <div
          onClick={() => {
            setAbaAtiva('pendentes');
            setStatusFilter('comprado');
            setSomenteAtrasados(false);
          }}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            abaAtiva === 'pendentes' && statusFilter === 'comprado'
              ? 'border-purple-600 bg-purple-600 text-white shadow-md'
              : 'border-purple-100 bg-purple-50/50 text-purple-950 hover:border-purple-300 shadow-2xs'
          }`}
        >
          <span className="block text-[11px] font-bold uppercase tracking-wider opacity-75">
            Comprados
          </span>
          <span className="mt-1 block font-mono text-2xl font-bold">{contadores.comprados}</span>
        </div>

        <div
          onClick={() => {
            setAbaAtiva('recebidos');
            setStatusFilter('todos');
            setSomenteAtrasados(false);
          }}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            abaAtiva === 'recebidos'
              ? 'border-emerald-600 bg-emerald-600 text-white shadow-md'
              : 'border-emerald-100 bg-emerald-50/50 text-emerald-950 hover:border-emerald-300 shadow-2xs'
          }`}
        >
          <span className="block text-[11px] font-bold uppercase tracking-wider opacity-75">
            Recebidos
          </span>
          <span className="mt-1 block font-mono text-2xl font-bold">{contadores.recebidos}</span>
        </div>

        <div
          onClick={() => {
            setAbaAtiva('pendentes');
            setSomenteAtrasados(true);
            setStatusFilter('todos');
          }}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            somenteAtrasados
              ? 'border-rose-600 bg-rose-600 text-white shadow-md'
              : contadores.atrasados > 0
              ? 'border-rose-200 bg-rose-50 text-rose-950 hover:border-rose-300 shadow-2xs'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <span className="block text-[11px] font-bold uppercase tracking-wider opacity-75">
            Atrasados
          </span>
          <span
            className={`mt-1 block font-mono text-2xl font-bold ${
              somenteAtrasados ? 'text-white' : 'text-rose-600'
            }`}
          >
            {contadores.atrasados}
          </span>
        </div>
      </div>

      {/* =========================================================================
          ABAS PRINCIPAIS: PENDENTES (PADRÃO) | RECEBIDOS | CANCELADOS | TODOS
      ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleSelectAba('pendentes')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
              abaAtiva === 'pendentes'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Pendentes</span>
            <span
              className={`px-1.5 py-0.2 text-[10px] rounded-full ${
                abaAtiva === 'pendentes'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {contadores.pendentes}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectAba('recebidos')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
              abaAtiva === 'recebidos'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Recebidos</span>
            <span
              className={`px-1.5 py-0.2 text-[10px] rounded-full ${
                abaAtiva === 'recebidos'
                  ? 'bg-emerald-900 text-emerald-100'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {contadores.recebidos}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectAba('cancelados')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
              abaAtiva === 'cancelados'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Cancelados</span>
            <span
              className={`px-1.5 py-0.2 text-[10px] rounded-full ${
                abaAtiva === 'cancelados'
                  ? 'bg-rose-900 text-rose-100'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {contadores.cancelados}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectAba('todos')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
              abaAtiva === 'todos'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Todos</span>
            <span
              className={`px-1.5 py-0.2 text-[10px] rounded-full ${
                abaAtiva === 'todos' ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {contadores.total}
            </span>
          </button>
        </div>

        <span className="text-[11px] text-slate-500">
          {abaAtiva === 'pendentes'
            ? 'Exibindo necessidades abertas; ao receber totalmente, o item vai automaticamente para "Recebidos".'
            : abaAtiva === 'recebidos'
            ? 'Histórico de recebimentos concluídos e atendimentos pelo estoque com rastreabilidade.'
            : abaAtiva === 'cancelados'
            ? 'Solicitações canceladas.'
            : 'Visão completa de todos os status.'}
        </span>
      </div>

      {/* =========================================================================
          FILTROS E AGRUPAMENTO
      ========================================================================= */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {/* Busca por texto */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por descrição, peça, fornecedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
            />
          </div>

          {/* Filtro Projeto */}
          <select
            value={projetoFilter}
            onChange={(e) => setProjetoFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-2xs focus:border-slate-900"
          >
            <option value="todos">Todos os Projetos</option>
            {projetos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} - {p.descricao}
              </option>
            ))}
          </select>

          {/* Filtro Fornecedor */}
          <select
            value={fornecedorFilter}
            onChange={(e) => setFornecedorFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-2xs focus:border-slate-900"
          >
            <option value="todos">Todos os Fornecedores</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>

          {/* Filtro Lista */}
          <select
            value={listaFilter}
            onChange={(e) => setListaFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-2xs focus:border-slate-900"
          >
            <option value="todos">Todas as Listas</option>
            {listasDisponiveis.map((l) => (
              <option key={l} value={l}>
                Lista: {l}
              </option>
            ))}
          </select>
        </div>

        {/* Linha secundária de filtros e agrupamento */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-2xs"
            >
              <option value="todos">Todos os Tipos</option>
              <option value="materia_prima">Matéria-Prima</option>
              <option value="item_comercial">Item Comercial</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-2xs"
            >
              <option value="todos">Todos os Status</option>
              <option value="a_solicitar">A solicitar</option>
              <option value="solicitado">Solicitado</option>
              <option value="comprado">Comprado</option>
              <option value="recebido">Recebido</option>
              <option value="atendido_estoque">Estoque</option>
              <option value="cancelado">Cancelado</option>
            </select>

            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 cursor-pointer shadow-2xs hover:bg-slate-50">
              <input
                type="checkbox"
                checked={somenteAtrasados}
                onChange={(e) => setSomenteAtrasados(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-rose-600 focus:ring-0"
              />
              <span>Somente atrasados</span>
            </label>
          </div>

          {/* Agrupamento */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
            <span>Agrupar por:</span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setModoAgrupamento('nenhum')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  modoAgrupamento === 'nenhum'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Nenhum
              </button>
              <button
                type="button"
                onClick={() => setModoAgrupamento('fornecedor')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  modoAgrupamento === 'fornecedor'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Fornecedor
              </button>
              <button
                type="button"
                onClick={() => setModoAgrupamento('lista')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  modoAgrupamento === 'lista'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Lista
              </button>
              <button
                type="button"
                onClick={() => setModoAgrupamento('projeto')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  modoAgrupamento === 'projeto'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Projeto
              </button>
            </div>
          </div>
        </div>

        {/* BARRA DE AÇÕES EM LOTE */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 animate-in fade-in">
            <div className="flex items-center gap-2 font-bold">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white font-mono text-xs">
                {selectedIds.size}
              </span>
              <span>item(ns) selecionado(s)</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={() => setBatchActionType('solicitado')}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-2xs"
                  >
                    <Clock className="h-3 w-3" />
                    <span>Marcar como Solicitado</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBatchActionType('comprado')}
                    className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 shadow-2xs"
                  >
                    <ShoppingBag className="h-3 w-3" />
                    <span>Marcar como Comprado</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBatchActionType('fornecedor')}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                  >
                    <Building2 className="h-3 w-3" />
                    <span>Alterar Fornecedor</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenDeleteBatch}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 hover:border-rose-400 shadow-2xs"
                    title="Excluir necessidades de compra selecionadas"
                  >
                    <Trash2 className="h-3 w-3 text-rose-600" />
                    <span>Excluir Selecionados</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          TABELA COMPACTA (COM OU SEM AGRUPAMENTO RECOLHÍVEL)
      ========================================================================= */}
      <div className="space-y-4">
        {gruposItens.map((grupo) => {
          const isAberta = secoesAbertas[grupo.key] !== false; // padrão aberta

          return (
            <div
              key={grupo.key}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs"
            >
              {/* Cabeçalho da Seção (quando agrupado) */}
              {modoAgrupamento !== 'nenhum' && (
                <button
                  type="button"
                  onClick={() => toggleSecao(grupo.key)}
                  className="w-full flex items-center justify-between p-3.5 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    {isAberta ? (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    )}
                    <h3 className="text-xs font-bold text-slate-900">{grupo.label}</h3>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-500">
                    {grupo.itens.length} item(ns)
                  </span>
                </button>
              )}

              {/* Tabela de Itens */}
              {isAberta && (
                <div className="overflow-x-auto">
                  {grupo.itens.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Nenhum item neste agrupamento.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="border-b border-slate-200 bg-slate-50/70 font-bold uppercase text-[10px] text-slate-600">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={
                                filteredItens.length > 0 &&
                                selectedIds.size === filteredItens.length
                              }
                              onChange={toggleSelectAll}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                            />
                          </th>
                          <th className="py-2.5 px-3 w-28">Projeto</th>
                          <th className="py-2.5 px-3 w-36">Peça (Código / Nome)</th>
                          <th className="py-2.5 px-3 w-28">Tipo</th>
                          <th className="py-2.5 px-3">Descrição / Especificação Técnica</th>
                          <th className="py-2.5 px-3 w-20 text-center">Qtd / Un</th>
                          <th className="py-2.5 px-3 w-36">Fornecedor</th>
                          <th className="py-2.5 px-3 w-20 text-center">Lista</th>
                          <th className="py-2.5 px-3 w-28 text-center">Status</th>
                          <th className="py-2.5 px-3 w-32 text-center">
                            {abaAtiva === 'recebidos' ? 'Recebimento / NF' : 'Previsão'}
                          </th>
                          <th className="py-2.5 px-3 w-36 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {grupo.itens.map((item) => {
                          const isSelected = selectedIds.has(item.id);
                          const isParcial = isRecebimentoParcial(item);
                          const qtdRecebida = getQuantidadeRecebidaItem(item);
                          const qtdPendente = getQuantidadePendenteItem(item);
                          const podeReceberAgora =
                            canReceber &&
                            (item.status === 'a_solicitar' ||
                              item.status === 'solicitado' ||
                              item.status === 'comprado') &&
                            qtdPendente > 0;
                          const podeExibirEstorno =
                            canManage &&
                            (item.status === 'recebido' || isParcial);

                          return (
                            <tr
                              key={item.id}
                              onClick={() => setItemDrawer(item)}
                              className={`cursor-pointer transition-colors ${
                                item.atrasado
                                  ? 'bg-rose-50/40 hover:bg-rose-50/70'
                                  : isSelected
                                  ? 'bg-blue-50/40 hover:bg-blue-50/60'
                                  : 'hover:bg-slate-50/80'
                              }`}
                            >
                              {/* Checkbox */}
                              <td
                                className="py-2.5 px-3 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => toggleSelectItem(item.id, e as any)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                                />
                              </td>

                              {/* Projeto */}
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                {item.projeto?.codigo || (item.tipo === 'reposicao' ? 'REPOSIÇÃO' : '—')}
                              </td>

                              {/* Peça (Código e Nome) */}
                              <td className="py-2.5 px-3">
                                {item.componente?.codigo && (
                                  <span className="block font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded w-fit mb-0.5 border border-slate-200">
                                    {item.componente.codigo}
                                  </span>
                                )}
                                <strong
                                  className="text-slate-900 block truncate max-w-[130px]"
                                  title={item.componente?.nome}
                                >
                                  {item.componente?.nome || '—'}
                                </strong>
                              </td>

                              {/* Tipo */}
                              <td className="py-2.5 px-3">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    item.tipo === 'materia_prima'
                                      ? 'bg-amber-100 text-amber-900'
                                      : item.tipo === 'reposicao'
                                      ? 'bg-indigo-100 text-indigo-900'
                                      : 'bg-purple-100 text-purple-900'
                                  }`}
                                >
                                  {item.tipo === 'materia_prima'
                                    ? 'Matéria-Prima'
                                    : item.tipo === 'reposicao'
                                    ? 'Reposição'
                                    : 'Item Comercial'}
                                </span>
                              </td>

                              {/* Descrição / Especificação / Rastro */}
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-900">
                                  {item.descricao}
                                </div>
                                <div
                                  className="font-mono text-[11px] text-slate-600 line-clamp-1"
                                  title={item.especificacao}
                                >
                                  {item.especificacao}
                                </div>
                                {(item.status === 'recebido' ||
                                  item.status === 'atendido_estoque' ||
                                  isParcial) && (
                                  <div
                                    className="mt-1 flex flex-wrap items-center gap-1.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {item.item_estoque_id && (
                                      <button
                                        type="button"
                                        onClick={() => navigateToEstoqueItem(item.item_estoque_id!)}
                                        className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100"
                                        title="Abrir item no módulo Estoque"
                                      >
                                        <ExternalLink className="h-2.5 w-2.5" />
                                        <span>
                                          Entrou no estoque
                                          {item.item_estoque?.codigo
                                            ? ` (${item.item_estoque.codigo})`
                                            : ''}
                                        </span>
                                      </button>
                                    )}
                                    {item.etiquetas_criadas &&
                                      item.etiquetas_criadas.length > 0 && (
                                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.2">
                                          <Tag className="h-2.5 w-2.5 text-slate-500" />
                                          {item.etiquetas_criadas.slice(0, 3).join(', ')}
                                          {item.etiquetas_criadas.length > 3
                                            ? ` +${item.etiquetas_criadas.length - 3}`
                                            : ''}
                                        </span>
                                      )}
                                  </div>
                                )}
                              </td>

                              {/* Quantidade e Unidade */}
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                                <div>
                                  {item.quantidade}{' '}
                                  <span className="text-[10px] uppercase font-normal text-slate-500">
                                    {item.unidade}
                                  </span>
                                </div>
                                {isParcial && (
                                  <div className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-1 mt-0.5 whitespace-nowrap">
                                    Recebido {qtdRecebida} de {item.quantidade}
                                  </div>
                                )}
                              </td>

                              {/* Fornecedor */}
                              <td className="py-2.5 px-3">
                                {item.fornecedor ? (
                                  <span
                                    className="font-semibold text-slate-800 block truncate max-w-[130px]"
                                    title={item.fornecedor.nome}
                                  >
                                    {item.fornecedor.nome}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">A definir</span>
                                )}
                              </td>

                              {/* Lista */}
                              <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600">
                                {item.numero_lista || '—'}
                              </td>

                              {/* Status */}
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${statusBadgeStyle(
                                    item.status
                                  )}`}
                                >
                                  {statusLabel(item.status)}
                                </span>
                                {isParcial && (
                                  <span className="block text-[9px] font-bold text-amber-700 mt-0.5">
                                    Falta {qtdPendente} {item.unidade}
                                  </span>
                                )}
                              </td>

                              {/* Previsão / Recebimento & NF */}
                              <td className="py-2.5 px-3 text-center font-mono">
                                {item.status === 'recebido' || item.status === 'atendido_estoque' ? (
                                  <div className="space-y-0.5">
                                    <span className="block text-emerald-800 font-bold">
                                      {item.data_recebimento
                                        ? formatDateBR(item.data_recebimento)
                                        : '—'}
                                    </span>
                                    {item.nota_fiscal && (
                                      <span className="block text-[10px] text-slate-600">
                                        NF {item.nota_fiscal}
                                      </span>
                                    )}
                                  </div>
                                ) : item.previsao_entrega ? (
                                  <div>
                                    <span
                                      className={
                                        item.atrasado ? 'font-bold text-rose-700' : 'text-slate-800'
                                      }
                                    >
                                      {formatDateBR(item.previsao_entrega)}
                                    </span>
                                    {item.atrasado && (
                                      <span className="block text-[10px] font-bold text-rose-600 font-sans">
                                        +{item.diasAtraso}d atraso
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>

                              {/* Ações Rápidas */}
                              <td
                                className="py-2.5 px-3 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="inline-flex items-center justify-end gap-1">
                                  {podeReceberAgora && (
                                    <button
                                      type="button"
                                      onClick={() => setItemParaReceber(item)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 shadow-2xs"
                                      title="Registrar recebimento com entrada no estoque"
                                    >
                                      <PackagePlus className="h-3.5 w-3.5" />
                                      <span>Receber</span>
                                    </button>
                                  )}

                                  {podeExibirEstorno && (
                                    <button
                                      type="button"
                                      disabled={!item.pode_estornar}
                                      onClick={() => {
                                        setErroEstorno(null);
                                        setMotivoEstorno('');
                                        setItemParaEstornar(item);
                                      }}
                                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${
                                        item.pode_estornar
                                          ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                                          : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                                      }`}
                                      title={
                                        item.pode_estornar
                                          ? 'Estornar recebimento e gerar movimentos inversos no estoque'
                                          : item.motivo_bloqueio_estorno || 'Estorno indisponível'
                                      }
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                      <span>Estornar</span>
                                    </button>
                                  )}

                                  {canManage && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenDeleteSingle(item)}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                      title="Excluir necessidade de compra"
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
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL 1: AÇÕES EM LOTE */}
      {batchActionType && (
        <BatchActionModal
          isOpen={Boolean(batchActionType)}
          onClose={() => setBatchActionType(null)}
          tipo={batchActionType}
          selectedCount={selectedIds.size}
          fornecedores={fornecedores.filter((f) => f.ativo)}
          onConfirm={handleConfirmBatchAction}
        />
      )}

      {/* MODAL 2: GESTÃO DE FORNECEDORES */}
      <FornecedoresModal
        isOpen={isFornecedoresModalOpen}
        onClose={() => setIsFornecedoresModalOpen(false)}
        fornecedores={fornecedores}
        onCreate={handleCreateFornecedor}
        onUpdate={handleUpdateFornecedor}
        onDelete={handleDeleteFornecedor}
      />

      {/* MODAL 3: SOLICITAÇÃO DE COMPRA PDF */}
      <SolicitacaoCompraPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        itens={filteredItens}
        configEmpresa={configEmpresa}
      />

      {/* DRAWER LATERAL: DETALHES COMPLETOS DO ITEM */}
      <ItemCompraDetalhesDrawer
        isOpen={Boolean(itemDrawer)}
        onClose={() => setItemDrawer(null)}
        item={itemDrawer}
        fornecedores={fornecedores}
        onSave={handleSaveItemDrawer}
        onDelete={handleDeleteItemDrawer}
        onRefresh={loadData}
      />

      {/* MODAL 4: CONFIRMAÇÃO DE EXCLUSÃO */}
      <ConfirmDeleteModal
        isOpen={deleteConfirmState.isOpen}
        onClose={() => setDeleteConfirmState({ isOpen: false, ids: [], itemName: '', isBatch: false })}
        onConfirm={handleConfirmDelete}
        title={deleteConfirmState.isBatch ? 'Excluir Necessidades em Lote' : 'Excluir Necessidade de Compra'}
        itemName={deleteConfirmState.itemName}
        entityTypeLabel={deleteConfirmState.isBatch ? 'Itens de Compra' : 'Necessidade de Compra'}
        isDeleting={isDeleting}
      />

      {/* MODAL 5: RECEBIMENTO COM ENTRADA ATÔMICA NO ESTOQUE */}
      <DarEntradaRecebimentoModal
        isOpen={Boolean(itemParaReceber)}
        onClose={() => setItemParaReceber(null)}
        itemCompra={itemParaReceber}
        itensEstoque={itensEstoque}
        onSuccess={(msg) => {
          setFeedback({ type: 'success', message: msg });
          setItemParaReceber(null);
          loadData();
        }}
      />

      {/* MODAL 6: CONFIRMAÇÃO DE ESTORNO DE RECEBIMENTO */}
      <Modal
        isOpen={Boolean(itemParaEstornar)}
        onClose={() => {
          if (!isEstornando) {
            setItemParaEstornar(null);
            setErroEstorno(null);
          }
        }}
        title="Estornar Recebimento"
        subtitle="Gera movimentos inversos no estoque e restaura o item de compra para a lista de pendentes"
        maxWidth="md"
      >
        {itemParaEstornar && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950 space-y-1">
              <p className="font-bold">Item: {itemParaEstornar.descricao}</p>
              <p className="text-amber-800">
                Esta ação criará lançamentos de saída/devolução no estoque (preservando o histórico
                auditável), descartará eventuais peças físicas ainda não consumidas e cancelará as
                reservas vinculadas a este recebimento.
              </p>
            </div>

            {erroEstorno && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 font-semibold flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{erroEstorno}</span>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Motivo do estorno (opcional)
              </label>
              <input
                type="text"
                value={motivoEstorno}
                onChange={(e) => setMotivoEstorno(e.target.value)}
                placeholder="Ex: Lançamento incorreto de nota fiscal ou quantidade"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isEstornando}
                onClick={() => {
                  setItemParaEstornar(null);
                  setErroEstorno(null);
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isEstornando}
                onClick={handleConfirmEstorno}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{isEstornando ? 'Estornando...' : 'Confirmar Estorno'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
