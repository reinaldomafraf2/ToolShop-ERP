import {
  FirestoreItemEstoqueRepository,
  FirestoreUnidadeEstoqueRepository,
  FirestoreMovimentoEstoqueRepository,
  FirestoreReservaEstoqueRepository,
  executeAtomicEstoqueOperation,
} from '../repositories/estoqueRepository';
import { toolShopService } from './toolShopService';
import { comprasService } from './comprasService';
import {
  ItemEstoque,
  UnidadeEstoque,
  MovimentoEstoque,
  ReservaEstoque,
  ItemEstoqueComDetalhes,
  UnidadeEstoqueComDetalhes,
  MovimentoEstoqueComDetalhes,
  ReservaEstoqueComDetalhes,
  TipoMovimentoEstoque,
  MotivoMovimentoEstoque,
  ItemCompra,
  TipoItemCompra,
  CategoriaItemEstoque,
  TipoControleEstoque,
  UnidadeMedidaEstoque,
  SugestaoEstoqueItem,
} from '../types';
import { generateUUID, DEFAULT_EMPRESA_ID } from '../utils/uuid';

export interface RegistrarEntradaParams {
  itemId: string;
  quantidade: number;
  usuarioId: string;
  usuarioNome?: string;
  motivo?: MotivoMovimentoEstoque;
  observacoes?: string;
  itemCompraId?: string;
  custo_unitario?: number;
  // Para itens de unidade física:
  dadosUnidadeFisica?: {
    etiqueta?: string;
    material?: string;
    formato?: string;
    comprimento_mm?: number;
    largura_mm?: number;
    espessura_mm?: number;
    diametro_mm?: number;
    peso_kg?: number;
    custo_unitario?: number;
    localizacao?: string;
    lote_ou_certificado?: string;
  };
}

export interface RegistrarSaidaParams {
  itemId: string;
  quantidade: number;
  usuarioId: string;
  usuarioNome?: string;
  motivo?: MotivoMovimentoEstoque;
  observacoes?: string;
  projetoId?: string;
  componenteId?: string;
  unidadeId?: string; // Obrigatório se tipo_controle === 'unidade_fisica'
  custo_unitario?: number;
}

export interface RegistrarAjusteParams {
  itemId: string;
  quantidadeAjuste: number; // Diferença a somar ou subtrair
  tipo: 'entrada' | 'saida';
  motivo: MotivoMovimentoEstoque;
  observacoes: string;
  usuarioId: string;
  usuarioNome?: string;
}

export interface RegistrarSobraParams {
  itemId: string;
  material: string;
  formato: string;
  comprimento_mm: number;
  largura_mm: number;
  espessura_mm: number;
  diametro_mm?: number;
  peso_kg?: number;
  localizacao?: string;
  projetoId?: string;
  componenteId?: string;
  observacoes?: string;
  usuarioId: string;
  usuarioNome?: string;
}

export interface FiltroPecaAtendeParams {
  comprimentoMin: number;
  larguraMin: number;
  espessuraMin: number;
  material?: string;
}

export class EstoqueService {
  private itemRepo = new FirestoreItemEstoqueRepository();
  private unidadeRepo = new FirestoreUnidadeEstoqueRepository();
  private movimentoRepo = new FirestoreMovimentoEstoqueRepository();
  private reservaRepo = new FirestoreReservaEstoqueRepository();

