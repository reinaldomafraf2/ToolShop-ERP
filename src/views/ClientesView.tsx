import React, { useState, useMemo } from 'react';
import { Cliente, ProjetoComDetalhes } from '../types';
import { toolShopService } from '../services/toolShopService';
import { Modal } from '../components/common/Modal';
import { ConfirmDeleteModal } from '../components/common/ConfirmDeleteModal';
import { FeedbackAlert } from '../components/common/FeedbackAlert';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../auth/AuthContext';
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  FolderKanban,
  Check,
  AlertCircle,
} from 'lucide-react';

interface ClientesViewProps {
  clientes: Cliente[];
  projetos: ProjetoComDetalhes[];
  onRefresh: () => void;
}

export const ClientesView: React.FC<ClientesViewProps> = ({
  clientes,
  projetos,
  onRefresh,
}) => {
  const { can } = useAuth();
  const canCreate = can('criar', 'clientes');
  const canEdit = can('editar', 'clientes');
  const canDelete = can('excluir', 'clientes');

  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estados dos Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState({ nome: '', contato: '' });
  const [formErrors, setFormErrors] = useState<{ nome?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado do Modal de Exclusão
  const [deletingCliente, setDeletingCliente] = useState<Cliente | null>(null);
  const [deleteBlockedReason, setDeleteBlockedReason] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filtragem dos clientes
  const filteredClientes = useMemo(() => {
    if (!searchTerm.trim()) return clientes;
    const term = searchTerm.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(term) ||
        (c.contato && c.contato.toLowerCase().includes(term))
    );
  }, [clientes, searchTerm]);

  // Contagem de projetos por cliente
  const projetosPorCliente = useMemo(() => {
    const map = new Map<string, ProjetoComDetalhes[]>();
    projetos.forEach((p) => {
      const list = map.get(p.cliente_id) || [];
      list.push(p);
      map.set(p.cliente_id, list);
    });
    return map;
  }, [projetos]);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleOpenCreateModal = () => {
    setEditingCliente(null);
    setFormData({ nome: '', contato: '' });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({ nome: cliente.nome, contato: cliente.contato || '' });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const handleOpenDeleteModal = async (cliente: Cliente) => {
    setDeletingCliente(cliente);
    const check = await toolShopService.checkCanDeleteCliente(cliente.id);
    if (!check.canDelete) {
      setDeleteBlockedReason(check.reason || 'Este cliente não pode ser excluído.');
    } else {
      setDeleteBlockedReason(null);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação
    if (!formData.nome.trim()) {
      setFormErrors({ nome: 'O nome do cliente é obrigatório.' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCliente) {
        await toolShopService.updateCliente(editingCliente.id, {
          nome: formData.nome.trim(),
          contato: formData.contato.trim(),
        });
        showFeedback('success', `Cliente "${formData.nome.trim()}" atualizado com sucesso!`);
      } else {
        await toolShopService.createCliente({
          nome: formData.nome.trim(),
          contato: formData.contato.trim(),
        });
        showFeedback('success', `Cliente "${formData.nome.trim()}" cadastrado com sucesso!`);
      }
      setIsFormModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setFormErrors({ nome: err.message || 'Erro ao salvar cliente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCliente) return;

    setIsDeleting(true);
    try {
      await toolShopService.deleteCliente(deletingCliente.id);
      showFeedback('success', `Cliente "${deletingCliente.nome}" excluído com sucesso.`);
      setDeletingCliente(null);
      onRefresh();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao excluir cliente.');
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
            Cadastro de Clientes Industriais
          </h2>
          <p className="text-xs text-slate-500">
            Gerencie os clientes contratantes de moldes, estampos e dispositivos
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-slate-900"
          >
            <Plus className="h-4 w-4 text-amber-400" />
            <span>Novo Cliente</span>
          </button>
        )}
      </div>

      {/* Feedback Padronizado */}
      <FeedbackAlert feedback={feedback} onClose={() => setFeedback(null)} />

      {/* Barra de Busca e Métricas */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou contato do cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-slate-900 focus:outline-none"
          />
        </div>

        <div className="text-xs text-slate-500">
          Mostrando <strong className="font-semibold text-slate-900">{filteredClientes.length}</strong> de {clientes.length} clientes
        </div>
      </div>

      {/* Tabela de Clientes ou Estado Vazio */}
      {clientes.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhum cliente cadastrado ainda"
          description="Cadastre parceiros industriais, montadoras e transformadores para vincular aos projetos de ferramentaria."
          actionLabel="Cadastrar Primeiro Cliente"
          onAction={handleOpenCreateModal}
        />
      ) : filteredClientes.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhum cliente encontrado"
          description={`Não localizamos nenhum cliente correspondente à busca "${searchTerm}".`}
          actionLabel="Limpar Busca"
          onAction={() => setSearchTerm('')}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-medium">
                  <th className="py-3 px-4">Nome do Cliente</th>
                  <th className="py-3 px-4">Contato / Representante</th>
                  <th className="py-3 px-4">Projetos Ativos</th>
                  <th className="py-3 px-4 font-mono text-[11px]">ID (UUID)</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredClientes.map((cli) => {
                  const cliProjetos = projetosPorCliente.get(cli.id) || [];
                  return (
                    <tr key={cli.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <span>{cli.nome}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                        {cli.contato || <span className="text-slate-400 italic">Não informado</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        {cliProjetos.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {cliProjetos.map((p) => (
                              <span
                                key={p.id}
                                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700"
                              >
                                <FolderKanban className="h-3 w-3 text-slate-400" />
                                <span>{p.codigo}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">Sem projetos no momento</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        {cli.id.substring(0, 13)}...
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(cli)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                              title="Editar cliente"
                            >
                              <Edit2 className="h-3 w-3" />
                              <span>Editar</span>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(cli)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                              title="Excluir cliente"
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

      {/* Modal Formulário (Novo / Edição de Cliente) */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
        subtitle={
          editingCliente
            ? `Atualize as informações de ${editingCliente.nome}`
            : 'Cadastre uma nova indústria parceira para alocação de projetos'
        }
        maxWidth="md"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Razão Social / Nome da Empresa <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Usinagem & Estamparia Brasil Ltda"
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

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Dados de Contato (Responsável, E-mail, Telefone)
            </label>
            <textarea
              rows={3}
              placeholder="Ex: Eng. Ricardo Prado · ricardo@empresa.com.br · (11) 98765-4321"
              value={formData.contato}
              onChange={(e) => setFormData({ ...formData, contato: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
            />
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
              {isSubmitting ? 'Salvando...' : editingCliente ? 'Salvar Alterações' : 'Cadastrar Cliente'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Confirmação de Exclusão */}
      {deletingCliente && (
        <ConfirmDeleteModal
          isOpen={Boolean(deletingCliente)}
          onClose={() => setDeletingCliente(null)}
          onConfirm={handleConfirmDelete}
          title="Excluir Cliente"
          itemName={deletingCliente.nome}
          entityTypeLabel="o cliente"
          blockedReason={deleteBlockedReason}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};
