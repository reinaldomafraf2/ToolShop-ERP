/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ViewTab,
  ProjetoComDetalhes,
  CentroCusto,
  Maquina,
  Operador,
  Cliente,
  ApontamentoComOperador,
} from './types';
import { toolShopService } from './services/toolShopService';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { PainelView } from './views/PainelView';
import { ProjetosView } from './views/ProjetosView';
import { BibliotecaView } from './views/BibliotecaView';
import { CentrosCustoView } from './views/CentrosCustoView';
import { MaquinasView } from './views/MaquinasView';
import { OperadoresView } from './views/OperadoresView';
import { ClientesView } from './views/ClientesView';
import { ApontamentoView } from './views/ApontamentoView';
import { UsuariosView } from './views/UsuariosView';
import { SemPermissaoView } from './views/SemPermissaoView';
import { LoginView } from './views/LoginView';
import { CriarPrimeiroAdminView } from './views/CriarPrimeiroAdminView';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    hasActiveAdmin,
    user,
    perfil,
    canAccessTab,
    defaultTab,
  } = useAuth();

  const [currentTab, setCurrentTab] = useState<ViewTab>('painel');
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  // Estados dos dados carregados através do ToolShopService
  const [projetos, setProjetos] = useState<ProjetoComDetalhes[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const maquinas = centrosCusto;
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [apontamentos, setApontamentos] = useState<ApontamentoComOperador[]>([]);

  // Sincroniza tab padrão do perfil ao autenticar (Operador cai direto em Apontamento)
  useEffect(() => {
    if (isAuthenticated && perfil) {
      // Se houver hash na URL, tenta navegar por ele
      const hash = window.location.hash.replace('#', '') as ViewTab;
      const validTabs: ViewTab[] = [
        'painel',
        'projetos',
        'biblioteca',
        'centros_custo',
        'maquinas',
        'operadores',
        'clientes',
        'apontamento',
        'usuarios',
      ];

      if (hash && validTabs.includes(hash)) {
        if (canAccessTab(hash)) {
          setCurrentTab(hash);
        } else {
          setCurrentTab('sem_permissao');
        }
      } else {
        setCurrentTab(defaultTab);
        window.location.hash = defaultTab;
      }
    }
  }, [isAuthenticated, perfil, defaultTab, canAccessTab]);

  // Listener para alteração direta de hash na barra de endereços do navegador
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as ViewTab;
      const validTabs: ViewTab[] = [
        'painel',
        'projetos',
        'biblioteca',
        'centros_custo',
        'maquinas',
        'operadores',
        'clientes',
        'apontamento',
        'usuarios',
      ];

      if (hash && validTabs.includes(hash)) {
        if (canAccessTab(hash)) {
          setCurrentTab(hash);
        } else {
          setCurrentTab('sem_permissao');
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isAuthenticated, canAccessTab]);

  const handleSelectTab = (tab: ViewTab) => {
    if (canAccessTab(tab)) {
      setCurrentTab(tab);
      window.location.hash = tab;
    } else {
      setCurrentTab('sem_permissao');
      window.location.hash = 'sem_permissao';
    }
  };

  const loadData = useCallback(async () => {
    try {
      const [projList, maqList, opList, cliList, aptList] = await Promise.all([
        toolShopService.getProjetosComDetalhes(),
        toolShopService.getCentrosCusto(),
        toolShopService.getOperadores(),
        toolShopService.getClientes(),
        toolShopService.getApontamentos(),
      ]);

      setProjetos(projList);
      setCentrosCusto(maqList);
      setOperadores(opList);
      setClientes(cliList);
      setApontamentos(aptList);
    } catch (error) {
      console.error('Erro ao carregar dados da ferramentaria:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  const handleResetSeed = async () => {
    setIsResetting(true);
    try {
      await toolShopService.resetSeedData();
      await loadData();
    } catch (err) {
      console.error('Erro ao restaurar dados seed:', err);
    } finally {
      setIsResetting(false);
    }
  };

  const activeMachineIds = new Set(
    apontamentos
      .filter((a) => !a.fim)
      .map((a) => a.maquina?.id)
      .filter((id): id is string => Boolean(id))
  );

  // Se estiver carregando estado de autenticação
  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  // Se não existir nenhum administrador ativo, exibe a tela de configuração do primeiro admin
  if (!hasActiveAdmin) {
    return <CriarPrimeiroAdminView />;
  }

  // Se não estiver autenticado, exibe tela de login (Dual: Chão de Fábrica Tablet vs Gestão)
  if (!isAuthenticated) {
    return <LoginView />;
  }

  // Validação de acesso à rota atual
  const isTabForbidden = !canAccessTab(currentTab) || currentTab === 'sem_permissao';

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Menu Lateral Fixo com Itens Filtrados por Perfil */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        isOpenMobile={isSidebarOpenMobile}
        onCloseMobile={() => setIsSidebarOpenMobile(false)}
        onResetSeed={handleResetSeed}
        isResetting={isResetting}
      />

      {/* Área de Conteúdo Principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          currentTab={currentTab}
          onToggleSidebarMobile={() => setIsSidebarOpenMobile((prev) => !prev)}
          activeShiftsCount={activeMachineIds.size}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {isLoading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-slate-700" />
              <span className="text-xs font-medium">Carregando dados da ferramentaria...</span>
            </div>
          ) : isTabForbidden ? (
            <SemPermissaoView
              attemptedTab={currentTab}
              onNavigateHome={() => handleSelectTab(defaultTab)}
            />
          ) : (
            <>
              {currentTab === 'painel' && (
                <PainelView
                  projetos={projetos}
                  maquinas={maquinas}
                  totalMaquinas={maquinas.length}
                  totalOperadores={operadores.length}
                  apontamentos={apontamentos}
                  onNavigateTab={handleSelectTab}
                  onRefresh={loadData}
                />
              )}

              {currentTab === 'projetos' && (
                <ProjetosView
                  projetos={projetos}
                  clientes={clientes}
                  maquinas={maquinas}
                  onRefresh={loadData}
                />
              )}

              {currentTab === 'biblioteca' && (
                <BibliotecaView onRefresh={loadData} />
              )}

              {(currentTab === 'centros_custo' || currentTab === 'maquinas') && (
                <CentrosCustoView
                  centrosCusto={centrosCusto}
                  activeCenterIds={activeMachineIds}
                  onRefresh={loadData}
                />
              )}

              {currentTab === 'operadores' && (
                <OperadoresView
                  operadores={operadores}
                  apontamentos={apontamentos}
                  onRefresh={loadData}
                />
              )}

              {currentTab === 'clientes' && (
                <ClientesView
                  clientes={clientes}
                  projetos={projetos}
                  onRefresh={loadData}
                />
              )}

              {currentTab === 'apontamento' && (
                <ApontamentoView
                  apontamentos={apontamentos}
                  operadores={operadores}
                  maquinas={maquinas}
                  onRefresh={loadData}
                />
              )}

              {currentTab === 'usuarios' && (
                <UsuariosView operadores={operadores} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
