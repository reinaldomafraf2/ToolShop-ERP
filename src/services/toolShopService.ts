import {
  Cliente,
  CentroCusto,
  Maquina,
  Operador,
  Projeto,
  Componente,
  Operacao,
  Apontamento,
  ProjetoComDetalhes,
  ComponenteComOperacoes,
  OperacaoComDetalhes,
  ApontamentoComOperador,
  ModeloComponente,
  ModeloOperacao,
  HistoricoImportacao,
  TipoComponente,
  OperadorCentroCusto,
  ConfiguracoesSistema,
  Usuario,
} from '../types';
import {
  IClienteRepository,
  ICentroCustoRepository,
  IMaquinaRepository,
  IOperadorRepository,
  IProjetoRepository,
  IComponenteRepository,
  IOperacaoRepository,
  IApontamentoRepository,
  IModeloComponenteRepository,
  IHistoricoImportacaoRepository,
  IOperadorCentroCustoRepository,
  IConfiguracoesRepository,
} from '../repositories/interfaces';
import {
  clienteRepository,
  centroCustoRepository,
  operadorRepository,
  projetoRepository,
  componenteRepository,
  operacaoRepository,
  apontamentoRepository,
  modeloComponenteRepository,
  historicoImportacaoRepository,
  operadorCentroCustoRepository,
  configuracoesRepository,
  syncSeedDataToFirestore,
  purgeExampleDataFromFirestore,
} from '../repositories/firestoreRepositories';
import { initializeSeedData } from '../repositories/localStorageRepositories';
import { itemCompraRepository } from '../repositories/comprasRepository';
import {
  FirestoreMovimentoEstoqueRepository,
  FirestoreReservaEstoqueRepository,
} from '../repositories/estoqueRepository';
import {
  computeComponenteMaterialStatus,
  avaliarLiberacaoOperacaoMaterial,
} from '../utils/materialStatus';
import {
  executeCascadeDeleteProjeto,
  executeCascadeDeleteComponente,
} from '../repositories/cascadeDelete';
import {
  recomputeAndPersistProjetoAggregates,
  transactionalAjustarApontamento,
  transactionalCreateOperacao,
  transactionalDeleteApontamento,
  transactionalDeleteOperacao,
  transactionalFinalizarApontamento,
  transactionalUpdateOperacao,
} from '../repositories/projetoAggregates';
import { recalcularCamposPrazoProjeto } from './prazoProjetoService';
import { isExampleItem } from '../data/seedData';
import { calculateDurationHours } from '../utils/formatters';
import { DEFAULT_EMPRESA_ID } from '../utils/uuid';

export class ToolShopService {
  public readonly maquinasRepo: IMaquinaRepository;

  constructor(
    public readonly clientesRepo: IClienteRepository,
    public readonly centrosCustoRepo: ICentroCustoRepository,
    public readonly operadoresRepo: IOperadorRepository,
    public readonly projetosRepo: IProjetoRepository,
    public readonly componentesRepo: IComponenteRepository,
    public readonly operacoesRepo: IOperacaoRepository,
    public readonly apontamentosRepo: IApontamentoRepository,
    public readonly modelosRepo: IModeloComponenteRepository,
    public readonly historicoRepo: IHistoricoImportacaoRepository,
    public readonly operadorCentrosRepo: IOperadorCentroCustoRepository = operadorCentroCustoRepository,
    public readonly configuracoesRepo: IConfiguracoesRepository = configuracoesRepository
  ) {
    this.maquinasRepo = this.centrosCustoRepo;
    // Inicializa o seed caso seja a primeira execução e sincroniza no Firestore
    initializeSeedData(false);
    syncSeedDataToFirestore().catch(() => {});
  }


  // --- CLIENTES ---
  async getClientes(empresaId: string = DEFAULT_EMPRESA_ID): Promise<Cliente[]> {
    return this.clientesRepo.getAll(empresaId);
  }

  async getClienteById(id: string): Promise<Cliente | null> {
    return this.clientesRepo.getById(id);
  }

  async createCliente(data: Omit<Cliente, 'id' | 'empresa_id'>): Promise<Cliente> {
    if (!data.nome || !data.nome.trim()) {
      throw new Error('O nome do cliente é obrigatório.');
    }
    return this.clientesRepo.create(data);
  }

  async updateCliente(id: string, updates: Partial<Cliente>): Promise<Cliente> {
    if (updates.nome !== undefined && !updates.nome.trim()) {
      throw new Error('O nome do cliente é obrigatório.');
    }
    return this.clientesRepo.update(id, updates);
  }

  async checkCanDeleteCliente(id: string): Promise<{ canDelete: boolean; reason?: string; projetosCount: number }> {
    const projetos = await this.projetosRepo.getByClienteId(id);
    if (projetos.length > 0) {
      return {
        canDelete: false,
        reason: `Não é possível excluir este cliente pois existem ${projetos.length} projeto(s) associado(s) a ele.`,
        projetosCount: projetos.length,
      };
    }
    return { canDelete: true, projetosCount: 0 };
  }

  async deleteCliente(id: string): Promise<boolean> {
    const check = await this.checkCanDeleteCliente(id);
    if (!check.canDelete) {
      throw new Error(check.reason);
    }
    return this.clientesRepo.delete(id);
  }

  // --- CENTROS DE CUSTO (ANTIGAS MÁQUINAS) ---
  async getCentrosCusto(empresaId: string = DEFAULT_EMPRESA_ID): Promise<CentroCusto[]> {
    return this.centrosCustoRepo.getAll(empresaId);
  }

  async getCentroCustoById(id: string): Promise<CentroCusto | null> {
    return this.centrosCustoRepo.getById(id);
  }

  async createCentroCusto(data: Omit<CentroCusto, 'id' | 'empresa_id'>): Promise<CentroCusto> {
    if (!data.nome || !data.nome.trim()) {
      throw new Error('O nome do centro de custo é obrigatório.');
    }
    const valor = data.valor_unitario ?? data.custo_hora ?? 0;
    if (typeof valor !== 'number' || isNaN(valor) || valor <= 0) {
      throw new Error('O valor unitário deve ser um número maior que zero.');
    }
    const origem = data.origem || 'interno';
    const categoria = data.categoria || data.tipo || 'Outro';

    return this.centrosCustoRepo.create({
      ...data,
      nome: data.nome.trim(),
      origem,
      categoria,
      tipo: categoria,
      modelo_custo: origem === 'interno' ? 'hora' : (data.modelo_custo || 'hora'),
      valor_unitario: valor,
      custo_hora: valor,
      fornecedor_nome: origem === 'terceirizado' ? data.fornecedor_nome?.trim() : undefined,
      fornecedor_contato: origem === 'terceirizado' ? data.fornecedor_contato?.trim() : undefined,
      prazo_padrao_dias: origem === 'terceirizado' && data.prazo_padrao_dias ? Number(data.prazo_padrao_dias) : undefined,
      capacidade_paralela:
        origem === 'interno'
          ? Math.max(1, Number(data.capacidade_paralela || 1))
          : undefined,
      horas_por_dia:
        origem === 'interno' && data.horas_por_dia !== undefined && data.horas_por_dia > 0
          ? Number(data.horas_por_dia)
          : undefined,
      disponibilidade_percentual:
        origem === 'interno' &&
        data.disponibilidade_percentual !== undefined &&
        data.disponibilidade_percentual >= 0 &&
        data.disponibilidade_percentual <= 100
          ? Number(data.disponibilidade_percentual)
          : undefined,
      ativo: data.ativo !== false,
      observacoes: data.observacoes?.trim() || undefined,
    });
  }

