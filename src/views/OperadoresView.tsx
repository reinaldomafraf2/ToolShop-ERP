import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Operador,
  ApontamentoComOperador,
  CentroCusto,
  OperadorCentroCusto,
} from '../types';
import { toolShopService } from '../services/toolShopService';
import { Modal } from '../components/common/Modal';
import { ConfirmDeleteModal } from '../components/common/ConfirmDeleteModal';
import { FeedbackAlert } from '../components/common/FeedbackAlert';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../auth/AuthContext';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  PlayCircle,
  User,
  Cpu,
  AlertTriangle,
  CheckSquare,
  Square,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { formatHours } from '../utils/formatters';

interface OperadoresViewProps {
  operadores: Operador[];
  apontamentos: ApontamentoComOperador[];
  centrosCusto?: CentroCusto[];
  onRefresh: () => void;
}

export const OperadoresView: React.FC<OperadoresViewProps> = ({
  operadores,
  apontamentos,
  centrosCusto: initialCentrosCusto,
  onRefresh,
}) => {
  const { user, can } = useAuth();
  const canCreate = can('criar', 'operadores');
  const canEdit = can('editar', 'operadores');
  const canDelete = can('excluir', 'operadores');

  const [searchTerm, setSearchTerm] = useState('');
  const [filtroPosto, setFiltroPosto] = useState<'todos' | 'com_posto' | 'sem_posto'>('todos');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Centros de custo e Vínculos carregados
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>(initialCentrosCusto || []);
  const [vinculos, setVinculos] = useState<OperadorCentroCusto[]>([]);

  // Carrega centros de custo internos e vínculos
  const loadCentrosEVinculos = useCallback(async () => {
    try {
      const [allCentros, allVinculos] = await Promise.all([
        toolShopService.getCentrosCusto(),
        toolShopService.getOperadorCentrosCusto(),
      ]);
      setCentrosCusto(allCentros);
      setVinculos(allVinculos);
    } catch (err) {
      console.error('Erro ao carregar postos e vínculos:', err);
    }
  }, []);

  useEffect(() => {
    loadCentrosEVinculos();
  }, [loadCentrosEVinculos]);

  // Centros internos ativos disponíveis para vincular
  const centrosInternosAtivos = useMemo(() => {
    return centrosCusto.filter((c) => c.origem === 'interno' && c.ativo !== false);
  }, [centrosCusto]);

  const centroMap = useMemo(() => {
    return new Map(centrosCusto.map((c) => [c.id, c]));
  }, [centrosCusto]);

  // Map de operador_id para lista de centro_custo_id
  const postosPorOperadorMap = useMemo(() => {
    const map = new Map<string, string[]>();
    vinculos.forEach((v) => {
      if (!map.has(v.operador_id)) {
        map.set(v.operador_id, []);
      }
      map.get(v.operador_id)!.push(v.centro_custo_id);
    });
    return map;
  }, [vinculos]);

  // Contagem de operadores sem posto
  const operadoresSemPostoCount = useMemo(() => {
    return operadores.filter((op) => {
      const postos = postosPorOperadorMap.get(op.id) || [];
      return postos.length === 0;
    }).length;
  }, [operadores, postosPorOperadorMap]);

  // Estados dos Modais de Cadastro/Edição
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingOperador, setEditingOperador] = useState<Operador | null>(null);
  const [formData, setFormData] = useState<{ nome: string; postosIds: string[] }>({
    nome: '',
    postosIds: [],
  });
  const [formErrors, setFormErrors] = useState<{ nome?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado do Modal de Exclusão
  const [deletingOperador, setDeletingOperador] = useState<Operador | null>(null);
  const [deleteBlockedReason, setDeleteBlockedReason] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Map de apontamentos ativos e total de horas por operador
  const activeOperatorMap = useMemo(() => {
    const map = new Map<string, ApontamentoComOperador>();
    apontamentos
      .filter((a) => !a.fim)
      .forEach((a) => {
        map.set(a.operador_id, a);
      });
    return map;
  }, [apontamentos]);

  const horasPorOperadorMap = useMemo(() => {
    const map = new Map<string, number>();
    apontamentos.forEach((a) => {
      const current = map.get(a.operador_id) || 0;
      map.set(a.operador_id, current + a.duracaoHoras);
    });
    return map;
  }, [apontamentos]);

  // Filtragem
  const filteredOperadores = useMemo(() => {
    return operadores.filter((o) => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        if (!o.nome.toLowerCase().includes(term)) return false;
      }

      const postos = postosPorOperadorMap.get(o.id) || [];
      if (filtroPosto === 'com_posto' && postos.length === 0) return false;
      if (filtroPosto === 'sem_posto' && postos.length > 0) return false;

      return true;
    });
  }, [operadores, searchTerm, filtroPosto, postosPorOperadorMap]);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleOpenCreateModal = () => {
    setEditingOperador(null);
    setFormData({ nome: '', postosIds: [] });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (operador: Operador) => {
    setEditingOperador(operador);
    const postosAtuais = postosPorOperadorMap.get(operador.id) || [];
    setFormData({ nome: operador.nome, postosIds: [...postosAtuais] });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const handleOpenDeleteModal = async (operador: Operador) => {
    setDeletingOperador(operador);
    const check = await toolShopService.checkCanDeleteOperador(operador.id);
    if (!check.canDelete) {
      setDeleteBlockedReason(
        check.reason || 'Este operador possui apontamentos de horas associados.'
      );
    } else {
      setDeleteBlockedReason(null);
    }
  };

  const handleTogglePostoSelection = (centroId: string) => {
    if (!canEdit) return;
    setFormData((prev) => {
      const exists = prev.postosIds.includes(centroId);
      if (exists) {
        return { ...prev, postosIds: prev.postosIds.filter((id) => id !== centroId) };
      } else {
        return { ...prev, postosIds: [...prev.postosIds, centroId] };
      }
    });
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      setFormErrors({ nome: 'O nome do operador é obrigatório.' });
      return;
    }

    setIsSubmitting(true);
    try {
      let operadorId = editingOperador?.id;

      if (editingOperador) {
        await toolShopService.updateOperador(editingOperador.id, {
          nome: formData.nome.trim(),
        });
      } else {
        const created = await toolShopService.createOperador({
          nome: formData.nome.trim(),
        });
        operadorId = created.id;
      }

      // Salva os postos de trabalho vinculados caso o usuário tenha permissão de edição
      if (canEdit && operadorId) {
        await toolShopService.salvarPostosDoOperador(
          operadorId,
          formData.postosIds,
          user?.nome || 'Usuário'
        );
      }

      showFeedback(
        'success',
        editingOperador
          ? `Operador "${formData.nome.trim()}" e seus postos atualizados com sucesso!`
          : `Operador "${formData.nome.trim()}" cadastrado com sucesso!`
      );

      setIsFormModalOpen(false);
      await loadCentrosEVinculos();
      onRefresh();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao salvar operador.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingOperador) return;

    setIsDeleting(true);
    try {
      await toolShopService.deleteOperador(deletingOperador.id);
      showFeedback('success', `Operador "${deletingOperador.nome}" excluído com sucesso.`);
      setDeletingOperador(null);
      await loadCentrosEVinculos();
      onRefresh();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao excluir operador.');
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
            Cadastro de Operadores e Postos de Trabalho
          </h2>
          <p className="text-xs text-slate-500">
            Cadastre a equipe e vincule operadores aos seus postos de trabalho (centros de custo
            internos)
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-slate-900"
          >
            <Plus className="h-4 w-4 text-amber-400" />
            <span>Novo Operador</span>
          </button>
        )}
      </div>

      {/* Alerta Discreto de Operadores Sem Posto de Trabalho */}
      {operadoresSemPostoCount > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 sm:flex-row sm:items-center sm:justify-between text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">
                {operadoresSemPostoCount === 1
                  ? '1 operador ativo sem nenhum posto de trabalho vinculado'
                  : `${operadoresSemPostoCount} operadores ativos sem nenhum posto de trabalho vinculado`}
              </span>
              <span className="text-amber-800 ml-1">
                — quando a restrição de postos estiver ativa, esses operadores não verão operações no
                apontamento.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setFiltroPosto('sem_posto')}
            className="inline-flex items-center gap-1 font-bold text-amber-800 hover:text-amber-950 underline shrink-0"
          >
            <span>Filtrar sem posto</span>
          </button>
        </div>
      )}

      {/* Feedback Padronizado */}
      <FeedbackAlert feedback={feedback} onClose={() => setFeedback(null)} />

      {/* Barra de Busca e Filtros Rápidos */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar operador por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-slate-900 focus:outline-none"
            />
          </div>

          {/* Filtro Rápido por Posto */}
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFiltroPosto('todos')}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                filtroPosto === 'todos'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Todos ({operadores.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroPosto('com_posto')}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                filtroPosto === 'com_posto'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Com Posto ({operadores.length - operadoresSemPostoCount})
            </button>
            <button
              type="button"
              onClick={() => setFiltroPosto('sem_posto')}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                filtroPosto === 'sem_posto'
                  ? 'bg-amber-600 text-white'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              Sem Posto ({operadoresSemPostoCount})
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Mostrando <strong className="font-semibold text-slate-900">{filteredOperadores.length}</strong> de{' '}
          {operadores.length} operadores
        </div>
      </div>

      {/* Tabela de Operadores ou Estados Vazios */}
      {operadores.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum operador cadastrado ainda"
          description="Cadastre ferramenteiros e operadores para apontar horas no chão de fábrica."
          actionLabel="Cadastrar Primeiro Operador"
          onAction={handleOpenCreateModal}
        />
      ) : filteredOperadores.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhum operador encontrado"
          description="Nenhum operador corresponde aos filtros e termos de busca aplicados."
          actionLabel="Limpar Filtros"
          onAction={() => {
            setSearchTerm('');
            setFiltroPosto('todos');
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-medium">
                  <th className="py-3 px-4">Nome do Operador</th>
                  <th className="py-3 px-4">Postos de Trabalho (Centros Internos)</th>
                  <th className="py-3 px-4">Status de Apontamento</th>
                  <th className="py-3 px-4 text-right">Horas Totais</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredOperadores.map((op) => {
                  const activeApt = activeOperatorMap.get(op.id);
                  const totalHoras = horasPorOperadorMap.get(op.id) || 0;
                  const postosIds = postosPorOperadorMap.get(op.id) || [];

                  return (
                    <tr key={op.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 shrink-0">
                            <User className="h-4 w-4" />
                          </div>
                          <span>{op.nome}</span>
                        </div>
                      </td>

                      {/* Coluna de Postos de Trabalho Vinculados */}
                      <td className="py-3.5 px-4">
                        {postosIds.length === 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                            <span>Nenhum posto vinculado</span>
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {postosIds.map((cid) => {
                              const centro = centroMap.get(cid);
                              if (!centro) return null;
                              return (
                                <span
                                  key={cid}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-800"
                                >
                                  <Cpu className="h-3 w-3 text-slate-500" />
                                  <span>{centro.nome}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {activeApt ? (
                          <div className="flex items-center gap-1.5 text-emerald-700">
                            <PlayCircle className="h-3.5 w-3.5 animate-pulse" />
                            <span className="font-semibold">
                              Operando em:{' '}
                              {activeApt.centro_custo?.nome ||
                                activeApt.maquina?.nome ||
                                'Centro de Custo'}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            <span>Disponível</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatHours(totalHoras)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(op)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                              title="Editar operador e postos"
                            >
                              <Edit2 className="h-3 w-3" />
                              <span>Editar</span>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(op)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                              title="Excluir operador"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Excluir</span>
                            </button>
                          )}
                          {!canEdit && !canDelete && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(op)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                              title="Visualizar postos"
                            >
                              <span>Visualizar</span>
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

      {/* Modal Formulário (Novo / Edição de Operador & Postos de Trabalho) */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingOperador ? 'Editar Operador & Postos' : 'Novo Operador'}
        subtitle={
          editingOperador
            ? `Edite o cadastro e os postos de trabalho de ${editingOperador.nome}`
            : 'Cadastre um novo operador e atribua seus postos de trabalho internos'
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitForm} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Nome Completo do Operador / Ferramenteiro <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Carlos Eduardo da Silva"
              value={formData.nome}
              disabled={!canEdit}
              onChange={(e) => {
                setFormData({ ...formData, nome: e.target.value });
                if (formErrors.nome) setFormErrors({});
              }}
              className={`mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 ${
                formErrors.nome
                  ? 'border-rose-300 bg-rose-50/50 focus:border-rose-500'
                  : 'border-slate-200 focus:border-slate-900'
              }`}
            />
            {formErrors.nome && <p className="mt-1 text-xs text-rose-600">{formErrors.nome}</p>}
          </div>

          {/* Campo Múltiplo: Postos de Trabalho (Centros de Custo Internos Ativos) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-900">
                  Postos de Trabalho Autorizados
                </label>
                <p className="text-[11px] text-slate-500">
                  Selecione os centros de custo internos que este operador pode operar no tablet
                </p>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                {formData.postosIds.length} selecionado(s)
              </span>
            </div>

            {centrosInternosAtivos.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                Nenhum centro de custo interno ativo cadastrado.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-56 overflow-y-auto pr-1">
                {centrosInternosAtivos.map((centro) => {
                  const isChecked = formData.postosIds.includes(centro.id);

                  return (
                    <label
                      key={centro.id}
                      className={`flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors cursor-pointer text-xs ${
                        isChecked
                          ? 'border-slate-900 bg-white font-semibold text-slate-900 shadow-2xs'
                          : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-white'
                      } ${!canEdit ? 'pointer-events-none opacity-80' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!canEdit}
                        onChange={() => handleTogglePostoSelection(centro.id)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{centro.nome}</div>
                        <div className="text-[10px] text-slate-500">
                          {centro.categoria} · {centro.modelo_custo}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {!canEdit && (
              <p className="text-[11px] text-amber-700 italic">
                Visualização somente leitura para o perfil Líder. Apenas Gerente e Administrador
                podem alterar vínculos de postos.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {canEdit ? 'Cancelar' : 'Fechar'}
            </button>
            {canEdit && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
              >
                {isSubmitting
                  ? 'Salvando...'
                  : editingOperador
                  ? 'Salvar Alterações'
                  : 'Cadastrar Operador'}
              </button>
            )}
          </div>
        </form>
      </Modal>

      {/* Modal Confirmação de Exclusão */}
      {deletingOperador && (
        <ConfirmDeleteModal
          isOpen={Boolean(deletingOperador)}
          onClose={() => setDeletingOperador(null)}
          onConfirm={handleConfirmDelete}
          title="Excluir Operador"
          itemName={deletingOperador.nome}
          entityTypeLabel="o operador"
          blockedReason={deleteBlockedReason}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};
