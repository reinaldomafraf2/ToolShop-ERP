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
  syncSeedDataToFirestore,
} from '../repositories/firestoreRepositories';
import { initializeSeedData } from '../repositories/localStorageRepositories';
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
    public readonly historicoRepo: IHistoricoImportacaoRepository
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

  // --- PROJETOS & HIERARQUIA COMPLETA ---
  async getProjetos(empresaId: string = DEFAULT_EMPRESA_ID): Promise<Projeto[]> {
    return this.projetosRepo.getAll(empresaId);
  }

  async getProjetosComDetalhes(empresaId: string = DEFAULT_EMPRESA_ID): Promise<ProjetoComDetalhes[]> {
    const [projetos, clientes, componentes, operacoes, apontamentos, maquinas] =
      await Promise.all([
        this.projetosRepo.getAll(empresaId),
        this.clientesRepo.getAll(empresaId),
        this.componentesRepo.getAll(empresaId),
        this.operacoesRepo.getAll(empresaId),
        this.apontamentosRepo.getAll(empresaId),
        this.maquinasRepo.getAll(empresaId),
      ]);

    const clienteMap = new Map(clientes.map((c) => [c.id, c]));
    const maquinaMap = new Map(maquinas.map((m) => [m.id, m]));

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

        return {
          ...comp,
          operacoes: operacoesDetalhes,
        };
      });

      let totalOperacoes = 0;
      let operacoesConcluidasCount = 0;
      let horasEstimadasTotal = 0;
      let horasApontadasTotal = 0;
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
            horasEstimadasTotal += op.horas_estimadas || 0;
            horasApontadasTotal += op.horasApontadas || 0;
            custoInterno += op.custoAcumulado || 0;
          }
        });
      });

      const custoRealAcumulado = Number((custoInterno + custoTerceiros).toFixed(2));

      return {
        ...proj,
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
    if (!data.prazo) {
      throw new Error('O prazo de entrega é obrigatório.');
    }
    return this.projetosRepo.create(data);
  }

  async updateProjeto(id: string, updates: Partial<Projeto>): Promise<Projeto> {
    if (updates.codigo !== undefined && !updates.codigo.trim()) {
      throw new Error('O código do projeto é obrigatório.');
    }
    if (updates.descricao !== undefined && !updates.descricao.trim()) {
      throw new Error('A descrição do projeto é obrigatória.');
    }
    return this.projetosRepo.update(id, updates);
  }

  async deleteProjeto(id: string): Promise<boolean> {
    const componentes = await this.componentesRepo.getByProjetoId(id);
    for (const comp of componentes) {
      await this.deleteComponente(comp.id);
    }
    return this.projetosRepo.delete(id);
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
    const operacoes = await this.operacoesRepo.getByComponenteId(id);
    for (const op of operacoes) {
      await this.deleteOperacao(op.id);
    }
    return this.componentesRepo.delete(id);
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

    return this.operacoesRepo.create({
      ...data,
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
    if (cleanUpdates.centro_custo_id && !cleanUpdates.maquina_id) {
      cleanUpdates.maquina_id = cleanUpdates.centro_custo_id;
    }
    if (cleanUpdates.maquina_id && !cleanUpdates.centro_custo_id) {
      cleanUpdates.centro_custo_id = cleanUpdates.maquina_id;
    }
    return this.operacoesRepo.update(id, cleanUpdates);
  }

  async deleteOperacao(id: string): Promise<boolean> {
    const apontamentos = await this.apontamentosRepo.getByOperacaoId(id);
    for (const apt of apontamentos) {
      await this.apontamentosRepo.delete(apt.id);
    }
    return this.operacoesRepo.delete(id);
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
    return this.operacoesRepo.update(id, { status });
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

    return apontamentos
      .map((apt) => {
        const operacao = operacaoMap.get(apt.operacao_id);
        const componente = operacao ? compMap.get(operacao.componente_id) : undefined;
        const projeto = componente ? projMap.get(componente.projeto_id) : undefined;
        const centroCustoId = operacao ? (operacao.centro_custo_id || operacao.maquina_id) : undefined;
        const centroCusto = centroCustoId ? maquinaMap.get(centroCustoId) : undefined;

        return {
          ...apt,
          operador: opMap.get(apt.operador_id),
          operacao,
          centro_custo: centroCusto,
          maquina: centroCusto,
          componente,
          projeto,
          duracaoHoras: calculateDurationHours(apt.inicio, apt.fim),
        };
      })
      .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime());
  }

  async iniciarApontamento(operacaoId: string, operadorId: string): Promise<Apontamento> {
    // Regra: um operador só pode ter um apontamento aberto por vez
    const apontamentosOperador = await this.apontamentosRepo.getByOperadorId(operadorId);
    const apontamentoAberto = apontamentosOperador.find((a) => !a.fim);
    if (apontamentoAberto) {
      throw new Error(
        'Este operador já possui um apontamento aberto no momento. Finalize o apontamento anterior antes de iniciar outro.'
      );
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
    const apt = await this.apontamentosRepo.getById(apontamentoId);
    if (!apt) throw new Error('Apontamento não encontrado.');

    const updatedApt = await this.apontamentosRepo.update(apontamentoId, {
      fim: new Date().toISOString(),
    });

    if (concluirOperacao && apt.operacao_id) {
      // Atualiza status da operação para 'Concluída'
      const op = await this.operacoesRepo.update(apt.operacao_id, { status: 'Concluída' });

      // Regra: Quando todas as operações de um componente estiverem concluídas, marque o componente como Concluído automaticamente.
      if (op.componente_id) {
        const operacoesComp = await this.operacoesRepo.getByComponenteId(op.componente_id);
        const todasConcluidas =
          operacoesComp.length > 0 &&
          operacoesComp.every((o) => o.status === 'Concluída' || o.status === 'Retornada');

        if (todasConcluidas) {
          await this.componentesRepo.update(op.componente_id, { status: 'Concluído' });
        }
      }
    }

    return updatedApt;
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

    return this.apontamentosRepo.update(id, {
      inicio,
      fim,
      editado_manualmente: true,
      motivo_edicao: motivo.trim(),
    });
  }

  async getOperacoesDisponiveis(
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<OperacaoComDetalhes[]> {
    const [operacoes, maquinas, componentes, projetos, apontamentos] = await Promise.all([
      this.operacoesRepo.getAll(empresaId),
      this.maquinasRepo.getAll(empresaId),
      this.componentesRepo.getAll(empresaId),
      this.projetosRepo.getAll(empresaId),
      this.apontamentosRepo.getAll(empresaId),
    ]);

    const maquinaMap = new Map(maquinas.map((m) => [m.id, m]));
    const compMap = new Map(componentes.map((c) => [c.id, c]));
    const projMap = new Map(projetos.map((p) => [p.id, p]));

    // Apenas operações internas disponíveis: Pendente ou Em andamento (operações terceirizadas NÃO aparecem no apontamento)
    const disponiveis = operacoes.filter((o) => {
      if (o.status !== 'Pendente' && o.status !== 'Em andamento') return false;
      const centro = maquinaMap.get(o.centro_custo_id || o.maquina_id || '');
      return centro?.origem !== 'terceirizado';
    });

    return disponiveis.map((op) => {
      const comp = compMap.get(op.componente_id);
      const proj = comp ? projMap.get(comp.projeto_id) : undefined;
      const opApts = apontamentos.filter((a) => a.operacao_id === op.id);
      const horasApontadas = opApts.reduce(
        (acc, a) => acc + calculateDurationHours(a.inicio, a.fim),
        0
      );
      const centroCustoId = op.centro_custo_id || op.maquina_id || '';
      const centroCusto = maquinaMap.get(centroCustoId);
      const valorUnitario = centroCusto?.valor_unitario ?? centroCusto?.custo_hora ?? 0;

      return {
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
      };
    });
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

  // --- RESET SEED ---
  async resetSeedData(): Promise<void> {
    initializeSeedData(true);
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
  historicoImportacaoRepository
);