  async updateCentroCusto(id: string, updates: Partial<CentroCusto>): Promise<CentroCusto> {
    if (updates.nome !== undefined && !updates.nome.trim()) {
      throw new Error('O nome do centro de custo é obrigatório.');
    }
    const valor = updates.valor_unitario ?? updates.custo_hora;
    if (valor !== undefined && (typeof valor !== 'number' || isNaN(valor) || valor <= 0)) {
      throw new Error('O valor unitário deve ser um número maior que zero.');
    }
    const cleanUpdates = { ...updates };
    if (cleanUpdates.nome) cleanUpdates.nome = cleanUpdates.nome.trim();
    if (valor !== undefined) {
      cleanUpdates.valor_unitario = valor;
      cleanUpdates.custo_hora = valor;
    }
    if (cleanUpdates.categoria) cleanUpdates.tipo = cleanUpdates.categoria;
    if (cleanUpdates.origem === 'interno') {
      cleanUpdates.modelo_custo = 'hora';
      cleanUpdates.fornecedor_nome = undefined;
      cleanUpdates.fornecedor_contato = undefined;
      cleanUpdates.prazo_padrao_dias = undefined;
      if (cleanUpdates.capacidade_paralela !== undefined) {
        cleanUpdates.capacidade_paralela = Math.max(1, Number(cleanUpdates.capacidade_paralela || 1));
      }
    } else if (cleanUpdates.origem === 'terceirizado') {
      cleanUpdates.capacidade_paralela = undefined;
      cleanUpdates.horas_por_dia = undefined;
      cleanUpdates.disponibilidade_percentual = undefined;
    }
    return this.centrosCustoRepo.update(id, cleanUpdates);
  }

  async checkCanDeleteCentroCusto(id: string): Promise<{
    canDelete: boolean;
    reason?: string;
    operacoesCount: number;
    modelosCount: number;
  }> {
    const [operacoes, modelos] = await Promise.all([
      this.operacoesRepo.getAll(),
      this.modelosRepo.getAll(),
    ]);

    const operacoesVinculadas = operacoes.filter(
      (o) => o.centro_custo_id === id || o.maquina_id === id
    );

    const modelosVinculados = modelos.filter((m) =>
      Array.isArray(m.operacoes) &&
      m.operacoes.some((o) => o.centro_custo_id === id || o.maquina_id === id)
    );

    if (operacoesVinculadas.length > 0 || modelosVinculados.length > 0) {
      const parts: string[] = [];
      if (operacoesVinculadas.length > 0) {
        parts.push(`${operacoesVinculadas.length} operação(ões) de projetos`);
      }
      if (modelosVinculados.length > 0) {
        parts.push(`${modelosVinculados.length} modelo(s) da biblioteca`);
      }
      return {
        canDelete: false,
        reason: `Não é possível excluir este centro de custo pois ele está em uso em ${parts.join(' e ')}. Para manter a integridade dos dados e do histórico, você pode desativá-lo.`,
        operacoesCount: operacoesVinculadas.length,
        modelosCount: modelosVinculados.length,
      };
    }

    return { canDelete: true, operacoesCount: 0, modelosCount: 0 };
  }

  async deleteCentroCusto(id: string): Promise<boolean> {
    const check = await this.checkCanDeleteCentroCusto(id);
    if (!check.canDelete) {
      throw new Error(check.reason);
    }
    return this.centrosCustoRepo.delete(id);
  }

  // Wrappers de compatibilidade retroativa para Máquinas
  async getMaquinas(empresaId: string = DEFAULT_EMPRESA_ID): Promise<Maquina[]> {
    return this.getCentrosCusto(empresaId);
  }

  async getMaquinaById(id: string): Promise<Maquina | null> {
    return this.getCentroCustoById(id);
  }

  async createMaquina(data: Omit<Maquina, 'id' | 'empresa_id'>): Promise<Maquina> {
    return this.createCentroCusto(data);
  }

  async updateMaquina(id: string, updates: Partial<Maquina>): Promise<Maquina> {
    return this.updateCentroCusto(id, updates);
  }

  async checkCanDeleteMaquina(id: string): Promise<{ canDelete: boolean; reason?: string; apontamentosCount: number }> {
    const check = await this.checkCanDeleteCentroCusto(id);
    return {
      canDelete: check.canDelete,
      reason: check.reason,
      apontamentosCount: check.operacoesCount,
    };
  }

  async deleteMaquina(id: string): Promise<boolean> {
    return this.deleteCentroCusto(id);
  }

  // --- OPERADORES ---
  async getOperadores(empresaId: string = DEFAULT_EMPRESA_ID): Promise<Operador[]> {
    return this.operadoresRepo.getAll(empresaId);
  }

  async getOperadorById(id: string): Promise<Operador | null> {
    return this.operadoresRepo.getById(id);
  }

  async createOperador(data: Omit<Operador, 'id' | 'empresa_id'>): Promise<Operador> {
    if (!data.nome || !data.nome.trim()) {
      throw new Error('O nome do operador é obrigatório.');
    }
    return this.operadoresRepo.create(data);
  }

  async updateOperador(id: string, updates: Partial<Operador>): Promise<Operador> {
    if (updates.nome !== undefined && !updates.nome.trim()) {
      throw new Error('O nome do operador é obrigatório.');
    }
    return this.operadoresRepo.update(id, updates);
  }

  async checkCanDeleteOperador(id: string): Promise<{ canDelete: boolean; reason?: string; apontamentosCount: number }> {
    const apontamentos = await this.apontamentosRepo.getByOperadorId(id);
    if (apontamentos.length > 0) {
      return {
        canDelete: false,
        reason: `Não é possível excluir este operador pois ele possui ${apontamentos.length} apontamento(s) de horas registrado(s) no histórico de produção.`,
        apontamentosCount: apontamentos.length,
      };
    }
    return { canDelete: true, apontamentosCount: 0 };
  }

  async deleteOperador(id: string): Promise<boolean> {
    const check = await this.checkCanDeleteOperador(id);
    if (!check.canDelete) {
      throw new Error(check.reason);
    }
    return this.operadoresRepo.delete(id);
  }

