import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ProjetoComDetalhes,
  ItemCompraComDetalhes,
  Fornecedor,
  StatusItemCompra,
  ConfiguracoesSistema,
} from '../../types';
import { comprasService, PreviaGeracaoNecessidades, SnapshotDesfazer } from '../../services/comprasService';
import { toolShopService } from '../../services/toolShopService';
import { useAuth } from '../../auth/AuthContext';
import { formatDateBR } from '../../utils/formatters';
import { GerarNecessidadesModal } from './GerarNecessidadesModal';
import { ItemCompraDetalhesDrawer } from './ItemCompraDetalhesDrawer';
import { BatchActionModal, TipoBatchAction } from './BatchActionModal';
import { SolicitacaoCompraPdfModal } from './SolicitacaoCompraPdfModal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { exportComprasToExcel } from '../../utils/comprasExport';
import {
  ShoppingCart,
  Sparkles,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShoppingBag,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  RotateCcw,
  Layers,
  Building2,
  AlertCircle,
  Package,
  Trash2,
} from 'lucide-react';

interface ProjetoComprasTabProps {
  projeto: ProjetoComDetalhes;
  onRefresh?: () => void;
}

export const ProjetoComprasTab: React.FC<ProjetoComprasTabProps> = ({
  projeto,
  onRefresh,
}) => {
  const { perfil } = useAuth();
  const canEdit = perfil === 'gerente' || perfil === 'admin';
  const isLider = perfil === 'lider';

  const [itens, setItens] = useState<ItemCompraComDetalhes[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [configEmpresa, setConfigEmpresa] = useState<ConfiguracoesSistema | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros internos da aba
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [somenteAtrasados, setSomenteAtrasados] = useState(false);

  // Seleção múltipla
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modais e gavetas
  const [previaNecessidades, setPreviaNecessidades] = useState<PreviaGeracaoNecessidades | null>(null);
  const [isGerarModalOpen, setIsGerarModalOpen] = useState(false);
  const [itemSelecionadoDrawer, setItemSelecionadoDrawer] = useState<ItemCompraComDetalhes | null>(null);
  const [batchActionType, setBatchActionType] = useState<TipoBatchAction | null>(null);
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

  // Toast com botão de desfazer (15 segundos)
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
      const [itensProj, fornList, config] = await Promise.all([
        comprasService.getItensCompraComDetalhes(projeto.empresa_id, projeto.id),
        comprasService.getFornecedores(projeto.empresa_id),
        toolShopService.getConfiguracoes().catch(() => null),
      ]);
      setItens(itensProj);
      setFornecedores(fornList);
      if (config) setConfigEmpresa(config);
    } catch (err: any) {
      console.error('Erro ao carregar dados de compras do projeto:', err);
      setFeedback({ type: 'error', message: err.message || 'Erro ao carregar compras do projeto.' });
    } finally {
      setIsLoading(false);
    }
  }, [projeto.id, projeto.empresa_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Limpa o timer de undo se o componente desmontar
  useEffect(() => {
    return () => {
      if (undoState?.timerId) clearTimeout(undoState.timerId);
    };
  }, [undoState]);

  // Resumo estatístico
  const resumo = useMemo(() => {
    const total = itens.length;
    const a_solicitar = itens.filter((i) => i.status === 'a_solicitar').length;
    const solicitados = itens.filter((i) => i.status === 'solicitado').length;
    const comprados = itens.filter((i) => i.status === 'comprado').length;
    const recebidos = itens.filter((i) => i.status === 'recebido' || i.status === 'atendido_estoque').length;
    const atrasados = itens.filter((i) => i.atrasado).length;

    const percentRecebidos = total > 0 ? Math.round((recebidos / total) * 100) : 0;

    return {
      total,
      a_solicitar,
      solicitados,
      comprados,
      recebidos,
      atrasados,
      percentRecebidos,
    };
  }, [itens]);

  // Itens filtrados
  const filteredItens = useMemo(() => {
    return itens.filter((i) => {
      if (search) {
        const q = search.toLowerCase();
        const matchDesc = i.descricao.toLowerCase().includes(q);
        const matchSpec = i.especificacao?.toLowerCase().includes(q);
        const matchComp = i.componente?.nome?.toLowerCase().includes(q) || i.componente?.codigo?.toLowerCase().includes(q);
        const matchForn = i.fornecedor?.nome?.toLowerCase().includes(q);
        const matchLista = i.numero_lista?.toLowerCase().includes(q);
        if (!matchDesc && !matchSpec && !matchComp && !matchForn && !matchLista) return false;
      }

      if (statusFilter !== 'todos' && i.status !== statusFilter) return false;
      if (tipoFilter !== 'todos' && i.tipo !== tipoFilter) return false;
      if (somenteAtrasados && !i.atrasado) return false;

      return true;
    });
  }, [itens, search, statusFilter, tipoFilter, somenteAtrasados]);

  // Handlers de seleção
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

  // Gerar Necessidades
  const handleOpenGerarModal = async () => {
    try {
      const prev = await comprasService.gerarPreviaNecessidadesCompra(projeto.id, projeto.empresa_id);
      setPreviaNecessidades(prev);
      setIsGerarModalOpen(true);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao gerar prévia de necessidades.' });
    }
  };

  const handleConfirmarGeracao = async (
    itensConfirmados: any[],
    fornecedoresParaCadastrar: string[]
  ) => {
    try {
      const criados = await comprasService.confirmarGeracaoNecessidades(
        itensConfirmados,
        fornecedoresParaCadastrar,
        projeto.empresa_id
      );
      setFeedback({
        type: 'success',
        message: `${criados.length} necessidade(s) de compra gerada(s) com sucesso!`,
      });
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao gravar necessidades de compra.' });
      throw err;
    }
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
      if (onRefresh) onRefresh();

      // Configura toast de Desfazer por 15 segundos
      if (undoState?.timerId) clearTimeout(undoState.timerId);

      const timer = setTimeout(() => {
        setUndoState(null);
      }, 15000);

      setUndoState({
        mensagem: `${ids.length} item(ns) atualizado(s) com sucesso!`,
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
      setFeedback({ type: 'success', message: 'Alteração desfeita com sucesso!' });
      await loadData();
      if (onRefresh) onRefresh();
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
      if (onRefresh) onRefresh();
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
      if (onRefresh) onRefresh();
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
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao excluir item(ns).' });
    } finally {
      setIsDeleting(false);
    }
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
      {/* Toast com opção de Desfazer por 15 segundos */}
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
          1. RESUMO DE COMPRAS DO PROJETO E BARRA DE PROGRESSO
      ========================================================================= */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-slate-700" />
              <h3 className="text-base font-bold text-slate-900">
                Necessidades de Compra & Materiais · {projeto.codigo}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhamento de matéria-prima e itens comerciais requeridos para esta ferramenta
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={handleOpenGerarModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                title="Gera automaticamente itens de compra para os componentes desta ferramenta"
              >
                <Sparkles className="h-4 w-4" />
                <span>Gerar necessidades de compra</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => exportComprasToExcel(filteredItens, `compras_${projeto.codigo}`)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              title="Exportar itens visíveis para planilha Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
              <span>Exportar Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPdfModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              title="Gerar PDF de Solicitação de Compra"
            >
              <Printer className="h-4 w-4 text-slate-600" />
              <span>Solicitação PDF</span>
            </button>
          </div>
        </div>

        {/* Barra de Progresso "X de Y recebidos" */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-700">Progresso de Materiais Recebidos:</span>
            <span className="font-mono text-slate-900 font-bold">
              {resumo.recebidos} de {resumo.total} recebidos ({resumo.percentRecebidos}%)
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${resumo.percentRecebidos}%` }}
            />
          </div>
        </div>

        {/* Cards de Contagem do Projeto */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <span className="block text-[11px] font-bold text-slate-500 uppercase">Total Itens</span>
            <span className="font-mono text-xl font-bold text-slate-900 mt-0.5 block">{resumo.total}</span>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <span className="block text-[11px] font-bold text-slate-500 uppercase">A Solicitar</span>
            <span className="font-mono text-xl font-bold text-slate-700 mt-0.5 block">{resumo.a_solicitar}</span>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
            <span className="block text-[11px] font-bold text-blue-900 uppercase">Solicitados</span>
            <span className="font-mono text-xl font-bold text-blue-950 mt-0.5 block">{resumo.solicitados}</span>
          </div>

          <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3">
            <span className="block text-[11px] font-bold text-purple-900 uppercase">Comprados</span>
            <span className="font-mono text-xl font-bold text-purple-950 mt-0.5 block">{resumo.comprados}</span>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
            <span className="block text-[11px] font-bold text-emerald-800 uppercase">Recebidos</span>
            <span className="font-mono text-xl font-bold text-emerald-950 mt-0.5 block">{resumo.recebidos}</span>
          </div>

          <div className={`rounded-xl border p-3 ${
            resumo.atrasados > 0
              ? 'border-rose-200 bg-rose-50 text-rose-900 font-bold'
              : 'border-slate-100 bg-slate-50/70 text-slate-500'
          }`}>
            <span className="block text-[11px] uppercase">Atrasados</span>
            <span className="font-mono text-xl font-bold mt-0.5 block">
              {resumo.atrasados}
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. FILTROS E AÇÕES EM LOTE
      ========================================================================= */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Busca por texto */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por descrição, especificação, peça, fornecedor, lista..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
            />
          </div>

          {/* Filtros em dropdown */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 shadow-2xs focus:border-slate-900"
            >
              <option value="todos">Todos os status</option>
              <option value="a_solicitar">A solicitar</option>
              <option value="solicitado">Solicitado</option>
              <option value="comprado">Comprado</option>
              <option value="recebido">Recebido</option>
              <option value="atendido_estoque">Estoque</option>
              <option value="cancelado">Cancelado</option>
            </select>

            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 shadow-2xs focus:border-slate-900"
            >
              <option value="todos">Todos os tipos</option>
              <option value="materia_prima">Matéria-Prima</option>
              <option value="item_comercial">Item Comercial</option>
            </select>

            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 cursor-pointer shadow-2xs hover:bg-slate-50">
              <input
                type="checkbox"
                checked={somenteAtrasados}
                onChange={(e) => setSomenteAtrasados(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-rose-600 focus:ring-0"
              />
              <span>Somente atrasados</span>
            </label>
          </div>
        </div>

        {/* BARRA DE AÇÕES EM LOTE (QUANDO HOUVER SELEÇÃO) */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 animate-in fade-in">
            <div className="flex items-center gap-2 font-bold">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white font-mono text-xs">
                {selectedIds.size}
              </span>
              <span>item(ns) selecionado(s)</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canEdit && (
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
                </>
              )}

              {/* Líder também tem permissão para registrar "recebido" */}
              <button
                type="button"
                onClick={() => setBatchActionType('recebido')}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-2xs"
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>Marcar como Recebido</span>
              </button>

              {canEdit && (
                <>
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
          3. TABELA COMPACTA DE ITENS DE COMPRA
      ========================================================================= */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        {filteredItens.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            {itens.length === 0 ? (
              <div className="space-y-3">
                <Package className="mx-auto h-10 w-10 text-slate-300" />
                <p className="font-semibold text-slate-700 text-sm">
                  Nenhum item de compra gerado para este projeto ainda.
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Clique em "Gerar necessidades de compra" acima para ler a estrutura de peças do molde e criar requisições de matéria-prima e itens comerciais.
                </p>
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleOpenGerarModal}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Gerar necessidades de compra</span>
                  </button>
                )}
              </div>
            ) : (
              'Nenhum item corresponde aos filtros selecionados.'
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-slate-200 bg-slate-50/80 font-bold uppercase text-[10px] text-slate-600">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredItens.length > 0 && selectedIds.size === filteredItens.length}
                      onChange={toggleSelectAll}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3 w-36">Peça (Código / Nome)</th>
                  <th className="py-2.5 px-3 w-28">Tipo</th>
                  <th className="py-2.5 px-3">Descrição / Especificação Técnica</th>
                  <th className="py-2.5 px-3 w-20 text-center">Qtd / Un</th>
                  <th className="py-2.5 px-3 w-36">Fornecedor</th>
                  <th className="py-2.5 px-3 w-20 text-center">Lista</th>
                  <th className="py-2.5 px-3 w-28 text-center">Status</th>
                  <th className="py-2.5 px-3 w-28 text-center">Previsão</th>
                  <th className="py-2.5 px-3 w-12 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredItens.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setItemSelecionadoDrawer(item)}
                      className={`cursor-pointer transition-colors ${
                        item.atrasado
                          ? 'bg-rose-50/40 hover:bg-rose-50/70'
                          : isSelected
                          ? 'bg-blue-50/40 hover:bg-blue-50/60'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleSelectItem(item.id, e as any)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Peça (Código e Nome) */}
                      <td className="py-2.5 px-3">
                        {item.componente?.codigo && (
                          <span className="block font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded w-fit mb-0.5 border border-slate-200">
                            {item.componente.codigo}
                          </span>
                        )}
                        <strong className="text-slate-900 block truncate max-w-[140px]" title={item.componente?.nome}>
                          {item.componente?.nome || '—'}
                        </strong>
                      </td>

                      {/* Tipo */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.tipo === 'materia_prima'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-purple-100 text-purple-900'
                          }`}
                        >
                          {item.tipo === 'materia_prima' ? 'Matéria-Prima' : 'Item Comercial'}
                        </span>
                      </td>

                      {/* Descrição / Especificação */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{item.descricao}</div>
                        <div className="font-mono text-[11px] text-slate-600 line-clamp-1" title={item.especificacao}>
                          {item.especificacao}
                        </div>
                      </td>

                      {/* Quantidade e Unidade */}
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                        {item.quantidade} <span className="text-[10px] uppercase font-normal text-slate-500">{item.unidade}</span>
                      </td>

                      {/* Fornecedor */}
                      <td className="py-2.5 px-3">
                        {item.fornecedor ? (
                          <span className="font-semibold text-slate-800 block truncate max-w-[130px]">
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
                      </td>

                      {/* Previsão de Entrega & Atraso */}
                      <td className="py-2.5 px-3 text-center font-mono">
                        {item.previsao_entrega ? (
                          <div>
                            <span className={item.atrasado ? 'font-bold text-rose-700' : 'text-slate-800'}>
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
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteSingle(item)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            title="Excluir necessidade de compra"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: GERAÇÃO AUTOMÁTICA DE NECESSIDADES */}
      <GerarNecessidadesModal
        isOpen={isGerarModalOpen}
        onClose={() => setIsGerarModalOpen(false)}
        previa={previaNecessidades}
        onConfirm={handleConfirmarGeracao}
      />

      {/* MODAL 2: AÇÕES EM LOTE */}
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

      {/* MODAL 3: SOLICITAÇÃO DE COMPRA PDF */}
      <SolicitacaoCompraPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        itens={filteredItens}
        configEmpresa={configEmpresa}
        titulo={`SOLICITAÇÃO DE COMPRA · PROJETO ${projeto.codigo}`}
      />

      {/* DRAWER LATERAL: DETALHES COMPLETOS DO ITEM */}
      <ItemCompraDetalhesDrawer
        isOpen={Boolean(itemSelecionadoDrawer)}
        onClose={() => setItemSelecionadoDrawer(null)}
        item={itemSelecionadoDrawer}
        fornecedores={fornecedores}
        onSave={handleSaveItemDrawer}
        onDelete={handleDeleteItemDrawer}
        onRefresh={() => {
          loadData();
          if (onRefresh) onRefresh();
        }}
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
    </div>
  );
};
