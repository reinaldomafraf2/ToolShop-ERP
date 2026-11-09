import React from 'react';
import { useAuth } from './AuthContext';
import { Acao, Recurso } from './permissions';

interface ProtectedActionProps {
  acao: Acao;
  recurso: Recurso;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  disableOnly?: boolean;
  disabledTooltip?: string;
}

/**
 * Componente declarativo para ocultar ou desabilitar elementos de UI
 * com base na matriz central de permissões.
 */
export const ProtectedAction: React.FC<ProtectedActionProps> = ({
  acao,
  recurso,
  children,
  fallback = null,
  disableOnly = false,
  disabledTooltip = 'Você não possui permissão para executar esta ação.',
}) => {
  const { can } = useAuth();
  const isAllowed = can(acao, recurso);

  if (isAllowed) {
    return <>{children}</>;
  }

  if (disableOnly && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      disabled: true,
      title: disabledTooltip,
      className: `${(children.props as any).className || ''} opacity-40 cursor-not-allowed pointer-events-none`,
    });
  }

  return <>{fallback}</>;
};
