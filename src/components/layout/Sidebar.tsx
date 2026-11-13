import React from 'react';
import { ViewTab } from '../../types';
import {
  LayoutDashboard,
  FolderKanban,
  BookOpen,
  Cpu,
  Users,
  Building2,
  Clock,
  RotateCcw,
  Wrench,
  ShieldCheck,
  UserCheck,
  LogOut,
  X,
  HardHat,
  Briefcase,
  Crown,
  Shield,
  Sliders,
  Trash2,
  ShoppingCart,
  Package,
} from 'lucide-react';
import { DEFAULT_EMPRESA_ID } from '../../utils/uuid';
import { useAuth } from '../../auth/AuthContext';
import { PERFIL_CONFIG } from '../../auth/permissions';

interface SidebarProps {
  currentTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onResetSeed: () => void;
  isResetting?: boolean;
}

interface NavItem {
  id: ViewTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const ALL_NAV_ITEMS: NavItem[] = [
  {
    id: 'painel',
    label: 'Painel',
    icon: LayoutDashboard,
    description: 'Indicadores e status geral',
  },
  {
    id: 'projetos',
    label: 'Projetos',
    icon: FolderKanban,
    description: 'Moldes, estampos e peças',
  },
  {
    id: 'compras',
    label: 'Compras',
    icon: ShoppingCart,
    description: 'Materiais e compras do projeto',
  },
  {
    id: 'estoque',
    label: 'Estoque',
    icon: Package,
    description: 'Materiais, sobras e inventário',
  },
  {
    id: 'biblioteca',
    label: 'Biblioteca',
    icon: BookOpen,
    description: 'Componentes-modelo e roteiros',
  },
  {
    id: 'centros_custo',
    label: 'Centros de Custo',
    icon: Cpu,
    description: 'Postos internos e terceirizados',
  },
  {
    id: 'operadores',
    label: 'Operadores',
    icon: Users,
    description: 'Ferramenteiros e equipe',
  },
  {
    id: 'clientes',
    label: 'Clientes',
    icon: Building2,
    description: 'Carteira industrial',
  },
  {
    id: 'apontamento',
    label: 'Apontamento',
    icon: Clock,
    description: 'Lançamento de horas e turno',
  },
  {
    id: 'usuarios',
    label: 'Usuários',
    icon: ShieldCheck,
    description: 'Controle de acesso e senhas',
  },
  {
    id: 'configuracoes',
    label: 'Configurações',
    icon: Sliders,
    description: 'Regras e postos de trabalho',
  },
  {
    id: 'sincronizacao',
    label: 'Sincronização',
    icon: RotateCcw,
    description: 'Backup e sincronização com servidor',
  },
];


export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  onResetSeed,
  isResetting,
}) => {
  const { user, perfil, canAccessTab, logout, sessionSecondsRemaining } = useAuth();

  // Filtra itens do menu conforme as permissões do perfil do usuário logado
  // Operador visualiza exclusivamente a tela de "Apontamento"
  const visibleNavItems = ALL_NAV_ITEMS.filter((item) => canAccessTab(item.id));

  const perfilMeta = perfil ? PERFIL_CONFIG[perfil] : null;

  const formatRemainingMinutes = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  return (
    <>
      {/* Overlay para telas móveis / tablet portrait quando sidebar estiver aberta */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Menu Lateral Fixo */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand / Topo da Ferramentaria */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
              <Wrench className="h-5 w-5 text-amber-400" />
            </div>
            <div className="leading-tight">
              <span className="block text-base font-bold tracking-tight text-slate-900">
                ToolShop ERP
              </span>
              <span className="block text-[11px] font-medium text-slate-500">
                Gestão de Ferramentaria
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Links de Navegação Filtrados por Perfil */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            {perfil === 'operador' ? 'Estação Chão de Fábrica' : 'Menu Operacional'}
          </div>

          <nav className="space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile();
                  }}
                  className={`group flex w-full items-center gap-3.5 rounded-xl px-3.5 py-3 text-left transition-all ${
                    isActive
                      ? 'bg-slate-900 font-semibold text-white shadow-xs'
                      : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 transition-colors ${
                      isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-700'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{item.label}</div>
                    <div
                      className={`truncate text-xs ${
                        isActive ? 'text-slate-300' : 'text-slate-400 group-hover:text-slate-500'
                      }`}
                    >
                      {item.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Destaque para Operador: Modo Focado Tablet */}
          {perfil === 'operador' && (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900">
              <div className="flex items-center gap-1.5 font-bold">
                <HardHat className="h-4 w-4 text-emerald-700" />
                <span>Modo Operador Ativo</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-emerald-700">
                Seu acesso é restrito ao lançamento e acompanhamento dos seus próprios turnos e
                apontamentos.
              </p>
            </div>
          )}
        </div>

        {/* Card do Usuário Conectado & Logout */}
        {user && perfilMeta && (
          <div className="border-t border-slate-200 bg-slate-50/80 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center rounded border px-1.5 py-0.2 text-[10px] font-bold ${perfilMeta.badgeClass}`}
                  >
                    {perfil === 'admin' && <Crown className="h-2.5 w-2.5 mr-0.5 text-amber-600" />}
                    {perfil === 'gerente' && <Briefcase className="h-2.5 w-2.5 mr-0.5 text-purple-600" />}
                    {perfil === 'lider' && <Shield className="h-2.5 w-2.5 mr-0.5 text-blue-600" />}
                    {perfil === 'operador' && <HardHat className="h-2.5 w-2.5 mr-0.5 text-emerald-600" />}
                    {perfilMeta.label}
                  </span>
                </div>
                <div className="mt-1 truncate text-xs font-bold text-slate-900">
                  {user.nome}
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500 font-mono">
                  Sessão: {formatRemainingMinutes(sessionSecondsRemaining)}
                </div>
              </div>

              <button
                type="button"
                onClick={logout}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-colors shadow-2xs"
                title="Encerrar sessão (Logout)"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Rodapé da Barra Lateral - Limpar Dados de Exemplo */}
        {(perfil === 'admin' || perfil === 'gerente') && (
          <div className="border-t border-slate-200 p-3">
            <button
              type="button"
              onClick={onResetSeed}
              disabled={isResetting}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-2xs hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:opacity-50"
              title="Apagar dados de exemplo e manter base limpa"
            >
              <Trash2 className={`h-3.5 w-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span>Limpar Dados de Exemplo</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
