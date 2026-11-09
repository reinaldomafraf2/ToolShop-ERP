import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, ShieldAlert, Trash2 } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  itemName: string;
  entityTypeLabel: string;
  blockedReason?: string | null;
  isDeleting?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  entityTypeLabel,
  blockedReason,
  isDeleting,
}) => {
  const isBlocked = Boolean(blockedReason);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={`Confirmação de exclusão para ${entityTypeLabel}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {isBlocked ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-rose-100 p-2 text-rose-700">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-rose-900">
                  Exclusão Não Permitida
                </h4>
                <p className="mt-1 text-xs text-rose-800 leading-relaxed">
                  {blockedReason}
                </p>
                <p className="mt-2 text-[11px] text-rose-600">
                  Por integridade do histórico do chão de fábrica e auditoria de produção,
                  registros com histórico de apontamento não podem ser removidos.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Tem certeza de que deseja excluir {entityTypeLabel.toLowerCase()}{' '}
                <strong className="font-semibold text-slate-900">"{itemName}"</strong>?
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Esta ação removerá o registro do sistema de forma permanente.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {isBlocked ? 'Fechar' : 'Cancelar'}
          </button>

          {!isBlocked && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
