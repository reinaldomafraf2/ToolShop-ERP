import React, { useState } from 'react';
import { ViewTab } from '../../types';
import { Menu, Layers, LogOut, User, Clock, AlertTriangle, KeyRound } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { PERFIL_CONFIG } from '../../auth/permissions';
import { AlterarSenhaModal } from '../auth/AlterarSenhaModal';

interface HeaderProps {
  currentTab: ViewTab;
  onToggleSidebarMobile: () => void;
  activeShiftsCount: number;
}

const TAB_TITLES: Record<ViewTab, { title: string; subtitle: string }> = {
  painel: {
    title: 'Painel Geral',
    subtitle: 'Visão executiva da oficina, projetos ativos e apontamento em tempo real',
  },
  projetos: {
    title: 'Projetos de Ferramentaria',
    subtitle: 'Moldes, estampos e dispositivos com estrutura de componentes e operações',
  },
  biblioteca: {
    title: 'Biblioteca Técnica',
    subtitle: 'Componentes-modelo, roteiros padrão de usinagem e processos',
  },
  centros_custo: {
    title: 'Centros de Custo',
    subtitle: 'Postos de usinagem internos e serviços terceirizados especializados',
  },
  maquinas: {
    title: 'Centros de Custo',
    subtitle: 'Postos de usinagem internos e serviços terceirizados especializados',
  },
  operadores: {
    title: 'Equipe de Operadores',
    subtitle: 'Ferramenteiros, operadores CNC, torneiros e ajustadores',
  },
  clientes: {
    title: 'Clientes Industriais',
    subtitle: 'Indústrias automotivas, sistemistas e transformadores de plástico',
  },
  apontamento: {
    title: 'Apontamento de Horas',
    subtitle: 'Registro de horas trabalhadas por centro de custo, componente e operador',
  },
  usuarios: {
    title: 'Gestão de Usuários',
    subtitle: 'Controle de acesso, perfis e credenciais de segurança',
  },
  sem_permissao: {
    title: 'Acesso Restrito',
    subtitle: 'Página sem permissão de acesso para o perfil atual',
  },
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onToggleSidebarMobile,
  activeShiftsCount,
}) => {
  const { user, perfil, logout, sessionSecondsRemaining, isExpiringSoon } = useAuth();
  const meta = TAB_TITLES[currentTab] || {
    title: 'ToolShop ERP',
    subtitle: 'Gestão de Ferramentaria',
  };

  const perfilMeta = perfil ? PERFIL_CONFIG[perfil] : null;

  const formatRemainingMinutes = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebarMobile}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Abrir menu lateral"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                {meta.title}
              </h1>
              <span className="hidden text-xs text-slate-400 sm:inline" aria-hidden="true">
                /
              </span>
              <span className="hidden text-xs font-medium text-slate-500 sm:inline">
                ToolShop ERP
              </span>
            </div>
            <p className="hidden text-xs text-slate-500 sm:block">{meta.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Indicador de Máquinas em Operação */}
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            <span className="tabular-nums">
              {activeShiftsCount > 0 ? (
                <span className="font-semibold text-emerald-700">
                  {activeShiftsCount} {activeShiftsCount === 1 ? 'posto em operação' : 'postos em operação'}
                </span>
              ) : (
                <span className="text-slate-500">Postos em espera</span>
              )}
            </span>
          </div>

          {/* Indicador de Inatividade de Sessão */}
          {user && (
            <div
              className={`hidden md:flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-mono tabular-nums transition-colors ${
                isExpiringSoon
                  ? 'border-amber-300 bg-amber-50 text-amber-800 font-bold animate-pulse'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
              title="Tempo restante de sessão antes do logout por inatividade"
            >
              {isExpiringSoon ? (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              ) : (
                <Clock className="h-3.5 w-3.5 text-slate-400" />
              )}
              <span>{formatRemainingMinutes(sessionSecondsRemaining)}</span>
            </div>
          )}

          {/* Usuário, Alterar Senha e Logout */}
          {user && perfilMeta && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-bold text-slate-900 leading-tight">
                  {user.nome}
                </span>
                <span className="text-[10px] text-slate-500 font-medium leading-tight">
                  {perfilMeta.label}
                </span>
              </div>

              {/* Botão Alterar Senha / PIN */}
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 sm:px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
                title={user.perfil === 'operador' || user.perfil === 'lider' ? 'Alterar meu PIN' : 'Alterar minha senha'}
              >
                <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                <span className="hidden md:inline">
                  {user.perfil === 'operador' || user.perfil === 'lider' ? 'Alterar PIN' : 'Alterar senha'}
                </span>
              </button>

              <button
                type="button"
                onClick={logout}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-colors shadow-2xs"
                title="Encerrar sessão"
              >
                <LogOut className="h-3.5 w-3.5 text-slate-500" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Modal de Alteração de Senha / PIN */}
      {isPasswordModalOpen && (
        <AlterarSenhaModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
        />
      )}
    </>
  );
};
