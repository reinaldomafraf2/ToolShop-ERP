import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import {
  Cliente,
  CentroCusto,
  Operador,
  Projeto,
  Componente,
  Operacao,
  Apontamento,
  Usuario,
  ModeloComponente,
  HistoricoImportacao,
  OrigemCentroCusto,
} from '../types';
import {
  IBaseRepository,
  IClienteRepository,
  ICentroCustoRepository,
  IOperadorRepository,
  IProjetoRepository,
  IComponenteRepository,
  IOperacaoRepository,
  IApontamentoRepository,
  IUsuarioRepository,
  IModeloComponenteRepository,
  IHistoricoImportacaoRepository,
} from './interfaces';
import { generateUUID, DEFAULT_EMPRESA_ID } from '../utils/uuid';
import {
  clienteRepository as localClienteRepo,
  centroCustoRepository as localCentroCustoRepo,
  operadorRepository as localOperadorRepo,
  projetoRepository as localProjetoRepo,
  componenteRepository as localComponenteRepo,
  operacaoRepository as localOperacaoRepo,
  apontamentoRepository as localApontamentoRepo,
  usuarioRepository as localUsuarioRepo,
  modeloComponenteRepository as localModeloRepo,
  historicoImportacaoRepository as localHistoricoRepo,
} from './localStorageRepositories';
import {
  SEED_CLIENTES,
  SEED_CENTROS_CUSTO,
  SEED_OPERADORES,
  SEED_PROJETOS,
  SEED_COMPONENTES,
  SEED_OPERACOES,
  SEED_APONTAMENTOS,
  SEED_MODELOS_COMPONENTES,
  SEED_HISTORICO_IMPORTACOES,
} from '../data/seedData';

// Repositório Base com Persistência em Firestore e Fallback Local
export class FirestoreBaseRepository<T extends { id: string; empresa_id: string }>
  implements IBaseRepository<T>
{
  constructor(
    protected collectionName: string,
    protected localRepo: IBaseRepository<T>
  ) {}

  async getAll(empresaId: string = DEFAULT_EMPRESA_ID): Promise<T[]> {
    try {
      const colRef = collection(db, this.collectionName);
      let q = query(colRef);
      if (empresaId) {
        q = query(colRef, where('empresa_id', '==', empresaId));
      }
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const items: T[] = [];
        snapshot.forEach((d) => items.push(d.data() as T));
        // Atualiza cache local
        await this.localRepo.saveAll(items).catch(() => {});
        return items;
      }
      return this.localRepo.getAll(empresaId);
    } catch {
      return this.localRepo.getAll(empresaId);
    }
  }

  async getById(id: string): Promise<T | null> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as T;
      }
      return this.localRepo.getById(id);
    } catch {
      return this.localRepo.getById(id);
    }
  }

  async create(
    item: Omit<T, 'id' | 'empresa_id'> & { id?: string; empresa_id?: string }
  ): Promise<T> {
    const finalId = item.id || generateUUID();
    const finalItem = {
      ...item,
      id: finalId,
      empresa_id: item.empresa_id || DEFAULT_EMPRESA_ID,
    } as T;

    // Salva localmente primeiro para resposta imediata
    await this.localRepo.create(finalItem).catch(() => {});

    try {
      const docRef = doc(db, this.collectionName, finalId);
      await setDoc(docRef, finalItem);
      return finalItem;
    } catch (err) {
      console.warn(`[Firestore ${this.collectionName}] create pendente de rede:`, err);
      return finalItem;
    }
  }

  async update(id: string, updates: Partial<T>): Promise<T> {
    const updated = await this.localRepo.update(id, updates);
    try {
      const docRef = doc(db, this.collectionName, id);
      await updateDoc(docRef, updates as { [key: string]: unknown });
    } catch (err) {
      console.warn(`[Firestore ${this.collectionName}] update pendente de rede:`, err);
    }
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    await this.localRepo.delete(id).catch(() => {});
    try {
      const docRef = doc(db, this.collectionName, id);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      console.warn(`[Firestore ${this.collectionName}] delete pendente de rede:`, err);
      return true;
    }
  }

  async saveAll(items: T[]): Promise<void> {
    await this.localRepo.saveAll(items).catch(() => {});
    try {
      for (const item of items) {
        const docRef = doc(db, this.collectionName, item.id);
        await setDoc(docRef, item);
      }
    } catch (err) {
      console.warn(`[Firestore ${this.collectionName}] saveAll pendente de rede:`, err);
    }
  }
}