  // --- VÍNCULOS OPERADOR - POSTOS DE TRABALHO (CENTROS DE CUSTO INTERNOS) ---
  async getOperadorCentrosCusto(
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<OperadorCentroCusto[]> {
    return this.operadorCentrosRepo.getAll(empresaId);
  }

  async getCentrosCustoDoOperador(
    operadorId: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<string[]> {
    const vinculos = await this.operadorCentrosRepo.getByOperadorId(operadorId, empresaId);
    return vinculos.map((v) => v.centro_custo_id);
  }

  async getOperadoresDoCentroCusto(
    centroCustoId: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<string[]> {
    const vinculos = await this.operadorCentrosRepo.getByCentroCustoId(centroCustoId, empresaId);
    return vinculos.map((v) => v.operador_id);
  }

  async vincularOperadorCentroCusto(
    operadorId: string,
    centroCustoId: string,
    usuarioNome: string = 'Usuário',
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<OperadorCentroCusto> {
    const centro = await this.centrosCustoRepo.getById(centroCustoId);
    if (!centro) {
      throw new Error('Centro de custo não encontrado.');
    }
    if (centro.origem !== 'interno') {
      throw new Error('Apenas centros de custo internos podem ser vinculados como postos de trabalho.');
    }
    const operador = await this.operadoresRepo.getById(operadorId);
    if (!operador) {
      throw new Error('Operador não encontrado.');
    }

    const existentes = await this.operadorCentrosRepo.getByOperadorId(operadorId, empresaId);
    const jaExiste = existentes.find((v) => v.centro_custo_id === centroCustoId);
    if (jaExiste) {
      return jaExiste;
    }

    const agora = new Date().toISOString();
    return this.operadorCentrosRepo.create({
      empresa_id: empresaId,
      operador_id: operadorId,
      centro_custo_id: centroCustoId,
      criado_em: agora,
      atualizado_por: usuarioNome,
      atualizado_em: agora,
    });
  }

  async desvincularOperadorCentroCusto(
    operadorId: string,
    centroCustoId: string,
    _usuarioNome: string = 'Usuário',
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<boolean> {
    return this.operadorCentrosRepo.deleteByOperadorECentroCusto(
      operadorId,
      centroCustoId,
      empresaId
    );
  }

  async salvarPostosDoOperador(
    operadorId: string,
    centroCustoIds: string[],
    usuarioNome: string = 'Usuário',
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<void> {
    const operador = await this.operadoresRepo.getById(operadorId);
    if (!operador) throw new Error('Operador não encontrado.');

    // Valida que todos os postos são de origem 'interno'
    const centros = await this.centrosCustoRepo.getAll(empresaId);
    const centroMap = new Map(centros.map((c) => [c.id, c]));

    for (const cid of centroCustoIds) {
      const c = centroMap.get(cid);
      if (c && c.origem !== 'interno') {
        throw new Error(
          `O centro de custo "${c.nome}" é terceirizado e não pode ser vinculado como posto de trabalho de operador.`
        );
      }
    }

    const atuais = await this.operadorCentrosRepo.getByOperadorId(operadorId, empresaId);
    const atuaisSet = new Set(atuais.map((v) => v.centro_custo_id));
    const novosSet = new Set(centroCustoIds);

    // Remover vínculos excluídos
    for (const v of atuais) {
      if (!novosSet.has(v.centro_custo_id)) {
        await this.operadorCentrosRepo.delete(v.id);
      }
    }

    // Criar novos vínculos
    const agora = new Date().toISOString();
    for (const cid of centroCustoIds) {
      if (!atuaisSet.has(cid)) {
        await this.operadorCentrosRepo.create({
          empresa_id: empresaId,
          operador_id: operadorId,
          centro_custo_id: cid,
          criado_em: agora,
          atualizado_por: usuarioNome,
          atualizado_em: agora,
        });
      }
    }
  }

  async salvarOperadoresDoPosto(
    centroCustoId: string,
    operadorIds: string[],
    usuarioNome: string = 'Usuário',
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<void> {
    const centro = await this.centrosCustoRepo.getById(centroCustoId);
    if (!centro) throw new Error('Centro de custo não encontrado.');
    if (centro.origem !== 'interno') {
      throw new Error(
        'Apenas centros de custo internos podem ser vinculados como postos de trabalho de operadores.'
      );
    }

    const atuais = await this.operadorCentrosRepo.getByCentroCustoId(centroCustoId, empresaId);
    const atuaisSet = new Set(atuais.map((v) => v.operador_id));
    const novosSet = new Set(operadorIds);

    // Remover
    for (const v of atuais) {
      if (!novosSet.has(v.operador_id)) {
        await this.operadorCentrosRepo.delete(v.id);
      }
    }

    // Adicionar
    const agora = new Date().toISOString();
    for (const opId of operadorIds) {
      if (!atuaisSet.has(opId)) {
        await this.operadorCentrosRepo.create({
          empresa_id: empresaId,
          operador_id: opId,
          centro_custo_id: centroCustoId,
          criado_em: agora,
          atualizado_por: usuarioNome,
          atualizado_em: agora,
        });
      }
    }
  }

  // --- CONFIGURAÇÕES DO SISTEMA ---
  async getConfiguracoes(empresaId: string = DEFAULT_EMPRESA_ID): Promise<ConfiguracoesSistema> {
    return this.configuracoesRepo.getConfig(empresaId);
  }

  async updateConfiguracoes(
    updates: Partial<ConfiguracoesSistema>,
    usuarioNome: string = 'Usuário',
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<ConfiguracoesSistema> {
    return this.configuracoesRepo.updateConfig(
      {
        ...updates,
        atualizado_por: usuarioNome,
        atualizado_em: new Date().toISOString(),
      },
      empresaId
    );
  }


  // --- PROJETOS & HIERARQUIA COMPLETA ---
  async getProjetos(empresaId: string = DEFAULT_EMPRESA_ID): Promise<Projeto[]> {
    return this.projetosRepo.getAll(empresaId);
  }

  /**
   * Lê exclusivamente documentos da coleção de projetos ativos (sem ler operações ou apontamentos).
   */
  async getProjetosAtivos(empresaId: string = DEFAULT_EMPRESA_ID): Promise<Projeto[]> {
    const projetos = await this.projetosRepo.getAll(empresaId);
    return projetos.filter(
      (p) => !isExampleItem(p) && p.status !== 'Concluído' && p.status !== 'Cancelado'
    );
  }

  async getProjetosComDetalhes(empresaId: string = DEFAULT_EMPRESA_ID): Promise<ProjetoComDetalhes[]> {
    const movRepo = new FirestoreMovimentoEstoqueRepository();
    const resRepo = new FirestoreReservaEstoqueRepository();

    const [projetos, clientes, componentes, operacoes, apontamentos, maquinas, itensCompra, movimentosEstoque, reservasEstoque] =
      await Promise.all([
        this.projetosRepo.getAll(empresaId),
        this.clientesRepo.getAll(empresaId),
        this.componentesRepo.getAll(empresaId),
        this.operacoesRepo.getAll(empresaId),
        this.apontamentosRepo.getAll(empresaId),
        this.maquinasRepo.getAll(empresaId),
        itemCompraRepository.getAll(empresaId).catch(() => []),
        movRepo.getAll(empresaId).catch(() => []),
        resRepo.getAll(empresaId).catch(() => []),
      ]);

    const clienteMap = new Map(clientes.map((c) => [c.id, c]));
    const maquinaMap = new Map(maquinas.map((m) => [m.id, m]));

    const itensCompraPorComp = new Map<string, typeof itensCompra>();
    itensCompra.forEach((ic) => {
      if (ic.componente_id) {
        const list = itensCompraPorComp.get(ic.componente_id) || [];
        list.push(ic);
        itensCompraPorComp.set(ic.componente_id, list);
      }
    });

    const movsPorComp = new Map<string, typeof movimentosEstoque>();
    movimentosEstoque.forEach((m) => {
      if (m.componente_id) {
        const list = movsPorComp.get(m.componente_id) || [];
        list.push(m);
        movsPorComp.set(m.componente_id, list);
      }
    });

    const resPorComp = new Map<string, typeof reservasEstoque>();
    reservasEstoque.forEach((r) => {
      if (r.componente_id) {
        const list = resPorComp.get(r.componente_id) || [];
        list.push(r);
        resPorComp.set(r.componente_id, list);
      }
    });

    return projetos.map((proj) => {
      const projComponentes = componentes.filter((c) => c.projeto_id === proj.id);

      const componentesComOperacoes: ComponenteComOperacoes[] = projComponentes.map((comp) => {
        const compOperacoes = operacoes.filter((o) => o.componente_id === comp.id);

        const operacoesDetalhes: OperacaoComDetalhes[] = compOperacoes.map((op) => {
          const opApontamentos = apontamentos.filter((a) => a.operacao_id === op.id);
          const apontamentosEnriquecidos: ApontamentoComOperador[] = opApontamentos.map((apt) => ({
            ...apt,
            duracaoHoras: calculateDurationHours(apt.inicio, apt.fim),
          }));

          const horasApontadas = apontamentosEnriquecidos.reduce(
            (acc, curr) => acc + curr.duracaoHoras,
            0
          );

          const centroCustoId = op.centro_custo_id || op.maquina_id || '';
          const opCentroCusto = maquinaMap.get(centroCustoId);
          const isTerceirizado = opCentroCusto?.origem === 'terceirizado';
          const valorUnitario = opCentroCusto?.valor_unitario ?? opCentroCusto?.custo_hora ?? 0;

          let custoAcumulado = 0;
          if (isTerceirizado) {
            custoAcumulado =
              op.valor_real !== undefined && op.valor_real !== null
                ? op.valor_real
                : (op.valor_orcado ?? 0);
          } else {
            custoAcumulado = Number((horasApontadas * valorUnitario).toFixed(2));
          }

          return {
            ...op,
            centro_custo_id: centroCustoId,
            maquina_id: centroCustoId,
            centro_custo: opCentroCusto,
            maquina: opCentroCusto,
            componente: comp,
            projeto: proj,
            apontamentos: apontamentosEnriquecidos,
            horasApontadas,
            custoAcumulado,
          };
        });

        const materialStatus = computeComponenteMaterialStatus(
          comp,
          itensCompraPorComp.get(comp.id) || [],
          movsPorComp.get(comp.id) || [],
          resPorComp.get(comp.id) || []
        );

        return {
          ...comp,
          operacoes: operacoesDetalhes,
          material_status: materialStatus,
        };
      });

      let totalOperacoes = 0;
      let operacoesConcluidasCount = 0;
      let horasEstimadasTotal = 0;
      let horasApontadasTotal = 0;
      let horasAExecutarFallback = 0;
      const horasAExecutarPorCcFallback: Record<string, number> = {};
      let custoInterno = 0;
      let custoTerceiros = 0;
      let custoTerceirosEstimado = 0;
      let custoTerceirosReal = 0;
      let operacoesTerceirosEnviadasCount = 0;

      componentesComOperacoes.forEach((comp) => {
        comp.operacoes.forEach((op) => {
          totalOperacoes++;
          // Para progresso e conclusão, 'Retornada' conta como concluída
          if (op.status === 'Concluída' || op.status === 'Retornada') {
            operacoesConcluidasCount++;
          }
          if (op.status === 'Enviada') {
            operacoesTerceirosEnviadasCount++;
          }

          const isTerc = op.centro_custo?.origem === 'terceirizado';
          if (isTerc) {
            if (op.valor_real !== undefined && op.valor_real !== null) {
              custoTerceirosReal += op.valor_real;
              custoTerceiros += op.valor_real;
            } else {
              const orcado = op.valor_orcado || 0;
              custoTerceirosEstimado += orcado;
              custoTerceiros += orcado;
            }
          } else {
            const estOp = op.horas_estimadas || 0;
            const aptOp = op.horasApontadas || 0;
            horasEstimadasTotal += estOp;
            horasApontadasTotal += aptOp;
            custoInterno += op.custoAcumulado || 0;
            if (op.status !== 'Concluída' && op.status !== 'Retornada') {
              const restOp = Math.max(estOp - aptOp, 0);
              const ccId = op.centro_custo_id || op.maquina_id || '';
              if (restOp > 0 && ccId) {
                horasAExecutarFallback += restOp;
                horasAExecutarPorCcFallback[ccId] =
                  (horasAExecutarPorCcFallback[ccId] || 0) + restOp;
              }
            }
          }
        });
      });

      const custoRealAcumulado = Number((custoInterno + custoTerceiros).toFixed(2));

      return {
        ...proj,
        horas_consumidas: Math.round(horasApontadasTotal * 10000) / 10000,
        horas_estimadas_total: Math.round(horasEstimadasTotal * 10000) / 10000,
        horas_a_executar: Math.round(horasAExecutarFallback * 10000) / 10000,
        horas_a_executar_por_cc: horasAExecutarPorCcFallback,
        cliente: clienteMap.get(proj.cliente_id),
        componentes: componentesComOperacoes,
        totalComponentes: projComponentes.length,
        totalOperacoes,
        operacoesConcluidasCount,
        horasEstimadasTotal,
        horasApontadasTotal,
        custoInterno: Number(custoInterno.toFixed(2)),
        custoTerceiros: Number(custoTerceiros.toFixed(2)),
        custoTerceirosEstimado: Number(custoTerceirosEstimado.toFixed(2)),
        custoTerceirosReal: Number(custoTerceirosReal.toFixed(2)),
        custoRealAcumulado,
        operacoesTerceirosEnviadasCount,
      };
    });
  }

  async getProjetoDetalhado(id: string): Promise<ProjetoComDetalhes | null> {
    const list = await this.getProjetosComDetalhes();
    return list.find((p) => p.id === id) || null;
  }

  async createProjeto(data: Omit<Projeto, 'id' | 'empresa_id'>): Promise<Projeto> {
    if (!data.codigo || !data.codigo.trim()) {
      throw new Error('O código do projeto é obrigatório.');
    }
    if (!data.descricao || !data.descricao.trim()) {
      throw new Error('A descrição do projeto é obrigatória.');
    }
    if (!data.cliente_id) {
      throw new Error('Selecione um cliente para o projeto.');
    }
    if (!data.prazo && !data.data_entrega && data.prazo_horas === undefined) {
      throw new Error('O prazo de entrega é obrigatório.');
    }

    const cfg = await this.getConfiguracoes();
    const agora = new Date().toISOString();
    const camposPrazo = recalcularCamposPrazoProjeto(
      {
        data_inicio: data.data_inicio || undefined,
        referencia_inicio: agora,
        data_entrega: data.data_entrega,
        prazo: data.prazo,
        prazo_horas: data.prazo_horas,
        prazo_origem: data.prazo_origem || (data.prazo_horas !== undefined && !data.data_entrega ? 'horas' : 'data'),
      },
      cfg
    );

    const payload: Omit<Projeto, 'id' | 'empresa_id'> = {
      ...data,
      data_entrega: camposPrazo.data_entrega,
      prazo: camposPrazo.prazo,
      prazo_horas: camposPrazo.prazo_horas,
      prazo_origem: camposPrazo.prazo_origem,
      criado_em: data.criado_em || agora,
      atualizado_em: agora,
      horas_consumidas: 0,
      horas_estimadas_total: 0,
      horas_a_executar: 0,
      horas_a_executar_por_cc: {},
    };
    if (camposPrazo.data_inicio) {
      payload.data_inicio = camposPrazo.data_inicio;
    } else {
      delete payload.data_inicio;
    }

    return this.projetosRepo.create(payload);
  }

  async updateProjeto(id: string, updates: Partial<Projeto>): Promise<Projeto> {
    if (updates.codigo !== undefined && !updates.codigo.trim()) {
      throw new Error('O código do projeto é obrigatório.');
    }
    if (updates.descricao !== undefined && !updates.descricao.trim()) {
      throw new Error('A descrição do projeto é obrigatória.');
    }

    const cleanUpdates: Partial<Projeto> = {
      ...updates,
      atualizado_em: new Date().toISOString(),
    };

    if (
      updates.data_inicio !== undefined ||
      updates.data_entrega !== undefined ||
      updates.prazo !== undefined ||
      updates.prazo_horas !== undefined ||
      updates.prazo_origem !== undefined
    ) {
      const [existing, cfg] = await Promise.all([
        this.projetosRepo.getById(id),
        this.getConfiguracoes(),
      ]);
      const dataInicioParam =
        updates.data_inicio !== undefined
          ? updates.data_inicio || undefined
          : existing?.data_inicio || undefined;
      const camposPrazo = recalcularCamposPrazoProjeto(
        {
          data_inicio: dataInicioParam,
          referencia_inicio: new Date().toISOString(),
          data_entrega: updates.data_entrega ?? existing?.data_entrega,
          prazo: updates.prazo ?? existing?.prazo,
          prazo_horas: updates.prazo_horas ?? existing?.prazo_horas,
          prazo_origem: updates.prazo_origem ?? existing?.prazo_origem ?? 'data',
        },
        cfg
      );
      cleanUpdates.data_entrega = camposPrazo.data_entrega;
      cleanUpdates.prazo = camposPrazo.prazo;
      cleanUpdates.prazo_horas = camposPrazo.prazo_horas;
      cleanUpdates.prazo_origem = camposPrazo.prazo_origem;
      if (camposPrazo.data_inicio) {
        cleanUpdates.data_inicio = camposPrazo.data_inicio;
      } else if (updates.data_inicio === '' || updates.data_inicio === null) {
        cleanUpdates.data_inicio = undefined;
      } else {
        delete cleanUpdates.data_inicio;
      }
    }

    return this.projetosRepo.update(id, cleanUpdates);
  }

  async iniciarProducaoProjeto(id: string): Promise<Projeto> {
    const existing = await this.projetosRepo.getById(id);
    if (!existing) {
      throw new Error('Projeto não encontrado.');
    }
    const cfg = await this.getConfiguracoes();
    const agora = new Date().toISOString();
    const camposPrazo = recalcularCamposPrazoProjeto(
      {
        data_inicio: agora,
        data_entrega: existing.data_entrega,
        prazo: existing.prazo,
        prazo_horas: existing.prazo_horas,
        prazo_origem: existing.prazo_origem || 'data',
      },
      cfg
    );
    return this.projetosRepo.update(id, {
      data_inicio: camposPrazo.data_inicio || agora,
      data_entrega: camposPrazo.data_entrega,
      prazo: camposPrazo.prazo,
      prazo_horas: camposPrazo.prazo_horas,
      prazo_origem: camposPrazo.prazo_origem,
      atualizado_em: agora,
    });
  }

  async deleteProjeto(id: string): Promise<boolean> {
    return executeCascadeDeleteProjeto(id);
  }

  // --- COMPONENTES ---
  async getComponentesPorProjeto(projetoId: string): Promise<Componente[]> {
    return this.componentesRepo.getByProjetoId(projetoId);
  }

  async createComponente(data: Omit<Componente, 'id' | 'empresa_id'>): Promise<Componente> {
    if (!data.nome || !data.nome.trim()) {
      throw new Error('O nome do componente é obrigatório.');
    }
    if (!data.material || !data.material.trim()) {
      throw new Error('O material do componente é obrigatório.');
    }
    return this.componentesRepo.create(data);
  }

  async updateComponente(id: string, updates: Partial<Componente>): Promise<Componente> {
    if (updates.nome !== undefined && !updates.nome.trim()) {
      throw new Error('O nome do componente é obrigatório.');
    }
    return this.componentesRepo.update(id, updates);
  }

  async deleteComponente(id: string): Promise<boolean> {
    return executeCascadeDeleteComponente(id);
  }

  // --- OPERAÇÕES ---
  async getOperacoesPorComponente(componenteId: string): Promise<Operacao[]> {
    return this.operacoesRepo.getByComponenteId(componenteId);
  }

  async createOperacao(data: Omit<Operacao, 'id' | 'empresa_id'>): Promise<Operacao> {
    if (!data.descricao || !data.descricao.trim()) {
      throw new Error('A descrição da operação é obrigatória.');
    }
    const centroCustoId = data.centro_custo_id || data.maquina_id;
    if (!centroCustoId) {
      throw new Error('Selecione um centro de custo para a operação.');
    }
    if (typeof data.horas_estimadas !== 'number' || isNaN(data.horas_estimadas) || data.horas_estimadas <= 0) {
      throw new Error('As horas estimadas devem ser um valor numérico maior que zero.');
    }

    if (!data.sequencia || data.sequencia <= 0) {
      const existing = await this.operacoesRepo.getByComponenteId(data.componente_id);
      const maxSeq = existing.reduce((max, op) => Math.max(max, op.sequencia || 0), 0);
      data.sequencia = maxSeq + 10;
    }

    let instrucoes = data.instrucoes;
    if (instrucoes && instrucoes.length > 5000) {
      instrucoes = instrucoes.substring(0, 5000);
    }

    return transactionalCreateOperacao({
      ...data,
      instrucoes,
      centro_custo_id: centroCustoId,
      maquina_id: centroCustoId,
    });
  }

  async updateOperacao(id: string, updates: Partial<Operacao>): Promise<Operacao> {
    if (updates.descricao !== undefined && !updates.descricao.trim()) {
      throw new Error('A descrição da operação é obrigatória.');
    }
    if (updates.horas_estimadas !== undefined && (typeof updates.horas_estimadas !== 'number' || isNaN(updates.horas_estimadas) || updates.horas_estimadas <= 0)) {
      throw new Error('As horas estimadas devem ser um valor numérico maior que zero.');
    }
    const cleanUpdates = { ...updates };
    if (cleanUpdates.instrucoes && cleanUpdates.instrucoes.length > 5000) {
      cleanUpdates.instrucoes = cleanUpdates.instrucoes.substring(0, 5000);
    }
    if (cleanUpdates.centro_custo_id && !cleanUpdates.maquina_id) {
      cleanUpdates.maquina_id = cleanUpdates.centro_custo_id;
    }
    if (cleanUpdates.maquina_id && !cleanUpdates.centro_custo_id) {
      cleanUpdates.centro_custo_id = cleanUpdates.maquina_id;
    }
    return transactionalUpdateOperacao(id, cleanUpdates);
  }

  async deleteOperacao(id: string): Promise<boolean> {
    return transactionalDeleteOperacao(id);
  }

  async reorderOperacoes(componenteId: string, operacaoIdsInOrder: string[]): Promise<Operacao[]> {
    const updated: Operacao[] = [];
    for (let i = 0; i < operacaoIdsInOrder.length; i++) {
      const opId = operacaoIdsInOrder[i];
      const newSeq = (i + 1) * 10;
      const op = await this.operacoesRepo.update(opId, { sequencia: newSeq });
      updated.push(op);
    }
    return updated;
  }

  async updateOperacaoStatus(id: string, status: Operacao['status']): Promise<Operacao> {
    return transactionalUpdateOperacao(id, { status }, status === 'Concluída' || status === 'Retornada');
  }

  // --- APONTAMENTOS ---
  async getApontamentos(empresaId: string = DEFAULT_EMPRESA_ID): Promise<ApontamentoComOperador[]> {
    const [apontamentos, operadores, operacoes, maquinas, componentes, projetos] =
      await Promise.all([
        this.apontamentosRepo.getAll(empresaId),
        this.operadoresRepo.getAll(empresaId),
        this.operacoesRepo.getAll(empresaId),
        this.maquinasRepo.getAll(empresaId),
        this.componentesRepo.getAll(empresaId),
        this.projetosRepo.getAll(empresaId),
      ]);

    const opMap = new Map(operadores.map((o) => [o.id, o]));
    const operacaoMap = new Map(operacoes.map((op) => [op.id, op]));
    const maquinaMap = new Map(maquinas.map((m) => [m.id, m]));
    const compMap = new Map(componentes.map((c) => [c.id, c]));
    const projMap = new Map(projetos.map((p) => [p.id, p]));

    const result: ApontamentoComOperador[] = [];
    for (const apt of apontamentos) {
      if (isExampleItem(apt)) continue;
      const operacao = operacaoMap.get(apt.operacao_id);
      const componente = operacao ? compMap.get(operacao.componente_id) : undefined;
      const projeto = componente ? projMap.get(componente.projeto_id) : undefined;
      const centroCustoId = operacao ? (operacao.centro_custo_id || operacao.maquina_id) : undefined;
      const centroCusto = centroCustoId ? maquinaMap.get(centroCustoId) : undefined;
      const operador = opMap.get(apt.operador_id);

      if (!operador || !operacao || !componente || !projeto) {
        continue;
      }

      if (
        isExampleItem(operacao) ||
        isExampleItem(componente) ||
        isExampleItem(projeto) ||
        isExampleItem(operador) ||
        isExampleItem(centroCusto)
      ) {
        continue;
      }

      result.push({
        ...apt,
        operador,
        operacao,
        centro_custo: centroCusto,
        maquina: centroCusto,
        componente,
        projeto,
        duracaoHoras: calculateDurationHours(apt.inicio, apt.fim),
      });
    }

    return result.sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime());
  }

  async iniciarApontamento(
    operacaoId: string,
    operadorId: string,
    usuarioLogado?: { perfil?: string } | null,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<Apontamento> {
    // Regra: um operador só pode ter um apontamento aberto por vez
    const apontamentosOperador = await this.apontamentosRepo.getByOperadorId(operadorId);
    const apontamentoAberto = apontamentosOperador.find((a) => !a.fim);
    if (apontamentoAberto) {
      throw new Error(
        'Este operador já possui um apontamento aberto no momento. Finalize o apontamento anterior antes de iniciar outro.'
      );
    }

    const op = await this.operacoesRepo.getById(operacaoId);
    if (!op) {
      throw new Error('Operação não encontrada.');
    }

    const centroId = op.centro_custo_id || op.maquina_id;
    let centro: CentroCusto | null = null;
    if (centroId) {
      centro = await this.centrosCustoRepo.getById(centroId);
      if (centro?.origem === 'terceirizado') {
        throw new Error('Esta operação pertence a um processo terceirizado e não permite apontamento.');
      }
    }

    const cfg = await this.getConfiguracoes(empresaId);

    // Validação de vínculo de postos: aplicada ao perfil operador (não se aplica a líder, gerente e admin)
    const isOperador = usuarioLogado?.perfil === 'operador';
    if (isOperador && cfg.restringir_postos) {
      if (!centroId) {
        throw new Error('Esta operação pertence a outro posto');
      }
      const postos = await this.getCentrosCustoDoOperador(operadorId, empresaId);
      if (!postos.includes(centroId)) {
        throw new Error('Esta operação pertence a outro posto');
      }
    }

    // Validação de sequência (liberar apenas quando anterior concluída)
    if (isOperador && cfg.liberar_apenas_proxima_operacao && op.componente_id) {
      const opsComp = await this.operacoesRepo.getByComponenteId(op.componente_id, empresaId);
      const anterioresNaoConcluidas = opsComp.filter(
        (o) => o.sequencia < op.sequencia && o.status !== 'Concluída' && o.status !== 'Retornada'
      );
      if (anterioresNaoConcluidas.length > 0) {
        throw new Error('A operação anterior deste componente ainda não foi concluída.');
      }
    }

    // Validação de liberação por material recebido (conforme configuração)
    if (op.componente_id) {
      const comp = await this.componentesRepo.getById(op.componente_id);
      if (comp) {
        const movRepo = new FirestoreMovimentoEstoqueRepository();
        const resRepo = new FirestoreReservaEstoqueRepository();
        const [itensCompraProj, movsAll, resAll] = await Promise.all([
          itemCompraRepository.getByProjetoId(comp.projeto_id, empresaId).catch(() => []),
          movRepo.getAll(empresaId).catch(() => []),
          resRepo.getAll(empresaId).catch(() => []),
        ]);
        const materialStatus = computeComponenteMaterialStatus(
          comp,
          itensCompraProj.filter((i) => i.componente_id === comp.id),
          movsAll.filter((m) => m.componente_id === comp.id),
          resAll.filter((r) => r.componente_id === comp.id)
        );
        const avaliacao = avaliarLiberacaoOperacaoMaterial({
          materialStatus,
          centroCustoCategoria: centro?.categoria || centro?.tipo,
          componenteTipo: comp.tipo,
          cfg,
        });
        if (avaliacao.bloqueado) {
          throw new Error(
            avaliacao.motivo || 'Operação bloqueada: o material deste componente ainda não foi recebido.'
          );
        }
      }
    }

    // Registra início de apontamento com data/hora atual
    const apt = await this.apontamentosRepo.create({
      operacao_id: operacaoId,
      operador_id: operadorId,
      inicio: new Date().toISOString(),
      fim: null,
      editado_manualmente: false,
    });

    // Atualiza status da operação para 'Em andamento'
    await this.operacoesRepo.update(operacaoId, { status: 'Em andamento' });
    return apt;
  }


  async finalizarApontamento(
    apontamentoId: string,
    concluirOperacao: boolean = false
  ): Promise<Apontamento> {
    return transactionalFinalizarApontamento(apontamentoId, concluirOperacao);
  }

  // --- CONTROLE DE OPERAÇÕES TERCEIRIZADAS (ENVIO E RETORNO) ---
  async registrarEnvioTerceiro(
    operacaoId: string,
    dados: {
      data_envio: string;
      documento?: string;
      prazo_dias?: number;
      fornecedor?: string;
      observacoes?: string;
    }
  ): Promise<Operacao> {
    const op = await this.operacoesRepo.getById(operacaoId);
    if (!op) throw new Error('Operação não encontrada.');

    const envioDate = new Date(dados.data_envio);
    const prazo = dados.prazo_dias !== undefined ? dados.prazo_dias : (op.prazo_dias ?? 5);

    // Calcula retorno_previsto = envio + prazo em dias
    const retornoPrevistoDate = new Date(envioDate);
    retornoPrevistoDate.setDate(retornoPrevistoDate.getDate() + prazo);
    const retornoPrevistoStr = retornoPrevistoDate.toISOString().split('T')[0];

    const updated = await this.operacoesRepo.update(operacaoId, {
      status: 'Enviada',
      data_envio: dados.data_envio,
      documento: dados.documento?.trim() || undefined,
      prazo_dias: prazo,
      retorno_previsto: retornoPrevistoStr,
      fornecedor: dados.fornecedor?.trim() || op.fornecedor,
      observacoes: dados.observacoes?.trim() || op.observacoes,
    });

    // Se o componente estava 'Pendente', pode passar para 'Em produção'
    const comp = await this.componentesRepo.getById(op.componente_id);
    if (comp && comp.status === 'Pendente') {
      await this.componentesRepo.update(comp.id, { status: 'Em produção' });
    }

    return updated;
  }

  async registrarRetornoTerceiro(
    operacaoId: string,
    dados: {
      data_retorno_real: string;
      valor_real?: number;
      documento?: string;
      observacoes?: string;
    }
  ): Promise<Operacao> {
    const op = await this.operacoesRepo.getById(operacaoId);
    if (!op) throw new Error('Operação não encontrada.');

    const updated = await this.operacoesRepo.update(operacaoId, {
      status: 'Retornada',
      data_retorno_real: dados.data_retorno_real,
      valor_real: dados.valor_real !== undefined ? dados.valor_real : op.valor_real,
      documento: dados.documento?.trim() || op.documento,
      observacoes: dados.observacoes?.trim() || op.observacoes,
    });

    // Verifica se todas as operações do componente foram concluídas ou retornadas
    const operacoesComp = await this.operacoesRepo.getByComponenteId(op.componente_id);
    const todasConcluidas =
      operacoesComp.length > 0 &&
      operacoesComp.every((o) => o.status === 'Concluída' || o.status === 'Retornada');

    if (todasConcluidas) {
      await this.componentesRepo.update(op.componente_id, { status: 'Concluído' });
    }

    return updated;
  }

  async ajustarApontamento(
    id: string,
    inicio: string,
    fim: string | null,
    motivo: string
  ): Promise<Apontamento> {
    if (!inicio) throw new Error('O horário de início é obrigatório.');
    if (fim && new Date(fim).getTime() <= new Date(inicio).getTime()) {
      throw new Error('O horário de término deve ser posterior ao horário de início.');
    }
    if (!motivo || !motivo.trim()) {
      throw new Error('Informe o motivo ou justificativa do ajuste manual.');
    }

    return transactionalAjustarApontamento(id, inicio, fim, motivo);
  }

  async deleteApontamento(id: string): Promise<boolean> {
    return transactionalDeleteApontamento(id);
  }

  async getOperacoesDisponiveis(
    empresaId: string = DEFAULT_EMPRESA_ID,
    usuarioLogado?: { perfil?: string } | null,
    operadorId?: string
  ): Promise<OperacaoComDetalhes[]> {
    const [operacoes, maquinas, componentes, projetos, apontamentos, cfg] = await Promise.all([
      this.operacoesRepo.getAll(empresaId),
      this.maquinasRepo.getAll(empresaId),
      this.componentesRepo.getAll(empresaId),
      this.projetosRepo.getAll(empresaId),
      this.apontamentosRepo.getAll(empresaId),
      this.getConfiguracoes(empresaId),
    ]);

    const maquinaMap = new Map(maquinas.map((m) => [m.id, m]));
    const compMap = new Map(componentes.map((c) => [c.id, c]));
    const projMap = new Map(projetos.map((p) => [p.id, p]));

    const isOperador = usuarioLogado?.perfil === 'operador';

    // Se o usuário logado for operador e a restrição de postos estiver ativa, busca os postos vinculados
    let postosOperadorSet: Set<string> | null = null;
    if (isOperador && cfg.restringir_postos) {
      if (operadorId) {
        const postos = await this.getCentrosCustoDoOperador(operadorId, empresaId);
        postosOperadorSet = new Set(postos);
      } else {
        postosOperadorSet = new Set();
      }
    }

    // Apenas operações internas disponíveis: Pendente ou Em andamento (operações terceirizadas NÃO aparecem no apontamento)
    let disponiveis = operacoes.filter((o) => {
      if (isExampleItem(o)) return false;
      if (o.status !== 'Pendente' && o.status !== 'Em andamento') return false;
      const comp = compMap.get(o.componente_id);
      if (!comp || isExampleItem(comp)) return false;
      const proj = projMap.get(comp.projeto_id);
      if (!proj || isExampleItem(proj)) return false;
      const centroId = o.centro_custo_id || o.maquina_id || '';
      const centro = maquinaMap.get(centroId);
      if (isExampleItem(centro)) return false;
      // Operações terceirizadas nunca aparecem no apontamento
      if (centro?.origem === 'terceirizado') return false;

      // Se for operador:
      if (isOperador) {
        // Operações sem centro de custo definido NUNCA aparecem para o operador
        if (!centroId || !centro) return false;

        // Se restrição estiver ativa, centro precisa estar nos postos vinculados
        if (postosOperadorSet && !postosOperadorSet.has(centroId)) {
          return false;
        }
      }

      return true;
    });

    // Se a regra "liberar apenas próxima operação" estiver ativa e o perfil for operador:
    if (isOperador && cfg.liberar_apenas_proxima_operacao) {
      // Agrupa todas as operações do sistema por componente para verificar status das sequências anteriores
      const opsPorComp = new Map<string, typeof operacoes>();
      operacoes.forEach((o) => {
        if (!opsPorComp.has(o.componente_id)) {
          opsPorComp.set(o.componente_id, []);
        }
        opsPorComp.get(o.componente_id)!.push(o);
      });

      disponiveis = disponiveis.filter((op) => {
        const todasDoComp = opsPorComp.get(op.componente_id) || [];
        // Verifica se todas as anteriores com menor sequência estão Concluída ou Retornada
        const anterioresNaoConcluidas = todasDoComp.filter(
          (o) => o.sequencia < op.sequencia && o.status !== 'Concluída' && o.status !== 'Retornada'
        );
        return anterioresNaoConcluidas.length === 0;
      });
    }

    const result: OperacaoComDetalhes[] = [];
    for (const op of disponiveis) {
      const comp = compMap.get(op.componente_id);
      const proj = comp ? projMap.get(comp.projeto_id) : undefined;
      if (!comp || !proj || isExampleItem(comp) || isExampleItem(proj)) continue;

      const opApts = apontamentos.filter((a) => !isExampleItem(a) && a.operacao_id === op.id);
      const horasApontadas = opApts.reduce(
        (acc, a) => acc + calculateDurationHours(a.inicio, a.fim),
        0
      );
      const centroCustoId = op.centro_custo_id || op.maquina_id || '';
      const centroCusto = maquinaMap.get(centroCustoId);
      if (isExampleItem(centroCusto)) continue;
      const valorUnitario = centroCusto?.valor_unitario ?? centroCusto?.custo_hora ?? 0;

      result.push({
        ...op,
        centro_custo_id: centroCustoId,
        maquina_id: centroCustoId,
        centro_custo: centroCusto,
        maquina: centroCusto,
        componente: comp,
        projeto: proj,
        apontamentos: opApts.map((a) => ({
          ...a,
          duracaoHoras: calculateDurationHours(a.inicio, a.fim),
        })),
        horasApontadas,
        custoAcumulado: Number((horasApontadas * valorUnitario).toFixed(2)),
      });
    }

    return result;
  }


  // --- STATS RESUMO DO PAINEL ---
  async getDashboardStats(empresaId: string = DEFAULT_EMPRESA_ID) {
    const [projetos, centrosCusto, operadores, apontamentos] = await Promise.all([
      this.getProjetosComDetalhes(empresaId),
      this.centrosCustoRepo.getAll(empresaId),
      this.operadoresRepo.getAll(empresaId),
      this.getApontamentos(empresaId),
    ]);

    const apontamentosAtivos = apontamentos.filter((a) => !a.fim);

    const horasEstimadasTotais = projetos.reduce((acc, p) => acc + p.horasEstimadasTotal, 0);
    const horasApontadasTotais = projetos.reduce((acc, p) => acc + p.horasApontadasTotal, 0);

    const projetosPorStatus = {
      aguardando: projetos.filter((p) => p.status === 'Aguardando').length,
      emAndamento: projetos.filter((p) => p.status === 'Em andamento').length,
      emTryout: projetos.filter((p) => p.status === 'Em tryout').length,
      concluido: projetos.filter((p) => p.status === 'Concluído').length,
      cancelado: projetos.filter((p) => p.status === 'Cancelado').length,
    };

    const centrosEmOperacao = new Set(
      apontamentosAtivos
        .map((a) => a.centro_custo?.id || a.maquina?.id)
        .filter(Boolean)
    ).size;

    // Operações enviadas a terceiros agora (status === 'Enviada')
    const operacoesEmTerceiros: OperacaoComDetalhes[] = [];
    projetos.forEach((proj) => {
      proj.componentes.forEach((comp) => {
        comp.operacoes.forEach((op) => {
          if (op.status === 'Enviada') {
            operacoesEmTerceiros.push(op);
          }
        });
      });
    });

    return {
      totalProjetos: projetos.length,
      projetosPorStatus,
      totalCentrosCusto: centrosCusto.length,
      centrosCustoEmOperacao: centrosEmOperacao,
      totalMaquinas: centrosCusto.length,
      maquinasEmOperacao: centrosEmOperacao,
      totalOperadores: operadores.length,
      operadoresAtivos: apontamentosAtivos.length,
      horasEstimadasTotais,
      horasApontadasTotais,
      apontamentosAtivos,
      operacoesEmTerceiros,
      projetos,
    };
  }

  // --- BIBLIOTECA DE COMPONENTES-MODELO ---
  async getModelos(empresaId: string = DEFAULT_EMPRESA_ID): Promise<ModeloComponente[]> {
    return this.modelosRepo.getAll(empresaId);
  }

  async getModeloById(id: string): Promise<ModeloComponente | null> {
    return this.modelosRepo.getById(id);
  }

  async getModeloByCodigo(
    codigo: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<ModeloComponente | null> {
    return this.modelosRepo.getByCodigo(codigo, empresaId);
  }

  async searchModelos(query: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<ModeloComponente[]> {
    return this.modelosRepo.search(query, empresaId);
  }

  async createModelo(
    data: Omit<ModeloComponente, 'id' | 'empresa_id'>
  ): Promise<ModeloComponente> {
    if (!data.codigo || !data.codigo.trim()) {
      throw new Error('O código do componente-modelo é obrigatório.');
    }
    if (!data.nome || !data.nome.trim()) {
      throw new Error('O nome do componente-modelo é obrigatório.');
    }

    // Validação de unicidade do código na empresa
    const existing = await this.modelosRepo.getByCodigo(data.codigo);
    if (existing) {
      throw new Error(`Já existe um modelo cadastrado com o código "${data.codigo}".`);
    }

    const cleanCodigo = data.codigo.trim().toUpperCase();
    const item = {
      ...data,
      codigo: cleanCodigo,
      criado_em: data.criado_em || new Date().toISOString(),
    };

    return this.modelosRepo.create(item);
  }

  async updateModelo(id: string, updates: Partial<ModeloComponente>): Promise<ModeloComponente> {
    if (updates.codigo !== undefined) {
      if (!updates.codigo.trim()) {
        throw new Error('O código do componente-modelo é obrigatório.');
      }
      const existing = await this.modelosRepo.getByCodigo(updates.codigo);
      if (existing && existing.id !== id) {
        throw new Error(`Já existe outro modelo com o código "${updates.codigo}".`);
      }
      updates.codigo = updates.codigo.trim().toUpperCase();
    }
    if (updates.nome !== undefined && !updates.nome.trim()) {
      throw new Error('O nome do componente-modelo é obrigatório.');
    }

    return this.modelosRepo.update(id, updates);
  }

  async deleteModelo(id: string): Promise<boolean> {
    return this.modelosRepo.delete(id);
  }

  // --- HISTÓRICO DE IMPORTAÇÕES ---
  async getHistoricoImportacoes(
    limite: number = 20,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<HistoricoImportacao[]> {
    return this.historicoRepo.getRecentes(limite, empresaId);
  }

  async registrarHistoricoImportacao(
    dados: Omit<HistoricoImportacao, 'id' | 'empresa_id'>
  ): Promise<HistoricoImportacao> {
    return this.historicoRepo.create(dados);
  }

  // --- IMPORTAÇÃO DE COMPONENTES EM LOTE PARA UM PROJETO ---
  async importarComponentesParaProjeto(params: {
    projetoId: string;
    itens: Array<{
      codigo?: string;
      nome: string;
      quantidade: number;
      material: string;
      tipo?: TipoComponente;
      dimensoes?: string;
      tratamento?: string;
      id_refer_pai?: string;
      num_lista?: string;
      observacoes?: string;
      modeloOrigemId?: string;
      operacoes?: Array<{
        sequencia: number;
        descricao: string;
        tipo_maquina?: string;
        maquina_id?: string;
        horas_estimadas: number;
      }>;
    }>;
    usuario: { id: string; nome: string };
    arquivoNome: string;
  }): Promise<{
    totalImportados: number;
    totalOperacoesCriadas: number;
    componentesCriados: Componente[];
  }> {
    const { projetoId, itens, usuario, arquivoNome } = params;
    const centrosCusto = await this.centrosCustoRepo.getAll();

    // Mapeamento de tipo, categoria ou nome para centro de custo
    const centroPorChave = new Map<string, string>();
    centrosCusto.forEach((c) => {
      if (c.categoria) centroPorChave.set(c.categoria.toLowerCase(), c.id);
      if (c.tipo) centroPorChave.set(c.tipo.toLowerCase(), c.id);
      if (c.nome) centroPorChave.set(c.nome.toLowerCase(), c.id);
    });

    const fallbackCentroId = centrosCusto[0]?.id || '';
    const componentesCriados: Componente[] = [];
    let totalOperacoesCriadas = 0;

    for (const item of itens) {
      const tipoFinal: TipoComponente = item.tipo || 'fabricado';

      const novoComponente = await this.componentesRepo.create({
        projeto_id: projetoId,
        codigo: item.codigo?.trim() || undefined,
        nome: item.nome.trim(),
        quantidade: Math.max(1, Math.floor(item.quantidade || 1)),
        material: item.material?.trim() || (tipoFinal === 'comprado' ? 'Item Comercial' : 'Aço P20'),
        tipo: tipoFinal,
        dimensoes: item.dimensoes?.trim() || undefined,
        tratamento: item.tratamento?.trim() || undefined,
        id_refer_pai: item.id_refer_pai?.trim() || undefined,
        num_lista: item.num_lista?.trim() || undefined,
        observacoes: item.observacoes?.trim() || undefined,
        status: 'Pendente',
        modelo_origem_id: item.modeloOrigemId || undefined,
      });

      componentesCriados.push(novoComponente);

      // REGRA: Itens comprados e de estoque NÃO recebem operações
      if (tipoFinal === 'fabricado' && item.operacoes && item.operacoes.length > 0) {
        for (const op of item.operacoes) {
          // Identifica o centro de custo correto pelo ID ou pelo tipo/categoria/nome
          const chaveBusca = (op as any).centro_custo_id || op.maquina_id || (op as any).categoria || op.tipo_maquina;
          let chosenCentroId = (op as any).centro_custo_id || op.maquina_id;
          if (!chosenCentroId && chaveBusca) {
            chosenCentroId = centroPorChave.get(String(chaveBusca).toLowerCase()) || fallbackCentroId;
          }
          if (!chosenCentroId) {
            chosenCentroId = fallbackCentroId;
          }

          await this.operacoesRepo.create({
            componente_id: novoComponente.id,
            centro_custo_id: chosenCentroId,
            maquina_id: chosenCentroId,
            sequencia: op.sequencia || 10,
            descricao: op.descricao,
            instrucoes: (op as any).instrucoes || undefined,
            horas_estimadas: op.horas_estimadas,
            status: 'Pendente',
          });
          totalOperacoesCriadas++;
        }
      }
    }

    // Registra no histórico de importações
    await this.registrarHistoricoImportacao({
      usuario_id: usuario.id,
      usuario_nome: usuario.nome,
      tipo: 'componentes_projeto',
      arquivo_nome: arquivoNome,
      total_linhas: itens.length,
      linhas_sucesso: itens.length,
      linhas_erro: 0,
      data_hora: new Date().toISOString(),
      detalhes: `Importados ${itens.length} componente(s) e ${totalOperacoesCriadas} operação(ões) para o projeto.`,
    });

    if (totalOperacoesCriadas > 0) {
      await recomputeAndPersistProjetoAggregates(projetoId);
    }

    return {
      totalImportados: componentesCriados.length,
      totalOperacoesCriadas,
      componentesCriados,
    };
  }

  // --- IMPORTAÇÃO EM LOTE PARA A BIBLIOTECA (COMPONENTES-MODELO E ROTEIROS) ---
  async importarModelosBiblioteca(params: {
    modelos: Array<{
      codigo: string;
      nome: string;
      categoria: string;
      material: string;
      observacoes?: string;
      operacoes: Array<{
        sequencia: number;
        descricao: string;
        tipo_maquina: any;
        horas_estimadas: number;
      }>;
      acaoConflito: 'atualizar' | 'ignorar';
    }>;
    usuario: { id: string; nome: string };
    arquivoNome: string;
  }): Promise<{
    criados: number;
    atualizados: number;
    ignorados: number;
    totalOperacoes: number;
  }> {
    const { modelos, usuario, arquivoNome } = params;
    let criados = 0;
    let atualizados = 0;
    let ignorados = 0;
    let totalOperacoes = 0;

    for (const item of modelos) {
      const cleanCodigo = item.codigo.trim().toUpperCase();
      const existing = await this.modelosRepo.getByCodigo(cleanCodigo);

      if (existing) {
        if (item.acaoConflito === 'atualizar') {
          // Substitui roteiro e dados do modelo existente
          await this.modelosRepo.update(existing.id, {
            nome: item.nome.trim(),
            categoria: item.categoria?.trim() || existing.categoria,
            material: item.material?.trim() || existing.material,
            observacoes: item.observacoes?.trim() || existing.observacoes,
            operacoes: item.operacoes.map((op, idx) => ({
              id: `mop_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
              modelo_componente_id: existing.id,
              sequencia: op.sequencia || (idx + 1) * 10,
              descricao: op.descricao,
              instrucoes: (op as any).instrucoes || undefined,
              categoria: op.tipo_maquina || (op as any).categoria || 'Geral',
              tipo_maquina: op.tipo_maquina || (op as any).categoria,
              horas_estimadas: op.horas_estimadas,
              prazo_dias: (op as any).prazo_dias,
              fornecedor: (op as any).fornecedor,
            })),
          });
          atualizados++;
          totalOperacoes += item.operacoes.length;
        } else {
          ignorados++;
        }
      } else {
        // Cria novo modelo
        const novoModeloId = `mod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await this.modelosRepo.create({
          id: novoModeloId,
          codigo: cleanCodigo,
          nome: item.nome.trim(),
          categoria: item.categoria?.trim() || 'Geral',
          material: item.material?.trim() || 'Aço Ferramenta',
          observacoes: item.observacoes?.trim() || undefined,
          criado_em: new Date().toISOString(),
          operacoes: item.operacoes.map((op, idx) => ({
            id: `mop_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
            modelo_componente_id: novoModeloId,
            sequencia: op.sequencia || (idx + 1) * 10,
            descricao: op.descricao,
            instrucoes: (op as any).instrucoes || undefined,
            categoria: op.tipo_maquina || (op as any).categoria || 'Geral',
            tipo_maquina: op.tipo_maquina || (op as any).categoria,
            horas_estimadas: op.horas_estimadas,
            prazo_dias: (op as any).prazo_dias,
            fornecedor: (op as any).fornecedor,
          })),
        });
        criados++;
        totalOperacoes += item.operacoes.length;
      }
    }

    // Registra no histórico
    await this.registrarHistoricoImportacao({
      usuario_id: usuario.id,
      usuario_nome: usuario.nome,
      tipo: 'biblioteca_modelos',
      arquivo_nome: arquivoNome,
      total_linhas: modelos.length,
      linhas_sucesso: criados + atualizados,
      linhas_erro: 0,
      data_hora: new Date().toISOString(),
      detalhes: `Carga de roteiros: ${criados} criados, ${atualizados} atualizados, ${ignorados} ignorados (${totalOperacoes} operações gravadas).`,
    });

    return {
      criados,
      atualizados,
      ignorados,
      totalOperacoes,
    };
  }

  // --- PURGA DE DADOS DE EXEMPLO ---
  async apagarDadosDeExemplo(): Promise<void> {
    initializeSeedData(true);
    await purgeExampleDataFromFirestore();
  }

  async resetSeedData(): Promise<void> {
    await this.apagarDadosDeExemplo();
  }
}

// Singleton pronto para consumo nos componentes e telas integrado ao Firestore
export const toolShopService = new ToolShopService(
  clienteRepository,
  centroCustoRepository,
  operadorRepository,
  projetoRepository,
  componenteRepository,
  operacaoRepository,
  apontamentoRepository,
  modeloComponenteRepository,
  historicoImportacaoRepository,
  operadorCentroCustoRepository,
  configuracoesRepository
);