  // =========================================================================
  // GERAÇÃO DE ETIQUETAS SEQUENCIAIS
  // =========================================================================
  async gerarProximaEtiqueta(
    prefixo: 'PE' | 'SOB' = 'PE',
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<string> {
    const unidades = await this.unidadeRepo.getAll(empresaId);
    const ano = new Date().getFullYear();
    const padrao = `${prefixo}-${ano}-`;
    const etiquetasDoAno = unidades
      .map((u) => u.etiqueta.trim().toUpperCase())
      .filter((e) => e.startsWith(padrao));

    let maxNum = 0;
    etiquetasDoAno.forEach((e) => {
      const part = e.replace(padrao, '');
      const num = parseInt(part, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });

    const proximo = maxNum + 1;
    return `${padrao}${String(proximo).padStart(4, '0')}`;
  }

  // =========================================================================
  // CONSULTAS ENRIQUECIDAS COM SALDO, RESERVAS E DISPONÍVEL
  // =========================================================================
  async getItensComDetalhes(
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<ItemEstoqueComDetalhes[]> {
    const [itens, reservas, unidades] = await Promise.all([
      this.itemRepo.getAll(empresaId),
      this.reservaRepo.getAll(empresaId),
      this.unidadeRepo.getAll(empresaId),
    ]);

    // Mapeia reservas ativas por item
    const reservasAtivasPorItem = new Map<string, number>();
    reservas.forEach((r) => {
      if (r.status === 'ativa') {
        const atual = reservasAtivasPorItem.get(r.item_id) || 0;
        reservasAtivasPorItem.set(r.item_id, atual + Number(r.quantidade));
      }
    });

    // Mapeia unidades físicas ativas por item
    const unidadesPorItem = new Map<string, UnidadeEstoque[]>();
    unidades.forEach((u) => {
      if (u.status === 'disponivel' || u.status === 'reservada') {
        const list = unidadesPorItem.get(u.item_id) || [];
        list.push(u);
        unidadesPorItem.set(u.item_id, list);
      }
    });

    return itens.map((item) => {
      const reservado = reservasAtivasPorItem.get(item.id) || 0;
      const unidadesItem = unidadesPorItem.get(item.id) || [];

      // Para itens com controle por unidade física, o saldo é o total de peças ativas
      let saldo = Number(item.saldo) || 0;
      if (item.tipo_controle === 'unidade_fisica') {
        saldo = unidadesItem.length;
      }

      const disponivel = saldo - reservado;
      const abaixo_minimo =
        item.estoque_minimo !== undefined &&
        item.estoque_minimo !== null &&
        saldo < item.estoque_minimo;

      return {
        ...item,
        saldo,
        reservado,
        disponivel,
        abaixo_minimo,
        total_unidades_fisicas: unidadesItem.length,
        unidades_disponiveis: unidadesItem.filter((u) => u.status === 'disponivel'),
      };
    });
  }

  async getUnidadesComDetalhes(
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<UnidadeEstoqueComDetalhes[]> {
    const [unidades, itens, projetos] = await Promise.all([
      this.unidadeRepo.getAll(empresaId),
      this.itemRepo.getAll(empresaId),
      toolShopService.getProjetosComDetalhes(empresaId),
    ]);

    const itemMap = new Map<string, ItemEstoque>();
    itens.forEach((i) => itemMap.set(i.id, i));

    const projetoMap = new Map<string, string>();
    const componenteMap = new Map<string, string>();
    projetos.forEach((p) => {
      projetoMap.set(p.id, p.codigo);
      p.componentes.forEach((c) => {
        componenteMap.set(c.id, c.nome);
      });
    });

    return unidades.map((u) => ({
      ...u,
      item: itemMap.get(u.item_id),
      origem_projeto_codigo: u.origem_projeto_id ? projetoMap.get(u.origem_projeto_id) : undefined,
      origem_componente_nome: u.origem_componente_id ? componenteMap.get(u.origem_componente_id) : undefined,
    }));
  }

  async getMovimentosComDetalhes(
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<MovimentoEstoqueComDetalhes[]> {
    const [movimentos, itens, unidades, projetos] = await Promise.all([
      this.movimentoRepo.getAll(empresaId),
      this.itemRepo.getAll(empresaId),
      this.unidadeRepo.getAll(empresaId),
      toolShopService.getProjetosComDetalhes(empresaId),
    ]);

    const itemMap = new Map<string, ItemEstoque>();
    itens.forEach((i) => itemMap.set(i.id, i));

    const unidadeMap = new Map<string, UnidadeEstoque>();
    unidades.forEach((u) => unidadeMap.set(u.id, u));

    const projetoMap = new Map<string, string>();
    const componenteMap = new Map<string, string>();
    projetos.forEach((p) => {
      projetoMap.set(p.id, p.codigo);
      p.componentes.forEach((c) => {
        componenteMap.set(c.id, c.nome);
      });
    });

    return movimentos.map((m) => ({
      ...m,
      item: itemMap.get(m.item_id),
      unidade: m.unidade_id ? unidadeMap.get(m.unidade_id) : undefined,
      projeto_codigo: m.projeto_id ? projetoMap.get(m.projeto_id) : undefined,
      componente_nome: m.componente_id ? componenteMap.get(m.componente_id) : undefined,
    }));
  }

  async getReservasComDetalhes(
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<ReservaEstoqueComDetalhes[]> {
    const [reservas, itens, unidades, projetos] = await Promise.all([
      this.reservaRepo.getAll(empresaId),
      this.itemRepo.getAll(empresaId),
      this.unidadeRepo.getAll(empresaId),
      toolShopService.getProjetosComDetalhes(empresaId),
    ]);

    const itemMap = new Map<string, ItemEstoque>();
    itens.forEach((i) => itemMap.set(i.id, i));

    const unidadeMap = new Map<string, UnidadeEstoque>();
    unidades.forEach((u) => unidadeMap.set(u.id, u));

    const projetoMap = new Map<string, string>();
    const componenteMap = new Map<string, string>();
    projetos.forEach((p) => {
      projetoMap.set(p.id, p.codigo);
      p.componentes.forEach((c) => {
        componenteMap.set(c.id, c.nome);
      });
    });

    return reservas.map((r) => ({
      ...r,
      item: itemMap.get(r.item_id),
      unidade: r.unidade_id ? unidadeMap.get(r.unidade_id) : undefined,
      projeto_codigo: r.projeto_id ? projetoMap.get(r.projeto_id) : undefined,
      componente_nome: r.componente_id ? componenteMap.get(r.componente_id) : undefined,
    }));
  }

  // =========================================================================
  // OPERAÇÕES: ENTRADA, SAÍDA, AJUSTE E SOBRA (TRANSAÇÃO ATÔMICA)
  // =========================================================================

  async registrarEntrada(
    params: RegistrarEntradaParams,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<{ movimento: MovimentoEstoque; novaUnidade?: UnidadeEstoque }> {
    const item = await this.itemRepo.getById(params.itemId);
    if (!item) {
      throw new Error(`Item de estoque ID ${params.itemId} não encontrado.`);
    }

    const qtd = Math.abs(Number(params.quantidade));
    if (qtd <= 0) {
      throw new Error('A quantidade de entrada deve ser maior que zero.');
    }

    const saldoAnterior = Number(item.saldo || 0);
    const novoSaldo = saldoAnterior + qtd;
    const movId = generateUUID();

    // 1. Custo Médio Móvel para itens controlados por quantidade
    let novoCustoMedio: number | undefined;
    if (params.custo_unitario !== undefined && !isNaN(Number(params.custo_unitario))) {
      const custoEntrada = Number(params.custo_unitario);
      if (item.tipo_controle === 'quantidade') {
        const custoAnterior = Number(item.custo_medio || 0);
        novoCustoMedio =
          novoSaldo > 0
            ? (saldoAnterior * custoAnterior + qtd * custoEntrada) / novoSaldo
            : custoEntrada;
        novoCustoMedio = Math.round(novoCustoMedio * 100) / 100;
      }
    }

    // 2. Criação de unidade física se o item for peça rastreada
    let novaUnidade: UnidadeEstoque | undefined;
    if (item.tipo_controle === 'unidade_fisica') {
      const etiqueta =
        params.dadosUnidadeFisica?.etiqueta ||
        (await this.gerarProximaEtiqueta('PE', empresaId));

      const custoProprio =
        params.dadosUnidadeFisica?.custo_unitario ?? params.custo_unitario;

      novaUnidade = {
        id: generateUUID(),
        empresa_id: empresaId,
        item_id: item.id,
        etiqueta,
        material: params.dadosUnidadeFisica?.material || item.especificacao,
        formato: params.dadosUnidadeFisica?.formato || 'BLOCO',
        comprimento_mm: params.dadosUnidadeFisica?.comprimento_mm,
        largura_mm: params.dadosUnidadeFisica?.largura_mm,
        espessura_mm: params.dadosUnidadeFisica?.espessura_mm,
        diametro_mm: params.dadosUnidadeFisica?.diametro_mm,
        peso_kg: params.dadosUnidadeFisica?.peso_kg,
        custo_unitario: custoProprio,
        localizacao:
          params.dadosUnidadeFisica?.localizacao ||
          item.localizacao_padrao ||
          'Almoxarifado',
        lote_ou_certificado: params.dadosUnidadeFisica?.lote_ou_certificado,
        origem: 'compra',
        status: 'disponivel',
        observacoes: params.observacoes,
        criado_em: new Date().toISOString(),
      };
    }

    const custoUnitarioFinal =
      params.custo_unitario !== undefined
        ? Number(params.custo_unitario)
        : (novaUnidade?.custo_unitario ?? item.custo_medio);
    const custoTotalFinal =
      custoUnitarioFinal !== undefined
        ? Math.round(custoUnitarioFinal * qtd * 100) / 100
        : undefined;

    const movimento: MovimentoEstoque = {
      id: movId,
      empresa_id: empresaId,
      item_id: item.id,
      unidade_id: novaUnidade?.id,
      tipo: 'entrada',
      quantidade: qtd,
      data_hora: new Date().toISOString(),
      usuario_id: params.usuarioId,
      usuario_nome: params.usuarioNome,
      item_compra_id: params.itemCompraId,
      motivo: params.motivo || 'compra',
      custo_unitario: custoUnitarioFinal,
      custo_total: custoTotalFinal,
      observacoes: params.observacoes,
    };

    await executeAtomicEstoqueOperation({
      itemId: item.id,
      novoSaldo,
      novoCustoMedio,
      movimento,
      novaUnidade,
      empresaId,
    });

    return { movimento, novaUnidade };
  }

  async registrarSaida(
    params: RegistrarSaidaParams,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<MovimentoEstoque> {
    const [item, config, reservas] = await Promise.all([
      this.itemRepo.getById(params.itemId),
      toolShopService.getConfiguracoes(empresaId),
      this.reservaRepo.getByItemId(params.itemId, empresaId),
    ]);

    if (!item) {
      throw new Error(`Item de estoque ID ${params.itemId} não encontrado.`);
    }

    const qtd = Math.abs(Number(params.quantidade));
    if (qtd <= 0) {
      throw new Error('A quantidade de saída deve ser maior que zero.');
    }

    // Calcula saldo disponível (saldo - reservas ativas)
    const totalReservado = reservas
      .filter((r) => r.status === 'ativa')
      .reduce((acc, r) => acc + Number(r.quantidade), 0);

    const saldoAtual = Number(item.saldo || 0);
    const disponivel = saldoAtual - totalReservado;

    // Regra: Bloquear saída acima do disponível caso a flag de saldo negativo não esteja ativa
    if (!config?.permitir_saldo_negativo && qtd > disponivel) {
      throw new Error(
        `Saldo disponível insuficiente (Solicitado: ${qtd} ${item.unidade}, Disponível: ${disponivel} ${item.unidade}, Saldo total: ${saldoAtual}, Reservado: ${totalReservado}). Ative "Permitir saldo negativo" nas configurações caso deseje forçar esta saída.`
      );
    }

    let unidadeFisica: UnidadeEstoque | null = null;
    let unidadeAtualizacao:
      | { unidadeId: string; novoStatus: 'disponivel' | 'reservada' | 'consumida' | 'descartada' }
      | undefined;

    if (item.tipo_controle === 'unidade_fisica') {
      if (!params.unidadeId) {
        throw new Error('Para itens com controle por unidade física, selecione a peça/unidade a consumir.');
      }
      unidadeFisica = await this.unidadeRepo.getById(params.unidadeId);
      if (!unidadeFisica) {
        throw new Error(`Unidade física ID ${params.unidadeId} não encontrada.`);
      }
      if (unidadeFisica.status === 'consumida' || unidadeFisica.status === 'descartada') {
        throw new Error(`A unidade ${unidadeFisica.etiqueta} já se encontra com status ${unidadeFisica.status}.`);
      }
      unidadeAtualizacao = {
        unidadeId: unidadeFisica.id,
        novoStatus: 'consumida',
      };
    }

    // Custo da saída gravado no movimento
    let custoUnit = params.custo_unitario;
    if (custoUnit === undefined) {
      if (unidadeFisica?.custo_unitario !== undefined) {
        custoUnit = unidadeFisica.custo_unitario;
      } else if (item.custo_medio !== undefined) {
        custoUnit = item.custo_medio;
      }
    }
    const custoTotal =
      custoUnit !== undefined ? Math.round(custoUnit * qtd * 100) / 100 : undefined;

    const novoSaldo = saldoAtual - qtd;
    const movId = generateUUID();

    const movimento: MovimentoEstoque = {
      id: movId,
      empresa_id: empresaId,
      item_id: item.id,
      unidade_id: params.unidadeId,
      tipo: 'saida',
      quantidade: qtd,
      data_hora: new Date().toISOString(),
      usuario_id: params.usuarioId,
      usuario_nome: params.usuarioNome,
      projeto_id: params.projetoId,
      componente_id: params.componenteId,
      motivo: params.motivo || 'producao',
      custo_unitario: custoUnit,
      custo_total: custoTotal,
      observacoes: params.observacoes,
    };

    await executeAtomicEstoqueOperation({
      itemId: item.id,
      novoSaldo,
      movimento,
      unidadeAtualizacao,
      empresaId,
    });

    return movimento;
  }

  async registrarAjuste(
    params: RegistrarAjusteParams,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<MovimentoEstoque> {
    const item = await this.itemRepo.getById(params.itemId);
    if (!item) {
      throw new Error(`Item de estoque ID ${params.itemId} não encontrado.`);
    }

    const delta = Math.abs(Number(params.quantidadeAjuste));
    if (delta <= 0) {
      throw new Error('A quantidade de ajuste deve ser maior que zero.');
    }

    const saldoAtual = Number(item.saldo || 0);
    const novoSaldo = params.tipo === 'entrada' ? saldoAtual + delta : saldoAtual - delta;

    const movId = generateUUID();
    const movimento: MovimentoEstoque = {
      id: movId,
      empresa_id: empresaId,
      item_id: item.id,
      tipo: 'ajuste',
      quantidade: delta,
      data_hora: new Date().toISOString(),
      usuario_id: params.usuarioId,
      usuario_nome: params.usuarioNome,
      motivo: params.motivo,
      observacoes: params.observacoes,
    };

    await executeAtomicEstoqueOperation({
      itemId: item.id,
      novoSaldo,
      movimento,
      empresaId,
    });

    return movimento;
  }

  async registrarSobra(
    params: RegistrarSobraParams,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<{ unidade: UnidadeEstoque; movimento: MovimentoEstoque }> {
    const item = await this.itemRepo.getById(params.itemId);
    if (!item) {
      throw new Error(`Item de estoque ID ${params.itemId} não encontrado.`);
    }

    const etiqueta = await this.gerarProximaEtiqueta('SOB', empresaId);
    const unidadeId = generateUUID();
    const movId = generateUUID();

    const novaUnidade: UnidadeEstoque = {
      id: unidadeId,
      empresa_id: empresaId,
      item_id: item.id,
      etiqueta,
      material: params.material || item.especificacao,
      formato: params.formato || 'BLOCO',
      comprimento_mm: Number(params.comprimento_mm) || 0,
      largura_mm: Number(params.largura_mm) || 0,
      espessura_mm: Number(params.espessura_mm) || 0,
      diametro_mm: params.diametro_mm ? Number(params.diametro_mm) : undefined,
      peso_kg: params.peso_kg ? Number(params.peso_kg) : undefined,
      localizacao: params.localizacao || item.localizacao_padrao || 'Retalhos / Sobras',
      origem: 'sobra',
      origem_projeto_id: params.projetoId,
      origem_componente_id: params.componenteId,
      status: 'disponivel',
      observacoes: params.observacoes,
      criado_em: new Date().toISOString(),
    };

    const novoSaldo = Number(item.saldo || 0) + 1;

    const movimento: MovimentoEstoque = {
      id: movId,
      empresa_id: empresaId,
      item_id: item.id,
      unidade_id: unidadeId,
      tipo: 'entrada',
      quantidade: 1,
      data_hora: new Date().toISOString(),
      usuario_id: params.usuarioId,
      usuario_nome: params.usuarioNome,
      projeto_id: params.projetoId,
      componente_id: params.componenteId,
      motivo: 'devolucao',
      observacoes: `Registro de retalho/sobra aproveitável (${novaUnidade.etiqueta})${
        params.observacoes ? ` - ${params.observacoes}` : ''
      }`,
    };

    await executeAtomicEstoqueOperation({
      itemId: item.id,
      novoSaldo,
      movimento,
      novaUnidade,
      empresaId,
    });

    return { unidade: novaUnidade, movimento };
  }

  // =========================================================================
  // GESTÃO DE RESERVAS
  // =========================================================================

  async criarReserva(
    params: {
      itemId: string;
      quantidade: number;
      projetoId?: string;
      componenteId?: string;
      unidadeId?: string;
    },
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<ReservaEstoque> {
    const [item, config, reservas] = await Promise.all([
      this.itemRepo.getById(params.itemId),
      toolShopService.getConfiguracoes(empresaId),
      this.reservaRepo.getByItemId(params.itemId, empresaId),
    ]);

    if (!item) {
      throw new Error(`Item de estoque ID ${params.itemId} não encontrado.`);
    }

    const qtd = Math.abs(Number(params.quantidade));
    if (qtd <= 0) {
      throw new Error('A quantidade a reservar deve ser maior que zero.');
    }

    const totalReservado = reservas
      .filter((r) => r.status === 'ativa')
      .reduce((acc, r) => acc + Number(r.quantidade), 0);

    const saldoAtual = Number(item.saldo || 0);
    const disponivel = saldoAtual - totalReservado;

    if (!config?.permitir_saldo_negativo && qtd > disponivel) {
      throw new Error(
        `Saldo disponível insuficiente para reserva (Solicitado: ${qtd}, Disponível: ${disponivel}).`
      );
    }

    if (params.unidadeId) {
      await this.unidadeRepo.update(params.unidadeId, { status: 'reservada' });
    }

    const reserva = await this.reservaRepo.create({
      id: generateUUID(),
      empresa_id: empresaId,
      item_id: item.id,
      unidade_id: params.unidadeId,
      quantidade: qtd,
      projeto_id: params.projetoId,
      componente_id: params.componenteId,
      status: 'ativa',
      criado_em: new Date().toISOString(),
    });

    return reserva;
  }

  async cancelarReserva(reservaId: string): Promise<ReservaEstoque> {
    const reserva = await this.reservaRepo.update(reservaId, { status: 'cancelada' });
    if (reserva.unidade_id) {
      await this.unidadeRepo.update(reserva.unidade_id, { status: 'disponivel' });
    }
    return reserva;
  }

  async consumirReserva(
    reservaId: string,
    usuarioId: string,
    usuarioNome?: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<{ reserva: ReservaEstoque; movimento: MovimentoEstoque }> {
    const reservas = await this.reservaRepo.getAll(empresaId);
    const reserva = reservas.find((r) => r.id === reservaId);
    if (!reserva) {
      throw new Error(`Reserva ID ${reservaId} não encontrada.`);
    }
    if (reserva.status !== 'ativa') {
      throw new Error(`Reserva não está ativa (status atual: ${reserva.status}).`);
    }

    // Registra a saída real
    const movimento = await this.registrarSaida(
      {
        itemId: reserva.item_id,
        quantidade: reserva.quantidade,
        unidadeId: reserva.unidade_id,
        projetoId: reserva.projeto_id,
        componenteId: reserva.componente_id,
        motivo: 'producao',
        observacoes: 'Consumo de reserva de estoque',
        usuarioId,
        usuarioNome,
      },
      empresaId
    );

    // Marca reserva como consumida
    const reservaAtualizada = await this.reservaRepo.update(reservaId, {
      status: 'consumida',
    });

    return { reserva: reservaAtualizada, movimento };
  }

  // =========================================================================
  // TRANSFERÊNCIA DE LOCALIZAÇÃO
  // =========================================================================

  async transferirLocalizacao(
    params: {
      itemId?: string;
      unidadeId?: string;
      novaLocalizacao: string;
      usuarioId: string;
      usuarioNome?: string;
    },
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<void> {
    const novaLocalizacao = params.novaLocalizacao.trim();
    if (!novaLocalizacao) {
      throw new Error('Informe a nova localização física no almoxarifado.');
    }

    if (params.unidadeId) {
      await this.unidadeRepo.update(params.unidadeId, {
        localizacao: novaLocalizacao,
      });
    } else if (params.itemId) {
      await this.itemRepo.update(params.itemId, {
        localizacao_padrao: novaLocalizacao,
      });
    }
  }

  // =========================================================================
  // ALGORITMO: PROCURAR PEÇA QUE ATENDA (QUALQUER ORIENTAÇÃO 3D)
  // =========================================================================
  async procurarPecasQueAtendem(
    filtros: FiltroPecaAtendeParams,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<
    {
      unidade: UnidadeEstoqueComDetalhes;
      volumeNecessarioMm3: number;
      volumePecaMm3: number;
      sobraVolumeMm3: number;
      sobraPercentual: number;
    }[]
  > {
    const unidades = await this.getUnidadesComDetalhes(empresaId);
    const disponiveis = unidades.filter((u) => u.status === 'disponivel');

    // Ordena medidas solicitadas em ordem decrescente [M1 >= M2 >= M3]
    const reqDims = [
      Math.abs(Number(filtros.comprimentoMin)),
      Math.abs(Number(filtros.larguraMin)),
      Math.abs(Number(filtros.espessuraMin)),
    ].sort((a, b) => b - a);

    const [reqL, reqW, reqT] = reqDims;
    const volumeNecessario = reqL * reqW * reqT;

    const matchMaterial = filtros.material?.trim().toLowerCase();

    const resultados: {
      unidade: UnidadeEstoqueComDetalhes;
      volumeNecessarioMm3: number;
      volumePecaMm3: number;
      sobraVolumeMm3: number;
      sobraPercentual: number;
    }[] = [];

    for (const u of disponiveis) {
      // Filtro opcional de material (parcial e sem case)
      if (matchMaterial) {
        const uMat = (u.material || u.item?.especificacao || '').toLowerCase();
        if (!uMat.includes(matchMaterial)) {
          continue;
        }
      }

      // Se for barra redonda cilíndrica com diâmetro
      if (u.diametro_mm && u.diametro_mm > 0) {
        const raio = u.diametro_mm / 2;
        const comp = u.comprimento_mm || 0;
        // Diagonal da seção transversal retangular necessária
        const diagonalNecessaria = Math.sqrt(reqW * reqW + reqT * reqT);
        if (comp >= reqL && u.diametro_mm >= diagonalNecessaria) {
          const volumeCilindro = Math.PI * raio * raio * comp;
          const sobra = volumeCilindro - volumeNecessario;
          resultados.push({
            unidade: u,
            volumeNecessarioMm3: volumeNecessario,
            volumePecaMm3: volumeCilindro,
            sobraVolumeMm3: sobra,
            sobraPercentual: Math.round((sobra / volumeNecessario) * 100),
          });
        }
        continue;
      }

      // Bloco retangular: dimensões da peça em ordem decrescente [D1 >= D2 >= D3]
      const dimsPeca = [
        Number(u.comprimento_mm) || 0,
        Number(u.largura_mm) || 0,
        Number(u.espessura_mm) || 0,
      ].sort((a, b) => b - a);

      const [pL, pW, pT] = dimsPeca;

      // Atende em qualquer orientação 3D se e somente se cada dimensão ordenada for >= à dimensão ordenada necessária
      if (pL >= reqL && pW >= reqW && pT >= reqT) {
        const volumePeca = pL * pW * pT;
        const sobra = volumePeca - volumeNecessario;
        resultados.push({
          unidade: u,
          volumeNecessarioMm3: volumeNecessario,
          volumePecaMm3: volumePeca,
          sobraVolumeMm3: sobra,
          sobraPercentual: Math.round((sobra / volumeNecessario) * 100),
        });
      }
    }

    // Ordena pela MENOR sobra de material (melhor aproveitamento primeiro)
    return resultados.sort((a, b) => a.sobraVolumeMm3 - b.sobraVolumeMm3);
  }

  // =========================================================================
  // INVENTÁRIO FÍSICO COM CONTAGEM E AJUSTES AUTOMÁTICOS
  // =========================================================================
  async executarInventario(
    contagens: { itemId: string; saldoContado: number; observacao?: string }[],
    usuarioId: string,
    usuarioNome?: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<{ totalAjustados: number; movimentosGerados: MovimentoEstoque[] }> {
    const movimentosGerados: MovimentoEstoque[] = [];

    for (const itemContado of contagens) {
      const item = await this.itemRepo.getById(itemContado.itemId);
      if (!item) continue;

      const saldoAtual = Number(item.saldo || 0);
      const saldoContado = Math.max(0, Number(itemContado.saldoContado));
      const diferenca = saldoContado - saldoAtual;

      if (diferenca === 0) continue; // Sem discrepância

      const tipo: TipoMovimentoEstoque = 'ajuste';
      const quantidade = Math.abs(diferenca);
      const movId = generateUUID();

      const obs = `Inventário físico: saldo anterior ${saldoAtual} ${item.unidade}, contado ${saldoContado} ${item.unidade} (diferença: ${
        diferenca > 0 ? `+${diferenca}` : diferenca
      }).${itemContado.observacao ? ` ${itemContado.observacao}` : ''}`;

      const movimento: MovimentoEstoque = {
        id: movId,
        empresa_id: empresaId,
        item_id: item.id,
        tipo,
        quantidade,
        data_hora: new Date().toISOString(),
        usuario_id: usuarioId,
        usuario_nome: usuarioNome,
        motivo: 'inventario',
        observacoes: obs,
      };

      await executeAtomicEstoqueOperation({
        itemId: item.id,
        novoSaldo: saldoContado,
        movimento,
        empresaId,
      });

      movimentosGerados.push(movimento);
    }

    return {
      totalAjustados: movimentosGerados.length,
      movimentosGerados,
    };
  }

  // =========================================================================
  // CRUD DE ITENS DE ESTOQUE
  // =========================================================================
  async criarItem(
    item: Omit<ItemEstoque, 'id' | 'empresa_id' | 'criado_em'>,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<ItemEstoque> {
    const codigoNorm = item.codigo.trim().toUpperCase();
    const existente = await this.itemRepo.getByCodigo(codigoNorm, empresaId);
    if (existente) {
      throw new Error(`Já existe um item de estoque com o código "${codigoNorm}".`);
    }

    return this.itemRepo.create({
      ...item,
      id: generateUUID(),
      empresa_id: empresaId,
      codigo: codigoNorm,
      saldo: Number(item.saldo) || 0,
      ativo: item.ativo ?? true,
      criado_em: new Date().toISOString(),
    });
  }

  async atualizarItem(
    id: string,
    updates: Partial<ItemEstoque>,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<ItemEstoque> {
    if (updates.codigo) {
      const codigoNorm = updates.codigo.trim().toUpperCase();
      const existente = await this.itemRepo.getByCodigo(codigoNorm, empresaId);
      if (existente && existente.id !== id) {
        throw new Error(`Já existe outro item com o código "${codigoNorm}".`);
      }
      updates.codigo = codigoNorm;
    }
    return this.itemRepo.update(id, updates);
  }

  async desativarItem(id: string): Promise<ItemEstoque> {
    return this.itemRepo.update(id, { ativo: false });
  }

  async excluirItem(id: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<void> {
    const movimentos = await this.movimentoRepo.getByItemId(id, empresaId);
    if (movimentos.length > 0) {
      throw new Error(
        'Este item possui histórico de movimentações e não pode ser excluído permanentemente. Você pode desativá-lo.'
      );
    }

    const unidades = await this.unidadeRepo.getByItemId(id, empresaId);
    if (unidades.length > 0) {
      throw new Error('Este item possui peças físicas cadastradas. Desative o item ou exclua as unidades antes.');
    }

    await this.itemRepo.delete(id);
  }

  // =========================================================================
  // INTEGRAÇÃO: ESTOQUE x COMPRAS x PRODUÇÃO
  // =========================================================================

  /**
   * Calcula o custo total de material retirado do estoque destinado a um projeto específico
   */
  async getCustoMaterialProjeto(
    projetoId: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<number> {
    const movimentos = await this.movimentoRepo.getByProjetoId(projetoId, empresaId);
    const total = movimentos
      .filter((m) => m.tipo === 'saida' && m.custo_total !== undefined && m.custo_total > 0)
      .reduce((acc, m) => acc + (m.custo_total || 0), 0);
    return Math.round(total * 100) / 100;
  }

  /**
   * Recebimento gera entrada: dá entrada de um ItemCompra recebido no estoque,
   * opcionalmente destina direto ao projeto com reserva automática e impede duplicidade.
   */
  async darEntradaPorRecebimento(
    params: {
      itemCompraId: string;
      itemId?: string;
      novoItem?: {
        codigo: string;
        descricao: string;
        categoria: CategoriaItemEstoque;
        unidade: UnidadeMedidaEstoque;
        especificacao: string;
        tipo_controle: TipoControleEstoque;
        localizacao_padrao?: string;
      };
      quantidade: number;
      localizacao: string;
      custo_unitario?: number;
      destinarDiretoAoProjeto?: boolean;
      dadosUnidadeFisica?: {
        material?: string;
        formato?: string;
        comprimento_mm?: number;
        largura_mm?: number;
        espessura_mm?: number;
        diametro_mm?: number;
        peso_kg?: number;
        lote_ou_certificado?: string;
      };
      usuarioId: string;
      usuarioNome?: string;
      observacoes?: string;
    },
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<{ movimento: MovimentoEstoque; novaUnidade?: UnidadeEstoque; reserva?: ReservaEstoque }> {
    const itemCompra = await comprasService.getItemCompraById(params.itemCompraId);
    if (!itemCompra) {
      throw new Error(`Item de compra ID ${params.itemCompraId} não encontrado.`);
    }

    if (itemCompra.movimento_entrada_id) {
      throw new Error('Este item de compra já teve sua entrada registrada no estoque anteriormente.');
    }

    let targetItemId = params.itemId;
    if (!targetItemId) {
      if (!params.novoItem) {
        throw new Error('Selecione um item de estoque existente ou forneça dados para cadastrar novo item.');
      }
      const criado = await this.criarItem(
        {
          ...params.novoItem,
          saldo: 0,
          ativo: true,
        },
        empresaId
      );
      targetItemId = criado.id;
    }

    const { movimento, novaUnidade } = await this.registrarEntrada(
      {
        itemId: targetItemId,
        quantidade: params.quantidade,
        usuarioId: params.usuarioId,
        usuarioNome: params.usuarioNome,
        motivo: 'compra',
        itemCompraId: params.itemCompraId,
        custo_unitario: params.custo_unitario,
        dadosUnidadeFisica: params.dadosUnidadeFisica
          ? {
              ...params.dadosUnidadeFisica,
              localizacao: params.localizacao,
              custo_unitario: params.custo_unitario,
            }
          : undefined,
        observacoes: params.observacoes,
      },
      empresaId
    );

    let reservaCriada: ReservaEstoque | undefined;
    if (params.destinarDiretoAoProjeto && itemCompra.projeto_id && itemCompra.componente_id) {
      reservaCriada = await this.criarReserva(
        {
          itemId: targetItemId,
          unidadeId: novaUnidade?.id,
          quantidade: params.quantidade,
          projetoId: itemCompra.projeto_id,
          componenteId: itemCompra.componente_id,
        },
        empresaId
      );
    }

    await comprasService.updateItemCompra(itemCompra.id, {
      status: 'recebido',
      data_recebimento: new Date().toISOString().split('T')[0],
      movimento_entrada_id: movimento.id,
      item_estoque_id: targetItemId,
    });

    return { movimento, novaUnidade, reserva: reservaCriada };
  }

  /**
   * Procura itens equivalentes no estoque ou sobras que comportem o bruto necessário
   */
  async procurarAtendimentoEstoque(
    queryData: {
      descricao?: string;
      especificacao?: string;
      dimensoes?: string;
      formato?: string;
      material?: string;
      tipo?: TipoItemCompra;
      quantidadeNecessaria: number;
    },
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<SugestaoEstoqueItem[]> {
    const [itens, unidades] = await Promise.all([
      this.getItensComDetalhes(empresaId),
      this.getUnidadesComDetalhes(empresaId),
    ]);

    const normalize = (txt?: string) =>
      (txt || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const termoDesc = normalize(queryData.descricao);
    const termoEsp = normalize(queryData.especificacao);
    const termoMat = normalize(queryData.material);

    const sugestoes: SugestaoEstoqueItem[] = [];

    // 1. Procurar itens por saldo disponível equivalente
    for (const it of itens) {
      if (it.disponivel <= 0) continue;
      const cod = normalize(it.codigo);
      const desc = normalize(it.descricao);
      const esp = normalize(it.especificacao);

      const matchDesc = termoDesc && (desc.includes(termoDesc) || termoDesc.includes(desc));
      const matchEsp = termoEsp && (esp.includes(termoEsp) || termoEsp.includes(esp));
      const matchCod = cod && (termoDesc.includes(cod) || termoEsp.includes(cod));
      const matchMat = termoMat && (esp.includes(termoMat) || desc.includes(termoMat));

      if (matchDesc || matchEsp || matchCod || matchMat) {
        sugestoes.push({
          tipo: 'item',
          itemId: it.id,
          itemCodigo: it.codigo,
          itemDescricao: it.descricao,
          disponivel: it.disponivel,
          unidade: it.unidade,
        });
      }
    }

    // 2. Para matéria-prima, procurar sobras físicas com dimensões que comportem o bruto
    const rawDims = queryData.dimensoes || queryData.especificacao || '';
    const dimsMatch = rawDims.match(
      /(\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)/
    );
    if (dimsMatch) {
      const necDims = [
        parseFloat(dimsMatch[1].replace(',', '.')),
        parseFloat(dimsMatch[2].replace(',', '.')),
        parseFloat(dimsMatch[3].replace(',', '.')),
      ].sort((a, b) => b - a);

      const sobras = unidades.filter((u) => u.status === 'disponivel');
      for (const sob of sobras) {
        if (!sob.comprimento_mm || !sob.largura_mm || !sob.espessura_mm) continue;
        const sobDims = [sob.comprimento_mm, sob.largura_mm, sob.espessura_mm].sort(
          (a, b) => b - a
        );

        if (
          sobDims[0] >= necDims[0] &&
          sobDims[1] >= necDims[1] &&
          sobDims[2] >= necDims[2]
        ) {
          const itemPai = itens.find((i) => i.id === sob.item_id);
          sugestoes.push({
            tipo: 'sobra',
            itemId: sob.item_id,
            itemCodigo: itemPai?.codigo || 'SOBRA',
            itemDescricao: itemPai?.descricao || sob.material || 'Retalho de Matéria-Prima',
            disponivel: 1,
            unidade: itemPai?.unidade || 'pç',
            unidadeId: sob.id,
            etiqueta: sob.etiqueta,
            dimensoes: `${sob.comprimento_mm} X ${sob.largura_mm} X ${sob.espessura_mm} mm`,
            peso_kg: sob.peso_kg,
            localizacao: sob.localizacao,
          });
        }
      }
    }

    return sugestoes;
  }

  /**
   * Atende uma necessidade de compra pelo estoque, reservando o material
   * e marcando o ItemCompra como 'atendido_estoque'
   */
  async atenderItemPeloEstoque(
    params: {
      itemCompraId: string;
      itemId: string;
      unidadeId?: string;
      quantidade: number;
      projetoId: string;
      componenteId: string;
      usuarioId: string;
      usuarioNome?: string;
    },
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<ReservaEstoque> {
    const reserva = await this.criarReserva(
      {
        itemId: params.itemId,
        unidadeId: params.unidadeId,
        quantidade: params.quantidade,
        projetoId: params.projetoId,
        componenteId: params.componenteId,
      },
      empresaId
    );

    await comprasService.updateItemCompra(params.itemCompraId, {
      status: 'atendido_estoque',
      item_estoque_id: params.itemId,
    });

    return reserva;
  }

  /**
   * Retirada para produção: registra saída para projeto e componente,
   * consumindo a reserva ativa vinculada
   */
  async retirarMaterialProducao(
    params: {
      projetoId: string;
      componenteId: string;
      itemId: string;
      unidadeId?: string;
      quantidade: number;
      reservaId?: string;
      custo_unitario?: number;
      usuarioId: string;
      usuarioNome?: string;
      observacoes?: string;
    },
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<{ movimento: MovimentoEstoque; reservaConsumida?: ReservaEstoque }> {
    if (params.reservaId) {
      const res = await this.consumirReserva(
        params.reservaId,
        params.usuarioId,
        params.usuarioNome,
        empresaId
      );
      return { movimento: res.movimento, reservaConsumida: res.reserva };
    }

    const reservas = await this.reservaRepo.getByItemId(params.itemId, empresaId);
    const ativa = reservas.find(
      (r) =>
        r.status === 'ativa' &&
        r.componente_id === params.componenteId &&
        (!params.unidadeId || r.unidade_id === params.unidadeId)
    );
    if (ativa) {
      const res = await this.consumirReserva(
        ativa.id,
        params.usuarioId,
        params.usuarioNome,
        empresaId
      );
      return { movimento: res.movimento, reservaConsumida: res.reserva };
    }

    const movimento = await this.registrarSaida(
      {
        itemId: params.itemId,
        unidadeId: params.unidadeId,
        quantidade: params.quantidade,
        projetoId: params.projetoId,
        componenteId: params.componenteId,
        motivo: 'producao',
        custo_unitario: params.custo_unitario,
        usuarioId: params.usuarioId,
        usuarioNome: params.usuarioNome,
        observacoes: params.observacoes || 'Retirada de material para produção da peça',
      },
      empresaId
    );

    return { movimento };
  }

  /**
   * Reposição: gera solicitações de compra de tipo reposicao (sem projeto)
   * para itens com saldo disponível abaixo do estoque mínimo
   */
  async gerarSolicitacoesReposicao(
    itensReposicao: {
      itemId: string;
      quantidade: number;
      fornecedorId?: string;
      observacoes?: string;
    }[],
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<ItemCompra[]> {
    const criados: ItemCompra[] = [];
    for (const sol of itensReposicao) {
      if (sol.quantidade <= 0) continue;
      const item = await this.itemRepo.getById(sol.itemId);
      if (!item) continue;

      const itemCompra = await comprasService.createItemCompra(
        {
          tipo: 'reposicao',
          item_estoque_id: item.id,
          descricao: item.descricao,
          especificacao: item.especificacao || `Reposição de ${item.codigo}`,
          quantidade: sol.quantidade,
          unidade: item.unidade,
          fornecedor_id: sol.fornecedorId,
          status: 'a_solicitar',
          observacoes:
            sol.observacoes ||
            `Reposição automática de estoque para atingir nível mínimo (${item.estoque_minimo || 0} ${item.unidade}).`,
          criado_em: new Date().toISOString(),
        },
        empresaId
      );
      criados.push(itemCompra);
    }
    return criados;
  }

  /**
   * Resumo para o Painel: cards de Estoque abaixo do mínimo, Sobras disponíveis
   * e Reservas paradas há mais de N dias
   */
  async getResumoEstoquePainel(
    empresaId: string = DEFAULT_EMPRESA_ID,
    diasAlertaCustom?: number
  ): Promise<{
    itensAbaixoMinimo: ItemEstoqueComDetalhes[];
    sobrasDisponiveis: UnidadeEstoqueComDetalhes[];
    reservasParadas: ReservaEstoqueComDetalhes[];
    diasAlerta: number;
  }> {
    const config = await toolShopService.getConfiguracoes(empresaId);
    const diasAlerta = diasAlertaCustom ?? config?.dias_alerta_reserva_parada ?? 30;

    const [itens, unidades, reservas] = await Promise.all([
      this.getItensComDetalhes(empresaId),
      this.getUnidadesComDetalhes(empresaId),
      this.getReservasComDetalhes(empresaId),
    ]);

    const itensAbaixoMinimo = itens.filter(
      (i) => i.estoque_minimo !== undefined && i.disponivel < i.estoque_minimo
    );

    const sobrasDisponiveis = unidades.filter(
      (u) => u.origem === 'sobra' && u.status === 'disponivel'
    );

    const nowMs = Date.now();
    const thresholdMs = diasAlerta * 24 * 60 * 60 * 1000;

    const reservasParadas = reservas.filter((r) => {
      if (r.status !== 'ativa') return false;
      const criadoMs = new Date(r.criado_em).getTime();
      return nowMs - criadoMs > thresholdMs;
    });

    return {
      itensAbaixoMinimo,
      sobrasDisponiveis,
      reservasParadas,
      diasAlerta,
    };
  }
}

export const estoqueService = new EstoqueService();
