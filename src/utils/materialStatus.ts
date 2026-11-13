import {
  Componente,
  ConfiguracoesSistema,
  ItemCompra,
  MaterialStatusComponente,
  ModoOperacaoSemMaterial,
  MovimentoEstoque,
  ReservaEstoque,
  TipoComponente,
} from '../types';

export function isItemCompraConcluido(item: Pick<ItemCompra, 'status'>): boolean {
  return item.status === 'recebido' || item.status === 'atendido_estoque';
}

export function getQuantidadeRecebidaItem(item: Pick<ItemCompra, 'quantidade' | 'quantidade_recebida' | 'status'>): number {
  if (item.quantidade_recebida !== undefined && item.quantidade_recebida !== null) {
    return Math.max(0, Number(item.quantidade_recebida) || 0);
  }
  return item.status === 'recebido' ? Math.max(0, Number(item.quantidade) || 0) : 0;
}

export function getQuantidadePendenteItem(
  item: Pick<ItemCompra, 'quantidade' | 'quantidade_recebida' | 'quantidade_pendente' | 'status'>
): number {
  if (item.status === 'recebido' || item.status === 'atendido_estoque' || item.status === 'cancelado') {
    return 0;
  }
  if (item.quantidade_pendente !== undefined && item.quantidade_pendente !== null) {
    return Math.max(0, Number(item.quantidade_pendente) || 0);
  }
  const total = Math.max(0, Number(item.quantidade) || 0);
  const recebida = getQuantidadeRecebidaItem(item);
  return Math.max(0, Number((total - recebida).toFixed(4)));
}

export function isRecebimentoParcial(
  item: Pick<ItemCompra, 'quantidade' | 'quantidade_recebida' | 'quantidade_pendente' | 'status'>
): boolean {
  if (item.status === 'recebido' || item.status === 'atendido_estoque' || item.status === 'cancelado') {
    return false;
  }
  const recebida = getQuantidadeRecebidaItem(item);
  const pendente = getQuantidadePendenteItem(item);
  return recebida > 0 && pendente > 0;
}

export function computeComponenteMaterialStatus(
  componente: Pick<Componente, 'id' | 'tipo'>,
  itensCompraDoComp: ItemCompra[],
  movimentosDoComp: MovimentoEstoque[] = [],
  reservasDoComp: ReservaEstoque[] = []
): MaterialStatusComponente {
  const houveRetiradaProducao =
    movimentosDoComp.some((m) => m.tipo === 'saida' && m.motivo === 'producao') ||
    reservasDoComp.some((r) => r.status === 'consumida');

  if (houveRetiradaProducao) {
    return 'retirado';
  }

  const relevantes = itensCompraDoComp.filter(
    (i) => (i.tipo === 'materia_prima' || i.tipo === 'item_comercial') && i.status !== 'cancelado'
  );

  if (relevantes.length === 0) {
    if (componente.tipo === 'estoque') {
      return 'recebido';
    }
    return 'pendente';
  }

  if (relevantes.every(isItemCompraConcluido)) {
    return 'recebido';
  }

  const temAlgumaEntrada = relevantes.some(
    (i) => isItemCompraConcluido(i) || getQuantidadeRecebidaItem(i) > 0
  );
  if (temAlgumaEntrada) {
    return 'parcial';
  }

  if (relevantes.some((i) => i.status === 'comprado')) {
    return 'comprado';
  }

  if (relevantes.some((i) => i.status === 'solicitado')) {
    return 'solicitado';
  }

  return 'pendente';
}

export function isMaterialLiberadoParaProducao(status?: MaterialStatusComponente): boolean {
  return status === 'recebido' || status === 'retirado';
}

export function getModoOperacaoSemMaterial(cfg?: ConfiguracoesSistema | null): ModoOperacaoSemMaterial {
  if (
    cfg?.operacoes_sem_material_recebido === 'ignorar' ||
    cfg?.operacoes_sem_material_recebido === 'avisar' ||
    cfg?.operacoes_sem_material_recebido === 'bloquear'
  ) {
    return cfg.operacoes_sem_material_recebido;
  }
  if (cfg?.avisar_operador_material_pendente === false) {
    return 'ignorar';
  }
  return 'avisar';
}

export function getCategoriasIsentasBloqueioMaterial(cfg?: ConfiguracoesSistema | null): string[] {
  if (Array.isArray(cfg?.categorias_isentas_bloqueio_material)) {
    return cfg.categorias_isentas_bloqueio_material;
  }
  return ['Programação'];
}

export const MATERIAL_STATUS_LABEL: Record<MaterialStatusComponente, string> = {
  pendente: 'Material pendente',
  solicitado: 'Material solicitado',
  comprado: 'Material comprado',
  parcial: 'Material parcial',
  recebido: 'Material recebido: liberado',
  retirado: 'Material retirado',
};

export function avaliarLiberacaoOperacaoMaterial(params: {
  materialStatus?: MaterialStatusComponente;
  centroCustoCategoria?: string;
  componenteTipo?: TipoComponente;
  cfg?: ConfiguracoesSistema | null;
}): {
  liberado: boolean;
  modo: ModoOperacaoSemMaterial;
  isento: boolean;
  bloqueado: boolean;
  avisar: boolean;
  motivo?: string;
  labelStatus: string;
} {
  const status: MaterialStatusComponente = params.materialStatus || (params.componenteTipo === 'estoque' ? 'recebido' : 'pendente');
  const modo = getModoOperacaoSemMaterial(params.cfg);
  const labelStatus = MATERIAL_STATUS_LABEL[status];

  if (isMaterialLiberadoParaProducao(status)) {
    return {
      liberado: true,
      modo,
      isento: false,
      bloqueado: false,
      avisar: false,
      labelStatus,
    };
  }

  const categoriaNorm = (params.centroCustoCategoria || '').trim().toLowerCase();
  const isentas = getCategoriasIsentasBloqueioMaterial(params.cfg).map((c) => c.trim().toLowerCase());
  const isento = Boolean(categoriaNorm && isentas.includes(categoriaNorm));

  if (modo === 'ignorar') {
    return {
      liberado: false,
      modo,
      isento,
      bloqueado: false,
      avisar: false,
      labelStatus,
    };
  }

  if (modo === 'bloquear') {
    if (isento) {
      return {
        liberado: false,
        modo,
        isento: true,
        bloqueado: false,
        avisar: true,
        motivo: `${labelStatus} (categoria "${params.centroCustoCategoria}" isenta do bloqueio)`,
        labelStatus,
      };
    }
    return {
      liberado: false,
      modo,
      isento: false,
      bloqueado: true,
      avisar: true,
      motivo: `${labelStatus}. Receba o material no módulo Compras/Estoque antes de iniciar esta operação.`,
      labelStatus,
    };
  }

  // modo === 'avisar'
  return {
    liberado: false,
    modo,
    isento,
    bloqueado: false,
    avisar: true,
    motivo: `${labelStatus}. Verifique com o almoxarifado antes de iniciar.`,
    labelStatus,
  };
}
