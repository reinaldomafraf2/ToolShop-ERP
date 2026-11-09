import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export interface FeedbackMessage {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface FeedbackAlertProps {
  feedback: FeedbackMessage | null;
  onClose?: () => void;
}

export const FeedbackAlert: React.FC<FeedbackAlertProps> = ({
  feedback,
  onClose,
}) => {
  if (!feedback) return null;

  const config = {
    success: {
      border: 'border-emerald-200',
      bg: 'bg-emerald-50/90',
      text: 'text-emerald-900',
      icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />,
    },
    error: {
      border: 'border-rose-200',
      bg: 'bg-rose-50/90',
      text: 'text-rose-900',
      icon: <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />,
    },
    warning: {
      border: 'border-amber-200',
      bg: 'bg-amber-50/90',
      text: 'text-amber-900',
      icon: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />,
    },
    info: {
      border: 'border-blue-200',
      bg: 'bg-blue-50/90',
      text: 'text-blue-900',
      icon: <Info className="h-4 w-4 shrink-0 text-blue-600" />,
    },
  }[feedback.type];

  return (
    <div
      role="alert"
      className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-xs font-medium shadow-2xs transition-all ${config.border} ${config.bg} ${config.text}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5">{config.icon}</div>
        <div className="leading-relaxed">{feedback.message}</div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-slate-400 hover:text-slate-700"
          aria-label="Fechar notificação"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