// 1. Clientes
export class FirestoreClienteRepository
  extends FirestoreBaseRepository<Cliente>
  implements IClienteRepository
{
  constructor() {
    super('clientes', localClienteRepo);
  }

  async search(searchQuery: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<Cliente[]> {
    const all = await this.getAll(empresaId);
    const q = searchQuery.toLowerCase().trim();
    if (!q) return all;
    return all.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.contato && c.contato.toLowerCase().includes(q))
    );
  }
}

// 2. Centros de Custo
export class FirestoreCentroCustoRepository
  extends FirestoreBaseRepository<CentroCusto>
  implements ICentroCustoRepository
{
  constructor() {
    super('centros_custo', localCentroCustoRepo);
  }

  async getByCategoria(
    categoria: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<CentroCusto[]> {
    const all = await this.getAll(empresaId);
    return all.filter((c) => c.categoria === categoria);
  }

  async getByOrigem(
    origem: OrigemCentroCusto,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<CentroCusto[]> {
    const all = await this.getAll(empresaId);
    return all.filter((c) => c.origem === origem);
  }

  async getByTipo(tipo: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<CentroCusto[]> {
    return this.getByCategoria(tipo, empresaId);
  }
}

// 3. Operadores
export class FirestoreOperadorRepository
  extends FirestoreBaseRepository<Operador>
  implements IOperadorRepository
{
  constructor() {
    super('operadores', localOperadorRepo);
  }

  async search(searchQuery: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<Operador[]> {
    const all = await this.getAll(empresaId);
    const q = searchQuery.toLowerCase().trim();
    if (!q) return all;
    return all.filter((op) => op.nome.toLowerCase().includes(q));
  }
}

// 4. Projetos
export class FirestoreProjetoRepository
  extends FirestoreBaseRepository<Projeto>
  implements IProjetoRepository
{
  constructor() {
    super('projetos', localProjetoRepo);
  }

  async getByClienteId(
    clienteId: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<Projeto[]> {
    const all = await this.getAll(empresaId);
    return all.filter((p) => p.cliente_id === clienteId);
  }

  async getByStatus(status: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<Projeto[]> {
    const all = await this.getAll(empresaId);
    return all.filter((p) => p.status === status);
  }
}

// 5. Componentes
export class FirestoreComponenteRepository
  extends FirestoreBaseRepository<Componente>
  implements IComponenteRepository
{
  constructor() {
    super('componentes', localComponenteRepo);
  }

  async getByProjetoId(
    projetoId: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<Componente[]> {
    const all = await this.getAll(empresaId);
    return all.filter((comp) => comp.projeto_id === projetoId);
  }
}

// 6. Operações
export class FirestoreOperacaoRepository
  extends FirestoreBaseRepository<Operacao>
  implements IOperacaoRepository
{
  constructor() {
    super('operacoes', localOperacaoRepo);
  }

  async getByComponenteId(
    componenteId: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<Operacao[]> {
    const all = await this.getAll(empresaId);
    return all
      .filter((op) => op.componente_id === componenteId)
      .sort((a, b) => a.sequencia - b.sequencia);
  }

  async getByCentroCustoId(
    centroCustoId: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<Operacao[]> {
    const all = await this.getAll(empresaId);
    return all.filter(
      (op) => op.centro_custo_id === centroCustoId || op.maquina_id === centroCustoId
    );
  }

  async getByMaquinaId(
    maquinaId: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<Operacao[]> {
    return this.getByCentroCustoId(maquinaId, empresaId);
  }
}

// 7. Apontamentos
export class FirestoreApontamentoRepository
  extends FirestoreBaseRepository<Apontamento>
  implements IApontamentoRepository
{
  constructor() {
    super('apontamentos', localApontamentoRepo);
  }

  async getByOperacaoId(
    operacaoId: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<Apontamento[]> {
    const all = await this.getAll(empresaId);
    return all.filter((apt) => apt.operacao_id === operacaoId);
  }

  async getByOperadorId(
    operadorId: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<Apontamento[]> {
    const all = await this.getAll(empresaId);
    return all.filter((apt) => apt.operador_id === operadorId);
  }

  async getActive(empresaId: string = DEFAULT_EMPRESA_ID): Promise<Apontamento[]> {
    const all = await this.getAll(empresaId);
    return all.filter((apt) => !apt.fim);
  }
}

// 8. Usuários
export class FirestoreUsuarioRepository
  extends FirestoreBaseRepository<Usuario>
  implements IUsuarioRepository
{
  constructor() {
    super('usuarios', localUsuarioRepo);
  }

  async getByEmail(email: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<Usuario | null> {
    const all = await this.getAll(empresaId);
    return (
      all.find((u) => u.email && u.email.toLowerCase() === email.trim().toLowerCase()) || null
    );
  }

  async getByMatricula(
    matricula: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<Usuario | null> {
    const all = await this.getAll(empresaId);
    return (
      all.find((u) => u.matricula && u.matricula.trim() === matricula.trim()) || null
    );
  }

  async search(searchQuery: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<Usuario[]> {
    const all = await this.getAll(empresaId);
    const q = searchQuery.toLowerCase().trim();
    if (!q) return all;
    return all.filter(
      (u) =>
        u.nome.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.matricula && u.matricula.toLowerCase().includes(q))
    );
  }
}

// 9. Modelos da Biblioteca
export class FirestoreModeloComponenteRepository
  extends FirestoreBaseRepository<ModeloComponente>
  implements IModeloComponenteRepository
{
  constructor() {
    super('modelos_componentes', localModeloRepo);
  }

  async getByCodigo(
    codigo: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<ModeloComponente | null> {
    const all = await this.getAll(empresaId);
    return (
      all.find((m) => m.codigo.toUpperCase() === codigo.trim().toUpperCase()) || null
    );
  }

  async search(
    searchQuery: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<ModeloComponente[]> {
    const all = await this.getAll(empresaId);
    const q = searchQuery.toLowerCase().trim();
    if (!q) return all;
    return all.filter(
      (m) =>
        m.codigo.toLowerCase().includes(q) ||
        m.nome.toLowerCase().includes(q) ||
        m.material.toLowerCase().includes(q) ||
        (m.categoria && m.categoria.toLowerCase().includes(q))
    );
  }
}

// 10. Histórico de Importações
export class FirestoreHistoricoImportacaoRepository
  extends FirestoreBaseRepository<HistoricoImportacao>
  implements IHistoricoImportacaoRepository
{
  constructor() {
    super('historico_importacoes', localHistoricoRepo);
  }

  async getRecentes(
    limite: number = 30,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<HistoricoImportacao[]> {
    const all = await this.getAll(empresaId);
    return all
      .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())
      .slice(0, limite);
  }
}

// Sincronizador inicial para Firestore caso a base do Firebase esteja vazia
export async function syncSeedDataToFirestore(): Promise<void> {
  try {
    const colRef = collection(db, 'clientes');
    const snap = await getDocs(query(colRef, limit(1))).catch(() => null);
    if (!snap || snap.empty) {
      console.info('Inicializando coleções no Firestore...');
      for (const c of SEED_CLIENTES) {
        await setDoc(doc(db, 'clientes', c.id), c).catch(() => {});
      }
      for (const cc of SEED_CENTROS_CUSTO) {
        await setDoc(doc(db, 'centros_custo', cc.id), cc).catch(() => {});
      }
      for (const op of SEED_OPERADORES) {
        await setDoc(doc(db, 'operadores', op.id), op).catch(() => {});
      }
      for (const p of SEED_PROJETOS) {
        await setDoc(doc(db, 'projetos', p.id), p).catch(() => {});
      }
      for (const comp of SEED_COMPONENTES) {
        await setDoc(doc(db, 'componentes', comp.id), comp).catch(() => {});
      }
      for (const o of SEED_OPERACOES) {
        await setDoc(doc(db, 'operacoes', o.id), o).catch(() => {});
      }
      for (const apt of SEED_APONTAMENTOS) {
        await setDoc(doc(db, 'apontamentos', apt.id), apt).catch(() => {});
      }
      for (const m of SEED_MODELOS_COMPONENTES) {
        await setDoc(doc(db, 'modelos_componentes', m.id), m).catch(() => {});
      }
      for (const h of SEED_HISTORICO_IMPORTACOES) {
        await setDoc(doc(db, 'historico_importacoes', h.id), h).catch(() => {});
      }
      console.info('Coleções no Firestore inicializadas com sucesso.');
    }
  } catch (err) {
    console.warn('Sincronização com Firestore diferida:', err);
  }
}

// Singletons Firestore para consumo em serviços
export const clienteRepository = new FirestoreClienteRepository();
export const centroCustoRepository = new FirestoreCentroCustoRepository();
export const maquinaRepository = centroCustoRepository;
export const operadorRepository = new FirestoreOperadorRepository();
export const projetoRepository = new FirestoreProjetoRepository();
export const componenteRepository = new FirestoreComponenteRepository();
export const operacaoRepository = new FirestoreOperacaoRepository();
export const apontamentoRepository = new FirestoreApontamentoRepository();
export const usuarioRepository = new FirestoreUsuarioRepository();
export const modeloComponenteRepository = new FirestoreModeloComponenteRepository();
export const historicoImportacaoRepository = new FirestoreHistoricoImportacaoRepository();
