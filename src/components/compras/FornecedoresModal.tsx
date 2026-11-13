import React, { useState } from 'react';
import { Fornecedor } from '../../types';
import { useAuth } from '../../auth/AuthContext';
import { Modal } from '../common/Modal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Power,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Mail,
  User,
  Clock,
} from 'lucide-react';

interface FornecedoresModalProps {
  isOpen: boolean;
  onClose: () => void;
  fornecedores: Fornecedor[];
  onCreate: (data: Omit<Fornecedor, 'id' | 'empresa_id'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Fornecedor>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const FornecedoresModal: React.FC<FornecedoresModalProps> = ({
  isOpen,
  onClose,
  fornecedores,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const { perfil } = useAuth();
  const canManage = perfil === 'gerente' || perfil === 'admin';

  const [search, setSearch] = useState('');
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [form, setForm] = useState({
    nome: '',
    contato: '',
    telefone: '',
    email: '',
    prazo_padrao_dias: '',
    observacoes: '',
    ativo: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fornecedorToDelete, setFornecedorToDelete] = useState<Fornecedor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  if (!isOpen) return null;

  const filteredFornecedores = fornecedores.filter((f) => {
    const q = search.toLowerCase();
    return (
      f.nome.toLowerCase().includes(q) ||
      (f.contato && f.contato.toLowerCase().includes(q)) ||
      (f.email && f.email.toLowerCase().includes(q))
    );
  });

  const handleOpenCreate = () => {
    setEditingFornecedor(null);
    setForm({
      nome: '',
      contato: '',
      telefone: '',
      email: '',
      prazo_padrao_dias: '5',
      observacoes: '',
      ativo: true,
    });
    setFeedback(null);
    setIsCreating(true);
  };

  const handleOpenEdit = (f: Fornecedor) => {
    setEditingFornecedor(f);
    setForm({
      nome: f.nome,
      contato: f.contato || '',
      telefone: f.telefone || '',
      email: f.email || '',
      prazo_padrao_dias: f.prazo_padrao_dias ? String(f.prazo_padrao_dias) : '',
      observacoes: f.observacoes || '',
      ativo: f.ativo,
    });
    setFeedback(null);
    setIsCreating(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      setFeedback({ type: 'error', message: 'O nome do fornecedor é obrigatório.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const payload = {
        nome: form.nome.trim(),
        contato: form.contato.trim() || undefined,
        telefone: form.telefone.trim() || undefined,
        email: form.email.trim() || undefined,
        prazo_padrao_dias: form.prazo_padrao_dias ? parseInt(form.prazo_padrao_dias, 10) : undefined,
        observacoes: form.observacoes.trim() || undefined,
        ativo: form.ativo,
      };

      if (editingFornecedor) {
        await onUpdate(editingFornecedor.id, payload);
        setFeedback({ type: 'success', message: 'Fornecedor atualizado com sucesso!' });
      } else {
        await onCreate(payload);
        setFeedback({ type: 'success', message: 'Fornecedor cadastrado com sucesso!' });
      }
      setIsCreating(false);
      setEditingFornecedor(null);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao salvar fornecedor.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleAtivo = async (f: Fornecedor) => {
    try {
      await onUpdate(f.id, { ativo: !f.ativo });
      setFeedback({
        type: 'success',
        message: `Fornecedor ${!f.ativo ? 'ativado' : 'desativado'} com sucesso!`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao alterar status.' });
    }
  };

  const handleConfirmDeleteFornecedor = async () => {
    if (!fornecedorToDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(fornecedorToDelete.id);
      setFeedback({ type: 'success', message: 'Fornecedor excluído com sucesso!' });
      setFornecedorToDelete(null);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao excluir fornecedor.' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cadastro de Fornecedores de Materiais e Peças"
      subtitle="Gerencie parceiros comerciais para cotação e fornecimento"
      maxWidth="3xl"
    >
      <div className="space-y-4 text-xs text-slate-800">
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
              className="font-bold ml-2 text-slate-500 hover:text-slate-800"
            >
              ✕
            </button>
          </div>
        )}

        {/* MODO FORMULÁRIO (CRIAR / EDITAR) */}
        {isCreating ? (
          <form onSubmit={handleSubmit} className="space-y-4 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingFornecedor ? `Editar Fornecedor: ${editingFornecedor.nome}` : 'Novo Fornecedor'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingFornecedor(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Voltar à lista
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Razão Social / Nome Fantasia <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Gerdau Aços Especiais"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contato Comercial
                </label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Oliveira (Vendas)"
                  value={form.contato}
                  onChange={(e) => setForm({ ...form, contato: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone</label>
                <input
                  type="text"
                  placeholder="Ex: (47) 3433-0000"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  placeholder="Ex: vendas@fornecedor.com.br"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Prazo Padrão de Entrega (dias úteis)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Ex: 5"
                  value={form.prazo_padrao_dias}
                  onChange={(e) => setForm({ ...form, prazo_padrao_dias: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="flex items-center pt-6">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Fornecedor Ativo para Novas Compras
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Observações Gerais
              </label>
              <textarea
                rows={2}
                placeholder="Condições de pagamento, frete, linha de produtos..."
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingFornecedor(null);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Fornecedor'}
              </button>
            </div>
          </form>
        ) : (
          /* MODO LISTA DE FORNECEDORES */
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome, contato ou e-mail..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
                />
              </div>

              {canManage && (
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  <span>Novo Fornecedor</span>
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-200">
              {filteredFornecedores.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  Nenhum fornecedor cadastrado ou encontrado na busca.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-[10px] text-slate-600">
                    <tr>
                      <th className="py-2 px-3">Fornecedor</th>
                      <th className="py-2 px-3">Contato & Telefone</th>
                      <th className="py-2 px-3">E-mail</th>
                      <th className="py-2 px-3 text-center">Prazo Médio</th>
                      <th className="py-2 px-3 text-center">Status</th>
                      {canManage && <th className="py-2 px-3 text-right">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredFornecedores.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3">
                          <strong className="text-slate-900 block">{f.nome}</strong>
                          {f.observacoes && (
                            <span className="text-[10px] text-slate-400 truncate block max-w-xs">
                              {f.observacoes}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {f.contato && <div>{f.contato}</div>}
                          {f.telefone && <div className="font-mono text-[11px] text-slate-400">{f.telefone}</div>}
                          {!f.contato && !f.telefone && <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {f.email ? (
                            <span className="font-mono text-[11px]">{f.email}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {f.prazo_padrao_dias ? `${f.prazo_padrao_dias}d` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              f.ativo
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {f.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        {canManage && (
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleToggleAtivo(f)}
                                className={`rounded p-1.5 text-xs ${
                                  f.ativo ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={f.ativo ? 'Desativar fornecedor' : 'Ativar fornecedor'}
                              >
                                <Power className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(f)}
                                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                title="Editar fornecedor"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setFornecedorToDelete(f)}
                                className="rounded p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                                title="Excluir fornecedor"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={Boolean(fornecedorToDelete)}
        onClose={() => setFornecedorToDelete(null)}
        onConfirm={handleConfirmDeleteFornecedor}
        title="Excluir Fornecedor"
        itemName={fornecedorToDelete?.nome || ''}
        entityTypeLabel="Fornecedor"
        isDeleting={isDeleting}
      />
    </Modal>
  );
};
