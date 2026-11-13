import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ItemEstoqueComDetalhes,
  UnidadeEstoqueComDetalhes,
  MovimentoEstoqueComDetalhes,
  ReservaEstoqueComDetalhes,
  ProjetoComDetalhes,
  CategoriaItemEstoque,
  Fornecedor,
} from '../types';
import { estoqueService } from '../services/estoqueService';
import { toolShopService } from '../services/toolShopService';
import { comprasService } from '../services/comprasService';
import { useAuth } from '../auth/AuthContext';
import { formatDateBR, formatDateTimeBR } from '../utils/formatters';
import { consumeFocusEstoqueItem } from '../utils/estoqueNavigation';
import { ItemEstoqueModal } from '../components/estoque/ItemEstoqueModal';
import { ItemEstoqueDrawer } from '../components/estoque/ItemEstoqueDrawer';
import {
  EntradaSaidaModal,
  TipoOperacaoEstoque,
} from '../components/estoque/EntradaSaidaModal';
import { RegistrarSobraModal } from '../components/estoque/RegistrarSobraModal';
import { ProcurarPecaModal } from '../components/estoque/ProcurarPecaModal';
import { InventarioModal } from '../components/estoque/InventarioModal';
import { EtiquetaPecaPdfModal } from '../components/estoque/EtiquetaPecaPdfModal';
import { GerarSolicitacaoReposicaoModal } from '../components/estoque/GerarSolicitacaoReposicaoModal';
import {
  exportItensEstoqueToExcel,
  exportMovimentosEstoqueToExcel,
  exportUnidadesEstoqueToExcel,
} from '../utils/estoqueExport';
import {
  Package,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  SlidersHorizontal,
  Scissors,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Printer,
  Plus,
  Box,
  Compass,
  ClipboardCheck,
  MapPin,
  BookmarkPlus,
  ArrowRight,
  History,
  Check,
  X,
  ShoppingCart,
} from 'lucide-react';

export type EstoqueTab = 'itens' | 'pecas' | 'movimentos' | 'inventario';

