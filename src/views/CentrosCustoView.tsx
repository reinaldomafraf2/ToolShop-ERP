import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  CentroCusto,
  OrigemCentroCusto,
  ModeloCusto,
  CATEGORIAS_CENTRO_CUSTO_SUGESTO,
  Operador,
  OperadorCentroCusto,
} from '../types';
import { toolShopService } from '../services/toolShopService';
import { Modal } from '../components/common/Modal';
import { ConfirmDeleteModal } from '../components/common/ConfirmDeleteModal';
import { FeedbackAlert } from '../components/common/FeedbackAlert';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../auth/AuthContext';
import {
  Cpu,
  Plus,
  Search,
  Edit2,
  Trash2,
  DollarSign,
  Building,
  Factory,
  Clock,
  Phone,
  Power,
  PowerOff,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Users,
  UserPlus,
  X,
  UserMinus,
} from 'lucide-react';

import { formatCurrencyBRL } from '../utils/formatters';

interface CentrosCustoViewProps {
  centrosCusto: CentroCusto[];
  activeCenterIds?: Set<string>;
  onRefresh: () => void;
}

export const CentrosCustoView: React.FC<CentrosCustoViewProps> = ({
  centrosCusto,
  activeCenterIds = new Set(),
  onRefresh,
}) => {
  const { user, can } = useAuth();
  const canCreate = can('criar', 'centros_custo') || can('criar', 'maquinas');
  const canEdit = can('editar', 'centros_custo') || can('editar', 'maquinas');
  const canDelete = can('excluir', 'centros_custo') || can('excluir', 'maquinas');
  const canViewCustos = can('ver', 'custos');

  const [searchTerm, setSearchTerm] = useState('');
  const [origemFiltro, setOrigemFiltro] = useState<'Todos' | OrigemCentroCusto>('Todos');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('Todas');
  const [situacaoFiltro, setSituacaoFiltro] = useState<'Todos' | 'ativos' | 'inativos'>('Todos');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estados dos Modais de Cadastro/Edição
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCentro, setEditingCentro] = useState<CentroCusto | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    origem: 'interno' as OrigemCentroCusto,
    categoria: 'CNC',
    modelo_custo: 'hora' as ModeloCusto,
    valor_unitario: '',
    fornecedor_nome: '',
    fornecedor_contato: '',
    prazo_padrao_dias: '',
    ativo: true,
    observacoes: '',
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string | undefined }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado do Modal de Exclusão
  const [deletingCentro, setDeletingCentro] = useState<CentroCusto | null>(null);
  const [deleteBlockedReason, setDeleteBlockedReason] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estado de Operadores e Vínculos de Postos de Trabalho
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [vinculos, setVinculos] = useState<OperadorCentroCusto[]>([]);
  const [selectedPostoParaOperadores, setSelectedPostoParaOperadores] = useState<CentroCusto | null>(
    null
  );
  const [operadorParaAdicionarId, setOperadorParaAdicionarId] = useState<string>('');
  const [isUpdatingVinculos, setIsUpdatingVinculos] = useState<boolean>(false);

  const loadOperadoresEVinculos = useCallback(async () => {
    try {
      const [ops, vincs] = await Promise.all([
        toolShopService.getOperadores(),
        toolShopService.getOperadorCentrosCusto(),
      ]);
      setOperadores(ops);
      setVinculos(vincs);
    } catch (err) {
      console.error('Erro ao carregar operadores e vínculos:', err);
    }
  }, []);

  useEffect(() => {
    loadOperadoresEVinculos();
  }, [loadOperadoresEVinculos]);

  // Mapa de operadores por centro de custo: centro_custo_id -> OperadorCentroCusto[]
  const vinculosPorCentroMap = useMemo(() => {
    const map = new Map<string, OperadorCentroCusto[]>();
    vinculos.forEach((v) => {
      if (!map.has(v.centro_custo_id)) {
        map.set(v.centro_custo_id, []);
      }
      map.get(v.centro_custo_id)!.push(v);
    });
    return map;
  }, [vinculos]);

  const operadorMap = useMemo(() => {
    return new Map(operadores.map((o) => [o.id, o]));
  }, [operadores]);

  // Handler para remover um operador de um posto
  const handleRemoverOperadorDoPosto = async (operadorId: string) => {
    if (!selectedPostoParaOperadores || !canEdit) return;
    setIsUpdatingVinculos(true);
    try {
      await toolShopService.desvincularOperadorCentroCusto(
        operadorId,
        selectedPostoParaOperadores.id,
        user?.nome || 'Usuário'
      );
      showFeedback('success', 'Operador desvinculado deste posto com sucesso.');
      await loadOperadoresEVinculos();
      onRefresh();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao desvincular operador.');
    } finally {
      setIsUpdatingVinculos(false);
    }
  };

  // Handler para adicionar operador ao posto
  const handleAdicionarOperadorAoPosto = async () => {
    if (!selectedPostoParaOperadores || !operadorParaAdicionarId || !canEdit) return;
    setIsUpdatingVinculos(true);
    try {
      await toolShopService.vincularOperadorCentroCusto(
        operadorParaAdicionarId,
        selectedPostoParaOperadores.id,
        user?.nome || 'Usuário'
      );
      showFeedback('success', 'Operador vinculado ao posto com sucesso.');
      setOperadorParaAdicionarId('');
      await loadOperadoresEVinculos();
      onRefresh();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao vincular operador.');
    } finally {
      setIsUpdatingVinculos(false);
    }
  };

  // Lista dinâmica de categorias para o filtro

  const categoriasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    centrosCusto.forEach((c) => {
      if (c.categoria) set.add(c.categoria);
    });
    return Array.from(set).sort();
  }, [centrosCusto]);

  // Filtragem
  const filteredCentros = useMemo(() => {
    return centrosCusto.filter((c) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        c.nome.toLowerCase().includes(q) ||
        c.categoria.toLowerCase().includes(q) ||
        (c.fornecedor_nome && c.fornecedor_nome.toLowerCase().includes(q)) ||
        (c.observacoes && c.observacoes.toLowerCase().includes(q));

      const matchesOrigem = origemFiltro === 'Todos' || c.origem === origemFiltro;
      const matchesCategoria = categoriaFiltro === 'Todas' || c.categoria === categoriaFiltro;
      const matchesSituacao =
        situacaoFiltro === 'Todos' ||
        (situacaoFiltro === 'ativos' && c.ativo !== false) ||
        (situacaoFiltro === 'inativos' && c.ativo === false);

      return matchesSearch && matchesOrigem && matchesCategoria && matchesSituacao;
    });
  }, [centrosCusto, searchTerm, origemFiltro, categoriaFiltro, situacaoFiltro]);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const formatCostWithUnit = (valor: number, modelo: ModeloCusto) => {
    const formatted = formatCurrencyBRL(valor);
    switch (modelo) {
      case 'hora':
        return `${formatted}/h`;
      case 'peca':
        return `${formatted}/peça`;
      case 'kg':
        return `${formatted}/kg`;
      case 'servico':
        return `${formatted}/serviço`;
      default:
        return formatted;
    }
  };

  const handleOpenCreateModal = () => {
    setEditingCentro(null);
    setFormData({
      nome: '',
      origem: 'interno',
      categoria: 'CNC',
      modelo_custo: 'hora',
      valor_unitario: '',
      fornecedor_nome: '',
      fornecedor_contato: '',
      prazo_padrao_dias: '',
      ativo: true,
      observacoes: '',
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (centro: CentroCusto) => {
    setEditingCentro(centro);
    setFormData({
      nome: centro.nome,
      origem: centro.origem || 'interno',
      categoria: centro.categoria || centro.tipo || 'Outro',
      modelo_custo: centro.origem === 'interno' ? 'hora' : (centro.modelo_custo || 'hora'),
      valor_unitario: String(centro.valor_unitario ?? centro.custo_hora ?? ''),
      fornecedor_nome: centro.fornecedor_nome || '',
      fornecedor_contato: centro.fornecedor_contato || '',
      prazo_padrao_dias: centro.prazo_padrao_dias ? String(centro.prazo_padrao_dias) : '',
      ativo: centro.ativo !== false,
      observacoes: centro.observacoes || '',
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const handleToggleAtivo = async (centro: CentroCusto) => {
    if (!canEdit) return;
    try {
      const novoStatus = !centro.ativo;
      await toolShopService.updateCentroCusto(centro.id, { ativo: novoStatus });
      showFeedback(
        'success',
        `Centro de custo "${centro.nome}" foi ${novoStatus ? 'ativado' : 'desativado'}.`
      );
      onRefresh();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao alterar situação.');
    }
  };

  const handleOpenDeleteModal = async (centro: CentroCusto) => {
    setDeletingCentro(centro);
    const check = await toolShopService.checkCanDeleteCentroCusto(centro.id);
    if (!check.canDelete) {
      setDeleteBlockedReason(check.reason || 'Este centro de custo está em uso em operações de projetos ou modelos.');
    } else {
      setDeleteBlockedReason(null);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: { [key: string]: string } = {};

    if (!formData.nome.trim()) {
      errors.nome = 'O nome do centro de custo é obrigatório.';
    }

    if (!formData.categoria.trim()) {
      errors.categoria = 'A categoria é obrigatória.';
    }

    const valorNum = parseFloat(formData.valor_unitario.replace(',', '.'));
    if (isNaN(valorNum) || valorNum <= 0) {
      errors.valor_unitario = 'O valor deve ser um número maior que zero.';
    }

    if (formData.origem === 'terceirizado') {
      if (formData.prazo_padrao_dias && (isNaN(Number(formData.prazo_padrao_dias)) || Number(formData.prazo_padrao_dias) < 0)) {
        errors.prazo_padrao_dias = 'O prazo deve ser um número inteiro de dias válido.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<CentroCusto> = {
        nome: formData.nome.trim(),
        origem: formData.origem,
        categoria: formData.categoria.trim(),
        tipo: formData.categoria.trim(),
        modelo_custo: formData.origem === 'interno' ? 'hora' : formData.modelo_custo,
        valor_unitario: valorNum,
        custo_hora: valorNum,
        fornecedor_nome: formData.origem === 'terceirizado' && formData.fornecedor_nome.trim() ? formData.fornecedor_nome.trim() : undefined,
        fornecedor_contato: formData.origem === 'terceirizado' && formData.fornecedor_contato.trim() ? formData.fornecedor_contato.trim() : undefined,
        prazo_padrao_dias: formData.origem === 'terceirizado' && formData.prazo_padrao_dias ? Number(formData.prazo_padrao_dias) : undefined,
        ativo: formData.ativo,
        observacoes: formData.observacoes.trim() || undefined,
      };

      if (editingCentro) {
        await toolShopService.updateCentroCusto(editingCentro.id, payload);
        showFeedback('success', `Centro de custo "${formData.nome.trim()}" atualizado com sucesso!`);
      } else {
        await toolShopService.createCentroCusto(payload as any);
        showFeedback('success', `Centro de custo "${formData.nome.trim()}" cadastrado com sucesso!`);
      }
      setIsFormModalOpen(false);
      onRefresh();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao salvar centro de custo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCentro) return;

    setIsDeleting(true);
    try {
      await toolShopService.deleteCentroCusto(deletingCentro.id);
      showFeedback('success', `Centro de custo "${deletingCentro.nome}" excluído com sucesso.`);
      setDeletingCentro(null);
      onRefresh();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao excluir centro de custo.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Topo da View */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
            Centros de Custo (Internos & Terceirizados)
          </h2>
          <p className="text-xs text-slate-500">
            Gerencie postos de usinagem internos da ferramentaria e serviços externos especializados (têmpera, niquelação, polimento)
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-slate-900"
          >
            <Plus className="h-4 w-4 text-amber-400" />
            <span>Novo Centro de Custo</span>
          </button>
        )}
      </div>

      {/* Feedback Padronizado */}
      <FeedbackAlert feedback={feedback} onClose={() => setFeedback(null)} />

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, categoria, fornecedor ou observação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-slate-900 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro por Origem */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setOrigemFiltro('Todos')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                origemFiltro === 'Todos'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Todos ({centrosCusto.length})
            </button>
            <button
              type="button"
              onClick={() => setOrigemFiltro('interno')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5 ${
                origemFiltro === 'interno'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Factory className="h-3 w-3" />
              <span>Interno ({centrosCusto.filter((c) => c.origem === 'interno').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setOrigemFiltro('terceirizado')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5 ${
                origemFiltro === 'terceirizado'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Building className="h-3 w-3" />
              <span>Terceiro ({centrosCusto.filter((c) => c.origem === 'terceirizado').length})</span>
            </button>
          </div>

          {/* Filtro por Categoria */}
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs focus:border-slate-900 focus:outline-none"
          >
            <option value="Todas">Todas as Categorias</option>
            {categoriasDisponiveis.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Filtro por Situação */}
          <select
            value={situacaoFiltro}
            onChange={(e) => setSituacaoFiltro(e.target.value as any)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs focus:border-slate-900 focus:outline-none"
          >
            <option value="Todos">Situação: Todos</option>
            <option value="ativos">Apenas Ativos</option>
            <option value="inativos">Apenas Inativos</option>
          </select>
        </div>
      </div>

      {/* Tabela de Centros de Custo ou Estado Vazio */}
      {centrosCusto.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="Nenhum centro de custo cadastrado"
          description="Cadastre máquinas e postos de trabalho internos ou serviços terceirizados para compor o roteiro de usinagem e orçamentos."
          actionLabel="Cadastrar Primeiro Centro de Custo"
          onAction={handleOpenCreateModal}
        />
      ) : filteredCentros.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhum centro de custo encontrado"
          description={`Nenhum registro corresponde aos filtros selecionados.`}
          actionLabel="Limpar Filtros"
          onAction={() => {
            setSearchTerm('');
            setOrigemFiltro('Todos');
            setCategoriaFiltro('Todas');
            setSituacaoFiltro('Todos');
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-medium">
                  <th className="py-3 px-4">Nome do Centro de Custo</th>
                  <th className="py-3 px-4 text-center">Origem</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4 text-right">Custo Unitário</th>
                  <th className="py-3 px-4">Fornecedor / Prazo</th>
                  <th className="py-3 px-4 text-center">Situação</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCentros.map((centro) => {
                  const isOperating = activeCenterIds.has(centro.id);
                  const isTerceirizado = centro.origem === 'terceirizado';
                  const valor = centro.valor_unitario ?? centro.custo_hora ?? 0;
                  const modelo = centro.modelo_custo || 'hora';

                  return (
                    <tr
                      key={centro.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        centro.ativo === false ? 'bg-slate-50/40 text-slate-400' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              isTerceirizado
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {isTerceirizado ? (
                              <Building className="h-4 w-4" />
                            ) : (
                              <Cpu className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="block truncate">{centro.nome}</span>
                            {centro.observacoes && (
                              <span className="block text-[11px] font-normal text-slate-500 truncate max-w-xs">
                                {centro.observacoes}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {isTerceirizado ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            <Building className="h-3 w-3 text-amber-600" />
                            <span>Terceiro</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                            <Factory className="h-3 w-3 text-blue-600" />
                            <span>Interno</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {centro.categoria}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-xs font-bold text-slate-900">
                        {canViewCustos ? (
                          <span>{formatCostWithUnit(valor, modelo)}</span>
                        ) : (
                          <span className="text-[11px] font-sans text-slate-400 font-normal italic">
                            Restrito
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {isTerceirizado ? (
                          <div className="space-y-0.5">
                            <div className="font-medium text-slate-900 truncate max-w-xs">
                              {centro.fornecedor_nome || <span className="text-slate-400 italic">Não informado</span>}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                              {centro.prazo_padrao_dias ? (
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-slate-400" />
                                  <span>{centro.prazo_padrao_dias} dias</span>
                                </span>
                              ) : null}
                              {centro.fornecedor_contato ? (
                                <span className="truncate max-w-[150px]" title={centro.fornecedor_contato}>
                                  · {centro.fornecedor_contato}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedPostoParaOperadores(centro)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-2xs"
                              title="Gerenciar operadores deste posto de trabalho"
                            >
                              <Users className="h-3.5 w-3.5 text-slate-500" />
                              <span>{(vinculosPorCentroMap.get(centro.id) || []).length} operador(es)</span>
                            </button>
                          </div>
                        )}
                      </td>


                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleAtivo(centro)}
                          disabled={!canEdit}
                          title={
                            !canEdit
                              ? 'Sem permissão para alterar'
                              : centro.ativo !== false
                              ? 'Clique para desativar'
                              : 'Clique para ativar'
                          }
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all ${
                            centro.ativo !== false
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          } ${!canEdit ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          {centro.ativo !== false ? (
                            <>
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              <span>Ativo</span>
                            </>
                          ) : (
                            <>
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                              <span>Inativo</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(centro)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                              title="Editar centro de custo"
                            >
                              <Edit2 className="h-3 w-3" />
                              <span>Editar</span>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(centro)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                              title="Excluir centro de custo"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Excluir</span>
                            </button>
                          )}
                          {!canEdit && !canDelete && (
                            <span className="text-[11px] text-slate-400 font-mono">-</span>
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

      {/* Modal Formulário (Novo / Edição de Centro de Custo) */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingCentro ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
        subtitle={
          editingCentro
            ? `Atualize os dados e tarifas de ${editingCentro.nome}`
            : 'Cadastre um posto de usinagem interno ou prestador terceirizado'
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {/* Seletor de Origem: Interno vs Terceirizado */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Origem do Centro de Custo <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  formData.origem === 'interno'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="origem"
                  value="interno"
                  checked={formData.origem === 'interno'}
                  onChange={() =>
                    setFormData({
                      ...formData,
                      origem: 'interno',
                      modelo_custo: 'hora',
                    })
                  }
                  className="sr-only"
                />
                <Factory className={`h-5 w-5 ${formData.origem === 'interno' ? 'text-amber-400' : 'text-slate-400'}`} />
                <div className="text-left">
                  <div className="text-xs font-bold leading-tight">Interno (Próprio)</div>
                  <div className={`text-[11px] ${formData.origem === 'interno' ? 'text-slate-300' : 'text-slate-400'}`}>
                    Máquinas e bancadas da oficina (R$/h)
                  </div>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  formData.origem === 'terceirizado'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="origem"
                  value="terceirizado"
                  checked={formData.origem === 'terceirizado'}
                  onChange={() =>
                    setFormData({
                      ...formData,
                      origem: 'terceirizado',
                    })
                  }
                  className="sr-only"
                />
                <Building className={`h-5 w-5 ${formData.origem === 'terceirizado' ? 'text-amber-400' : 'text-slate-400'}`} />
                <div className="text-left">
                  <div className="text-xs font-bold leading-tight">Terceirizado (Externo)</div>
                  <div className={`text-[11px] ${formData.origem === 'terceirizado' ? 'text-slate-300' : 'text-slate-400'}`}>
                    Têmpera, cromo, niquelação, polimento
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Nome e Categoria */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Nome do Centro de Custo <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder={
                  formData.origem === 'interno'
                    ? 'Ex: Centro CNC Romi D800'
                    : 'Ex: Têmpera e Revenimento'
                }
                value={formData.nome}
                onChange={(e) => {
                  setFormData({ ...formData, nome: e.target.value });
                  if (formErrors.nome) setFormErrors({ ...formErrors, nome: undefined });
                }}
                className={`mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:outline-none ${
                  formErrors.nome
                    ? 'border-rose-300 bg-rose-50/50 focus:border-rose-500'
                    : 'border-slate-200 focus:border-slate-900'
                }`}
              />
              {formErrors.nome && (
                <p className="mt-1 text-xs text-rose-600">{formErrors.nome}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Categoria / Especialidade <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                list="categorias-sugestoes"
                placeholder="Ex: CNC, Torno, Tratamento térmico..."
                value={formData.categoria}
                onChange={(e) => {
                  setFormData({ ...formData, categoria: e.target.value });
                  if (formErrors.categoria)
                    setFormErrors({ ...formErrors, categoria: undefined });
                }}
                className={`mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:outline-none ${
                  formErrors.categoria
                    ? 'border-rose-300 bg-rose-50/50 focus:border-rose-500'
                    : 'border-slate-200 focus:border-slate-900'
                }`}
              />
              <datalist id="categorias-sugestoes">
                {CATEGORIAS_CENTRO_CUSTO_SUGESTO.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
              {formErrors.categoria && (
                <p className="mt-1 text-xs text-rose-600">{formErrors.categoria}</p>
              )}
            </div>
          </div>

          {/* Modelo de Custo e Valor Unitário */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Modelo de Cobrança <span className="text-rose-500">*</span>
              </label>
              {formData.origem === 'interno' ? (
                <div className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700 font-medium">
                  Por Hora (R$/h) — Taxa horária da máquina
                </div>
              ) : (
                <select
                  value={formData.modelo_custo}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      modelo_custo: e.target.value as ModeloCusto,
                    })
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
                >
                  <option value="hora">Por Hora (R$/h)</option>
                  <option value="peca">Por Peça (R$/peça)</option>
                  <option value="kg">Por Peso / Quilo (R$/kg)</option>
                  <option value="servico">Por Serviço Fixo (R$/serviço)</option>
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Valor Unitário (R$){' '}
                {formData.modelo_custo === 'hora'
                  ? '(R$/h)'
                  : formData.modelo_custo === 'peca'
                  ? '(R$/peça)'
                  : formData.modelo_custo === 'kg'
                  ? '(R$/kg)'
                  : '(R$/serviço)'}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-400">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="150,00"
                  value={formData.valor_unitario}
                  onChange={(e) => {
                    setFormData({ ...formData, valor_unitario: e.target.value });
                    if (formErrors.valor_unitario)
                      setFormErrors({ ...formErrors, valor_unitario: undefined });
                  }}
                  className={`w-full rounded-xl border py-2.5 pl-10 pr-3.5 text-xs font-mono text-slate-900 shadow-2xs focus:outline-none ${
                    formErrors.valor_unitario
                      ? 'border-rose-300 bg-rose-50/50 focus:border-rose-500'
                      : 'border-slate-200 focus:border-slate-900'
                  }`}
                />
              </div>
              {formErrors.valor_unitario && (
                <p className="mt-1 text-xs text-rose-600">{formErrors.valor_unitario}</p>
              )}
            </div>
          </div>

          {/* Campos exclusivos para Terceirizado: Fornecedor, Contato e Prazo */}
          {formData.origem === 'terceirizado' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <Building className="h-4 w-4 text-amber-700" />
                <span>Dados do Fornecedor / Terceiro</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Nome do Fornecedor / Empresa
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Têmpera Industrial ABC Ltda"
                    value={formData.fornecedor_nome}
                    onChange={(e) =>
                      setFormData({ ...formData, fornecedor_nome: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Prazo Padrão (dias)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ex: 5"
                    value={formData.prazo_padrao_dias}
                    onChange={(e) => {
                      setFormData({ ...formData, prazo_padrao_dias: e.target.value });
                      if (formErrors.prazo_padrao_dias)
                        setFormErrors({ ...formErrors, prazo_padrao_dias: undefined });
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
                  />
                  {formErrors.prazo_padrao_dias && (
                    <p className="mt-1 text-xs text-rose-600">{formErrors.prazo_padrao_dias}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Contato do Fornecedor (Telefone / E-mail / Responsável)
                </label>
                <input
                  type="text"
                  placeholder="Ex: (19) 3888-1200 · contato@tempera.com.br"
                  value={formData.fornecedor_contato}
                  onChange={(e) =>
                    setFormData({ ...formData, fornecedor_contato: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Observações Técnicas / Restrições
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Tolerância centesimal, necessidade de atmosfera controlada ou certificado..."
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
            />
          </div>

          {/* Toggle Ativo */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="centro-ativo"
              checked={formData.ativo}
              onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <label htmlFor="centro-ativo" className="text-xs font-medium text-slate-700 cursor-pointer">
              Centro de custo ativo (disponível para alocação em operações)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
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
                : editingCentro
                ? 'Salvar Alterações'
                : 'Cadastrar Centro de Custo'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Confirmação de Exclusão */}
      {deletingCentro && (
        <ConfirmDeleteModal
          isOpen={Boolean(deletingCentro)}
          onClose={() => setDeletingCentro(null)}
          onConfirm={handleConfirmDelete}
          title="Excluir Centro de Custo"
          itemName={deletingCentro.nome}
          entityTypeLabel="o centro de custo"
          blockedReason={deleteBlockedReason}
          isDeleting={isDeleting}
        />
      )}

      {/* Modal: Operadores deste Posto de Trabalho */}
      {selectedPostoParaOperadores && (
        <Modal
          isOpen={Boolean(selectedPostoParaOperadores)}
          onClose={() => {
            setSelectedPostoParaOperadores(null);
            setOperadorParaAdicionarId('');
          }}
          title="Operadores deste Posto de Trabalho"
          subtitle={`Gerencie os operadores autorizados no terminal de chão de fábrica para ${selectedPostoParaOperadores.nome}`}
          maxWidth="lg"
        >
          <div className="space-y-5">
            {/* Cabeçalho do Posto */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-amber-400">
                  <Cpu className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {selectedPostoParaOperadores.nome}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Categoria: <strong>{selectedPostoParaOperadores.categoria}</strong></span>
                    <span>·</span>
                    <span>Origem: <strong>Interno</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Seção Adicionar Operador a este Posto (apenas gerente e admin) */}
            {canEdit && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <label className="block text-xs font-bold text-slate-900">
                  Vincular Operador a este Posto
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={operadorParaAdicionarId}
                    onChange={(e) => setOperadorParaAdicionarId(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
                  >
                    <option value="">Selecione um operador para vincular...</option>
                    {operadores
                      .filter((op) => {
                        const postosVinculados =
                          vinculosPorCentroMap.get(selectedPostoParaOperadores.id) || [];
                        return !postosVinculados.some((v) => v.operador_id === op.id);
                      })
                      .map((op) => (
                        <option key={op.id} value={op.id}>
                          {op.nome}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={!operadorParaAdicionarId || isUpdatingVinculos}
                    onClick={handleAdicionarOperadorAoPosto}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
                  >
                    <UserPlus className="h-4 w-4 text-amber-400" />
                    <span>Vincular ao Posto</span>
                  </button>
                </div>
              </div>
            )}

            {/* Lista de Operadores Vinculados */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Operadores Deste Posto ({((vinculosPorCentroMap.get(selectedPostoParaOperadores.id) || []).length)})
                </h5>
              </div>

              {((vinculosPorCentroMap.get(selectedPostoParaOperadores.id) || []).length === 0) ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                  Nenhum operador vinculado a este posto de trabalho.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                  {(vinculosPorCentroMap.get(selectedPostoParaOperadores.id) || []).map((v) => {
                    const op = operadorMap.get(v.operador_id);
                    return (
                      <div
                        key={v.id}
                        className="flex items-center justify-between p-3.5 hover:bg-slate-50/70 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                            <Users className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              {op?.nome || 'Operador'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {v.atualizado_por ? `Alterado por ${v.atualizado_por}` : 'Vínculo inicial'}
                            </div>
                          </div>
                        </div>

                        {canEdit && (
                          <button
                            type="button"
                            disabled={isUpdatingVinculos}
                            onClick={() => handleRemoverOperadorDoPosto(v.operador_id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50"
                            title="Desvincular operador deste posto"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Desvincular</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedPostoParaOperadores(null);
                  setOperadorParaAdicionarId('');
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

