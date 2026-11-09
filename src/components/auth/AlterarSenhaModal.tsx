import React, { useState } from 'react';
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Modal } from '../common/Modal';

interface AlterarSenhaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AlterarSenhaModal: React.FC<AlterarSenhaModalProps> = ({ isOpen, onClose }) => {
  const { user, alterarMinhaSenha } = useAuth();

  const isPin = user?.perfil === 'operador' || user?.perfil === 'lider';

  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');

  const [showAtual, setShowAtual] = useState(false);
  const [showNova, setShowNova] = useState(false);
  const [showConfirmacao, setShowConfirmacao] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleClose = () => {
    setAtual('');
    setNova('');
    setConfirmacao('');
    setErrorMessage(null);
    setSuccessMessage(null);
    onClose();
  };

  const isNovaValid = isPin
    ? nova.length >= 4 && nova.length <= 6 && /^\d+$/.test(nova)
    : nova.length >= 8;

  const doMatch = nova.length > 0 && nova === confirmacao;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!atual.trim()) {
      setErrorMessage(`Informe o ${isPin ? 'PIN' : 'senha'} atual.`);
      return;
    }

    if (!isNovaValid) {
      setErrorMessage(
        isPin
          ? 'O novo PIN deve conter entre 4 e 6 dígitos numéricos.'
          : 'A nova senha deve conter no mínimo 8 caracteres.'
      );
      return;
    }

    if (!doMatch) {
      setErrorMessage('A nova credencial e a confirmação não conferem.');
      return;
    }

    setIsLoading(true);
    try {
      await alterarMinhaSenha(atual, nova, confirmacao);
      setSuccessMessage(`${isPin ? 'PIN' : 'Senha'} alterado(a) com sucesso!`);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao alterar credencial.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isPin ? 'Alterar Meu PIN de Acesso' : 'Alterar Minha Senha'}
      subtitle={`Usuário: ${user?.nome || ''}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Credencial Atual */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            {isPin ? 'PIN Atual (4 a 6 dígitos)' : 'Senha Atual'}
          </label>
          <div className="relative">
            <input
              type={isPin ? (showAtual ? 'text' : 'password') : (showAtual ? 'text' : 'password')}
              inputMode={isPin ? 'numeric' : 'text'}
              maxLength={isPin ? 6 : undefined}
              required
              value={atual}
              onChange={(e) =>
                setAtual(isPin ? e.target.value.replace(/\D/g, '') : e.target.value)
              }
              placeholder={isPin ? 'Digite seu PIN atual' : 'Digite sua senha atual'}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowAtual(!showAtual)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showAtual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Nova Credencial */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              {isPin ? 'Novo PIN Numérico' : 'Nova Senha'}
            </label>
            <span
              className={`text-[11px] font-mono ${
                isNovaValid ? 'text-emerald-600 font-semibold' : 'text-slate-400'
              }`}
            >
              {isPin ? `${nova.length}/4 a 6 dígitos` : `${nova.length}/8 carac.`}
            </span>
          </div>
          <div className="relative">
            <input
              type={isPin ? (showNova ? 'text' : 'password') : (showNova ? 'text' : 'password')}
              inputMode={isPin ? 'numeric' : 'text'}
              maxLength={isPin ? 6 : undefined}
              required
              value={nova}
              onChange={(e) =>
                setNova(isPin ? e.target.value.replace(/\D/g, '') : e.target.value)
              }
              placeholder={isPin ? 'Digite o novo PIN numérico' : 'Digite a nova senha'}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowNova(!showNova)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showNova ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Confirmação */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Confirmar Nova Credencial
            </label>
            {doMatch && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                <CheckCircle2 className="h-3 w-3" />
                <span>Conferem</span>
              </span>
            )}
          </div>
          <div className="relative">
            <input
              type={isPin ? (showConfirmacao ? 'text' : 'password') : (showConfirmacao ? 'text' : 'password')}
              inputMode={isPin ? 'numeric' : 'text'}
              maxLength={isPin ? 6 : undefined}
              required
              value={confirmacao}
              onChange={(e) =>
                setConfirmacao(isPin ? e.target.value.replace(/\D/g, '') : e.target.value)
              }
              placeholder={isPin ? 'Repita o novo PIN' : 'Repita a nova senha'}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowConfirmacao(!showConfirmacao)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showConfirmacao ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-500 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Protegido por derivação criptográfica PBKDF2 com 200.000 iterações e salt aleatório.</span>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading || !isNovaValid || !doMatch || !atual.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Atualizando...</span>
              </>
            ) : (
              <>
                <KeyRound className="h-3.5 w-3.5" />
                <span>Atualizar Credencial</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
