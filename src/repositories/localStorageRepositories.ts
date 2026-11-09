import {
  Cliente,
  CentroCusto,
  Maquina,
  Operador,
  Projeto,
  Componente,
  Operacao,
  Apontamento,
  Usuario,
  ModeloComponente,
  HistoricoImportacao,
  OrigemCentroCusto,
  OperadorCentroCusto,
  ConfiguracoesSistema,
} from '../types';
import {
  IBaseRepository,
  IClienteRepository,
  ICentroCustoRepository,
  IMaquinaRepository,
  IOperadorRepository,
  IProjetoRepository,
  IComponenteRepository,
  IOperacaoRepository,
  IApontamentoRepository,
  IUsuarioRepository,
  IModeloComponenteRepository,
  IHistoricoImportacaoRepository,
  IOperadorCentroCustoRepository,
  IConfiguracoesRepository,
} from './interfaces';
import { generateUUID, DEFAULT_EMPRESA_ID } from '../utils/uuid';
import {
  SEED_CLIENTES,
  SEED_CENTROS_CUSTO,
  SEED_MAQUINAS,
  SEED_OPERADORES,
  SEED_PROJETOS,
  SEED_COMPONENTES,
  SEED_OPERACOES,
  SEED_APONTAMENTOS,
  SEED_MODELOS_COMPONENTES,
  SEED_HISTORICO_IMPORTACOES,
  SEED_OPERADOR_CENTROS_CUSTO,
  SEED_CONFIGURACOES,
  isExampleId,
  isExampleItem,
} from '../data/seedData';
import { runLegacyUserMigration } from '../auth/migration';

const STORAGE_KEYS = {
  CLIENTES: 'toolshop_clientes_v1',
  CENTROS_CUSTO: 'toolshop_centros_custo_v1',
  MAQUINAS: 'toolshop_maquinas_v1',
  OPERADORES: 'toolshop_operadores_v1',
  PROJETOS: 'toolshop_projetos_v1',
  COMPONENTES: 'toolshop_componentes_v1',
  OPERACOES: 'toolshop_operacoes_v1',
  APONTAMENTOS: 'toolshop_apontamentos_v1',
  USUARIOS: 'toolshop_usuarios_v1',
  MODELOS: 'toolshop_modelos_v1',
  HISTORICO_IMPORTACOES: 'toolshop_historico_importacoes_v1',
  OPERADOR_CENTROS_CUSTO: 'toolshop_operador_centros_custo_v1',
  CONFIGURACOES: 'toolshop_configuracoes_v1',
  INITIALIZED: 'toolshop_initialized_v1',
};


