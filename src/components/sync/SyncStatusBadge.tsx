import React, { useEffect, useState } from 'react';
import { SyncStatusInfo, syncStatusService } from '../../services/syncStatusService';
import { SyncStatusModal } from './SyncStatusModal';
import { CloudCheck, CloudOff, CloudAlert } from 'lucide-react';

interface SyncStatusBadgeProps {
  onNavigateToSync?: () => void;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ onNavigateToSync }) => {
  const [status, setStatus] = useState<SyncStatusInfo>(syncStatusService.getStatus());
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = syncStatusService.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return () => unsubscribe();
  }, []);

  const renderContent = () => {
    switch (status.state) {
      case 'conectado':
        return {
          icon: <CloudCheck className="h-4 w-4 text-emerald-600 shrink-0" />,
          dot: <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />,
          label: 'Conectado ao servidor',
          containerClass:
            'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300',
        };
      case 'erro':
        return {
          icon: <CloudAlert className="h-4 w-4 text-rose-600 shrink-0" />,
          dot: <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping shrink-0" />,
          label: 'Erro de sincronização',
          containerClass:
            'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 hover:border-rose-400 font-semibold',
        };
      case 'sem_sessao':
      default:
        return {
          icon: <CloudOff className="h-4 w-4 text-amber-600 shrink-0" />,
          dot: <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />,
          label: 'Sem sessão no servidor',
          containerClass:
            'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300',
        };
    }
  };

  const { icon, dot, label, containerClass } = renderContent();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={`group inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-all shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-slate-400 ${containerClass}`}
        title="Clique para ver detalhes da sincronização com o servidor"
      >
        {icon}
        <span className="relative flex items-center justify-center">
          {dot}
        </span>
        <span className="hidden sm:inline font-semibold tracking-tight">{label}</span>
        <span className="sm:hidden font-semibold text-[11px]">
          {status.state === 'conectado' ? 'Conectado' : status.state === 'erro' ? 'Erro' : 'Local'}
        </span>
      </button>

      {isModalOpen && (
        <SyncStatusModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          status={status}
          onNavigateToSync={onNavigateToSync}
        />
      )}
    </>
  );
};
