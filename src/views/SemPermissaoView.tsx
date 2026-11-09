import React from 'react';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { PERFIL_CONFIG } from '../auth/permissions';
import { ViewTab } from '../types';

interface SemPermissaoViewProps {
  attemptedTab?: ViewTab | string;
  onNavigateHome: () => void;
}

export const SemPermissaoView: React.FC<SemPermissaoViewProps> = ({
  attemptedTab,
  onNavigateHome,
}) => {
  const { user, logout } = useAuth();
  const perfilMeta = user ? PERFIL_CONFIG[user.perfil] : null;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <h2 className="mt-4 text-lg font-bold text-slate-900 sm:text-xl">
          Acesso Não Autorizado
        </h2>

        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          Você tentou acessar a seção{' '}
          {attemptedTab && (
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-800">
              {attemptedTab}
            </code>
          )}
          , mas o seu perfil atual não possui autorização na matriz de permissões.
        </p>

        {user && perfilMeta && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-left text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Usuário conectado:</span>
              <strong className="text-slate-900">{user.nome}</strong>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-slate-500">Perfil:</span>
              <span
                className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${perfilMeta.badgeClass}`}
              >
                {perfilMeta.label}
              </span>
            </div>
            <p className="mt-2 border-t border-slate-200/80 pt-2 text-[11px] text-slate-500 leading-snug">
              {perfilMeta.description}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-center">
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Ir para Início Permitido</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <LogOut className="h-4 w-4 text-slate-500" />
            <span>Trocar de Conta</span>
          </button>
        </div>
      </div>
    </div>
  );
};