export const EstoqueView: React.FC = () => {
  const { user, can } = useAuth();
  const canManage = can('editar', 'estoque');
  const canAdjust = can('ajustar', 'estoque');

  const [activeTab, setActiveTab] = useState<EstoqueTab>('itens');
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Dados carregados do serviço
  const [itens, setItens] = useState<ItemEstoqueComDetalhes[]>([]);
  const [unidades, setUnidades] = useState<UnidadeEstoqueComDetalhes[]>([]);
  const [movimentos, setMovimentos] = useState<MovimentoEstoqueComDetalhes[]>([]);
  const [reservas, setReservas] = useState<ReservaEstoqueComDetalhes[]>([]);
  const [projetos, setProjetos] = useState<ProjetoComDetalhes[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  // Filtros - Aba 1: Itens
  const [searchItem, setSearchItem] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todas');
  const [localizacaoFilter, setLocalizacaoFilter] = useState<string>('todas');
  const [somenteAbaixoMinimo, setSomenteAbaixoMinimo] = useState(false);
  const [somenteAtivos, setSomenteAtivos] = useState(true);

  // Filtros - Aba 2: Peças e Sobras
  const [searchPeca, setSearchPeca] = useState('');
  const [formatoFilter, setFormatoFilter] = useState<string>('todos');
  const [origemFilter, setOrigemFilter] = useState<string>('todas');
  const [statusPecaFilter, setStatusPecaFilter] = useState<string>('disponivel');

  // Filtros - Aba 3: Movimentos
  const [searchMovimento, setSearchMovimento] = useState('');
  const [tipoMovFilter, setTipoMovFilter] = useState<string>('todos');
  const [motivoMovFilter, setMotivoMovFilter] = useState<string>('todos');

  // Seleção em lote na aba de Itens
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Modais e Drawer
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemParaEditar, setItemParaEditar] = useState<ItemEstoqueComDetalhes | null>(null);

  const [drawerItem, setDrawerItem] = useState<ItemEstoqueComDetalhes | null>(null);

  const [isEntradaSaidaOpen, setIsEntradaSaidaOpen] = useState(false);
  const [tipoOperacaoModal, setTipoOperacaoModal] = useState<TipoOperacaoEstoque>('entrada');
  const [itemParaOperacao, setItemParaOperacao] = useState<ItemEstoqueComDetalhes | null>(null);

  const [isRegistrarSobraOpen, setIsRegistrarSobraOpen] = useState(false);
  const [isProcurarPecaOpen, setIsProcurarPecaOpen] = useState(false);
  const [isInventarioOpen, setIsInventarioOpen] = useState(false);
  const [isReposicaoModalOpen, setIsReposicaoModalOpen] = useState(false);

  const [etiquetaModalUnidade, setEtiquetaModalUnidade] = useState<UnidadeEstoqueComDetalhes | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [itList, unList, movList, resList, projList, fornList] = await Promise.all([
        estoqueService.getItensComDetalhes(),
        estoqueService.getUnidadesComDetalhes(),
        estoqueService.getMovimentosComDetalhes(),
        estoqueService.getReservasComDetalhes(),
        toolShopService.getProjetosComDetalhes(),
        comprasService.getFornecedores(),
      ]);

      setItens(itList);
      setUnidades(unList);
      setMovimentos(movList);
      setReservas(resList);
      setProjetos(projList);
      setFornecedores(fornList);

      // Atualiza referência do item no drawer se estiver aberto ou se veio de deep-link
      const focusId = consumeFocusEstoqueItem();
      if (focusId) {
        const focused = itList.find((i) => i.id === focusId) || null;
        if (focused) {
          setActiveTab('itens');
          setDrawerItem(focused);
        }
      } else if (drawerItem) {
        const refreshed = itList.find((i) => i.id === drawerItem.id) || null;
        setDrawerItem(refreshed);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados do estoque:', err);
      showFeedback('error', err.message || 'Erro ao carregar dados de estoque.');
    } finally {
      setIsLoading(false);
    }
  }, [drawerItem?.id]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleFocusEvent = (e: Event) => {
      const custom = e as CustomEvent<{ itemId?: string }>;
      const targetId = custom.detail?.itemId || consumeFocusEstoqueItem();
      if (!targetId) return;
      const found = itens.find((i) => i.id === targetId);
      if (found) {
        consumeFocusEstoqueItem();
        setActiveTab('itens');
        setDrawerItem(found);
      } else {
        loadData();
      }
    };

    window.addEventListener('toolshop:focus-estoque-item', handleFocusEvent);
    return () => window.removeEventListener('toolshop:focus-estoque-item', handleFocusEvent);
  }, [itens, loadData]);

  // Opções únicas de localização para filtro
  const localizacoesUnicas = useMemo(() => {
    const set = new Set<string>();
    itens.forEach((i) => {
      if (i.localizacao_padrao) set.add(i.localizacao_padrao.trim());
    });
    return Array.from(set).sort();
  }, [itens]);

  // KPIs do Cabeçalho
  const totalItens = itens.length;
  const totalAbaixoMinimo = itens.filter((i) => i.abaixo_minimo).length;
  const totalPecasFisicas = unidades.filter((u) => u.status === 'disponivel').length;
  const totalReservasAtivas = reservas.filter((r) => r.status === 'ativa').length;

  // Filtragem Aba 1: Itens
  const itensFiltrados = useMemo(() => {
    const q = searchItem.trim().toLowerCase();
    return itens.filter((it) => {
      if (somenteAtivos && !it.ativo) return false;
      if (somenteAbaixoMinimo && !it.abaixo_minimo) return false;
      if (categoriaFilter !== 'todas' && it.categoria !== categoriaFilter) return false;
      if (localizacaoFilter !== 'todas' && it.localizacao_padrao !== localizacaoFilter) return false;

      if (!q) return true;
      return (
        it.codigo.toLowerCase().includes(q) ||
        it.descricao.toLowerCase().includes(q) ||
        it.especificacao.toLowerCase().includes(q) ||
        (it.localizacao_padrao && it.localizacao_padrao.toLowerCase().includes(q))
      );
    });
  }, [itens, searchItem, categoriaFilter, localizacaoFilter, somenteAbaixoMinimo, somenteAtivos]);

  // Filtragem Aba 2: Peças e Sobras
  const unidadesFiltradas = useMemo(() => {
    const q = searchPeca.trim().toLowerCase();
    return unidades.filter((u) => {
      if (statusPecaFilter !== 'todos' && u.status !== statusPecaFilter) return false;
      if (formatoFilter !== 'todos' && u.formato !== formatoFilter) return false;
      if (origemFilter !== 'todas' && u.origem !== origemFilter) return false;

      if (!q) return true;
      return (
        u.etiqueta.toLowerCase().includes(q) ||
        (u.material && u.material.toLowerCase().includes(q)) ||
        (u.item?.codigo && u.item.codigo.toLowerCase().includes(q)) ||
        (u.item?.descricao && u.item.descricao.toLowerCase().includes(q)) ||
        (u.localizacao && u.localizacao.toLowerCase().includes(q))
      );
    });
  }, [unidades, searchPeca, statusPecaFilter, formatoFilter, origemFilter]);

  // Filtragem Aba 3: Movimentos
  const movimentosFiltrados = useMemo(() => {
    const q = searchMovimento.trim().toLowerCase();
    return movimentos.filter((m) => {
      if (tipoMovFilter !== 'todos' && m.tipo !== tipoMovFilter) return false;
      if (motivoMovFilter !== 'todos' && m.motivo !== motivoMovFilter) return false;

      if (!q) return true;
      return (
        (m.item?.codigo && m.item.codigo.toLowerCase().includes(q)) ||
        (m.item?.descricao && m.item.descricao.toLowerCase().includes(q)) ||
        (m.unidade?.etiqueta && m.unidade.etiqueta.toLowerCase().includes(q)) ||
        (m.usuario_nome && m.usuario_nome.toLowerCase().includes(q)) ||
        (m.projeto_codigo && m.projeto_codigo.toLowerCase().includes(q)) ||
        (m.observacoes && m.observacoes.toLowerCase().includes(q))
      );
    });
  }, [movimentos, searchMovimento, tipoMovFilter, motivoMovFilter]);

  // Seleção em lote
  const handleToggleSelectAll = () => {
    if (selectedItemIds.size === itensFiltrados.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(itensFiltrados.map((i) => i.id)));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    const next = new Set(selectedItemIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedItemIds(next);
  };

  const abrirOperacao = (tipo: TipoOperacaoEstoque, item?: ItemEstoqueComDetalhes) => {
    setTipoOperacaoModal(tipo);
    setItemParaOperacao(item || null);
    setIsEntradaSaidaOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Alerta de Feedback */}
      {feedback && (
        <div
          className={`rounded-2xl border p-4 text-xs font-semibold flex items-center justify-between shadow-xs ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="p-1 hover:opacity-70">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* CABEÇALHO DO MÓDULO & AÇÕES RÁPIDAS */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-amber-400 shadow-xs">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                Estoque & Rastreabilidade de Materiais
              </h2>
              <p className="text-xs text-slate-500">
                Controle atômico de saldos, retalhos físicos em 3D, reservas e inventário
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Ação Geral */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => abrirOperacao('entrada')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
          >
            <ArrowDownRight className="h-4 w-4 text-emerald-400" />
            <span>Entrada</span>
          </button>

          <button
            type="button"
            onClick={() => abrirOperacao('saida')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-2xs hover:bg-slate-50"
          >
            <ArrowUpRight className="h-4 w-4 text-rose-500" />
            <span>Saída</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRegistrarSobraOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2 text-xs font-semibold text-purple-900 shadow-2xs hover:bg-purple-100"
          >
            <Scissors className="h-4 w-4 text-purple-700" />
            <span>Registrar Sobra</span>
          </button>

          <button
            type="button"
            onClick={() => setIsProcurarPecaOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-900 shadow-2xs hover:bg-blue-100"
          >
            <Compass className="h-4 w-4 text-blue-700" />
            <span>Procurar Peça (3D)</span>
          </button>

          {canManage && (
            <button
              type="button"
              onClick={() => {
                setItemParaEditar(null);
                setIsItemModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
            >
              <Plus className="h-4 w-4 text-amber-400" />
              <span>Novo Item</span>
            </button>
          )}
        </div>
      </div>

      {/* CARDS DE INDICADORES / KPIS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total de Itens
          </span>
          <span className="font-mono text-2xl font-extrabold text-slate-900 mt-1 block">
            {totalItens}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Cadastrados no catálogo</span>
        </div>

        <div
          className={`rounded-2xl border p-4 shadow-2xs ${
            totalAbaixoMinimo > 0
              ? 'border-rose-300 bg-rose-50/50 text-rose-950'
              : 'border-slate-200 bg-white text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Abaixo do Mínimo
            </span>
            {totalAbaixoMinimo > 0 && <AlertTriangle className="h-4 w-4 text-rose-600" />}
          </div>
          <span className="font-mono text-2xl font-extrabold text-rose-700 mt-1 block">
            {totalAbaixoMinimo}
          </span>
          <span className="text-[11px] text-slate-500 block mt-0.5">Necessitam reposição urgente</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Peças e Sobras Físicas
          </span>
          <span className="font-mono text-2xl font-extrabold text-slate-900 mt-1 block">
            {totalPecasFisicas}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Disponíveis com etiquetas QR</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Reservas Ativas
          </span>
          <span className="font-mono text-2xl font-extrabold text-blue-900 mt-1 block">
            {totalReservasAtivas}
          </span>
          <span className="text-[11px] text-blue-600 block mt-0.5">Comprometidas com projetos</span>
        </div>
      </div>

      {/* ABAS PRINCIPAIS */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('itens')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
              activeTab === 'itens'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Package className="h-4 w-4" />
            <span>Itens de Estoque</span>
            <span
              className={`ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full ${
                activeTab === 'itens' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {itensFiltrados.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pecas')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
              activeTab === 'pecas'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Box className="h-4 w-4" />
            <span>Peças e Sobras</span>
            <span
              className={`ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full ${
                activeTab === 'pecas' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {unidadesFiltradas.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('movimentos')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
              activeTab === 'movimentos'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Histórico de Movimentos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inventario')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
              activeTab === 'inventario'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ClipboardCheck className="h-4 w-4" />
            <span>Inventário Físico</span>
          </button>
        </div>

        {/* Botão de Reposição e Exportação Contextual */}
        <div className="flex items-center gap-2">
          {activeTab === 'itens' && (
            <>
              <button
                type="button"
                onClick={() => setIsReposicaoModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 shadow-2xs hover:bg-amber-100 transition-colors"
                title="Gerar solicitações de compra para reposição de itens abaixo do estoque mínimo"
              >
                <ShoppingCart className="h-4 w-4 text-amber-700" />
                <span>Gerar solicitação de compra</span>
                {totalAbaixoMinimo > 0 && (
                  <span className="rounded-full bg-amber-200 px-1.5 py-0.2 text-[10px] font-extrabold text-amber-950">
                    {totalAbaixoMinimo}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => exportItensEstoqueToExcel(itensFiltrados)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>Exportar Excel</span>
              </button>
            </>
          )}

          {activeTab === 'pecas' && (
            <button
              type="button"
              onClick={() => exportUnidadesEstoqueToExcel(unidadesFiltradas)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Exportar Peças</span>
            </button>
          )}

          {activeTab === 'movimentos' && (
            <button
              type="button"
              onClick={() => exportMovimentosEstoqueToExcel(movimentosFiltrados)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Exportar Movimentos</span>
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* ABA 1: ITENS DE ESTOQUE                                               */}
      {/* ===================================================================== */}
      {activeTab === 'itens' && (
        <div className="space-y-4">
          {/* Filtros da Aba de Itens */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchItem}
                onChange={(e) => setSearchItem(e.target.value)}
                placeholder="Buscar por código, descrição ou especificação..."
                className="pl-9 block w-full rounded-xl border border-slate-300 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={categoriaFilter}
                onChange={(e) => setCategoriaFilter(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
              >
                <option value="todas">Todas Categorias</option>
                <option value="materia_prima">Matéria-prima</option>
                <option value="item_comercial">Item Comercial</option>
                <option value="consumivel">Consumível</option>
                <option value="outro">Outro</option>
              </select>

              <select
                value={localizacaoFilter}
                onChange={(e) => setLocalizacaoFilter(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
              >
                <option value="todas">Todas Localizações</option>
                {localizacoesUnicas.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer pl-2">
                <input
                  type="checkbox"
                  checked={somenteAbaixoMinimo}
                  onChange={(e) => setSomenteAbaixoMinimo(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-rose-700">Somente abaixo do mínimo</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer pl-2">
                <input
                  type="checkbox"
                  checked={somenteAtivos}
                  onChange={(e) => setSomenteAtivos(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Apenas ativos</span>
              </label>
            </div>
          </div>

          {/* Tabela de Itens */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          itensFiltrados.length > 0 && selectedItemIds.size === itensFiltrados.length
                        }
                        onChange={handleToggleSelectAll}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                    </th>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Descrição & Especificação</th>
                    <th className="py-2.5 px-3">Categoria</th>
                    <th className="py-2.5 px-3 text-center">Un.</th>
                    <th className="py-2.5 px-3 text-right">Saldo Físico</th>
                    <th className="py-2.5 px-3 text-right">Reservado</th>
                    <th className="py-2.5 px-3 text-right">Disponível</th>
                    <th className="py-2.5 px-3 text-center">Mínimo</th>
                    <th className="py-2.5 px-3">Localização</th>
                    <th className="py-2.5 px-3 text-center">Alertas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itensFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        Nenhum item encontrado no estoque com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    itensFiltrados.map((it) => {
                      const isSelected = selectedItemIds.has(it.id);

                      return (
                        <tr
                          key={it.id}
                          onClick={() => setDrawerItem(it)}
                          className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                            isSelected ? 'bg-blue-50/70' : ''
                          }`}
                        >
                          <td
                            className="py-2.5 px-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectOne(it.id)}
                              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                            />
                          </td>

                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            {it.codigo}
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-900 block truncate max-w-xs">
                              {it.descricao}
                            </span>
                            {it.especificacao && (
                              <span className="text-[11px] text-slate-400 truncate block max-w-xs font-mono">
                                {it.especificacao}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 capitalize">
                              {it.categoria.replace('_', ' ')}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                            {it.unidade}
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-900">
                            {it.saldo}
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-amber-800">
                            {it.reservado > 0 ? it.reservado : '—'}
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-800">
                            {it.disponivel}
                          </td>

                          <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                            {it.estoque_minimo !== undefined ? it.estoque_minimo : '—'}
                          </td>

                          <td className="py-2.5 px-3 text-slate-600 truncate max-w-[140px]">
                            {it.localizacao_padrao || '—'}
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            {it.abaixo_minimo ? (
                              <span className="inline-flex items-center gap-1 rounded bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                                <AlertTriangle className="h-3 w-3 text-rose-600" />
                                <span>Abaixo</span>
                              </span>
                            ) : (
                              <span className="text-slate-300 text-[11px]">—</span>
                            )}
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
      )}

      {/* ===================================================================== */}
      {/* ABA 2: PEÇAS FÍSICAS E SOBRAS (UNIDADE ESTOQUE)                       */}
      {/* ===================================================================== */}
      {activeTab === 'pecas' && (
        <div className="space-y-4">
          {/* Barra de Filtros da Aba de Peças */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[220px] flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchPeca}
                  onChange={(e) => setSearchPeca(e.target.value)}
                  placeholder="Buscar por etiqueta, material ou localização..."
                  className="pl-9 block w-full rounded-xl border border-slate-300 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:ring-slate-900"
                />
              </div>

              <select
                value={statusPecaFilter}
                onChange={(e) => setStatusPecaFilter(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
              >
                <option value="todos">Todos Status</option>
                <option value="disponivel">Apenas Disponíveis</option>
                <option value="reservada">Reservadas</option>
                <option value="consumida">Consumidas</option>
                <option value="descartada">Descartadas</option>
              </select>

              <select
                value={formatoFilter}
                onChange={(e) => setFormatoFilter(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
              >
                <option value="todos">Todos Formatos</option>
                <option value="BLOCO">Bloco</option>
                <option value="BARRA_REDONDA">Barra Redonda</option>
                <option value="CHAPA">Chapa</option>
                <option value="BARRA_CHATA">Barra Chata</option>
              </select>

              <select
                value={origemFilter}
                onChange={(e) => setOrigemFilter(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
              >
                <option value="todas">Todas Origens</option>
                <option value="compra">Compras</option>
                <option value="sobra">Retalhos / Sobras</option>
                <option value="ajuste">Ajustes</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsProcurarPecaOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700"
              >
                <Compass className="h-4 w-4" />
                <span>Procurar Peça que Atenda</span>
              </button>
            </div>
          </div>

          {/* Tabela de Peças e Sobras */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Etiqueta</th>
                    <th className="py-2.5 px-3">Item / Material</th>
                    <th className="py-2.5 px-3">Formato</th>
                    <th className="py-2.5 px-3">Dimensões Físicas (mm)</th>
                    <th className="py-2.5 px-3 text-right">Peso (kg)</th>
                    <th className="py-2.5 px-3">Localização</th>
                    <th className="py-2.5 px-3">Origem</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unidadesFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        Nenhuma peça física ou retalho encontrado.
                      </td>
                    </tr>
                  ) : (
                    unidadesFiltradas.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {u.etiqueta}
                          </span>
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-900 block truncate max-w-xs">
                            {u.material || u.item?.especificacao}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono block">
                            {u.item?.codigo} — {u.item?.descricao}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-slate-700 capitalize">
                          {u.formato?.toLowerCase().replace('_', ' ')}
                        </td>

                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                          {u.diametro_mm
                            ? `Ø ${u.diametro_mm} × ${u.comprimento_mm} mm`
                            : `${u.comprimento_mm || 0} × ${u.largura_mm || 0} × ${
                                u.espessura_mm || 0
                              } mm`}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {u.peso_kg ? u.peso_kg.toFixed(2) : '—'}
                        </td>

                        <td className="py-2.5 px-3 text-slate-600">
                          {u.localizacao || 'Almoxarifado'}
                        </td>

                        <td className="py-2.5 px-3">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              u.origem === 'sobra'
                                ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {u.origem === 'sobra' ? 'SOBRA / RETALHO' : 'COMPRA'}
                          </span>
                          {(u.numero_pedido || u.nota_fiscal || u.origem_projeto_codigo) && (
                            <span className="block text-[10px] text-slate-500 mt-0.5 font-mono">
                              {[
                                u.numero_pedido ? `Ped. ${u.numero_pedido}` : null,
                                u.nota_fiscal ? `NF ${u.nota_fiscal}` : null,
                                u.origem_projeto_codigo ? `O.S. ${u.origem_projeto_codigo}` : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          )}
                          {u.lote_ou_certificado && (
                            <span className="block text-[10px] text-slate-400 font-mono">
                              Cert/Lote: {u.lote_ou_certificado}
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                              u.status === 'disponivel'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : u.status === 'reservada'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setEtiquetaModalUnidade(u)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span>Etiqueta</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 3: HISTÓRICO DE MOVIMENTOS                                        */}
      {/* ===================================================================== */}
      {activeTab === 'movimentos' && (
        <div className="space-y-4">
          {/* Barra de Filtros de Movimentos */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchMovimento}
                onChange={(e) => setSearchMovimento(e.target.value)}
                placeholder="Buscar por código, usuário, projeto ou observação..."
                className="pl-9 block w-full rounded-xl border border-slate-300 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:ring-slate-900"
              />
            </div>

            <select
              value={tipoMovFilter}
              onChange={(e) => setTipoMovFilter(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
            >
              <option value="todos">Todos os Tipos</option>
              <option value="entrada">Entradas (+)</option>
              <option value="saida">Saídas (-)</option>
              <option value="ajuste">Ajustes (±)</option>
            </select>

            <select
              value={motivoMovFilter}
              onChange={(e) => setMotivoMovFilter(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
            >
              <option value="todos">Todos os Motivos</option>
              <option value="compra">Compra</option>
              <option value="producao">Produção</option>
              <option value="inventario">Inventário</option>
              <option value="perda">Perda / Descarte</option>
              <option value="devolucao">Devolução</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          {/* Tabela de Movimentos */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Data / Hora</th>
                    <th className="py-2.5 px-3">Tipo & Qtd</th>
                    <th className="py-2.5 px-3">Item / Código</th>
                    <th className="py-2.5 px-3">Peça Física</th>
                    <th className="py-2.5 px-3">Motivo</th>
                    <th className="py-2.5 px-3">Usuário</th>
                    <th className="py-2.5 px-3">Projeto / O.S.</th>
                    <th className="py-2.5 px-3">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movimentosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        Nenhuma movimentação registrada com os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    movimentosFiltrados.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                          {formatDateTimeBR(m.data_hora)}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-extrabold ${
                              m.tipo === 'entrada'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : m.tipo === 'saida'
                                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {m.tipo === 'entrada' ? '+' : m.tipo === 'saida' ? '-' : '±'} {m.quantidade}{' '}
                            {m.item?.unidade || 'un'}
                          </span>
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="font-mono font-bold text-slate-900 block">
                            {m.item?.codigo}
                          </span>
                          <span className="text-slate-600 truncate max-w-xs block text-[11px]">
                            {m.item?.descricao}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                          {m.unidade?.etiqueta ? (
                            <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.2">
                              {m.unidade.etiqueta}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>

                        <td className="py-2.5 px-3 capitalize font-medium text-slate-800">
                          <div>{m.motivo}</div>
                          {(m.item_compra_id || m.numero_pedido || m.nota_fiscal) && (
                            <div className="text-[10px] text-slate-500 font-mono normal-case mt-0.5">
                              {[
                                'Compra',
                                m.numero_pedido ? `Ped. ${m.numero_pedido}` : null,
                                m.nota_fiscal ? `NF ${m.nota_fiscal}` : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          {m.usuario_nome || '—'}
                        </td>

                        <td className="py-2.5 px-3 font-mono">
                          {m.projeto_codigo ? (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 border border-slate-200 text-slate-800 font-bold">
                              {m.projeto_codigo}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-slate-500 truncate max-w-xs">
                          {m.observacoes || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 4: INVENTÁRIO FÍSICO                                              */}
      {/* ===================================================================== */}
      {activeTab === 'inventario' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Contagem e Balanço Físico de Almoxarifado
                  </h3>
                </div>
                <p className="text-xs text-slate-500 max-w-2xl">
                  Realize a contagem das peças físicas, barras e itens comerciais. O sistema aponta
                  automaticamente as divergências e gera os movimentos de ajuste corretivo rastreados no log.
                </p>
              </div>

              {canAdjust ? (
                <button
                  type="button"
                  onClick={() => setIsInventarioOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 shrink-0"
                >
                  <ClipboardCheck className="h-4 w-4 text-amber-400" />
                  <span>Iniciar Contagem Física</span>
                </button>
              ) : (
                <span className="text-xs text-amber-800 italic">
                  Apenas Gerente e Administrador podem aplicar ajustes de inventário
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs space-y-1">
                <span className="font-bold text-slate-800 block">1. Contagem Cega ou Guiada</span>
                <p className="text-slate-600 text-[11px]">
                  Verifique a prateleira e digite o saldo real conferido no chão de fábrica.
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs space-y-1">
                <span className="font-bold text-slate-800 block">2. Apuração de Sobras e Faltas</span>
                <p className="text-slate-600 text-[11px]">
                  O sistema calcula as diferenças (+/-) e exibe o resumo completo antes de confirmar.
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs space-y-1">
                <span className="font-bold text-slate-800 block">3. Ajuste Atômico no Firestore</span>
                <p className="text-slate-600 text-[11px]">
                  Movimentos imutáveis com motivo "inventário" são gerados sem apagar o histórico anterior.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAIS E DRAWER DO MÓDULO                                             */}
      {/* ===================================================================== */}
      {/* 1. Modal Cadastro / Edição de Item */}
      <ItemEstoqueModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        itemParaEditar={itemParaEditar}
        onSuccess={() => {
          showFeedback('success', 'Item de estoque salvo com sucesso.');
          loadData();
        }}
      />

      {/* 2. Drawer Lateral de Detalhes do Item */}
      <ItemEstoqueDrawer
        item={drawerItem}
        isOpen={Boolean(drawerItem)}
        onClose={() => setDrawerItem(null)}
        onEditarItem={(it) => {
          setItemParaEditar(it);
          setIsItemModalOpen(true);
        }}
        onNovaEntrada={(it) => abrirOperacao('entrada', it)}
        onNovaSaida={(it) => abrirOperacao('saida', it)}
        onNovoAjuste={(it) => abrirOperacao('ajuste', it)}
        onNovaReserva={(it) => abrirOperacao('reserva', it)}
        onTransferir={(it) => abrirOperacao('transferir', it)}
        onImprimirEtiquetaUnidade={(u) => setEtiquetaModalUnidade(u)}
        onItemAtualizado={loadData}
        canManage={canManage}
      />

      {/* 3. Modal de Operações (Entrada, Saída, Ajuste, Reserva, Transferir) */}
      <EntradaSaidaModal
        isOpen={isEntradaSaidaOpen}
        onClose={() => setIsEntradaSaidaOpen(false)}
        tipoOperacao={tipoOperacaoModal}
        itemSelecionado={itemParaOperacao}
        itensDisponiveis={itens}
        projetos={projetos}
        onSuccess={(msg) => {
          showFeedback('success', msg);
          loadData();
        }}
      />

      {/* 4. Modal de Registro de Sobra / Retalho */}
      <RegistrarSobraModal
        isOpen={isRegistrarSobraOpen}
        onClose={() => setIsRegistrarSobraOpen(false)}
        itensDisponiveis={itens}
        projetos={projetos}
        onSuccess={(msg) => {
          showFeedback('success', msg);
          loadData();
        }}
      />

      {/* 5. Modal "Procurar Peça que Atenda" (Algoritmo 3D) */}
      <ProcurarPecaModal
        isOpen={isProcurarPecaOpen}
        onClose={() => setIsProcurarPecaOpen(false)}
        onSelectUnidadeParaSaida={(u) => {
          const it = itens.find((i) => i.id === u.item_id);
          abrirOperacao('saida', it);
        }}
        onSelectUnidadeParaReserva={(u) => {
          const it = itens.find((i) => i.id === u.item_id);
          abrirOperacao('reserva', it);
        }}
        onImprimirEtiqueta={(u) => setEtiquetaModalUnidade(u)}
      />

      {/* 6. Modal de Inventário Físico */}
      <InventarioModal
        isOpen={isInventarioOpen}
        onClose={() => setIsInventarioOpen(false)}
        itens={itens}
        onSuccess={(msg) => {
          showFeedback('success', msg);
          loadData();
        }}
      />

      {/* 7. Modal de Impressão de Etiqueta com QR Code */}
      <EtiquetaPecaPdfModal
        isOpen={Boolean(etiquetaModalUnidade)}
        onClose={() => setEtiquetaModalUnidade(null)}
        unidade={etiquetaModalUnidade}
      />

      {/* 8. Modal de Gerar Solicitação de Reposição */}
      <GerarSolicitacaoReposicaoModal
        isOpen={isReposicaoModalOpen}
        onClose={() => setIsReposicaoModalOpen(false)}
        itensAbaixoMinimo={itens.filter(
          (i) => i.estoque_minimo !== undefined && i.disponivel < i.estoque_minimo
        )}
        fornecedores={fornecedores}
        onSuccess={(msg) => {
          showFeedback('success', msg);
          loadData();
        }}
      />
    </div>
  );
};
