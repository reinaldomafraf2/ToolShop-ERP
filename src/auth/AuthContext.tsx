import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { Usuario, PerfilUsuario, ViewTab } from '../types';
import { authService, AuthSession } from './authService';
import {
  can as checkCan,
  canAccessTab as checkCanAccessTab,
  Recurso,
  Acao,
  getDefaultTabForPerfil,
} from './permissions';

interface AuthContextType {
  user: Usuario | null;
  perfil: PerfilUsuario | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasActiveAdmin: boolean;
  checkHasActiveAdmin: () => Promise<boolean>;
  setupFirstAdmin: (dados: {
    nome: string;
    email: string;
    senha: string;
    confirmacaoSenha?: string;
  }) => Promise<Usuario>;
  alterarMinhaSenha: (
    credencialAtual: string,
    novaCredencial: string,
    confirmacao: string
  ) => Promise<void>;
  can: (acao: Acao, recurso: Recurso) => boolean;
  canAccessTab: (tab: ViewTab) => boolean;
  loginWithMatricula: (matricula: string, pin: string) => Promise<Usuario>;
  loginWithEmail: (email: string, senha: string) => Promise<Usuario>;
  loginWithGoogle: () => Promise<Usuario>;
  logout: () => void;
  sessionSecondsRemaining: number;
  isExpiringSoon: boolean;
  touchActivity: () => void;
  defaultTab: ViewTab;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasActiveAdmin, setHasActiveAdmin] = useState<boolean>(true);
  const [sessionSecondsRemaining, setSessionSecondsRemaining] = useState<number>(0);

  const checkHasActiveAdmin = useCallback(async (): Promise<boolean> => {
    try {
      const active = await authService.hasActiveAdmin();
      setHasActiveAdmin(active);
      return active;
    } catch {
      return false;
    }
  }, []);

  // Inicializa sessão a partir do storage e verifica existência de admin ativo
  useEffect(() => {
    const initAuth = async () => {
      try {
        const adminExists = await authService.hasActiveAdmin();
        setHasActiveAdmin(adminExists);

        if (adminExists) {
          const current = authService.getSession();
          setSession(current);
        } else {
          // Nenhum admin ativo: força logout de qualquer resíduo
          authService.logout();
          setSession(null);
        }
      } catch (err) {
        console.error('Erro na inicialização da autenticação:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Monitora inatividade e atualiza contagem regressiva a cada 1 segundo
  useEffect(() => {
    if (!session) {
      setSessionSecondsRemaining(0);
      return;
    }

    const checkInactivity = () => {
      const now = Date.now();
      const elapsedMs = now - session.lastActivity;
      const totalAllowedMs = session.timeoutMinutes * 60 * 1000;
      const remainingMs = totalAllowedMs - elapsedMs;

      if (remainingMs <= 0) {
        authService.logout();
        setSession(null);
        setSessionSecondsRemaining(0);
      } else {
        setSessionSecondsRemaining(Math.max(0, Math.floor(remainingMs / 1000)));
      }
    };

    checkInactivity();
    const interval = setInterval(checkInactivity, 1000);
    return () => clearInterval(interval);
  }, [session]);

  // Listener global de interação do usuário para atualizar atividade
  const touchActivity = useCallback(() => {
    if (!session) return;
    authService.touchActivity();
    setSession((prev) => {
      if (!prev) return null;
      return { ...prev, lastActivity: Date.now() };
    });
  }, [session]);

  useEffect(() => {
    if (!session) return;

    const handleUserInteraction = () => {
      touchActivity();
    };

    // Eventos de interação (tablet touch, mouse, teclado)
    window.addEventListener('mousedown', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });

    return () => {
      window.removeEventListener('mousedown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
    };
  }, [session, touchActivity]);

  const setupFirstAdmin = async (dados: {
    nome: string;
    email: string;
    senha: string;
    confirmacaoSenha?: string;
  }): Promise<Usuario> => {
    const adminUser = await authService.criarPrimeiroAdmin(dados);
    const newSession = authService.getSession();
    setSession(newSession);
    setHasActiveAdmin(true);
    return adminUser;
  };

  const loginWithMatricula = async (matricula: string, pin: string): Promise<Usuario> => {
    const user = await authService.loginComMatricula(matricula, pin);
    const newSession = authService.getSession();
    setSession(newSession);
    return user;
  };

  const loginWithEmail = async (email: string, senha: string): Promise<Usuario> => {
    const user = await authService.loginComEmail(email, senha);
    const newSession = authService.getSession();
    setSession(newSession);
    return user;
  };

  const loginWithGoogle = async (): Promise<Usuario> => {
    const user = await authService.loginComGoogle();
    const newSession = authService.getSession();
    setSession(newSession);
    setHasActiveAdmin(true);
    return user;
  };

  const alterarMinhaSenha = async (
    credencialAtual: string,
    novaCredencial: string,
    confirmacao: string
  ): Promise<void> => {
    if (!session?.user) {
      throw new Error('Nenhum usuário autenticado na sessão.');
    }
    await authService.alterarPropriaSenha(
      session.user.id,
      credencialAtual,
      novaCredencial,
      confirmacao
    );
    const updatedSession = authService.getSession();
    setSession(updatedSession);
  };

  const logout = useCallback(() => {
    authService.logout();
    setSession(null);
  }, []);

  const user = session?.user || null;
  const perfil = user?.perfil || null;

  const can = useCallback(
    (acao: Acao, recurso: Recurso) => {
      return checkCan(perfil, acao, recurso);
    },
    [perfil]
  );

  const canAccessTab = useCallback(
    (tab: ViewTab) => {
      return checkCanAccessTab(perfil, tab);
    },
    [perfil]
  );

  const defaultTab = useMemo(() => {
    return perfil ? getDefaultTabForPerfil(perfil) : 'painel';
  }, [perfil]);

  const isExpiringSoon = sessionSecondsRemaining > 0 && sessionSecondsRemaining <= 60;

  const value = {
    user,
    perfil,
    isAuthenticated: Boolean(user),
    isLoading,
    hasActiveAdmin,
    checkHasActiveAdmin,
    setupFirstAdmin,
    alterarMinhaSenha,
    can,
    canAccessTab,
    loginWithMatricula,
    loginWithEmail,
    loginWithGoogle,
    logout,
    sessionSecondsRemaining,
    isExpiringSoon,
    touchActivity,
    defaultTab,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um <AuthProvider />');
  }
  return context;
};
