import React from 'react';
import { AlertTriangle, CheckCircle2, PackageCheck } from 'lucide-react';
import { ItemCompra, MaterialStatusComponente, StatusItemCompra } from '../../types';

interface ComponenteMaterialBadgeProps {
  materialStatus?: MaterialStatusComponente;
  legacyCompraInfo?: { status: StatusItemCompra; atrasado: boolean; item: ItemCompra };
  compact?: boolean;
}

export const ComponenteMaterialBadge: React.FC<ComponenteMaterialBadgeProps> = ({
  materialStatus,
  legacyCompraInfo,
  compact = false,
}) => {
  if (legacyCompraInfo?.atrasado && materialStatus !== 'recebido' && materialStatus !== 'retirado') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded border border-rose-300 bg-rose-50 font-bold text-rose-700 ${
          compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
        }`}
        title="Pedido de compra com entrega em atraso"
      >
        <AlertTriangle className="h-2.5 w-2.5 text-rose-600 shrink-0" />
        <span>Material: Atrasado</span>
      </span>
    );
  }

  let effectiveStatus: MaterialStatusComponente | undefined = materialStatus;
  if (!effectiveStatus && legacyCompraInfo) {
    switch (legacyCompraInfo.status) {
      case 'recebido':
      case 'atendido_estoque':
        effectiveStatus = 'recebido';
        break;
      case 'comprado':
        effectiveStatus =
          (legacyCompraInfo.item.quantidade_recebida || 0) > 0 ? 'parcial' : 'comprado';
        break;
      case 'solicitado':
        effectiveStatus = 'solicitado';
        break;
      default:
        effectiveStatus = 'pendente';
    }
  }

  const sizeClass = compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]';

  switch (effectiveStatus) {
    case 'retirado':
      return (
        <span
          className={`inline-flex items-center gap-1 rounded border border-teal-300 bg-teal-50 font-semibold text-teal-800 ${sizeClass}`}
          title="Material já retirado do estoque para produção"
        >
          <PackageCheck className="h-2.5 w-2.5 text-teal-700 shrink-0" />
          <span>Material retirado · liberado</span>
        </span>
      );
    case 'recebido':
      return (
        <span
          className={`inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 font-semibold text-emerald-800 ${sizeClass}`}
          title="Material recebido no estoque e liberado para produção"
        >
          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-700 shrink-0" />
          <span>Material recebido: liberado</span>
        </span>
      );
    case 'parcial':
      return (
        <span
          className={`inline-block rounded border border-amber-300 bg-amber-50 font-semibold text-amber-900 ${sizeClass}`}
          title="Recebimento parcial: aguardando saldo restante"
        >
          Material: Parcial
        </span>
      );
    case 'comprado':
      return (
        <span
          className={`inline-block rounded border border-amber-300 bg-amber-50 font-semibold text-amber-900 ${sizeClass}`}
        >
          Material: Comprado
        </span>
      );
    case 'solicitado':
      return (
        <span
          className={`inline-block rounded border border-blue-300 bg-blue-50 font-semibold text-blue-800 ${sizeClass}`}
        >
          Material: Solicitado
        </span>
      );
    case 'pendente':
    default:
      return (
        <span
          className={`inline-block rounded border border-slate-200 bg-slate-100 font-medium text-slate-600 ${sizeClass}`}
        >
          Material: Pendente
        </span>
      );
  }
};
