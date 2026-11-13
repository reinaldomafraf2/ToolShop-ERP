import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, testFirestoreConnection } from '../firebase/config';

export type SyncState = 'conectado' | 'sem_sessao' | 'erro';

export interface SyncStatusInfo {
  state: SyncState;
  hasFirebaseSession: boolean;
  firebaseEmail: string | null;
  firebaseUser: User | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  lastOperation: string | null;
}

function isPermissionErrorMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('missing or insufficient permissions') ||
    lower.includes('permission-denied') ||
    lower.includes('permission_denied')
  );
}

class SyncStatusService {
  private listeners = new Set<(status: SyncStatusInfo) => void>();
  private currentUser: User | null = null;
  private lastSuccessAt: string | null = null;
  private lastError: string | null = null;
  private lastErrorAt: string | null = null;
  private lastOperation: string | null = null;

  constructor() {
    try {
      this.lastSuccessAt = localStorage.getItem('toolshop_sync_last_success') || null;
      this.lastError = localStorage.getItem('toolshop_sync_last_error') || null;
      this.lastErrorAt = localStorage.getItem('toolshop_sync_last_error_at') || null;
    } catch {
      // Ignora erro de acesso a localStorage
    }

    // Monitora autenticação do Firebase em tempo real
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      if (user) {
        // Limpa erro anterior ao iniciar/recuperar sessão para reavaliar estado atual
        this.lastError = null;
        this.lastErrorAt = null;
        try {
          localStorage.removeItem('toolshop_sync_last_error');
          localStorage.removeItem('toolshop_sync_last_error_at');
        } catch {
          // Ignora erro
        }
        this.notify();

        testFirestoreConnection()
          .then((ok) => {
            if (ok) {
              this.recordSuccess('conexão estabelecida');
            }
          })
          .catch((err) => {
            this.recordError(err, 'conexão');
          });
      } else {
        // Sem sessão Firebase: limpa erros de permissão anteriores para refletir modo local corretamente
        if (this.lastError && isPermissionErrorMessage(this.lastError)) {
          this.lastError = null;
          this.lastErrorAt = null;
          try {
            localStorage.removeItem('toolshop_sync_last_error');
            localStorage.removeItem('toolshop_sync_last_error_at');
          } catch {
            // Ignora erro
          }
        }
        this.notify();
      }
    });

    // Teste inicial rápido ao carregar o aplicativo
    testFirestoreConnection()
      .then((ok) => {
        if (ok && auth.currentUser) {
          this.recordSuccess('leitura inicial');
        }
      })
      .catch((err) => {
        if (auth.currentUser) {
          this.recordError(err, 'leitura inicial');
        }
      });
  }

  private hasActiveFirebaseSession(): boolean {
    return Boolean(this.currentUser || auth.currentUser);
  }

  public getStatus(): SyncStatusInfo {
    const hasFirebaseSession = this.hasActiveFirebaseSession();
    const firebaseEmail = this.currentUser?.email || auth.currentUser?.email || null;

    let state: SyncState = 'sem_sessao';
    if (!hasFirebaseSession) {
      // Sem sessão no Firebase: estado é 'sem_sessao' (a menos que haja erro explícito não relacionado a permissão)
      if (this.lastError && !isPermissionErrorMessage(this.lastError)) {
        state = 'erro';
      } else {
        state = 'sem_sessao';
      }
    } else if (this.lastError) {
      state = 'erro';
    } else if (this.lastSuccessAt) {
      state = 'conectado';
    } else {
      state = 'conectado';
    }

    return {
      state,
      hasFirebaseSession,
      firebaseEmail,
      firebaseUser: this.currentUser || auth.currentUser,
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
      lastErrorAt: this.lastErrorAt,
      lastOperation: this.lastOperation,
    };
  }

  public recordSuccess(operation: string = 'operação') {
    const hasSession = this.hasActiveFirebaseSession();
    if (!hasSession) {
      return;
    }

    const now = new Date().toISOString();
    this.lastSuccessAt = now;
    this.lastError = null;
    this.lastErrorAt = null;
    this.lastOperation = operation;
    try {
      localStorage.setItem('toolshop_sync_last_success', now);
      localStorage.removeItem('toolshop_sync_last_error');
      localStorage.removeItem('toolshop_sync_last_error_at');
    } catch {
      // Ignora erro de acesso a localStorage
    }
    this.notify();
  }

  public recordError(error: unknown, operation: string = 'operação') {
    let msg = 'Erro desconhecido de comunicação com o servidor';
    if (error instanceof Error) {
      msg = error.message;
    } else if (typeof error === 'string') {
      msg = error;
    } else if (error && typeof error === 'object' && 'error' in error) {
      msg = String((error as any).error);
    }

    // Limpa payloads JSON de erro para mensagem legível
    try {
      if (msg.trim().startsWith('{') && msg.trim().endsWith('}')) {
        const parsed = JSON.parse(msg.trim());
        if (parsed.error) msg = String(parsed.error);
      }
    } catch {
      // Mantém msg como está
    }

    // Sem sessão Firebase, erros esperados de permissão não devem mascarar o estado "Sem sessão no servidor"
    if (!this.hasActiveFirebaseSession() && isPermissionErrorMessage(msg)) {
      return;
    }

    const now = new Date().toISOString();
    this.lastError = msg;
    this.lastErrorAt = now;
    this.lastOperation = operation;

    try {
      localStorage.setItem('toolshop_sync_last_error', msg);
      localStorage.setItem('toolshop_sync_last_error_at', now);
    } catch {
      // Ignora erro
    }

    this.notify();
  }

  public clearError() {
    this.lastError = null;
    this.lastErrorAt = null;
    try {
      localStorage.removeItem('toolshop_sync_last_error');
      localStorage.removeItem('toolshop_sync_last_error_at');
    } catch {
      // Ignora erro
    }
    this.notify();
  }

  public async retestConnection(): Promise<boolean> {
    try {
      const ok = await testFirestoreConnection();
      if (ok) {
        if (this.hasActiveFirebaseSession()) {
          this.recordSuccess('teste manual de conexão');
        } else {
          this.clearError();
        }
        return true;
      } else {
        this.recordError(
          new Error('O servidor não respondeu ao teste de conexão com o banco de dados.'),
          'teste manual de conexão'
        );
        return false;
      }
    } catch (err) {
      this.recordError(err, 'teste manual de conexão');
      return false;
    }
  }

  public subscribe(callback: (status: SyncStatusInfo) => void): () => void {
    this.listeners.add(callback);
    callback(this.getStatus());
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((cb) => {
      try {
        cb(status);
      } catch (err) {
        console.error('Erro em ouvinte de status de sincronização:', err);
      }
    });
  }
}

export const syncStatusService = new SyncStatusService();
