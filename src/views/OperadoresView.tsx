import React, { useState, useMemo } from 'react';
import { Operador, ApontamentoComOperador } from '../types';
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
  Clock,
  PlayCircle,
  User,
} from 'lucide-react';
import { formatHours } from '../utils/formatters';

interface OperadoresViewProps {
  operadores: Operador[];
  apontamentos: ApontamentoComOperador[];
  onRefresh: () => void;
}

export const OperadoresView: React.FC<OperadoresViewProps> = ({
  operadores,
  apontamentos,
  onRefresh,
}) => {
  const { can } = useAuth();
  const canCreate = can('criar', 'operadores');
  const canEdit = can('editar', 'operadores');
  const canDelete = can('excluir', 'operadores');

  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estados dos Modais de Cadastro/Edição
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingOperador, setEditingOperador] = useState<Operador | null>(null);
  const [formData, setFormData] = useState({ nome: '' });
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
    if (!searchTerm.trim()) return operadores;
    const term = searchTerm.toLowerCase();
    return operadores.filter((o) => o.nome.toLowerCase().includes(term));
  }, [operadores, searchTerm]);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleOpenCreateModal = () => {
    setEditingOperador(null);
    setFormData({ nome: '' });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (operador: Operador) => {
    setEditingOperador(operador);
    setFormData({ nome: operador.nome });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const handleOpenDeleteModal = async (operador: Operador) => {
    setDeletingOperador(operador);
    const check = await toolShopService.checkCanDeleteOperador(operador.id);
    if (!check.canDelete) {
      setDeleteBlockedReason(check.reason || 'Este operador possui apontamentos de horas associados.');
    } else {
      setDeleteBlockedReason(null);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      setFormErrors({ nome: 'O nome do operador é obrigatório.' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingOperador) {
        await toolShopService.updateOperador(editingOperador.id, {
          nome: formData.nome.trim(),
        });
        showFeedback('success', `Operador "${formData.nome.trim()}" atualizado com sucesso!`);
      } else {
        await toolShopService.createOperador({
          nome: formData.nome.trim(),
        });
        showFeedback('success', `Operador "${formData.nome.trim()}" cadastrado com sucesso!`);
      }
      setIsFormModalOpen(false);
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
            Cadastro de Operadores e Ferramenteiros
          </h2>
          <p className="text-xs text-slate-500">
            Cadastre os profissionais autorizados para apontamento de horas e execução de usinagem
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

      {/* Feedback Padronizado */}
      <FeedbackAlert feedback={feedback} onClose={() => setFeedback(null)} />

      {/* Barra de Busca e Quantidade */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar operador por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-slate-900 focus:outline-none"
          />
        </div>

        <div className="text-xs text-slate-500">
          Mostrando <strong className="font-semibold text-slate-900">{filteredOperadores.length}</strong> de {operadores.length} operadores
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
          description={`Nenhum operador corresponde ao termo de busca "${searchTerm}".`}
          actionLabel="Limpar Busca"
          onAction={() => setSearchTerm('')}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-medium">
                  <th className="py-3 px-4">Nome do Operador</th>
                  <th className="py-3 px-4">Status de Apontamento</th>
                  <th className="py-3 px-4 text-right">Horas Registradas</th>
                  <th className="py-3 px-4 font-mono text-[11px]">ID (UUID)</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredOperadores.map((op) => {
                  const activeApt = activeOperatorMap.get(op.id);
                  const totalHoras = horasPorOperadorMap.get(op.id) || 0;

                  return (
                    <tr key={op.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                            <User className="h-4 w-4" />
                          </div>
                          <span>{op.nome}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {activeApt ? (
                          <div className="flex items-center gap-1.5 text-emerald-700">
                            <PlayCircle className="h-3.5 w-3.5 animate-pulse" />
                            <span className="font-semibold">
                              Operando em: {activeApt.centro_custo?.nome || activeApt.maquina?.nome || 'Centro de Custo'}
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
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        {op.id.substring(0, 13)}...
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(op)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                              title="Editar operador"
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

      {/* Modal Formulário (Novo / Edição de Operador) */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingOperador ? 'Editar Operador' : 'Novo Operador'}
        subtitle={
          editingOperador
            ? `Edite o nome de ${editingOperador.nome}`
            : 'Cadastre um novo operador para apontamento no chão de fábrica'
        }
        maxWidth="md"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Nome Completo do Operador / Ferramenteiro <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Carlos Eduardo da Silva"
              value={formData.nome}
              onChange={(e) => {
                setFormData({ ...formData, nome: e.target.value });
                if (formErrors.nome) setFormErrors({});
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
              {isSubmitting ? 'Salvando...' : editingOperador ? 'Salvar Alterações' : 'Cadastrar Operador'}
            </button>
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
