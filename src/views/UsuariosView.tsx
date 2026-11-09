import React, { useState, useEffect, useMemo } from 'react';
import { Usuario, PerfilUsuario, Operador } from '../types';
import { authService, CriarUsuarioDTO, AtualizarUsuarioDTO } from '../auth/authService';
import { PERFIL_CONFIG } from '../auth/permissions';
import { Modal } from '../components/common/Modal';
import { ConfirmDeleteModal } from '../components/common/ConfirmDeleteModal';
import { FeedbackAlert } from '../components/common/FeedbackAlert';
import { EmptyState } from '../components/common/EmptyState';
import {
  Users,
  UserPlus,
  Search,
  KeyRound,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Shield,
  Briefcase,
  HardHat,
  Crown,
  Calendar,
  Lock,
  Mail,
  User,
} from 'lucide-react';
import { formatDateBR } from '../utils/formatters';

interface UsuariosViewProps {
  operadores: Operador[];
}

export const UsuariosView: React.FC<UsuariosViewProps> = ({ operadores }) => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [perfilFilter, setPerfilFilter] = useState<string>('Todos');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Modal Criar / Editar
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [formData, setFormData] = useState<{
    nome: string;
    perfil: PerfilUsuario;
    operador_id: string;
    matricula: string;
    pin: string;
    email: string;
    senha: string;
    ativo: boolean;
  }>({
    nome: '',
    perfil: 'operador',
    operador_id: '',
    matricula: '',
    pin: '',
    email: '',
    senha: '',
    ativo: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Redefinir Senha/PIN
  const [resetModalState, setResetModalState] = useState<{
    isOpen: boolean;
    usuario: Usuario | null;
    novaCredencial: string;
    error?: string;
  }>({
    isOpen: false,
    usuario: null,
    novaCredencial: '',
  });

  // Modal Exclusão
  const [deletingUsuario, setDeletingUsuario] = useState<Usuario | null>(null);

  const activeAdminsCount = useMemo(
    () => usuarios.filter((u) => u.perfil === 'admin' && u.ativo).length,
    [usuarios]
  );
  const isEditingLastActiveAdmin = Boolean(
    editingUsuario && editingUsuario.perfil === 'admin' && activeAdminsCount <= 1
  );

  const loadUsuarios = async () => {
    setIsLoading(true);
    try {
      const data = await authService.getUsuarios();
      setUsuarios(data);
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao carregar lista de usuários.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsuarios();
  }, []);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

  // Filtragem
  const filteredUsuarios = useMemo(() => {
    return usuarios.filter((u) => {
      const matchesSearch =
        u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.matricula && u.matricula.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesPerfil = perfilFilter === 'Todos' || u.perfil === perfilFilter;
      const matchesStatus =
        statusFilter === 'Todos' ||
        (statusFilter === 'Ativos' && u.ativo) ||
        (statusFilter === 'Inativos' && !u.ativo);

      return matchesSearch && matchesPerfil && matchesStatus;
    });
  }, [usuarios, searchTerm, perfilFilter, statusFilter]);

  // Abertura do Modal de Criação
  const handleOpenCreateModal = () => {
    setEditingUsuario(null);
    setFormData({
      nome: '',
      perfil: 'operador',
      operador_id: operadores[0]?.id || '',
      matricula: '',
      pin: '',
      email: '',
      senha: '',
      ativo: true,
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Abertura do Modal de Edição
  const handleOpenEditModal = (usuario: Usuario) => {
    setEditingUsuario(usuario);
    setFormData({
      nome: usuario.nome,
      perfil: usuario.perfil,
      operador_id: usuario.operador_id || '',
      matricula: usuario.matricula || '',
      pin: '',
      email: usuario.email || '',
      senha: '',
      ativo: usuario.ativo,
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Validação e Submissão do Formulário de Usuário
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.nome.trim()) {
      errors.nome = 'O nome do usuário é obrigatório.';
    }

    if (formData.perfil === 'operador' || formData.perfil === 'lider') {
      if (!formData.matricula.trim()) {
        errors.matricula = 'A matrícula é obrigatória para operador/líder.';
      }
      if (!editingUsuario && (!formData.pin.trim() || formData.pin.length < 4 || formData.pin.length > 6 || !/^\d+$/.test(formData.pin))) {
        errors.pin = 'O PIN deve conter entre 4 e 6 dígitos numéricos.';
      }
    } else {
      if (!formData.email.trim() || !formData.email.includes('@')) {
        errors.email = 'Informe um e-mail válido.';
      }
      if (!editingUsuario && (!formData.senha.trim() || formData.senha.length < 8)) {
        errors.senha = 'A senha deve conter no mínimo 8 caracteres.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingUsuario) {
        const updatePayload: AtualizarUsuarioDTO = {
          nome: formData.nome.trim(),
          perfil: formData.perfil,
          operador_id: formData.operador_id || undefined,
          ativo: formData.ativo,
          matricula: formData.matricula ? formData.matricula.trim().toUpperCase() : undefined,
          email: formData.email ? formData.email.trim().toLowerCase() : undefined,
        };
        await authService.atualizarUsuario(editingUsuario.id, updatePayload);
        showFeedback('success', `Usuário "${formData.nome.trim()}" atualizado com sucesso!`);
      } else {
        const createPayload: CriarUsuarioDTO = {
          nome: formData.nome.trim(),
          perfil: formData.perfil,
          operador_id: formData.operador_id || undefined,
          ativo: formData.ativo,
          matricula: formData.matricula ? formData.matricula.trim().toUpperCase() : undefined,
          pin: formData.pin,
          email: formData.email ? formData.email.trim().toLowerCase() : undefined,
          senha: formData.senha,
        };
        await authService.criarUsuario(createPayload);
        showFeedback('success', `Usuário "${formData.nome.trim()}" criado com sucesso!`);
      }

      setIsFormModalOpen(false);
      await loadUsuarios();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao salvar usuário.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alternar Status Ativo / Inativo
  const handleToggleStatus = async (usuario: Usuario) => {
    try {
      const updated = await authService.alternarStatusUsuario(usuario.id);
      showFeedback(
        'success',
        `Usuário "${updated.nome}" ${updated.ativo ? 'ativado' : 'desativado'} com sucesso.`
      );
      await loadUsuarios();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao alterar status do usuário.');
    }
  };

  // Abrir Modal de Redefinição de Senha/PIN
  const handleOpenResetModal = (usuario: Usuario) => {
    setResetModalState({
      isOpen: true,
      usuario,
      novaCredencial: '',
      error: undefined,
    });
  };

  const handleConfirmReset = async () => {
    if (!resetModalState.usuario) return;
    const isPin =
      resetModalState.usuario.perfil === 'operador' ||
      resetModalState.usuario.perfil === 'lider';

    if (isPin) {
      if (
        !resetModalState.novaCredencial.trim() ||
        resetModalState.novaCredencial.length < 4 ||
        resetModalState.novaCredencial.length > 6 ||
        !/^\d+$/.test(resetModalState.novaCredencial)
      ) {
        setResetModalState((prev) => ({
          ...prev,
          error: 'O novo PIN deve conter entre 4 e 6 dígitos numéricos.',
        }));
        return;
      }
    } else {
      if (
        !resetModalState.novaCredencial.trim() ||
        resetModalState.novaCredencial.length < 8
      ) {
        setResetModalState((prev) => ({
          ...prev,
          error: 'A nova senha deve conter no mínimo 8 caracteres.',
        }));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await authService.redefinirCredencial(
        resetModalState.usuario.id,
        resetModalState.novaCredencial
      );
      showFeedback(
        'success',
        `Credencial de "${resetModalState.usuario.nome}" redefinida com sucesso!`
      );
      setResetModalState({ isOpen: false, usuario: null, novaCredencial: '' });
      await loadUsuarios();
    } catch (err: any) {
      setResetModalState((prev) => ({ ...prev, error: err.message || 'Erro ao redefinir.' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Exclusão de Usuário
  const handleConfirmDelete = async () => {
    if (!deletingUsuario) return;
    setIsSubmitting(true);
    try {
      await authService.excluirUsuario(deletingUsuario.id);
      showFeedback('success', `Usuário "${deletingUsuario.nome}" excluído com sucesso.`);
      setDeletingUsuario(null);
      await loadUsuarios();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao excluir usuário.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPerfilBadge = (perfil: PerfilUsuario) => {
    const meta = PERFIL_CONFIG[perfil];
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}
      >
        {perfil === 'admin' && <Crown className="h-3 w-3 text-amber-600" />}
        {perfil === 'gerente' && <Briefcase className="h-3 w-3 text-purple-600" />}
        {perfil === 'lider' && <Shield className="h-3 w-3 text-blue-600" />}
        {perfil === 'operador' && <HardHat className="h-3 w-3 text-emerald-600" />}
        <span>{meta.label}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Topo da View */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
            Gestão de Usuários & Controle de Acesso
          </h2>
          <p className="text-xs text-slate-500">
            Administração de contas, perfis de permissão, matrículas, PINs e senhas corporativas
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-slate-900"
        >
          <UserPlus className="h-4 w-4 text-amber-400" />
          <span>Novo Usuário</span>
        </button>
      </div>

      {/* Alerta de Feedback */}
      <FeedbackAlert feedback={feedback} onClose={() => setFeedback(null)} />

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou matrícula..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-slate-900 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
            <span className="text-slate-500 font-medium">Perfil:</span>
            <select
              value={perfilFilter}
              onChange={(e) => setPerfilFilter(e.target.value)}
              className="bg-transparent font-semibold text-slate-900 focus:outline-none"
            >
              <option value="Todos">Todos os Perfis</option>
              <option value="admin">Administrador</option>
              <option value="gerente">Gerente</option>
              <option value="lider">Líder</option>
              <option value="operador">Operador</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent font-semibold text-slate-900 focus:outline-none"
            >
              <option value="Todos">Todos</option>
              <option value="Ativos">Apenas Ativos</option>
              <option value="Inativos">Apenas Inativos</option>
            </select>
          </div>

          <div className="text-xs text-slate-500 pl-2">
            Mostrando <strong className="font-semibold text-slate-900">{filteredUsuarios.length}</strong> de {usuarios.length} usuários
          </div>
        </div>
      </div>

      {/* Tabela de Usuários ou Estado Vazio */}
      {usuarios.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum usuário cadastrado"
          description="Crie usuários para conceder acesso ao chão de fábrica ou ao painel administrativo."
          actionLabel="Criar Primeiro Usuário"
          onAction={handleOpenCreateModal}
        />
      ) : filteredUsuarios.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhum usuário encontrado"
          description="Nenhum registro corresponde aos filtros ou busca aplicados."
          actionLabel="Limpar Filtros"
          onAction={() => {
            setSearchTerm('');
            setPerfilFilter('Todos');
            setStatusFilter('Todos');
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-medium">
                  <th className="py-3 px-4">Usuário</th>
                  <th className="py-3 px-4">Perfil</th>
                  <th className="py-3 px-4">Credencial de Login</th>
                  <th className="py-3 px-4">Operador Vinculado</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 font-mono text-[11px]">Último Acesso</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredUsuarios.map((u) => {
                  const linkedOp = operadores.find((op) => op.id === u.operador_id);
                  const isLastActiveAdmin = u.perfil === 'admin' && u.ativo && activeAdminsCount <= 1;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{u.nome}</div>
                            <div className="font-mono text-[10px] text-slate-400">
                              ID: {u.id.substring(0, 13)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">{getPerfilBadge(u.perfil)}</td>

                      <td className="py-3.5 px-4">
                        {u.perfil === 'operador' || u.perfil === 'lider' ? (
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="font-semibold text-slate-800">Matrícula:</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-900">
                              {u.matricula || '-'}
                            </span>
                            <span className="text-[10px] text-slate-400">· PIN Criptografado</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-slate-800 font-medium">{u.email || '-'}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {linkedOp ? (
                          <span className="font-medium text-slate-900">{linkedOp.nome}</span>
                        ) : (
                          <span className="text-slate-400 italic">Nenhum</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          disabled={isLastActiveAdmin}
                          onClick={() => handleToggleStatus(u)}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                            u.ativo
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          } ${isLastActiveAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={
                            isLastActiveAdmin
                              ? 'Não é permitido desativar o único administrador ativo do sistema'
                              : 'Clique para ativar/desativar usuário'
                          }
                        >
                          {u.ativo ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              <span>Ativo</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 text-slate-400" />
                              <span>Inativo</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {u.ultimo_login ? formatDateBR(u.ultimo_login) : 'Nunca acessou'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenResetModal(u)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                            title="Redefinir senha ou PIN"
                          >
                            <KeyRound className="h-3 w-3 text-slate-500" />
                            <span>Reset</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(u)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                            title="Editar dados cadastrais"
                          >
                            <Edit2 className="h-3 w-3" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            disabled={isLastActiveAdmin}
                            onClick={() => setDeletingUsuario(u)}
                            className={`inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-200 ${
                              isLastActiveAdmin ? 'opacity-40 cursor-not-allowed' : ''
                            }`}
                            title={
                              isLastActiveAdmin
                                ? 'Não é permitido excluir o único administrador ativo do sistema'
                                : 'Excluir usuário'
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Excluir</span>
                          </button>
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

      {/* ========================================================================= */}
      {/* MODAL 1: NOVO / EDITAR USUÁRIO                                            */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingUsuario ? 'Editar Usuário' : 'Novo Usuário'}
        subtitle={
          editingUsuario
            ? `Edite as permissões e dados cadastrais de ${editingUsuario.nome}`
            : 'Cadastre um novo usuário com perfil e credenciais de acesso'
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Nome Completo <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Carlos Eduardo da Silva"
                value={formData.nome}
                onChange={(e) => {
                  setFormData({ ...formData, nome: e.target.value });
                  if (formErrors.nome) setFormErrors({ ...formErrors, nome: '' });
                }}
                className={`mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:outline-none ${
                  formErrors.nome ? 'border-rose-300 bg-rose-50' : 'border-slate-200 focus:border-slate-900'
                }`}
              />
              {formErrors.nome && <p className="mt-1 text-xs text-rose-600">{formErrors.nome}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Perfil de Acesso (Role) <span className="text-rose-500">*</span>
              </label>
              <select
                disabled={isEditingLastActiveAdmin}
                value={formData.perfil}
                onChange={(e) =>
                  setFormData({ ...formData, perfil: e.target.value as PerfilUsuario })
                }
                className={`mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none ${
                  isEditingLastActiveAdmin ? 'bg-slate-100 cursor-not-allowed opacity-80' : ''
                }`}
              >
                <option value="operador">Operador (Apenas Apontamento)</option>
                <option value="lider">Líder (Apontamento + Leitura geral)</option>
                <option value="gerente">Gerente (Gestão completa + Custos)</option>
                <option value="admin">Administrador (Controle total)</option>
              </select>
              {isEditingLastActiveAdmin && (
                <p className="mt-1 text-[11px] text-amber-700 font-medium">
                  Único administrador ativo do sistema. Não pode ser rebaixado nem desativado.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Operador do Chão de Fábrica Vinculado
              </label>
              <select
                value={formData.operador_id}
                onChange={(e) => setFormData({ ...formData, operador_id: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
              >
                <option value="">Nenhum operador vinculado</option>
                {operadores.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.nome}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400">
                Facilita a identificação automática no tablet de apontamento.
              </span>
            </div>
          </div>

          {/* Campos condicionais baseados no perfil (Chão de fábrica vs Gestão) */}
          {formData.perfil === 'operador' || formData.perfil === 'lider' ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <HardHat className="h-4 w-4 text-amber-500" />
                <span>Credenciais Chão de Fábrica (Matrícula + PIN)</span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Matrícula <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 2001 ou OP01"
                    value={formData.matricula}
                    onChange={(e) => {
                      setFormData({ ...formData, matricula: e.target.value.toUpperCase() });
                      if (formErrors.matricula) setFormErrors({ ...formErrors, matricula: '' });
                    }}
                    className={`mt-1.5 w-full rounded-xl border px-3.5 py-2 text-xs font-mono font-bold text-slate-900 bg-white shadow-2xs focus:outline-none ${
                      formErrors.matricula ? 'border-rose-300 bg-rose-50' : 'border-slate-200 focus:border-slate-900'
                    }`}
                  />
                  {formErrors.matricula && (
                    <p className="mt-1 text-xs text-rose-600">{formErrors.matricula}</p>
                  )}
                </div>

                {!editingUsuario && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      PIN Numérico (4 a 6 dígitos) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      placeholder="••••"
                      value={formData.pin}
                      onChange={(e) => {
                        setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') });
                        if (formErrors.pin) setFormErrors({ ...formErrors, pin: '' });
                      }}
                      className={`mt-1.5 w-full rounded-xl border px-3.5 py-2 text-xs font-mono text-slate-900 bg-white shadow-2xs focus:outline-none ${
                        formErrors.pin ? 'border-rose-300 bg-rose-50' : 'border-slate-200 focus:border-slate-900'
                      }`}
                    />
                    {formErrors.pin && <p className="mt-1 text-xs text-rose-600">{formErrors.pin}</p>}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Briefcase className="h-4 w-4 text-blue-600" />
                <span>Credenciais Corporativas (E-mail + Senha)</span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    E-mail Corporativo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="usuario@toolshop.ind.br"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (formErrors.email) setFormErrors({ ...formErrors, email: '' });
                    }}
                    className={`mt-1.5 w-full rounded-xl border px-3.5 py-2 text-xs text-slate-900 bg-white shadow-2xs focus:outline-none ${
                      formErrors.email ? 'border-rose-300 bg-rose-50' : 'border-slate-200 focus:border-slate-900'
                    }`}
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-xs text-rose-600">{formErrors.email}</p>
                  )}
                </div>

                {!editingUsuario && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Senha Provisória (Mínimo 6 chars) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={formData.senha}
                      onChange={(e) => {
                        setFormData({ ...formData, senha: e.target.value });
                        if (formErrors.senha) setFormErrors({ ...formErrors, senha: '' });
                      }}
                      className={`mt-1.5 w-full rounded-xl border px-3.5 py-2 text-xs text-slate-900 bg-white shadow-2xs focus:outline-none ${
                        formErrors.senha ? 'border-rose-300 bg-rose-50' : 'border-slate-200 focus:border-slate-900'
                      }`}
                    />
                    {formErrors.senha && (
                      <p className="mt-1 text-xs text-rose-600">{formErrors.senha}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={isEditingLastActiveAdmin}
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 disabled:opacity-50"
              />
              <span className="text-xs font-semibold text-slate-700">
                Conta Ativa (autorizada a realizar login)
              </span>
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
              {isSubmitting ? 'Salvando...' : editingUsuario ? 'Salvar Alterações' : 'Cadastrar Usuário'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: REDEFINIR SENHA / PIN                                            */}
      {/* ========================================================================= */}
      <Modal
        isOpen={resetModalState.isOpen}
        onClose={() =>
          setResetModalState({ isOpen: false, usuario: null, novaCredencial: '', error: undefined })
        }
        title="Redefinir Credencial de Acesso"
        subtitle={`Defina nova senha ou PIN para ${resetModalState.usuario?.nome}`}
        maxWidth="md"
      >
        <div className="space-y-4">
          {resetModalState.error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-medium">
              {resetModalState.error}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <div>
              <strong>Usuário:</strong> {resetModalState.usuario?.nome}
            </div>
            <div>
              <strong>Perfil:</strong>{' '}
              {resetModalState.usuario ? PERFIL_CONFIG[resetModalState.usuario.perfil].label : ''}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              {resetModalState.usuario?.perfil === 'operador' ||
              resetModalState.usuario?.perfil === 'lider'
                ? 'Novo PIN Numérico (4 a 6 dígitos)'
                : 'Nova Senha (Mínimo 6 caracteres)'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              value={resetModalState.novaCredencial}
              onChange={(e) =>
                setResetModalState({
                  ...resetModalState,
                  novaCredencial:
                    resetModalState.usuario?.perfil === 'operador' ||
                    resetModalState.usuario?.perfil === 'lider'
                      ? e.target.value.replace(/\D/g, '')
                      : e.target.value,
                  error: undefined,
                })
              }
              placeholder={
                resetModalState.usuario?.perfil === 'operador' ||
                resetModalState.usuario?.perfil === 'lider'
                  ? 'Ex: 4 a 6 dígitos'
                  : 'Digite a nova senha (mínimo 8 caracteres)...'
              }
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 shadow-2xs focus:border-slate-900 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              A nova credencial será protegida via Web Crypto PBKDF2 (200.000 iterações com salt individual).
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() =>
                setResetModalState({
                  isOpen: false,
                  usuario: null,
                  novaCredencial: '',
                  error: undefined,
                })
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmReset}
              disabled={isSubmitting || !resetModalState.novaCredencial}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
            >
              <KeyRound className="h-3.5 w-3.5 text-amber-400" />
              <span>{isSubmitting ? 'Salvando...' : 'Salvar Nova Credencial'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: CONFIRMAÇÃO DE EXCLUSÃO DE USUÁRIO                               */}
      {/* ========================================================================= */}
      {deletingUsuario && (
        <ConfirmDeleteModal
          isOpen={Boolean(deletingUsuario)}
          onClose={() => setDeletingUsuario(null)}
          onConfirm={handleConfirmDelete}
          title="Excluir Usuário"
          itemName={deletingUsuario.nome}
          entityTypeLabel="o usuário"
          isDeleting={isSubmitting}
        />
      )}
    </div>
  );
};
