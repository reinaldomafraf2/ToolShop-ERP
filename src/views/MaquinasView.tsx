import React from 'react';
import { CentrosCustoView } from './CentrosCustoView';
import { CentroCusto, Maquina } from '../types';

export interface MaquinasViewProps {
  maquinas: Maquina[];
  activeMachineIds?: Set<string>;
  onRefresh: () => void;
}

export const MaquinasView: React.FC<MaquinasViewProps> = ({
  maquinas,
  activeMachineIds,
  onRefresh,
}) => {
  return (
    <CentrosCustoView
      centrosCusto={maquinas as CentroCusto[]}
      activeCenterIds={activeMachineIds}
      onRefresh={onRefresh}
    />
  );
};

export { CentrosCustoView };