class LocalStorageBaseRepository<T extends { id: string; empresa_id: string }>
  implements IBaseRepository<T>
{
  constructor(protected storageKey: string, protected defaultData: T[] = []) {}

  protected getRawItems(): T[] {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return [];
      return JSON.parse(data) as T[];
    } catch (err) {
      console.error(`Erro ao ler localStorage key ${this.storageKey}:`, err);
      return [];
    }
  }

  protected setRawItems(items: T[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(items));
    } catch (err) {
      console.error(`Erro ao salvar no localStorage key ${this.storageKey}:`, err);
    }
  }

  async getAll(empresaId: string = DEFAULT_EMPRESA_ID): Promise<T[]> {
    const items = this.getRawItems();
    return items.filter(
      (item) => (!empresaId || item.empresa_id === empresaId) && !isExampleItem(item)
    );
  }

  async getById(id: string): Promise<T | null> {
    if (isExampleId(id)) return null;
    const items = this.getRawItems();
    const found = items.find((item) => item.id === id);
    if (!found || isExampleItem(found)) return null;
    return found;
  }

  async create(
    item: Omit<T, 'id' | 'empresa_id'> & { id?: string; empresa_id?: string }
  ): Promise<T> {
    const items = this.getRawItems();
    const newItem = {
      ...item,
      id: item.id || generateUUID(),
      empresa_id: item.empresa_id || DEFAULT_EMPRESA_ID,
    } as T;
    items.push(newItem);
    this.setRawItems(items);
    return newItem;
  }

  async update(id: string, updates: Partial<T>): Promise<T> {
    const items = this.getRawItems();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Registro com id ${id} não encontrado.`);
    }
    const updatedItem = { ...items[index], ...updates };
    items[index] = updatedItem;
    this.setRawItems(items);
    return updatedItem;
  }

  async delete(id: string): Promise<boolean> {
    const items = this.getRawItems();
    const filtered = items.filter((item) => item.id !== id);
    if (filtered.length === items.length) {
      return false;
    }
    this.setRawItems(filtered);
    return true;
  }

  async saveAll(items: T[]): Promise<void> {
    this.setRawItems(items);
  }
}

export class LocalStorageClienteRepository
  extends LocalStorageBaseRepository<Cliente>
  implements IClienteRepository
{
  constructor() {
    super(STORAGE_KEYS.CLIENTES, SEED_CLIENTES);
  }

  async search(query: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<Cliente[]> {
    const all = await this.getAll(empresaId);
    if (!query) return all;
    const q = query.toLowerCase();
    return all.filter(
      (c) => c.nome.toLowerCase().includes(q) || c.contato.toLowerCase().includes(q)
    );
  }
}

export class LocalStorageCentroCustoRepository
  extends LocalStorageBaseRepository<CentroCusto>
  implements ICentroCustoRepository
{
  constructor() {
    super(STORAGE_KEYS.CENTROS_CUSTO, SEED_CENTROS_CUSTO);
  }

  async getByCategoria(categoria: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<CentroCusto[]> {
    const all = await this.getAll(empresaId);
    return all.filter((c) => c.categoria.toLowerCase() === categoria.toLowerCase() || (c.tipo && c.tipo.toLowerCase() === categoria.toLowerCase()));
  }

  async getByOrigem(origem: OrigemCentroCusto, empresaId: string = DEFAULT_EMPRESA_ID): Promise<CentroCusto[]> {
    const all = await this.getAll(empresaId);
    return all.filter((c) => c.origem === origem);
  }

  async getByTipo(tipo: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<CentroCusto[]> {
    return this.getByCategoria(tipo, empresaId);
  }

  async search(query: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<CentroCusto[]> {
    const all = await this.getAll(empresaId);
    if (!query) return all;
    const q = query.toLowerCase();
    return all.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.categoria.toLowerCase().includes(q) ||
        (c.fornecedor_nome && c.fornecedor_nome.toLowerCase().includes(q)) ||
        (c.observacoes && c.observacoes.toLowerCase().includes(q))
    );
  }

  override async create(
    item: Omit<CentroCusto, 'id' | 'empresa_id'> & { id?: string; empresa_id?: string }
  ): Promise<CentroCusto> {
    const valorUnitario = item.valor_unitario ?? item.custo_hora ?? 0;
    const categoria = item.categoria || item.tipo || 'Outro';
    const normalized: Omit<CentroCusto, 'id' | 'empresa_id'> & { id?: string; empresa_id?: string } = {
      ...item,
      categoria,
      tipo: categoria,
      valor_unitario: valorUnitario,
      custo_hora: valorUnitario,
      modelo_custo: item.origem === 'interno' ? 'hora' : (item.modelo_custo || 'hora'),
      fornecedor_nome: item.origem === 'terceirizado' ? item.fornecedor_nome : undefined,
      fornecedor_contato: item.origem === 'terceirizado' ? item.fornecedor_contato : undefined,
      prazo_padrao_dias: item.origem === 'terceirizado' ? item.prazo_padrao_dias : undefined,
    };
    const created = await super.create(normalized);
    // Espelha no storage legado
    this.syncToLegacyStorage();
    return created;
  }

  override async update(id: string, updates: Partial<CentroCusto>): Promise<CentroCusto> {
    const normalizedUpdates = { ...updates };
    if (normalizedUpdates.categoria && !normalizedUpdates.tipo) {
      normalizedUpdates.tipo = normalizedUpdates.categoria;
    }
    if (normalizedUpdates.tipo && !normalizedUpdates.categoria) {
      normalizedUpdates.categoria = normalizedUpdates.tipo;
    }
    if (normalizedUpdates.valor_unitario !== undefined && normalizedUpdates.custo_hora === undefined) {
      normalizedUpdates.custo_hora = normalizedUpdates.valor_unitario;
    }
    if (normalizedUpdates.custo_hora !== undefined && normalizedUpdates.valor_unitario === undefined) {
      normalizedUpdates.valor_unitario = normalizedUpdates.custo_hora;
    }
    if (normalizedUpdates.origem === 'interno') {
      normalizedUpdates.modelo_custo = 'hora';
      normalizedUpdates.fornecedor_nome = undefined;
      normalizedUpdates.fornecedor_contato = undefined;
      normalizedUpdates.prazo_padrao_dias = undefined;
    }
    const updated = await super.update(id, normalizedUpdates);
    this.syncToLegacyStorage();
    return updated;
  }

  override async delete(id: string): Promise<boolean> {
    const res = await super.delete(id);
    if (res) {
      this.syncToLegacyStorage();
    }
    return res;
  }

  private syncToLegacyStorage(): void {
    try {
      const items = this.getRawItems();
      localStorage.setItem(STORAGE_KEYS.MAQUINAS, JSON.stringify(items));
    } catch {
      // Ignora falhas menores de sincronização legado
    }
  }
}

export class LocalStorageMaquinaRepository extends LocalStorageCentroCustoRepository {}

export class LocalStorageOperadorRepository
  extends LocalStorageBaseRepository<Operador>
  implements IOperadorRepository
{
  constructor() {
    super(STORAGE_KEYS.OPERADORES, SEED_OPERADORES);
  }

  async search(query: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<Operador[]> {
    const all = await this.getAll(empresaId);
    if (!query) return all;
    const q = query.toLowerCase();
    return all.filter((o) => o.nome.toLowerCase().includes(q));
  }
}

export class LocalStorageProjetoRepository
  extends LocalStorageBaseRepository<Projeto>
  implements IProjetoRepository
{
  constructor() {
    super(STORAGE_KEYS.PROJETOS, SEED_PROJETOS);
  }

  async getByClienteId(clienteId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<Projeto[]> {
    const all = await this.getAll(empresaId);
    return all.filter((p) => p.cliente_id === clienteId);
  }

  async getByStatus(status: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<Projeto[]> {
    const all = await this.getAll(empresaId);
    return all.filter((p) => p.status === status);
  }
}

export class LocalStorageComponenteRepository
  extends LocalStorageBaseRepository<Componente>
  implements IComponenteRepository
{
  constructor() {
    super(STORAGE_KEYS.COMPONENTES, SEED_COMPONENTES);
  }

  async getByProjetoId(projetoId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<Componente[]> {
    const all = await this.getAll(empresaId);
    return all.filter((c) => c.projeto_id === projetoId);
  }
}

export class LocalStorageOperacaoRepository
  extends LocalStorageBaseRepository<Operacao>
  implements IOperacaoRepository
{
  constructor() {
    super(STORAGE_KEYS.OPERACOES, SEED_OPERACOES);
  }

  async getByComponenteId(componenteId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<Operacao[]> {
    const all = await this.getAll(empresaId);
    return all
      .filter((o) => o.componente_id === componenteId)
      .sort((a, b) => a.sequencia - b.sequencia);
  }

  async getByCentroCustoId(centroCustoId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<Operacao[]> {
    const all = await this.getAll(empresaId);
    return all.filter((o) => (o.centro_custo_id === centroCustoId || o.maquina_id === centroCustoId));
  }

  async getByMaquinaId(maquinaId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<Operacao[]> {
    return this.getByCentroCustoId(maquinaId, empresaId);
  }

  override async create(
    item: Omit<Operacao, 'id' | 'empresa_id'> & { id?: string; empresa_id?: string }
  ): Promise<Operacao> {
    const centroCustoId = item.centro_custo_id || item.maquina_id || '';
    const normalized = {
      ...item,
      centro_custo_id: centroCustoId,
      maquina_id: centroCustoId,
    };
    return super.create(normalized);
  }

  override async update(id: string, updates: Partial<Operacao>): Promise<Operacao> {
    const normalizedUpdates = { ...updates };
    if (normalizedUpdates.centro_custo_id && !normalizedUpdates.maquina_id) {
      normalizedUpdates.maquina_id = normalizedUpdates.centro_custo_id;
    }
    if (normalizedUpdates.maquina_id && !normalizedUpdates.centro_custo_id) {
      normalizedUpdates.centro_custo_id = normalizedUpdates.maquina_id;
    }
    return super.update(id, normalizedUpdates);
  }
}

export class LocalStorageApontamentoRepository
  extends LocalStorageBaseRepository<Apontamento>
  implements IApontamentoRepository
{
  constructor() {
    super(STORAGE_KEYS.APONTAMENTOS, SEED_APONTAMENTOS);
  }

  async getByOperacaoId(operacaoId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<Apontamento[]> {
    const all = await this.getAll(empresaId);
    return all.filter((a) => a.operacao_id === operacaoId);
  }

  async getByOperadorId(operadorId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<Apontamento[]> {
    const all = await this.getAll(empresaId);
    return all.filter((a) => a.operador_id === operadorId);
  }

  async getActive(empresaId: string = DEFAULT_EMPRESA_ID): Promise<Apontamento[]> {
    const all = await this.getAll(empresaId);
    return all.filter((a) => a.fim === null);
  }
}

export class LocalStorageUsuarioRepository
  extends LocalStorageBaseRepository<Usuario>
  implements IUsuarioRepository
{
  constructor() {
    super(STORAGE_KEYS.USUARIOS, []);
  }

  async getByEmail(email: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<Usuario | null> {
    const all = await this.getAll(empresaId);
    const normalized = (email || '').trim().toLowerCase();
    return all.find((u) => (u.email || '').trim().toLowerCase() === normalized) || null;
  }

  async getByMatricula(matricula: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<Usuario | null> {
    const all = await this.getAll(empresaId);
    const normalized = (matricula || '').trim().toUpperCase();
    return all.find((u) => (u.matricula || '').trim().toUpperCase() === normalized) || null;
  }

  async search(query: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<Usuario[]> {
    const all = await this.getAll(empresaId);
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter(
      (u) =>
        u.nome.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.matricula && u.matricula.toLowerCase().includes(q)) ||
        u.perfil.toLowerCase().includes(q)
    );
  }
}

export class LocalStorageModeloComponenteRepository
  extends LocalStorageBaseRepository<ModeloComponente>
  implements IModeloComponenteRepository
{
  constructor() {
    super(STORAGE_KEYS.MODELOS, SEED_MODELOS_COMPONENTES);
  }

  async getByCodigo(
    codigo: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<ModeloComponente | null> {
    const all = await this.getAll(empresaId);
    const cleanCode = (codigo || '').trim().toUpperCase();
    if (!cleanCode) return null;
    return all.find((m) => (m.codigo || '').trim().toUpperCase() === cleanCode) || null;
  }

  async search(query: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<ModeloComponente[]> {
    const all = await this.getAll(empresaId);
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter(
      (m) =>
        (m.codigo && m.codigo.toLowerCase().includes(q)) ||
        m.nome.toLowerCase().includes(q) ||
        (m.categoria && m.categoria.toLowerCase().includes(q)) ||
        (m.material && m.material.toLowerCase().includes(q))
    );
  }
}

export class LocalStorageHistoricoImportacaoRepository
  extends LocalStorageBaseRepository<HistoricoImportacao>
  implements IHistoricoImportacaoRepository
{
  constructor() {
    super(STORAGE_KEYS.HISTORICO_IMPORTACOES, SEED_HISTORICO_IMPORTACOES);
  }

  async getRecentes(
    limite: number = 20,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<HistoricoImportacao[]> {
    const all = await this.getAll(empresaId);
    return all
      .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())
      .slice(0, limite);
  }
}

export class LocalStorageOperadorCentroCustoRepository
  extends LocalStorageBaseRepository<OperadorCentroCusto>
  implements IOperadorCentroCustoRepository
{
  constructor() {
    super(STORAGE_KEYS.OPERADOR_CENTROS_CUSTO, SEED_OPERADOR_CENTROS_CUSTO);
  }

  async getByOperadorId(
    operadorId: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<OperadorCentroCusto[]> {
    const all = await this.getAll(empresaId);
    return all.filter((item) => item.operador_id === operadorId);
  }

  async getByCentroCustoId(
    centroCustoId: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<OperadorCentroCusto[]> {
    const all = await this.getAll(empresaId);
    return all.filter((item) => item.centro_custo_id === centroCustoId);
  }

  async deleteByOperadorECentroCusto(
    operadorId: string,
    centroCustoId: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<boolean> {
    const items = this.getRawItems();
    const filtered = items.filter(
      (item) =>
        !(
          item.operador_id === operadorId &&
          item.centro_custo_id === centroCustoId &&
          (!empresaId || item.empresa_id === empresaId)
        )
    );
    if (filtered.length !== items.length) {
      this.setRawItems(filtered);
      return true;
    }
    return false;
  }
}

export class LocalStorageConfiguracoesRepository
  extends LocalStorageBaseRepository<ConfiguracoesSistema>
  implements IConfiguracoesRepository
{
  constructor() {
    super(STORAGE_KEYS.CONFIGURACOES, [SEED_CONFIGURACOES]);
  }

  async getConfig(empresaId: string = DEFAULT_EMPRESA_ID): Promise<ConfiguracoesSistema> {
    const all = await this.getAll(empresaId);
    if (all.length > 0) {
      return all[0];
    }
    // Cria padrão se não existir
    const defaultCfg: ConfiguracoesSistema = {
      ...SEED_CONFIGURACOES,
      empresa_id: empresaId,
    };
    await this.create(defaultCfg);
    return defaultCfg;
  }

  async updateConfig(
    updates: Partial<ConfiguracoesSistema>,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<ConfiguracoesSistema> {
    const current = await this.getConfig(empresaId);
    const updated = await this.update(current.id, updates);
    return updated;
  }
}


/**
 * Migração única e idempotente de Máquinas para Centros de Custo
 */
export function runCentroCustoMigration(): void {
  try {
    const rawCentros = localStorage.getItem(STORAGE_KEYS.CENTROS_CUSTO);
    const rawMaquinas = localStorage.getItem(STORAGE_KEYS.MAQUINAS);

    let centros: CentroCusto[] = [];

    if (rawCentros) {
      try {
        centros = JSON.parse(rawCentros) as CentroCusto[];
      } catch {
        centros = [];
      }
    } else if (rawMaquinas) {
      try {
        const maquinas = JSON.parse(rawMaquinas) as any[];
        centros = maquinas.map((m) => {
          const val = Number(m.valor_unitario ?? m.custo_hora ?? 0);
          const cat = m.categoria || m.tipo || 'Outro';
          return {
            id: m.id,
            empresa_id: m.empresa_id || DEFAULT_EMPRESA_ID,
            nome: m.nome,
            origem: (m.origem as OrigemCentroCusto) || 'interno',
            categoria: cat,
            tipo: cat,
            modelo_custo: m.origem === 'terceirizado' ? (m.modelo_custo || 'hora') : 'hora',
            valor_unitario: val,
            custo_hora: val,
            fornecedor_nome: m.fornecedor_nome,
            fornecedor_contato: m.fornecedor_contato,
            prazo_padrao_dias: m.prazo_padrao_dias,
            ativo: m.ativo !== false,
            observacoes: m.observacoes || '',
          };
        });
      } catch {
        centros = [];
      }
    }

    // Filtra e normaliza todos os centros de custo (removendo qualquer registro de exemplo)
    centros = centros
      .filter((c: any) => !isExampleId(c.id))
      .map((c: any) => {
        const val = Number(c.valor_unitario ?? c.custo_hora ?? 0);
        const cat = c.categoria || c.tipo || 'Outro';
        return {
          ...c,
          categoria: cat,
          tipo: cat,
          valor_unitario: val,
          custo_hora: val,
          origem: c.origem || 'interno',
          modelo_custo: c.origem === 'terceirizado' ? (c.modelo_custo || 'hora') : 'hora',
          ativo: c.ativo !== false,
        };
      });

    localStorage.setItem(STORAGE_KEYS.CENTROS_CUSTO, JSON.stringify(centros));
    localStorage.setItem(STORAGE_KEYS.MAQUINAS, JSON.stringify(centros));

    // Migração de Operações: sincroniza centro_custo_id <-> maquina_id e remove exemplos
    const rawOps = localStorage.getItem(STORAGE_KEYS.OPERACOES);
    if (rawOps) {
      try {
        const ops = (JSON.parse(rawOps) as any[]).filter((op: any) => !isExampleId(op.id));
        let opsChanged = false;
        for (const op of ops) {
          if (!op.centro_custo_id && op.maquina_id) {
            op.centro_custo_id = op.maquina_id;
            opsChanged = true;
          } else if (!op.maquina_id && op.centro_custo_id) {
            op.maquina_id = op.centro_custo_id;
            opsChanged = true;
          }
        }
        localStorage.setItem(STORAGE_KEYS.OPERACOES, JSON.stringify(ops));
      } catch (err) {
        console.error('Erro ao migrar operações para centro_custo_id:', err);
      }
    }

    // Migração de Modelos: sincroniza categoria <-> tipo_maquina e remove exemplos
    const rawModelos = localStorage.getItem(STORAGE_KEYS.MODELOS);
    if (rawModelos) {
      try {
        const modelos = (JSON.parse(rawModelos) as any[]).filter((mod: any) => !isExampleId(mod.id));
        let modChanged = false;
        for (const mod of modelos) {
          if (Array.isArray(mod.operacoes)) {
            for (const mop of mod.operacoes) {
              if (!mop.categoria && mop.tipo_maquina) {
                mop.categoria = mop.tipo_maquina;
                modChanged = true;
              } else if (!mop.tipo_maquina && mop.categoria) {
                mop.tipo_maquina = mop.categoria;
                modChanged = true;
              }
              if (!mop.centro_custo_id && mop.maquina_id) {
                mop.centro_custo_id = mop.maquina_id;
                modChanged = true;
              }
            }
          }
        }
        localStorage.setItem(STORAGE_KEYS.MODELOS, JSON.stringify(modelos));
      } catch (err) {
        console.error('Erro ao migrar modelos para categoria:', err);
      }
    }
  } catch (err) {
    console.error('Erro durante migração de Centros de Custo:', err);
  }
}

/**
 * Função para purgar completamente todos os dados de exemplo do localStorage
 */
export function purgeAllExampleData(): void {
  try {
    const keysToClean = [
      STORAGE_KEYS.CLIENTES,
      STORAGE_KEYS.CENTROS_CUSTO,
      STORAGE_KEYS.MAQUINAS,
      STORAGE_KEYS.OPERADORES,
      STORAGE_KEYS.PROJETOS,
      STORAGE_KEYS.COMPONENTES,
      STORAGE_KEYS.OPERACOES,
      STORAGE_KEYS.APONTAMENTOS,
      STORAGE_KEYS.MODELOS,
      STORAGE_KEYS.HISTORICO_IMPORTACOES,
      STORAGE_KEYS.OPERADOR_CENTROS_CUSTO,
      // Chaves legadas sem sufixo de versão
      'toolshop_clientes',
      'toolshop_centros_custo',
      'toolshop_maquinas',
      'toolshop_operadores',
      'toolshop_projetos',
      'toolshop_componentes',
      'toolshop_operacoes',
      'toolshop_apontamentos',
      'toolshop_modelos',
      'toolshop_historico_importacoes',
      'toolshop_operador_centros_custo',
    ];

    for (const key of keysToClean) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const items = JSON.parse(raw);
          if (Array.isArray(items)) {
            const cleaned = items.filter((item: any) => !isExampleItem(item));
            localStorage.setItem(key, JSON.stringify(cleaned));
          } else {
            localStorage.setItem(key, JSON.stringify([]));
          }
        } catch {
          localStorage.setItem(key, JSON.stringify([]));
        }
      } else {
        localStorage.setItem(key, JSON.stringify([]));
      }
    }

    // Varre e purga qualquer outra chave do localStorage que pertença a coleções
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          k.startsWith('toolshop_') &&
          !k.includes('usuario') &&
          !k.includes('auth_session') &&
          !k.includes('configuraco') &&
          !k.includes('initialized')
        ) {
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              const val = JSON.parse(raw);
              if (Array.isArray(val)) {
                const cleaned = val.filter((item: any) => !isExampleItem(item));
                localStorage.setItem(k, JSON.stringify(cleaned));
              }
            } catch {
              // ignore
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // Configurações: mantém ou inicializa padrão
    const rawConfig = localStorage.getItem(STORAGE_KEYS.CONFIGURACOES);
    if (!rawConfig) {
      localStorage.setItem(STORAGE_KEYS.CONFIGURACOES, JSON.stringify([SEED_CONFIGURACOES]));
    }

    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  } catch (err) {
    console.error('Erro ao purgar dados de exemplo locais:', err);
  }
}

/**
 * Inicialização do sistema limpo (sem registros de demonstração)
 */
export function initializeSeedData(forceReset: boolean = false): void {
  // Executa migração de segurança para purgar usuários legados do seed
  runLegacyUserMigration();
  // Executa migração de máquinas para centros de custo
  runCentroCustoMigration();
  // Purga integral de todos os dados de demonstração
  purgeAllExampleData();
}

// Instâncias Singleton dos Repositórios para uso em Serviços
export const clienteRepository = new LocalStorageClienteRepository();
export const centroCustoRepository = new LocalStorageCentroCustoRepository();
export const centrosCustoRepository = centroCustoRepository;
export const maquinaRepository = centroCustoRepository;
export const operadorRepository = new LocalStorageOperadorRepository();
export const projetoRepository = new LocalStorageProjetoRepository();
export const componenteRepository = new LocalStorageComponenteRepository();
export const operacaoRepository = new LocalStorageOperacaoRepository();
export const apontamentoRepository = new LocalStorageApontamentoRepository();
export const usuarioRepository = new LocalStorageUsuarioRepository();
export const modeloComponenteRepository = new LocalStorageModeloComponenteRepository();
export const historicoImportacaoRepository = new LocalStorageHistoricoImportacaoRepository();
export const operadorCentroCustoRepository = new LocalStorageOperadorCentroCustoRepository();
export const configuracoesRepository = new LocalStorageConfiguracoesRepository();



