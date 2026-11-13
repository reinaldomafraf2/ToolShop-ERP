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
  runTransaction,
} from 'firebase/firestore';
import { db, cleanFirestoreData } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { syncStatusService } from '../services/syncStatusService';
import {
  ItemEstoque,
  UnidadeEstoque,
  MovimentoEstoque,
  ReservaEstoque,
  ItemCompra,
  RecebimentoItemCompraRegistro,
  StatusItemCompra,
} from '../types';
import { LocalItemCompraRepository } from './comprasRepository';
import { generateUUID, DEFAULT_EMPRESA_ID } from '../utils/uuid';

// =========================================================================
// CHAVES DE LOCALSTORAGE
// =========================================================================
const ITENS_ESTOQUE_KEY = 'toolshop_itens_estoque';
const UNIDADES_ESTOQUE_KEY = 'toolshop_unidades_estoque';
const MOVIMENTOS_ESTOQUE_KEY = 'toolshop_movimentos_estoque';
const RESERVAS_ESTOQUE_KEY = 'toolshop_reservas_estoque';

// =========================================================================
// 1. REPOSITÓRIOS LOCAIS
// =========================================================================

export class LocalItemEstoqueRepository {
  private getStorage(): ItemEstoque[] {
    try {
      const data = localStorage.getItem(ITENS_ESTOQUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private setStorage(items: ItemEstoque[]): void {
    try {
      localStorage.setItem(ITENS_ESTOQUE_KEY, JSON.stringify(items));
    } catch (err) {
      console.warn('Erro ao salvar itens de estoque localmente:', err);
    }
  }

  async getAll(empresaId: string = DEFAULT_EMPRESA_ID): Promise<ItemEstoque[]> {
    const all = this.getStorage();
    return all.filter((i) => !empresaId || i.empresa_id === empresaId);
  }

  async getById(id: string): Promise<ItemEstoque | null> {
    const all = this.getStorage();
    return all.find((i) => i.id === id) || null;
  }

  async getByCodigo(codigo: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<ItemEstoque | null> {
    const all = this.getStorage();
    const norm = codigo.trim().toUpperCase();
    return all.find((i) => i.empresa_id === empresaId && i.codigo.trim().toUpperCase() === norm) || null;
  }

  async create(item: ItemEstoque): Promise<ItemEstoque> {
    const all = this.getStorage();
    const finalItem: ItemEstoque = {
      ...item,
      id: item.id || generateUUID(),
      empresa_id: item.empresa_id || DEFAULT_EMPRESA_ID,
      ativo: item.ativo ?? true,
      saldo: Number(item.saldo) || 0,
      criado_em: item.criado_em || new Date().toISOString(),
    };
    all.push(finalItem);
    this.setStorage(all);
    return finalItem;
  }

  async update(id: string, updates: Partial<ItemEstoque>): Promise<ItemEstoque> {
    const all = this.getStorage();
    const index = all.findIndex((i) => i.id === id);
    if (index === -1) {
      throw new Error(`Item de estoque ID ${id} não encontrado para atualização.`);
    }
    const updated: ItemEstoque = {
      ...all[index],
      ...updates,
      id,
      saldo: updates.saldo !== undefined ? Number(updates.saldo) : all[index].saldo,
    };
    all[index] = updated;
    this.setStorage(all);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const all = this.getStorage();
    const filtered = all.filter((i) => i.id !== id);
    this.setStorage(filtered);
  }

  async saveAll(items: ItemEstoque[]): Promise<void> {
    this.setStorage(items);
  }
}

export class LocalUnidadeEstoqueRepository {
  private getStorage(): UnidadeEstoque[] {
    try {
      const data = localStorage.getItem(UNIDADES_ESTOQUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private setStorage(items: UnidadeEstoque[]): void {
    try {
      localStorage.setItem(UNIDADES_ESTOQUE_KEY, JSON.stringify(items));
    } catch (err) {
      console.warn('Erro ao salvar unidades de estoque localmente:', err);
    }
  }

  async getAll(empresaId: string = DEFAULT_EMPRESA_ID): Promise<UnidadeEstoque[]> {
    const all = this.getStorage();
    return all.filter((u) => !empresaId || u.empresa_id === empresaId);
  }

  async getById(id: string): Promise<UnidadeEstoque | null> {
    const all = this.getStorage();
    return all.find((u) => u.id === id) || null;
  }

  async getByItemId(itemId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<UnidadeEstoque[]> {
    const all = this.getStorage();
    return all.filter((u) => u.item_id === itemId && (!empresaId || u.empresa_id === empresaId));
  }

  async getByEtiqueta(etiqueta: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<UnidadeEstoque | null> {
    const all = this.getStorage();
    const norm = etiqueta.trim().toUpperCase();
    return all.find((u) => u.empresa_id === empresaId && u.etiqueta.trim().toUpperCase() === norm) || null;
  }

  async create(unidade: UnidadeEstoque): Promise<UnidadeEstoque> {
    const all = this.getStorage();
    const finalUnidade: UnidadeEstoque = {
      ...unidade,
      id: unidade.id || generateUUID(),
      empresa_id: unidade.empresa_id || DEFAULT_EMPRESA_ID,
      status: unidade.status || 'disponivel',
      criado_em: unidade.criado_em || new Date().toISOString(),
    };
    all.push(finalUnidade);
    this.setStorage(all);
    return finalUnidade;
  }

  async update(id: string, updates: Partial<UnidadeEstoque>): Promise<UnidadeEstoque> {
    const all = this.getStorage();
    const index = all.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new Error(`Unidade de estoque ID ${id} não encontrada.`);
    }
    const updated: UnidadeEstoque = { ...all[index], ...updates, id };
    all[index] = updated;
    this.setStorage(all);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const all = this.getStorage();
    this.setStorage(all.filter((u) => u.id !== id));
  }

  async saveAll(items: UnidadeEstoque[]): Promise<void> {
    this.setStorage(items);
  }
}

export class LocalMovimentoEstoqueRepository {
  private getStorage(): MovimentoEstoque[] {
    try {
      const data = localStorage.getItem(MOVIMENTOS_ESTOQUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private setStorage(items: MovimentoEstoque[]): void {
    try {
      localStorage.setItem(MOVIMENTOS_ESTOQUE_KEY, JSON.stringify(items));
    } catch (err) {
      console.warn('Erro ao salvar movimentos de estoque localmente:', err);
    }
  }

  async getAll(empresaId: string = DEFAULT_EMPRESA_ID): Promise<MovimentoEstoque[]> {
    const all = this.getStorage();
    return all
      .filter((m) => !empresaId || m.empresa_id === empresaId)
      .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime());
  }

  async getByItemId(itemId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<MovimentoEstoque[]> {
    const all = this.getStorage();
    return all
      .filter((m) => m.item_id === itemId && (!empresaId || m.empresa_id === empresaId))
      .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime());
  }

  async getByProjetoId(projetoId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<MovimentoEstoque[]> {
    const all = this.getStorage();
    return all
      .filter((m) => m.projeto_id === projetoId && (!empresaId || m.empresa_id === empresaId))
      .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime());
  }

  async create(movimento: MovimentoEstoque): Promise<MovimentoEstoque> {
    const all = this.getStorage();
    const finalMovimento: MovimentoEstoque = {
      ...movimento,
      id: movimento.id || generateUUID(),
      empresa_id: movimento.empresa_id || DEFAULT_EMPRESA_ID,
      quantidade: Math.abs(Number(movimento.quantidade)) || 0,
      data_hora: movimento.data_hora || new Date().toISOString(),
    };
    all.push(finalMovimento);
    this.setStorage(all);
    return finalMovimento;
  }

  async saveAll(items: MovimentoEstoque[]): Promise<void> {
    this.setStorage(items);
  }
}

export class LocalReservaEstoqueRepository {
  private getStorage(): ReservaEstoque[] {
    try {
      const data = localStorage.getItem(RESERVAS_ESTOQUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private setStorage(items: ReservaEstoque[]): void {
    try {
      localStorage.setItem(RESERVAS_ESTOQUE_KEY, JSON.stringify(items));
    } catch (err) {
      console.warn('Erro ao salvar reservas de estoque localmente:', err);
    }
  }

  async getAll(empresaId: string = DEFAULT_EMPRESA_ID): Promise<ReservaEstoque[]> {
    const all = this.getStorage();
    return all.filter((r) => !empresaId || r.empresa_id === empresaId);
  }

  async getByItemId(itemId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<ReservaEstoque[]> {
    const all = this.getStorage();
    return all.filter((r) => r.item_id === itemId && (!empresaId || r.empresa_id === empresaId));
  }

  async getByProjetoId(projetoId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<ReservaEstoque[]> {
    const all = this.getStorage();
    return all.filter((r) => r.projeto_id === projetoId && (!empresaId || r.empresa_id === empresaId));
  }

  async create(reserva: ReservaEstoque): Promise<ReservaEstoque> {
    const all = this.getStorage();
    const finalReserva: ReservaEstoque = {
      ...reserva,
      id: reserva.id || generateUUID(),
      empresa_id: reserva.empresa_id || DEFAULT_EMPRESA_ID,
      quantidade: Math.abs(Number(reserva.quantidade)) || 1,
      status: reserva.status || 'ativa',
      criado_em: reserva.criado_em || new Date().toISOString(),
    };
    all.push(finalReserva);
    this.setStorage(all);
    return finalReserva;
  }

  async update(id: string, updates: Partial<ReservaEstoque>): Promise<ReservaEstoque> {
    const all = this.getStorage();
    const index = all.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Reserva ID ${id} não encontrada.`);
    }
    const updated: ReservaEstoque = { ...all[index], ...updates, id };
    all[index] = updated;
    this.setStorage(all);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const all = this.getStorage();
    this.setStorage(all.filter((r) => r.id !== id));
  }

  async saveAll(items: ReservaEstoque[]): Promise<void> {
    this.setStorage(items);
  }
}

// =========================================================================
// 2. REPOSITÓRIOS FIRESTORE (COM SINCRONIZAÇÃO E TRATAMENTO DE ERROS)
// =========================================================================

export class FirestoreItemEstoqueRepository {
  private readonly collectionName = 'itens_estoque';
  private localRepo = new LocalItemEstoqueRepository();

  async getAll(empresaId: string = DEFAULT_EMPRESA_ID): Promise<ItemEstoque[]> {
    try {
      const colRef = collection(db, this.collectionName);
      const q = empresaId ? query(colRef, where('empresa_id', '==', empresaId)) : query(colRef);
      const snapshot = await getDocs(q);
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (!snapshot.empty) {
        const items: ItemEstoque[] = [];
        snapshot.forEach((d) => items.push(d.data() as ItemEstoque));
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

  async getById(id: string): Promise<ItemEstoque | null> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const snapshot = await getDoc(docRef);
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (snapshot.exists()) {
        return snapshot.data() as ItemEstoque;
      }
      return this.localRepo.getById(id);
    } catch (error) {
      syncStatusService.recordError(error, `leitura ${this.collectionName}`);
      return this.localRepo.getById(id);
    }
  }

  async getByCodigo(codigo: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<ItemEstoque | null> {
    const local = await this.localRepo.getByCodigo(codigo, empresaId);
    if (local) return local;
    try {
      const colRef = collection(db, this.collectionName);
      const q = query(
        colRef,
        where('empresa_id', '==', empresaId),
        where('codigo', '==', codigo.trim().toUpperCase())
      );
      const snapshot = await getDocs(q);
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (!snapshot.empty) {
        return snapshot.docs[0].data() as ItemEstoque;
      }
      return null;
    } catch (error) {
      syncStatusService.recordError(error, `leitura ${this.collectionName}`);
      return null;
    }
  }

  async create(item: ItemEstoque): Promise<ItemEstoque> {
    const finalId = item.id || generateUUID();
    const finalItem: ItemEstoque = {
      ...item,
      id: finalId,
      empresa_id: item.empresa_id || DEFAULT_EMPRESA_ID,
      ativo: item.ativo ?? true,
      saldo: Number(item.saldo) || 0,
      criado_em: item.criado_em || new Date().toISOString(),
    };

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

  async update(id: string, updates: Partial<ItemEstoque>): Promise<ItemEstoque> {
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

  async delete(id: string): Promise<void> {
    await this.localRepo.delete(id);
    try {
      const docRef = doc(db, this.collectionName, id);
      await deleteDoc(docRef);
      syncStatusService.recordSuccess(`exclusão ${this.collectionName}`);
    } catch (err) {
      console.error(`[Firestore ${this.collectionName}] Erro ao excluir documento:`, err);
      handleFirestoreError(err, OperationType.DELETE, `${this.collectionName}/${id}`);
      throw err;
    }
  }
}

export class FirestoreUnidadeEstoqueRepository {
  private readonly collectionName = 'unidades_estoque';
  private localRepo = new LocalUnidadeEstoqueRepository();

  async getAll(empresaId: string = DEFAULT_EMPRESA_ID): Promise<UnidadeEstoque[]> {
    try {
      const colRef = collection(db, this.collectionName);
      const q = empresaId ? query(colRef, where('empresa_id', '==', empresaId)) : query(colRef);
      const snapshot = await getDocs(q);
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (!snapshot.empty) {
        const items: UnidadeEstoque[] = [];
        snapshot.forEach((d) => items.push(d.data() as UnidadeEstoque));
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

  async getById(id: string): Promise<UnidadeEstoque | null> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const snapshot = await getDoc(docRef);
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (snapshot.exists()) {
        return snapshot.data() as UnidadeEstoque;
      }
      return this.localRepo.getById(id);
    } catch (error) {
      syncStatusService.recordError(error, `leitura ${this.collectionName}`);
      return this.localRepo.getById(id);
    }
  }

  async getByItemId(itemId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<UnidadeEstoque[]> {
    try {
      const colRef = collection(db, this.collectionName);
      const q = query(
        colRef,
        where('item_id', '==', itemId),
        where('empresa_id', '==', empresaId)
      );
      const snapshot = await getDocs(q);
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (!snapshot.empty) {
        const items: UnidadeEstoque[] = [];
        snapshot.forEach((d) => items.push(d.data() as UnidadeEstoque));
        return items;
      }
      return this.localRepo.getByItemId(itemId, empresaId);
    } catch (error) {
      syncStatusService.recordError(error, `leitura ${this.collectionName}`);
      return this.localRepo.getByItemId(itemId, empresaId);
    }
  }

  async create(unidade: UnidadeEstoque): Promise<UnidadeEstoque> {
    const finalId = unidade.id || generateUUID();
    const finalItem: UnidadeEstoque = {
      ...unidade,
      id: finalId,
      empresa_id: unidade.empresa_id || DEFAULT_EMPRESA_ID,
      status: unidade.status || 'disponivel',
      criado_em: unidade.criado_em || new Date().toISOString(),
    };

    await this.localRepo.create(finalItem);

    try {
      const docRef = doc(db, this.collectionName, finalId);
      await setDoc(docRef, cleanFirestoreData(finalItem));
      syncStatusService.recordSuccess(`gravação ${this.collectionName}`);
      return finalItem;
    } catch (err) {
      console.error(`[Firestore ${this.collectionName}] Erro ao criar unidade:`, err);
      handleFirestoreError(err, OperationType.CREATE, `${this.collectionName}/${finalId}`);
      throw err;
    }
  }

  async update(id: string, updates: Partial<UnidadeEstoque>): Promise<UnidadeEstoque> {
    const updated = await this.localRepo.update(id, updates);
    try {
      const docRef = doc(db, this.collectionName, id);
      await updateDoc(docRef, cleanFirestoreData(updates) as { [key: string]: unknown });
      syncStatusService.recordSuccess(`gravação ${this.collectionName}`);
      return updated;
    } catch (err) {
      console.error(`[Firestore ${this.collectionName}] Erro ao atualizar unidade:`, err);
      handleFirestoreError(err, OperationType.UPDATE, `${this.collectionName}/${id}`);
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    await this.localRepo.delete(id);
    try {
      const docRef = doc(db, this.collectionName, id);
      await deleteDoc(docRef);
      syncStatusService.recordSuccess(`exclusão ${this.collectionName}`);
    } catch (err) {
      console.error(`[Firestore ${this.collectionName}] Erro ao excluir unidade:`, err);
      handleFirestoreError(err, OperationType.DELETE, `${this.collectionName}/${id}`);
      throw err;
    }
  }
}

export class FirestoreMovimentoEstoqueRepository {
  private readonly collectionName = 'movimentos_estoque';
  private localRepo = new LocalMovimentoEstoqueRepository();

  async getAll(empresaId: string = DEFAULT_EMPRESA_ID): Promise<MovimentoEstoque[]> {
    try {
      const colRef = collection(db, this.collectionName);
      const q = empresaId ? query(colRef, where('empresa_id', '==', empresaId)) : query(colRef);
      const snapshot = await getDocs(q);
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (!snapshot.empty) {
        const items: MovimentoEstoque[] = [];
        snapshot.forEach((d) => items.push(d.data() as MovimentoEstoque));
        await this.localRepo.saveAll(items).catch(() => {});
        return items.sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime());
      }
      return this.localRepo.getAll(empresaId);
    } catch (error) {
      syncStatusService.recordError(error, `leitura ${this.collectionName}`);
      console.warn(`[Firestore ${this.collectionName}] Falha ao buscar, usando local:`, error);
      return this.localRepo.getAll(empresaId);
    }
  }

  async getByItemId(itemId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<MovimentoEstoque[]> {
    try {
      const colRef = collection(db, this.collectionName);
      const q = query(
        colRef,
        where('item_id', '==', itemId),
        where('empresa_id', '==', empresaId)
      );
      const snapshot = await getDocs(q);
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (!snapshot.empty) {
        const items: MovimentoEstoque[] = [];
        snapshot.forEach((d) => items.push(d.data() as MovimentoEstoque));
        return items.sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime());
      }
      return this.localRepo.getByItemId(itemId, empresaId);
    } catch (error) {
      syncStatusService.recordError(error, `leitura ${this.collectionName}`);
      return this.localRepo.getByItemId(itemId, empresaId);
    }
  }

  async getByProjetoId(projetoId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<MovimentoEstoque[]> {
    try {
      const colRef = collection(db, this.collectionName);
      const q = query(
        colRef,
        where('projeto_id', '==', projetoId),
        where('empresa_id', '==', empresaId)
      );
      const snapshot = await getDocs(q);
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (!snapshot.empty) {
        const items: MovimentoEstoque[] = [];
        snapshot.forEach((d) => items.push(d.data() as MovimentoEstoque));
        return items.sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime());
      }
      return this.localRepo.getByProjetoId(projetoId, empresaId);
    } catch (error) {
      syncStatusService.recordError(error, `leitura ${this.collectionName}`);
      return this.localRepo.getByProjetoId(projetoId, empresaId);
    }
  }

  // Movimento é estritamente IMUTÁVEL (não há update nem delete)
  async create(movimento: MovimentoEstoque): Promise<MovimentoEstoque> {
    const finalId = movimento.id || generateUUID();
    const finalItem: MovimentoEstoque = {
      ...movimento,
      id: finalId,
      empresa_id: movimento.empresa_id || DEFAULT_EMPRESA_ID,
      quantidade: Math.abs(Number(movimento.quantidade)) || 0,
      data_hora: movimento.data_hora || new Date().toISOString(),
    };

    await this.localRepo.create(finalItem);

    try {
      const docRef = doc(db, this.collectionName, finalId);
      await setDoc(docRef, cleanFirestoreData(finalItem));
      syncStatusService.recordSuccess(`gravação ${this.collectionName}`);
      return finalItem;
    } catch (err) {
      console.error(`[Firestore ${this.collectionName}] Erro ao registrar movimento:`, err);
      handleFirestoreError(err, OperationType.CREATE, `${this.collectionName}/${finalId}`);
      throw err;
    }
  }
}

export class FirestoreReservaEstoqueRepository {
  private readonly collectionName = 'reservas_estoque';
  private localRepo = new LocalReservaEstoqueRepository();

  async getAll(empresaId: string = DEFAULT_EMPRESA_ID): Promise<ReservaEstoque[]> {
    try {
      const colRef = collection(db, this.collectionName);
      const q = empresaId ? query(colRef, where('empresa_id', '==', empresaId)) : query(colRef);
      const snapshot = await getDocs(q);
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (!snapshot.empty) {
        const items: ReservaEstoque[] = [];
        snapshot.forEach((d) => items.push(d.data() as ReservaEstoque));
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

  async getByItemId(itemId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<ReservaEstoque[]> {
    try {
      const colRef = collection(db, this.collectionName);
      const q = query(
        colRef,
        where('item_id', '==', itemId),
        where('empresa_id', '==', empresaId)
      );
      const snapshot = await getDocs(q);
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (!snapshot.empty) {
        const items: ReservaEstoque[] = [];
        snapshot.forEach((d) => items.push(d.data() as ReservaEstoque));
        return items;
      }
      return this.localRepo.getByItemId(itemId, empresaId);
    } catch (error) {
      syncStatusService.recordError(error, `leitura ${this.collectionName}`);
      return this.localRepo.getByItemId(itemId, empresaId);
    }
  }

  async getByProjetoId(projetoId: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<ReservaEstoque[]> {
    try {
      const colRef = collection(db, this.collectionName);
      const q = query(
        colRef,
        where('projeto_id', '==', projetoId),
        where('empresa_id', '==', empresaId)
      );
      const snapshot = await getDocs(q);
      syncStatusService.recordSuccess(`leitura ${this.collectionName}`);
      if (!snapshot.empty) {
        const items: ReservaEstoque[] = [];
        snapshot.forEach((d) => items.push(d.data() as ReservaEstoque));
        return items;
      }
      return this.localRepo.getByProjetoId(projetoId, empresaId);
    } catch (error) {
      syncStatusService.recordError(error, `leitura ${this.collectionName}`);
      return this.localRepo.getByProjetoId(projetoId, empresaId);
    }
  }

  async create(reserva: ReservaEstoque): Promise<ReservaEstoque> {
    const finalId = reserva.id || generateUUID();
    const finalItem: ReservaEstoque = {
      ...reserva,
      id: finalId,
      empresa_id: reserva.empresa_id || DEFAULT_EMPRESA_ID,
      quantidade: Math.abs(Number(reserva.quantidade)) || 1,
      status: reserva.status || 'ativa',
      criado_em: reserva.criado_em || new Date().toISOString(),
    };

    await this.localRepo.create(finalItem);

    try {
      const docRef = doc(db, this.collectionName, finalId);
      await setDoc(docRef, cleanFirestoreData(finalItem));
      syncStatusService.recordSuccess(`gravação ${this.collectionName}`);
      return finalItem;
    } catch (err) {
      console.error(`[Firestore ${this.collectionName}] Erro ao criar reserva:`, err);
      handleFirestoreError(err, OperationType.CREATE, `${this.collectionName}/${finalId}`);
      throw err;
    }
  }

  async update(id: string, updates: Partial<ReservaEstoque>): Promise<ReservaEstoque> {
    const updated = await this.localRepo.update(id, updates);
    try {
      const docRef = doc(db, this.collectionName, id);
      await updateDoc(docRef, cleanFirestoreData(updates) as { [key: string]: unknown });
      syncStatusService.recordSuccess(`gravação ${this.collectionName}`);
      return updated;
    } catch (err) {
      console.error(`[Firestore ${this.collectionName}] Erro ao atualizar reserva:`, err);
      handleFirestoreError(err, OperationType.UPDATE, `${this.collectionName}/${id}`);
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    await this.localRepo.delete(id);
    try {
      const docRef = doc(db, this.collectionName, id);
      await deleteDoc(docRef);
      syncStatusService.recordSuccess(`exclusão ${this.collectionName}`);
    } catch (err) {
      console.error(`[Firestore ${this.collectionName}] Erro ao excluir reserva:`, err);
      handleFirestoreError(err, OperationType.DELETE, `${this.collectionName}/${id}`);
      throw err;
    }
  }
}

// =========================================================================
// 3. EXECUÇÃO TRANSAÇÃO ATÔMICA (SALDO + MOVIMENTO)
// =========================================================================

export interface EstoqueAtomicTransactionParams {
  itemId: string;
  novoSaldo: number;
  novoCustoMedio?: number;
  movimento: MovimentoEstoque;
  unidadeAtualizacao?: {
    unidadeId: string;
    novoStatus: 'disponivel' | 'reservada' | 'consumida' | 'descartada';
  };
  novaUnidade?: UnidadeEstoque;
  empresaId?: string;
}

export async function executeAtomicEstoqueOperation(
  params: EstoqueAtomicTransactionParams
): Promise<void> {
  const empresaId = params.empresaId || DEFAULT_EMPRESA_ID;
  const localItemRepo = new LocalItemEstoqueRepository();
  const localMovimentoRepo = new LocalMovimentoEstoqueRepository();
  const localUnidadeRepo = new LocalUnidadeEstoqueRepository();

  // 1. Atualiza repositório local imediatamente
  await localItemRepo.update(params.itemId, {
    saldo: params.novoSaldo,
    ...(params.novoCustoMedio !== undefined ? { custo_medio: params.novoCustoMedio } : {}),
  });
  await localMovimentoRepo.create(params.movimento);

  if (params.novaUnidade) {
    await localUnidadeRepo.create(params.novaUnidade);
  }

  if (params.unidadeAtualizacao) {
    await localUnidadeRepo.update(params.unidadeAtualizacao.unidadeId, {
      status: params.unidadeAtualizacao.novoStatus,
    });
  }

  // 2. Executa transação atômica no Firestore
  try {
    const itemRef = doc(db, 'itens_estoque', params.itemId);
    const movRef = doc(db, 'movimentos_estoque', params.movimento.id);

    await runTransaction(db, async (transaction) => {
      // Leitura na transação
      const itemSnap = await transaction.get(itemRef);
      if (!itemSnap.exists()) {
        throw new Error(`Item de estoque ${params.itemId} não existe no Firestore.`);
      }

      // Escrita atômica do saldo do item e custo médio móvel
      transaction.update(itemRef, {
        saldo: params.novoSaldo,
        ...(params.novoCustoMedio !== undefined ? { custo_medio: params.novoCustoMedio } : {}),
      });

      // Escrita atômica do movimento imutável
      transaction.set(movRef, cleanFirestoreData({
        ...params.movimento,
        empresa_id: empresaId,
      }));

      // Se houver criação de unidade física
      if (params.novaUnidade) {
        const unidadeRef = doc(db, 'unidades_estoque', params.novaUnidade.id);
        transaction.set(unidadeRef, cleanFirestoreData({
          ...params.novaUnidade,
          empresa_id: empresaId,
        }));
      }

      // Se houver atualização de status de unidade física
      if (params.unidadeAtualizacao) {
        const unidadeRef = doc(db, 'unidades_estoque', params.unidadeAtualizacao.unidadeId);
        transaction.update(unidadeRef, {
          status: params.unidadeAtualizacao.novoStatus,
        });
      }
    });
    syncStatusService.recordSuccess('transação estoque');
  } catch (err: any) {
    console.error('[Firestore runTransaction] Erro na transação atômica de estoque:', err);
    // Se for erro de permissão ou conexão, re-lança para notificar o usuário na UI
    handleFirestoreError(err, OperationType.UPDATE, `itens_estoque/${params.itemId}`);
    throw err;
  }
}

// =========================================================================
// 4. TRANSAÇÃO ATÔMICA DE RECEBIMENTO DE COMPRA (ENTRADA + RESERVA + ITEMCOMPRA)
// =========================================================================

export interface RecebimentoAtomicTransactionParams {
  empresaId?: string;
  itemCompraId: string;
  novoItemEstoque?: ItemEstoque;
  existingItemEstoqueId?: string;
  quantidadeRecebida: number;
  valorUnitarioEntrada?: number;
  novasUnidades: UnidadeEstoque[];
  movimento: MovimentoEstoque;
  novasReservas: ReservaEstoque[];
  dataRecebimento: string;
  notaFiscal?: string;
  registroRecebimento: RecebimentoItemCompraRegistro;
}

export interface RecebimentoAtomicTransactionResult {
  itemCompraAtualizado: ItemCompra;
  itemEstoqueAtualizado: ItemEstoque;
  unidadesCriadas: UnidadeEstoque[];
  movimentoCriado: MovimentoEstoque;
  reservasCriadas: ReservaEstoque[];
}

export async function executeAtomicRecebimentoTransaction(
  params: RecebimentoAtomicTransactionParams
): Promise<RecebimentoAtomicTransactionResult> {
  const empresaId = params.empresaId || DEFAULT_EMPRESA_ID;
  const localItemRepo = new LocalItemEstoqueRepository();
  const localUnidadeRepo = new LocalUnidadeEstoqueRepository();
  const localMovimentoRepo = new LocalMovimentoEstoqueRepository();
  const localReservaRepo = new LocalReservaEstoqueRepository();
  const localItemCompraRepo = new LocalItemCompraRepository();

  let itemCompraAtualizado!: ItemCompra;
  let itemEstoqueAtualizado!: ItemEstoque;

  try {
    await runTransaction(db, async (transaction) => {
      const itemCompraRef = doc(db, 'itens_compra', params.itemCompraId);
      const icSnap = await transaction.get(itemCompraRef);
      if (!icSnap.exists()) {
        throw new Error(
          'Este item de compra ainda não existe no servidor (Firestore). Sincronize na aba Sincronização antes de registrar o recebimento.'
        );
      }

      const targetItemEstoqueId = params.novoItemEstoque
        ? params.novoItemEstoque.id
        : params.existingItemEstoqueId || '';
      if (!targetItemEstoqueId) {
        throw new Error('Item de estoque de destino não informado.');
      }

      const itemEstoqueRef = doc(db, 'itens_estoque', targetItemEstoqueId);
      const itemEstoqueSnap = params.novoItemEstoque ? null : await transaction.get(itemEstoqueRef);

      const icData = icSnap.data() as ItemCompra;
      if (icData.status === 'recebido' || icData.status === 'atendido_estoque' || icData.status === 'cancelado') {
        throw new Error('Este item de compra já foi totalmente recebido, atendido ou cancelado.');
      }

      const qtdTotal = Math.max(0, Number(icData.quantidade) || 0);
      const qtdRecebidaAntes = Number(icData.quantidade_recebida ?? 0) || 0;
      const qtdPendenteAntes =
        icData.quantidade_pendente !== undefined && icData.quantidade_pendente !== null
          ? Math.max(0, Number(icData.quantidade_pendente) || 0)
          : Math.max(0, Number((qtdTotal - qtdRecebidaAntes).toFixed(4)));

      if (qtdPendenteAntes <= 0) {
        throw new Error('Não há quantidade pendente para receber neste item.');
      }

      if (!Number.isFinite(params.quantidadeRecebida) || params.quantidadeRecebida <= 0) {
        throw new Error('A quantidade recebida deve ser maior que zero.');
      }

      if (params.quantidadeRecebida > qtdPendenteAntes + 0.0001) {
        throw new Error(
          `A quantidade recebida (${params.quantidadeRecebida}) excede a quantidade pendente (${qtdPendenteAntes}).`
        );
      }

      // 1. Calcula novo saldo e custo médio móvel do ItemEstoque
      if (params.novoItemEstoque) {
        const custoUnit =
          params.valorUnitarioEntrada !== undefined && params.valorUnitarioEntrada >= 0
            ? Number(params.valorUnitarioEntrada.toFixed(4))
            : params.novoItemEstoque.custo_medio;
        itemEstoqueAtualizado = {
          ...params.novoItemEstoque,
          empresa_id: empresaId,
          saldo: Number(params.quantidadeRecebida.toFixed(4)),
          ...(custoUnit !== undefined ? { custo_medio: custoUnit } : {}),
        };
        transaction.set(itemEstoqueRef, cleanFirestoreData(itemEstoqueAtualizado));
      } else {
        if (!itemEstoqueSnap || !itemEstoqueSnap.exists()) {
          throw new Error(
            'O item de estoque selecionado ainda não existe no servidor. Sincronize antes de receber.'
          );
        }
        const estData = itemEstoqueSnap.data() as ItemEstoque;
        const saldoAtual = Number(estData.saldo) || 0;
        const novoSaldo = Number((saldoAtual + params.quantidadeRecebida).toFixed(4));
        let novoCustoMedio = estData.custo_medio;

        if (params.valorUnitarioEntrada !== undefined && params.valorUnitarioEntrada >= 0) {
          const custoAtual = Number(estData.custo_medio) || 0;
          const baseValor = Math.max(0, saldoAtual) * custoAtual;
          const entradaValor = params.quantidadeRecebida * params.valorUnitarioEntrada;
          novoCustoMedio =
            novoSaldo > 0
              ? Number(((baseValor + entradaValor) / novoSaldo).toFixed(4))
              : Number(params.valorUnitarioEntrada.toFixed(4));
        }

        itemEstoqueAtualizado = {
          ...estData,
          saldo: novoSaldo,
          ...(novoCustoMedio !== undefined ? { custo_medio: novoCustoMedio } : {}),
        };

        transaction.update(
          itemEstoqueRef,
          cleanFirestoreData({
            saldo: novoSaldo,
            ...(novoCustoMedio !== undefined ? { custo_medio: novoCustoMedio } : {}),
          }) as { [key: string]: unknown }
        );
      }

      // 2. Cria unidades físicas (se houver)
      for (const unidade of params.novasUnidades) {
        const uRef = doc(db, 'unidades_estoque', unidade.id);
        transaction.set(
          uRef,
          cleanFirestoreData({
            ...unidade,
            empresa_id: empresaId,
          })
        );
      }

      // 3. Cria movimento imutável de entrada
      const movRef = doc(db, 'movimentos_estoque', params.movimento.id);
      transaction.set(
        movRef,
        cleanFirestoreData({
          ...params.movimento,
          empresa_id: empresaId,
        })
      );

      // 4. Cria reservas (se destinar ao projeto de origem)
      for (const reserva of params.novasReservas) {
        const resRef = doc(db, 'reservas_estoque', reserva.id);
        transaction.set(
          resRef,
          cleanFirestoreData({
            ...reserva,
            empresa_id: empresaId,
          })
        );
      }

      // 5. Atualiza ItemCompra (parcial ou recebido completo)
      const novaQtdRecebida = Number((qtdRecebidaAntes + params.quantidadeRecebida).toFixed(4));
      const novaQtdPendente = Math.max(0, Number((qtdTotal - novaQtdRecebida).toFixed(4)));
      const novoStatus: StatusItemCompra = novaQtdPendente <= 0.0001 ? 'recebido' : 'comprado';

      const movIds = Array.from(
        new Set([
          ...(icData.movimento_entrada_ids ||
            (icData.movimento_entrada_id ? [icData.movimento_entrada_id] : [])),
          params.movimento.id,
        ])
      );
      const etiquetasNovas = params.novasUnidades.map((u) => u.etiqueta);
      const etiquetasCriadas = Array.from(
        new Set([...(icData.etiquetas_criadas || []), ...etiquetasNovas])
      );
      const historicoRecebimentos = [
        ...(icData.historico_recebimentos || []),
        params.registroRecebimento,
      ];

      const icUpdates: Partial<ItemCompra> = {
        status: novoStatus,
        quantidade_recebida: novaQtdRecebida,
        quantidade_pendente: novaQtdPendente <= 0.0001 ? 0 : novaQtdPendente,
        data_recebimento: params.dataRecebimento,
        nota_fiscal: params.notaFiscal?.trim() || icData.nota_fiscal || '',
        item_estoque_id: targetItemEstoqueId,
        movimento_entrada_id: params.movimento.id,
        movimento_entrada_ids: movIds,
        etiquetas_criadas: etiquetasCriadas,
        historico_recebimentos: historicoRecebimentos,
      };

      itemCompraAtualizado = {
        ...icData,
        ...icUpdates,
      };

      transaction.update(
        itemCompraRef,
        cleanFirestoreData(icUpdates) as { [key: string]: unknown }
      );
    });

    // Somente após o commit da transação no Firestore, espelha no armazenamento local
    if (params.novoItemEstoque) {
      const existsLocal = await localItemRepo.getById(itemEstoqueAtualizado.id);
      if (existsLocal) {
        await localItemRepo.update(itemEstoqueAtualizado.id, itemEstoqueAtualizado);
      } else {
        await localItemRepo.create(itemEstoqueAtualizado);
      }
    } else {
      const existsLocal = await localItemRepo.getById(itemEstoqueAtualizado.id);
      if (existsLocal) {
        await localItemRepo.update(itemEstoqueAtualizado.id, {
          saldo: itemEstoqueAtualizado.saldo,
          custo_medio: itemEstoqueAtualizado.custo_medio,
        });
      } else {
        await localItemRepo.create(itemEstoqueAtualizado);
      }
    }

    for (const u of params.novasUnidades) {
      await localUnidadeRepo.create({ ...u, empresa_id: empresaId });
    }
    await localMovimentoRepo.create({ ...params.movimento, empresa_id: empresaId });
    for (const r of params.novasReservas) {
      await localReservaRepo.create({ ...r, empresa_id: empresaId });
    }
    const localIc = await localItemCompraRepo.getById(params.itemCompraId);
    if (localIc) {
      await localItemCompraRepo.update(params.itemCompraId, itemCompraAtualizado);
    }

    syncStatusService.recordSuccess('recebimento atômico no estoque');
    return {
      itemCompraAtualizado,
      itemEstoqueAtualizado,
      unidadesCriadas: params.novasUnidades,
      movimentoCriado: params.movimento,
      reservasCriadas: params.novasReservas,
    };
  } catch (err: any) {
    console.error('[Firestore runTransaction] Erro na transação atômica de recebimento:', err);
    syncStatusService.recordError(err, 'recebimento atômico no estoque');
    throw err;
  }
}

// =========================================================================
// 5. TRANSAÇÃO ATÔMICA DE ESTORNO DE RECEBIMENTO DE COMPRA
// =========================================================================

export interface EstornoRecebimentoTransactionParams {
  empresaId?: string;
  itemCompraId: string;
  estornoMovimentos: Array<{
    itemEstoqueId: string;
    quantidadeEstornada: number;
    movimentoInverso: MovimentoEstoque;
  }>;
  unidadeIdsParaDescartar: string[];
  reservaIdsParaCancelar: string[];
  usuarioNome: string;
  permitirSaldoNegativo?: boolean;
}

export async function executeAtomicEstornoRecebimentoTransaction(
  params: EstornoRecebimentoTransactionParams
): Promise<ItemCompra> {
  const empresaId = params.empresaId || DEFAULT_EMPRESA_ID;
  const localItemRepo = new LocalItemEstoqueRepository();
  const localUnidadeRepo = new LocalUnidadeEstoqueRepository();
  const localMovimentoRepo = new LocalMovimentoEstoqueRepository();
  const localReservaRepo = new LocalReservaEstoqueRepository();
  const localItemCompraRepo = new LocalItemCompraRepository();

  let itemCompraAtualizado!: ItemCompra;
  const itensEstoqueAtualizados: Array<{ id: string; saldo: number }> = [];
  const agoraIso = new Date().toISOString();

  try {
    await runTransaction(db, async (transaction) => {
      const itemCompraRef = doc(db, 'itens_compra', params.itemCompraId);
      const icSnap = await transaction.get(itemCompraRef);
      if (!icSnap.exists()) {
        throw new Error('Item de compra não encontrado no servidor.');
      }

      const icData = icSnap.data() as ItemCompra;
      const qtdRecebidaAtual = Number(
        icData.quantidade_recebida ?? (icData.status === 'recebido' ? icData.quantidade : 0)
      );
      if (qtdRecebidaAtual <= 0 && icData.status !== 'recebido') {
        throw new Error('Este item não possui recebimentos ativos para estornar.');
      }

      // Agrupa redução de saldo por itemEstoqueId
      const deltaPorItem = new Map<string, number>();
      for (const est of params.estornoMovimentos) {
        deltaPorItem.set(
          est.itemEstoqueId,
          (deltaPorItem.get(est.itemEstoqueId) || 0) + est.quantidadeEstornada
        );
      }

      // Leitura de todos os itens de estoque afetados
      const itemSnaps = new Map<string, ItemEstoque>();
      for (const [itemEstId] of deltaPorItem.entries()) {
        const ref = doc(db, 'itens_estoque', itemEstId);
        const snap = await transaction.get(ref);
        if (!snap.exists()) {
          throw new Error('O item de estoque vinculado a este recebimento não foi encontrado no servidor.');
        }
        itemSnaps.set(itemEstId, snap.data() as ItemEstoque);
      }

      // Leitura e validação de todas as unidades físicas criadas pelo recebimento
      const unidadeObsMap = new Map<string, string>();
      for (const uId of params.unidadeIdsParaDescartar) {
        const uRef = doc(db, 'unidades_estoque', uId);
        const uSnap = await transaction.get(uRef);
        if (uSnap.exists()) {
          const uData = uSnap.data() as UnidadeEstoque;
          if (uData.status === 'consumida') {
            throw new Error(
              `Não é possível estornar: a etiqueta ${uData.etiqueta} já foi retirada/consumida pela produção.`
            );
          }
          unidadeObsMap.set(uId, uData.observacoes || '');
        }
      }

      // Leitura e validação de todas as reservas criadas pelo recebimento
      const reservasValidas = new Set<string>();
      for (const rId of params.reservaIdsParaCancelar) {
        const rRef = doc(db, 'reservas_estoque', rId);
        const rSnap = await transaction.get(rRef);
        if (rSnap.exists()) {
          const rData = rSnap.data() as ReservaEstoque;
          if (rData.status === 'consumida') {
            throw new Error(
              'Não é possível estornar: a reserva criada no recebimento já foi consumida pela produção.'
            );
          }
          if (rData.status === 'ativa') {
            reservasValidas.add(rId);
          }
        }
      }

      // Validação de saldo suficiente no estoque
      for (const [itemEstId, qtdEstorno] of deltaPorItem.entries()) {
        const estData = itemSnaps.get(itemEstId)!;
        const saldoAtual = Number(estData.saldo) || 0;
        const novoSaldo = Number((saldoAtual - qtdEstorno).toFixed(4));
        if (!params.permitirSaldoNegativo && novoSaldo < 0) {
          throw new Error(
            `Não é possível estornar: o item "${estData.descricao}" possui saldo atual de ${saldoAtual} ${estData.unidade}, menor que a quantidade a estornar (${qtdEstorno}).`
          );
        }
        itensEstoqueAtualizados.push({ id: itemEstId, saldo: novoSaldo });
      }

      // --- ESCRITAS ATÔMICAS ---
      // 1. Atualiza saldos dos itens de estoque
      for (const itemUpd of itensEstoqueAtualizados) {
        const ref = doc(db, 'itens_estoque', itemUpd.id);
        transaction.update(ref, { saldo: itemUpd.saldo });
      }

      // 2. Cria movimentos inversos (imutáveis)
      for (const est of params.estornoMovimentos) {
        const movRef = doc(db, 'movimentos_estoque', est.movimentoInverso.id);
        transaction.set(
          movRef,
          cleanFirestoreData({
            ...est.movimentoInverso,
            empresa_id: empresaId,
          })
        );
      }

      // 3. Descarta unidades físicas geradas no recebimento
      for (const [uId, obsAtual] of unidadeObsMap.entries()) {
        const uRef = doc(db, 'unidades_estoque', uId);
        const obsEstorno = `[Estorno em ${agoraIso.split('T')[0]} por ${params.usuarioNome}]`;
        transaction.update(uRef, {
          status: 'descartada',
          observacoes: obsAtual ? `${obsAtual} | ${obsEstorno}` : obsEstorno,
        });
      }

      // 4. Cancela reservas geradas no recebimento
      for (const rId of reservasValidas) {
        const rRef = doc(db, 'reservas_estoque', rId);
        transaction.update(rRef, { status: 'cancelada' });
      }

      // 5. Restaura o ItemCompra ao estado anterior
      const statusAnterior: StatusItemCompra = icData.numero_pedido?.trim()
        ? 'comprado'
        : icData.data_solicitacao?.trim()
          ? 'solicitado'
          : 'a_solicitar';

      const estornoMovIds = params.estornoMovimentos.map((e) => e.movimentoInverso.id);
      const historicoAtualizado = (icData.historico_recebimentos || []).map((rec) =>
        rec.estornado
          ? rec
          : {
              ...rec,
              estornado: true,
              estornado_em: agoraIso,
              estornado_por: params.usuarioNome,
              estorno_movimento_ids: estornoMovIds,
            }
      );

      const icRestore: Record<string, any> = {
        status: statusAnterior,
        quantidade_recebida: 0,
        quantidade_pendente: Number(icData.quantidade) || 0,
        data_recebimento: '',
        nota_fiscal: '',
        movimento_entrada_id: null,
        movimento_entrada_ids: [],
        etiquetas_criadas: [],
        historico_recebimentos: historicoAtualizado,
        estornado_em: agoraIso,
        estornado_por: params.usuarioNome,
        estorno_movimento_ids: Array.from(
          new Set([...(icData.estorno_movimento_ids || []), ...estornoMovIds])
        ),
      };

      itemCompraAtualizado = {
        ...icData,
        status: statusAnterior,
        quantidade_recebida: 0,
        quantidade_pendente: Number(icData.quantidade) || 0,
        data_recebimento: undefined,
        nota_fiscal: undefined,
        movimento_entrada_id: undefined,
        movimento_entrada_ids: [],
        etiquetas_criadas: [],
        historico_recebimentos: historicoAtualizado,
        estornado_em: agoraIso,
        estornado_por: params.usuarioNome,
        estorno_movimento_ids: icRestore.estorno_movimento_ids,
      };

      transaction.update(
        itemCompraRef,
        cleanFirestoreData(icRestore) as { [key: string]: unknown }
      );
    });

    // Espelha no armazenamento local somente após sucesso da transação no Firestore
    for (const itemUpd of itensEstoqueAtualizados) {
      await localItemRepo.update(itemUpd.id, { saldo: itemUpd.saldo }).catch(() => {});
    }
    for (const est of params.estornoMovimentos) {
      await localMovimentoRepo.create({ ...est.movimentoInverso, empresa_id: empresaId });
    }
    for (const uId of params.unidadeIdsParaDescartar) {
      await localUnidadeRepo.update(uId, { status: 'descartada' }).catch(() => {});
    }
    for (const rId of params.reservaIdsParaCancelar) {
      await localReservaRepo.update(rId, { status: 'cancelada' }).catch(() => {});
    }
    const localIc = await localItemCompraRepo.getById(params.itemCompraId);
    if (localIc) {
      await localItemCompraRepo.update(params.itemCompraId, {
        status: itemCompraAtualizado.status,
        quantidade_recebida: 0,
        quantidade_pendente: itemCompraAtualizado.quantidade_pendente,
        data_recebimento: undefined,
        nota_fiscal: undefined,
        movimento_entrada_id: undefined,
        movimento_entrada_ids: [],
        etiquetas_criadas: [],
        historico_recebimentos: itemCompraAtualizado.historico_recebimentos,
        estornado_em: agoraIso,
        estornado_por: params.usuarioNome,
        estorno_movimento_ids: itemCompraAtualizado.estorno_movimento_ids,
      });
    }

    syncStatusService.recordSuccess('estorno atômico de recebimento');
    return itemCompraAtualizado;
  } catch (err: any) {
    console.error('[Firestore runTransaction] Erro ao estornar recebimento:', err);
    syncStatusService.recordError(err, 'estorno de recebimento');
    throw err;
  }
}
