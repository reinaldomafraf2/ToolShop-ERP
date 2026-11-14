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
import { auth, db, cleanFirestoreData } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { syncStatusService } from '../services/syncStatusService';
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
  OperadorCentroCusto,
  ConfiguracoesSistema,
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
  IOperadorCentroCustoRepository,
  IConfiguracoesRepository,
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
  operadorCentroCustoRepository as localOperadorCentroRepo,
  configuracoesRepository as localConfiguracoesRepo,
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
  SEED_CONFIGURACOES,
  DEMO_SEED_IDS,
  isExampleId,
  isExampleItem,
} from '../data/seedData';


// Repositório Base com Persistência em Firestore e Fallback Local
export class FirestoreBaseRepository<T extends { id: string; empresa_id: string }>
  implements IBaseRepository<T>
{
  protected throwOnSignedInError = false;

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
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (!snapshot.empty) {
        const items: T[] = [];
        snapshot.forEach((d) => {
          const item = d.data() as T;
          if (!isExampleItem(item)) {
            items.push(item);
          }
        });
        // Atualiza cache local
        await this.localRepo.saveAll(items).catch(() => {});
        return items;
      }
      const local = await this.localRepo.getAll(empresaId);
      return local.filter((item) => !isExampleItem(item));
    } catch (err) {
      syncStatusService.recordError(err, `leitura ${this.collectionName}`);
      const local = await this.localRepo.getAll(empresaId);
      return local.filter((item) => !isExampleItem(item));
    }
  }

  async getById(id: string): Promise<T | null> {
    if (isExampleId(id)) return null;
    try {
      const docRef = doc(db, this.collectionName, id);
      const snapshot = await getDoc(docRef);
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (snapshot.exists()) {
        const item = snapshot.data() as T;
        return isExampleItem(item) ? null : item;
      }
      return this.localRepo.getById(id);
    } catch (err) {
      syncStatusService.recordError(err, `leitura ${this.collectionName}`);
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

    if (this.throwOnSignedInError && auth.currentUser) {
      try {
        const docRef = doc(db, this.collectionName, finalId);
        await setDoc(docRef, cleanFirestoreData(finalItem));
        syncStatusService.recordSuccess(`gravação ${this.collectionName}`);
      } catch (err: any) {
        syncStatusService.recordError(err, `gravação ${this.collectionName}`);
        throw new Error(
          `Erro ao gravar em ${this.collectionName}: ${err?.message || 'permissão ou conexão.'}`
        );
      }
      await this.localRepo.create(finalItem).catch(() => {});
      return finalItem;
    }

    // Salva localmente primeiro para resposta imediata
    await this.localRepo.create(finalItem).catch(() => {});

    try {
      const docRef = doc(db, this.collectionName, finalId);
      await setDoc(docRef, cleanFirestoreData(finalItem));
      syncStatusService.recordSuccess(`gravação ${this.collectionName}`);
      return finalItem;
    } catch (err) {
      syncStatusService.recordError(err, `gravação ${this.collectionName}`);
      console.warn(`[Firestore ${this.collectionName}] create pendente de rede:`, err);
      return finalItem;
    }
  }

  async update(id: string, updates: Partial<T>): Promise<T> {
    if (this.throwOnSignedInError && auth.currentUser) {
      try {
        const docRef = doc(db, this.collectionName, id);
        await updateDoc(docRef, cleanFirestoreData(updates as Record<string, any>));
        syncStatusService.recordSuccess(`gravação ${this.collectionName}`);
      } catch (err: any) {
        syncStatusService.recordError(err, `gravação ${this.collectionName}`);
        throw new Error(
          `Erro ao atualizar ${this.collectionName}: ${err?.message || 'permissão ou conexão.'}`
        );
      }
      return this.localRepo.update(id, updates);
    }

    const updated = await this.localRepo.update(id, updates);
    try {
      const docRef = doc(db, this.collectionName, id);
      await updateDoc(docRef, cleanFirestoreData(updates as Record<string, any>));
      syncStatusService.recordSuccess(`gravação ${this.collectionName}`);
    } catch (err) {
      syncStatusService.recordError(err, `gravação ${this.collectionName}`);
      console.warn(`[Firestore ${this.collectionName}] update pendente de rede:`, err);
    }
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    if (this.throwOnSignedInError && auth.currentUser) {
      try {
        const docRef = doc(db, this.collectionName, id);
        await deleteDoc(docRef);
        syncStatusService.recordSuccess(`exclusão ${this.collectionName}`);
      } catch (err: any) {
        syncStatusService.recordError(err, `exclusão ${this.collectionName}`);
        throw new Error(
          `Erro ao excluir em ${this.collectionName}: ${err?.message || 'permissão ou conexão.'}`
        );
      }
      await this.localRepo.delete(id).catch(() => {});
      return true;
    }

    await this.localRepo.delete(id).catch(() => {});
    try {
      const docRef = doc(db, this.collectionName, id);
      await deleteDoc(docRef);
      syncStatusService.recordSuccess(`exclusão ${this.collectionName}`);
      return true;
    } catch (err) {
      syncStatusService.recordError(err, `exclusão ${this.collectionName}`);
      console.warn(`[Firestore ${this.collectionName}] delete pendente de rede:`, err);
      return true;
    }
  }

  async saveAll(items: T[]): Promise<void> {
    await this.localRepo.saveAll(items).catch(() => {});
    try {
      for (const item of items) {
        const docRef = doc(db, this.collectionName, item.id);
        await setDoc(docRef, cleanFirestoreData(item));
      }
      syncStatusService.recordSuccess(`gravação em lote ${this.collectionName}`);
    } catch (err) {
      syncStatusService.recordError(err, `gravação em lote ${this.collectionName}`);
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
    this.throwOnSignedInError = true;
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
    this.throwOnSignedInError = true;
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

// 11. Vínculo Operador - Centros de Custo (Postos de Trabalho Internos)
export class FirestoreOperadorCentroCustoRepository
  extends FirestoreBaseRepository<OperadorCentroCusto>
  implements IOperadorCentroCustoRepository
{
  constructor() {
    super('operador_centros_custo', localOperadorCentroRepo);
  }

  async getByOperadorId(
    operadorId: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<OperadorCentroCusto[]> {
    try {
      const colRef = collection(db, this.collectionName);
      const q = query(colRef, where('operador_id', '==', operadorId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const items: OperadorCentroCusto[] = [];
        snap.forEach((d) => items.push(d.data() as OperadorCentroCusto));
        return items;
      }
      return (this.localRepo as any).getByOperadorId(operadorId, empresaId);
    } catch {
      return (this.localRepo as any).getByOperadorId(operadorId, empresaId);
    }

  }

  async getByCentroCustoId(
    centroCustoId: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<OperadorCentroCusto[]> {
    try {
      const colRef = collection(db, this.collectionName);
      const q = query(colRef, where('centro_custo_id', '==', centroCustoId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const items: OperadorCentroCusto[] = [];
        snap.forEach((d) => items.push(d.data() as OperadorCentroCusto));
        return items;
      }
      return (this.localRepo as any).getByCentroCustoId(centroCustoId, empresaId);
    } catch {
      return (this.localRepo as any).getByCentroCustoId(centroCustoId, empresaId);
    }
  }

  async deleteByOperadorECentroCusto(
    operadorId: string,
    centroCustoId: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<boolean> {
    try {
      const colRef = collection(db, this.collectionName);
      const q = query(
        colRef,
        where('operador_id', '==', operadorId),
        where('centro_custo_id', '==', centroCustoId)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        for (const docSnap of snap.docs) {
          await deleteDoc(doc(db, this.collectionName, docSnap.id)).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Erro ao deletar vínculo no Firestore:', err);
    }
    return (this.localRepo as any).deleteByOperadorECentroCusto(
      operadorId,
      centroCustoId,
      empresaId
    );
  }
}

// 12. Configurações do Sistema
export class FirestoreConfiguracoesRepository
  extends FirestoreBaseRepository<ConfiguracoesSistema>
  implements IConfiguracoesRepository
{
  constructor() {
    super('configuracoes', localConfiguracoesRepo);
  }

  async getConfig(empresaId: string = DEFAULT_EMPRESA_ID): Promise<ConfiguracoesSistema> {
    try {
      const docRef = doc(db, this.collectionName, 'config_padrao');
      const snap = await getDoc(docRef);
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (snap.exists()) {
        const cfg = snap.data() as ConfiguracoesSistema;
        await this.localRepo.update(cfg.id, cfg).catch(() => {});
        return cfg;
      }
    } catch (err) {
      syncStatusService.recordError(err, `leitura ${this.collectionName}`);
    }
    return (this.localRepo as any).getConfig(empresaId);
  }

  async updateConfig(
    updates: Partial<ConfiguracoesSistema>,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<ConfiguracoesSistema> {
    const current = await this.getConfig(empresaId);
    const updated = cleanFirestoreData({ ...current, ...updates });
    try {
      await setDoc(doc(db, this.collectionName, 'config_padrao'), updated, { merge: true });
      syncStatusService.recordSuccess(`gravação ${this.collectionName}`);
    } catch (err: any) {
      syncStatusService.recordError(err, `gravação ${this.collectionName}`);
      if (auth.currentUser) {
        throw new Error(
          `Erro ao gravar configurações no servidor: ${err?.message || 'permissão ou conexão.'}`
        );
      }
      console.warn('Falha ao atualizar config no Firestore:', err);
    }
    return (this.localRepo as any).updateConfig(updates, empresaId);
  }
}

// Purga de todos os registros de demonstração no Firestore
export async function purgeExampleDataFromFirestore(): Promise<void> {
  try {
    for (const id of DEMO_SEED_IDS.clientes) {
      await deleteDoc(doc(db, 'clientes', id)).catch(() => {});
    }
    for (const id of DEMO_SEED_IDS.centros_custo) {
      await deleteDoc(doc(db, 'centros_custo', id)).catch(() => {});
    }
    for (const id of DEMO_SEED_IDS.operadores) {
      await deleteDoc(doc(db, 'operadores', id)).catch(() => {});
    }
    for (const id of DEMO_SEED_IDS.projetos) {
      await deleteDoc(doc(db, 'projetos', id)).catch(() => {});
    }
    for (const id of DEMO_SEED_IDS.componentes) {
      await deleteDoc(doc(db, 'componentes', id)).catch(() => {});
    }
    for (const id of DEMO_SEED_IDS.operacoes) {
      await deleteDoc(doc(db, 'operacoes', id)).catch(() => {});
    }
    for (const id of DEMO_SEED_IDS.apontamentos) {
      await deleteDoc(doc(db, 'apontamentos', id)).catch(() => {});
    }
    for (const id of DEMO_SEED_IDS.modelos_componentes) {
      await deleteDoc(doc(db, 'modelos_componentes', id)).catch(() => {});
    }
    for (const id of DEMO_SEED_IDS.historico_importacoes) {
      await deleteDoc(doc(db, 'historico_importacoes', id)).catch(() => {});
    }
    for (const id of DEMO_SEED_IDS.operador_centros_custo) {
      await deleteDoc(doc(db, 'operador_centros_custo', id)).catch(() => {});
    }
    // Garante que a configuração de parâmetros de sistema exista no Firestore
    await setDoc(doc(db, 'configuracoes', 'config_padrao'), SEED_CONFIGURACOES, { merge: true }).catch(() => {});
  } catch (err) {
    console.warn('Execução de limpeza no Firestore diferida:', err);
  }
}

// Inicializador limpo para Firestore
export async function syncSeedDataToFirestore(): Promise<void> {
  await purgeExampleDataFromFirestore();
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
export const operadorCentroCustoRepository = new FirestoreOperadorCentroCustoRepository();
export const configuracoesRepository = new FirestoreConfiguracoesRepository();

