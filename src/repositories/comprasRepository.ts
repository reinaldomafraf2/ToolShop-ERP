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
} from 'firebase/firestore';
import { db, cleanFirestoreData } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { syncStatusService } from '../services/syncStatusService';
import { Fornecedor, ItemCompra } from '../types';
import { generateUUID, DEFAULT_EMPRESA_ID } from '../utils/uuid';

// =========================================================================
// REPOSITÓRIO LOCAL: FORNECEDORES
// =========================================================================

const FORNECEDORES_STORAGE_KEY = 'toolshop_fornecedores';

export class LocalFornecedorRepository {
  private getStorage(): Fornecedor[] {
    try {
      const data = localStorage.getItem(FORNECEDORES_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private setStorage(items: Fornecedor[]): void {
    try {
      localStorage.setItem(FORNECEDORES_STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.warn('Erro ao salvar fornecedores localmente:', err);
    }
  }

  async getAll(empresaId: string = DEFAULT_EMPRESA_ID): Promise<Fornecedor[]> {
    const all = this.getStorage();
    return all.filter((f) => !empresaId || f.empresa_id === empresaId);
  }

  async getById(id: string): Promise<Fornecedor | null> {
    const all = this.getStorage();
    return all.find((f) => f.id === id) || null;
  }

  async create(item: Omit<Fornecedor, 'id' | 'empresa_id'> & { id?: string; empresa_id?: string }): Promise<Fornecedor> {
    const all = this.getStorage();
    const finalItem: Fornecedor = {
      ...item,
      id: item.id || generateUUID(),
      empresa_id: item.empresa_id || DEFAULT_EMPRESA_ID,
      ativo: item.ativo ?? true,
      criado_em: item.criado_em || new Date().toISOString(),
    };
    all.push(finalItem);
    this.setStorage(all);
    return finalItem;
  }

  async update(id: string, updates: Partial<Fornecedor>): Promise<Fornecedor> {
    const all = this.getStorage();
    const idx = all.findIndex((f) => f.id === id);
    if (idx === -1) {
      throw new Error(`Fornecedor com ID ${id} não encontrado.`);
    }
    const updated = { ...all[idx], ...updates };
    all[idx] = updated;
    this.setStorage(all);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const all = this.getStorage();
    const filtered = all.filter((f) => f.id !== id);
    this.setStorage(filtered);
    return true;
  }

  async saveAll(items: Fornecedor[]): Promise<void> {
    this.setStorage(items);
  }
}

// =========================================================================
// REPOSITÓRIO FIRESTORE: FORNECEDORES
// =========================================================================

export class FirestoreFornecedorRepository {
  private collectionName = 'fornecedores';

  constructor(private localRepo: LocalFornecedorRepository) {}

  async getAll(empresaId: string = DEFAULT_EMPRESA_ID): Promise<Fornecedor[]> {
    try {
      const colRef = collection(db, this.collectionName);
      const q = empresaId
        ? query(colRef, where('empresa_id', '==', empresaId))
        : query(colRef);
      const snapshot = await getDocs(q);
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (!snapshot.empty) {
        const items: Fornecedor[] = [];
        snapshot.forEach((d) => items.push(d.data() as Fornecedor));
        await this.localRepo.saveAll(items).catch(() => {});
        return items;
      }
      return this.localRepo.getAll(empresaId);
    } catch (error) {
      syncStatusService.recordError(error, `leitura ${this.collectionName}`);
      console.warn(`[Firestore ${this.collectionName}] Falha ao buscar, usando local:`, error);
      return this.localRepo.getAll(empresaId);
    }
  }

  async getById(id: string): Promise<Fornecedor | null> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const snapshot = await getDoc(docRef);
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (snapshot.exists()) {
        return snapshot.data() as Fornecedor;
      }
      return this.localRepo.getById(id);
    } catch (error) {
      syncStatusService.recordError(error, `leitura ${this.collectionName}`);
      return this.localRepo.getById(id);
    }
  }

  async create(item: Omit<Fornecedor, 'id' | 'empresa_id'> & { id?: string; empresa_id?: string }): Promise<Fornecedor> {
    const finalId = item.id || generateUUID();
    const finalItem: Fornecedor = {
      ...item,
      id: finalId,
      empresa_id: item.empresa_id || DEFAULT_EMPRESA_ID,
      ativo: item.ativo ?? true,
      criado_em: item.criado_em || new Date().toISOString(),
    };

    // Salva localmente
    await this.localRepo.create(finalItem);

    try {
      const docRef = doc(db, this.collectionName, finalId);
      await setDoc(docRef, cleanFirestoreData(finalItem));
      syncStatusService.recordSuccess(`gravação ${this.collectionName}`);
      return finalItem;
    } catch (err) {
      console.error(`[Firestore ${this.collectionName}] Erro ao criar documento:`, err);
      handleFirestoreError(err, OperationType.CREATE, `${this.collectionName}/${finalId}`);
      throw err;
    }
  }

  async update(id: string, updates: Partial<Fornecedor>): Promise<Fornecedor> {
    const updated = await this.localRepo.update(id, updates);
    try {
      const docRef = doc(db, this.collectionName, id);
      await updateDoc(docRef, cleanFirestoreData(updates) as { [key: string]: unknown });
      syncStatusService.recordSuccess(`gravação ${this.collectionName}`);
      return updated;
    } catch (err) {
      console.error(`[Firestore ${this.collectionName}] Erro ao atualizar documento:`, err);
      handleFirestoreError(err, OperationType.UPDATE, `${this.collectionName}/${id}`);
      throw err;
    }
  }

  async delete(id: string): Promise<boolean> {
    await this.localRepo.delete(id);
    try {
      const docRef = doc(db, this.collectionName, id);
      await deleteDoc(docRef);
      syncStatusService.recordSuccess(`exclusão ${this.collectionName}`);
      return true;
    } catch (err) {
      console.error(`[Firestore ${this.collectionName}] Erro ao excluir documento:`, err);
      handleFirestoreError(err, OperationType.DELETE, `${this.collectionName}/${id}`);
      throw err;
    }
  }
}

// =========================================================================
// REPOSITÓRIO LOCAL: ITENS DE COMPRA
// =========================================================================

const ITENS_COMPRA_STORAGE_KEY = 'toolshop_itens_compra';

export class LocalItemCompraRepository {
  private getStorage(): ItemCompra[] {
    try {
      const data = localStorage.getItem(ITENS_COMPRA_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private setStorage(items: ItemCompra[]): void {
    try {
      localStorage.setItem(ITENS_COMPRA_STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.warn('Erro ao salvar itens de compra localmente:', err);
    }
  }

  async getAll(empresaId: string = DEFAULT_EMPRESA_ID): Promise<ItemCompra[]> {
    const all = this.getStorage();
    return all.filter((i) => !empresaId || i.empresa_id === empresaId);
  }

  async getById(id: string): Promise<ItemCompra | null> {
    const all = this.getStorage();
    return all.find((i) => i.id === id) || null;
  }

  async getByProjetoId(projetoId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<ItemCompra[]> {
    const all = await this.getAll(empresaId);
    return all.filter((i) => i.projeto_id === projetoId);
  }

  async getByComponenteId(componenteId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<ItemCompra[]> {
    const all = await this.getAll(empresaId);
    return all.filter((i) => i.componente_id === componenteId);
  }

  async getByFornecedorId(fornecedorId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<ItemCompra[]> {
    const all = await this.getAll(empresaId);
    return all.filter((i) => i.fornecedor_id === fornecedorId);
  }

  async create(item: Omit<ItemCompra, 'id' | 'empresa_id'> & { id?: string; empresa_id?: string }): Promise<ItemCompra> {
    const all = this.getStorage();
    const finalItem: ItemCompra = {
      ...item,
      id: item.id || generateUUID(),
      empresa_id: item.empresa_id || DEFAULT_EMPRESA_ID,
      criado_em: item.criado_em || new Date().toISOString(),
    };
    all.push(finalItem);
    this.setStorage(all);
    return finalItem;
  }

  async update(id: string, updates: Partial<ItemCompra>): Promise<ItemCompra> {
    const all = this.getStorage();
    const idx = all.findIndex((i) => i.id === id);
    if (idx === -1) {
      throw new Error(`Item de compra com ID ${id} não encontrado.`);
    }
    const updated = { ...all[idx], ...updates };
    all[idx] = updated;
    this.setStorage(all);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const all = this.getStorage();
    const filtered = all.filter((i) => i.id !== id);
    this.setStorage(filtered);
    return true;
  }

  async saveAll(items: ItemCompra[]): Promise<void> {
    this.setStorage(items);
  }
}

// =========================================================================
// REPOSITÓRIO FIRESTORE: ITENS DE COMPRA
// =========================================================================

export class FirestoreItemCompraRepository {
  private collectionName = 'itens_compra';

  constructor(private localRepo: LocalItemCompraRepository) {}

  async getAll(empresaId: string = DEFAULT_EMPRESA_ID): Promise<ItemCompra[]> {
    try {
      const colRef = collection(db, this.collectionName);
      const q = empresaId
        ? query(colRef, where('empresa_id', '==', empresaId))
        : query(colRef);
      const snapshot = await getDocs(q);
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (!snapshot.empty) {
        const items: ItemCompra[] = [];
        snapshot.forEach((d) => items.push(d.data() as ItemCompra));
        await this.localRepo.saveAll(items).catch(() => {});
        return items;
      }
      return this.localRepo.getAll(empresaId);
    } catch (error) {
      syncStatusService.recordError(error, `leitura ${this.collectionName}`);
      console.warn(`[Firestore ${this.collectionName}] Falha ao buscar, usando local:`, error);
      return this.localRepo.getAll(empresaId);
    }
  }

  async getById(id: string): Promise<ItemCompra | null> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const snapshot = await getDoc(docRef);
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (snapshot.exists()) {
        return snapshot.data() as ItemCompra;
      }
      return this.localRepo.getById(id);
    } catch (error) {
      syncStatusService.recordError(error, `leitura ${this.collectionName}`);
      return this.localRepo.getById(id);
    }
  }

  async getByProjetoId(projetoId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<ItemCompra[]> {
    try {
      const colRef = collection(db, this.collectionName);
      const q = query(
        colRef,
        where('empresa_id', '==', empresaId),
        where('projeto_id', '==', projetoId)
      );
      const snapshot = await getDocs(q);
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (!snapshot.empty) {
        const items: ItemCompra[] = [];
        snapshot.forEach((d) => items.push(d.data() as ItemCompra));
        return items;
      }
      return this.localRepo.getByProjetoId(projetoId, empresaId);
    } catch (error) {
      syncStatusService.recordError(error, `leitura ${this.collectionName}`);
      return this.localRepo.getByProjetoId(projetoId, empresaId);
    }
  }

  async getByComponenteId(componenteId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<ItemCompra[]> {
    const all = await this.getAll(empresaId);
    return all.filter((i) => i.componente_id === componenteId);
  }

  async getByFornecedorId(fornecedorId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<ItemCompra[]> {
    const all = await this.getAll(empresaId);
    return all.filter((i) => i.fornecedor_id === fornecedorId);
  }

  async create(item: Omit<ItemCompra, 'id' | 'empresa_id'> & { id?: string; empresa_id?: string }): Promise<ItemCompra> {
    const finalId = item.id || generateUUID();
    const finalItem: ItemCompra = {
      ...item,
      id: finalId,
      empresa_id: item.empresa_id || DEFAULT_EMPRESA_ID,
      criado_em: item.criado_em || new Date().toISOString(),
    };

    // Salva localmente primeiro
    await this.localRepo.create(finalItem);

    try {
      const docRef = doc(db, this.collectionName, finalId);
      await setDoc(docRef, cleanFirestoreData(finalItem));
      syncStatusService.recordSuccess(`gravação ${this.collectionName}`);
      return finalItem;
    } catch (err) {
      console.error(`[Firestore ${this.collectionName}] Erro ao criar documento:`, err);
      handleFirestoreError(err, OperationType.CREATE, `${this.collectionName}/${finalId}`);
      throw err;
    }
  }

  async update(id: string, updates: Partial<ItemCompra>): Promise<ItemCompra> {
    const updated = await this.localRepo.update(id, updates);
    try {
      const docRef = doc(db, this.collectionName, id);
      await updateDoc(docRef, cleanFirestoreData(updates) as { [key: string]: unknown });
      syncStatusService.recordSuccess(`gravação ${this.collectionName}`);
      return updated;
    } catch (err) {
      console.error(`[Firestore ${this.collectionName}] Erro ao atualizar documento:`, err);
      handleFirestoreError(err, OperationType.UPDATE, `${this.collectionName}/${id}`);
      throw err;
    }
  }

  async delete(id: string): Promise<boolean> {
    await this.localRepo.delete(id);
    try {
      const docRef = doc(db, this.collectionName, id);
      await deleteDoc(docRef);
      syncStatusService.recordSuccess(`exclusão ${this.collectionName}`);
      return true;
    } catch (err) {
      syncStatusService.recordError(err, `exclusão ${this.collectionName}`);
      console.warn(`[Firestore ${this.collectionName}] Falha ao excluir no Firestore (removido localmente):`, err);
      return true;
    }
  }
}

// Singletons para uso direto
export const localFornecedorRepository = new LocalFornecedorRepository();
export const fornecedorRepository = new FirestoreFornecedorRepository(localFornecedorRepository);

export const localItemCompraRepository = new LocalItemCompraRepository();
export const itemCompraRepository = new FirestoreItemCompraRepository(localItemCompraRepository);
