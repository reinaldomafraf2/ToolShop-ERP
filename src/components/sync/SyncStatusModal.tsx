import React, { useState } from 'react';
import { SyncStatusInfo, syncStatusService } from '../../services/syncStatusService';
import { formatDateTimeBR } from '../../utils/formatters';
import {
  CloudCheck,
  CloudOff,
  CloudAlert,
  X,
  RefreshCw,
  Mail,
  Clock,
  AlertTriangle,
  ArrowRight,
  LogIn,
  CheckCircle2,
  HardDrive,
  Database,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

interface SyncStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SyncStatusInfo;
  onNavigateToSync?: () => void;
}

export const SyncStatusModal: React.FC<SyncStatusModalProps> = ({
  isOpen,
  onClose,
  status,
  onNavigateToSync,
}) => {
  const { loginWithGoogle, perfil } = useAuth();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRetest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const ok = await syncStatusService.retestConnection();
      if (ok) {
        setTestResult('Conexão com o Firestore verificada com sucesso!');
      } else {
        setTestResult('O servidor não respondeu. Verifique sua conexão e tente novamente.');
      }
    } catch (err) {
      setTestResult(`Falha ao testar conexão: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setTestResult(null);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err) {
      setTestResult(`Falha no login Google: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const getStatusBadge = () => {
    switch (status.state) {
      case 'conectado':
        return (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-emerald-800">
            <CloudCheck className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-semibold text-sm">Conectado ao servidor</span>
              <p className="text-xs text-emerald-700">Existe sessão do Firebase ativa e o Firestore respondeu com sucesso.</p>
            </div>
          </div>
        );
      case 'erro':
        return (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2 text-rose-800">
            <CloudAlert className="h-5 w-5 text-rose-600 shrink-0" />
            <div>
              <span className="font-semibold text-sm">Erro de sincronização</span>
              <p className="text-xs text-rose-700">O servidor do Firestore recusou ou falhou na última comunicação.</p>
            </div>
          </div>
        );
      case 'sem_sessao':
      default:
        return (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2 text-amber-900">
            <CloudOff className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-semibold text-sm">Sem sessão no servidor</span>
              <p className="text-xs text-amber-700">Sem sessão ativa do Firebase; os dados estão sendo salvos e lidos exclusivamente neste navegador.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header do Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Status de Sincronização</h3>
              <p className="text-xs text-slate-500">Comunicação entre o navegador local e o servidor Firestore</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo do Modal */}
        <div className="p-6 space-y-4">
          {/* Badge do Estado Atual */}
          {getStatusBadge()}

          {/* Lista de Detalhes Exigidos */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700 shadow-2xs">
            {/* E-mail da Conta do Firebase */}
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                <Mail className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-slate-500 block">Conta do Firebase:</span>
                {status.firebaseEmail ? (
                  <span className="font-mono font-medium text-slate-900 text-sm break-all">
                    {status.firebaseEmail}
                  </span>
                ) : (
                  <span className="italic text-slate-500">
                    Nenhuma conta do Firebase autenticada nesta aba.
                  </span>
                )}
              </div>
            </div>

            {/* Data e Hora do Último Sucesso */}
            <div className="flex items-start gap-3 border-t border-slate-100 pt-3">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                <Clock className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-slate-500 block">Último sucesso com o servidor:</span>
                {status.lastSuccessAt ? (
                  <span className="font-medium text-slate-900">
                    {formatDateTimeBR(status.lastSuccessAt)}
                    {status.lastOperation && (
                      <span className="text-slate-500 ml-1.5 text-[11px]">
                        ({status.lastOperation})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="italic text-slate-500">
                    Nenhum registro de sucesso nesta sessão.
                  </span>
                )}
              </div>
            </div>

            {/* Última Mensagem de Erro */}
            <div className="flex items-start gap-3 border-t border-slate-100 pt-3">
              <div className={`p-1.5 rounded-lg shrink-0 ${status.lastError ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-slate-500 block">Último erro registrado:</span>
                {status.lastError ? (
                  <div className="mt-1 rounded-lg bg-rose-50 border border-rose-200 p-2 text-rose-900 font-mono text-[11px] leading-relaxed break-words">
                    {status.lastError}
                    {status.lastErrorAt && (
                      <span className="block mt-1 text-[10px] text-rose-600 font-sans">
                        Ocorrido em {formatDateTimeBR(status.lastErrorAt)}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-emerald-700 font-medium flex items-center gap-1.5 mt-0.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Nenhum erro registrado no momento.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Mensagem do teste manual se executado */}
          {testResult && (
            <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800">
              {testResult}
            </div>
          )}

          {/* Dica de Armazenamento Local */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
            <HardDrive className="h-4 w-4 text-slate-400 shrink-0" />
            <span>
              O ToolShop ERP armazena seus dados localmente no navegador, permitindo operação imediata mesmo sem sinal ou durante falhas de rede.
            </span>
          </div>
        </div>

        {/* Rodapé com Ações */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRetest}
              disabled={isTesting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Testando...' : 'Testar Conexão'}</span>
            </button>

            {!status.hasFirebaseSession && (
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 px-3 py-2 text-xs font-semibold transition-colors shadow-2xs"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Entrar com Google</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {perfil === 'admin' && onNavigateToSync && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToSync();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-2xs"
              >
                <span>Tela Sincronização</span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
