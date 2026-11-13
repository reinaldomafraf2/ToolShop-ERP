import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db, auth, cleanFirestoreData } from '../firebase/config';
import { syncStatusService } from './syncStatusService';

export interface CollectionSyncDef {
  id: string;
  label: string;
  storageKey: string;
  firestoreCollection: string;
  isSingleObject?: boolean;
}

export const SYNC_COLLECTIONS: CollectionSyncDef[] = [
  { id: 'clientes', label: 'Clientes Industriais', storageKey: 'toolshop_clientes_v1', firestoreCollection: 'clientes' },
  { id: 'centros_custo', label: 'Centros de Custo / Postos', storageKey: 'toolshop_centros_custo_v1', firestoreCollection: 'centros_custo' },
  { id: 'operadores', label: 'Operadores Fabris', storageKey: 'toolshop_operadores_v1', firestoreCollection: 'operadores' },
  { id: 'projetos', label: 'Projetos e Moldes', storageKey: 'toolshop_projetos_v1', firestoreCollection: 'projetos' },
  { id: 'componentes', label: 'Componentes de Projetos', storageKey: 'toolshop_componentes_v1', firestoreCollection: 'componentes' },
  { id: 'operacoes', label: 'Roteiros de Operações', storageKey: 'toolshop_operacoes_v1', firestoreCollection: 'operacoes' },
  { id: 'apontamentos', label: 'Apontamentos de Horas', storageKey: 'toolshop_apontamentos_v1', firestoreCollection: 'apontamentos' },
  { id: 'usuarios', label: 'Usuários e Acessos', storageKey: 'toolshop_usuarios_v1', firestoreCollection: 'usuarios' },
  { id: 'modelos_componentes', label: 'Biblioteca de Modelos', storageKey: 'toolshop_modelos_v1', firestoreCollection: 'modelos_componentes' },
  { id: 'historico_importacoes', label: 'Histórico de Importações', storageKey: 'toolshop_historico_importacoes_v1', firestoreCollection: 'historico_importacoes' },
  { id: 'operador_centros_custo', label: 'Vínculos Operador-Posto', storageKey: 'toolshop_operador_centros_custo_v1', firestoreCollection: 'operador_centros_custo' },
  { id: 'configuracoes', label: 'Configurações de Chão de Fábrica', storageKey: 'toolshop_configuracoes_v1', firestoreCollection: 'configuracoes', isSingleObject: true },
  { id: 'fornecedores', label: 'Fornecedores e Terceiros', storageKey: 'toolshop_fornecedores', firestoreCollection: 'fornecedores' },
  { id: 'itens_compra', label: 'Necessidades de Compra', storageKey: 'toolshop_itens_compra', firestoreCollection: 'itens_compra' },
  { id: 'itens_estoque', label: 'Itens de Estoque', storageKey: 'toolshop_itens_estoque', firestoreCollection: 'itens_estoque' },
  { id: 'unidades_estoque', label: 'Peças Físicas / Sobras', storageKey: 'toolshop_unidades_estoque', firestoreCollection: 'unidades_estoque' },
  { id: 'movimentos_estoque', label: 'Movimentos de Estoque', storageKey: 'toolshop_movimentos_estoque', firestoreCollection: 'movimentos_estoque' },
  { id: 'reservas_estoque', label: 'Reservas de Estoque', storageKey: 'toolshop_reservas_estoque', firestoreCollection: 'reservas_estoque' },
];

export type ConflictResolution = 'manter_servidor' | 'usar_local';

export interface ConflictItem {
  id: string;
  collectionId: string;
  collectionLabel: string;
  firestoreCollection: string;
  localItem: Record<string, any>;
  serverItem: Record<string, any>;
  localSummary: Record<string, any>;
  serverSummary: Record<string, any>;
  choice?: ConflictResolution;
}

export interface CollectionAnalysis {
  collectionId: string;
  collectionLabel: string;
  firestoreCollection: string;
  totalLocal: number;
  totalServer: number;
  toSendCount: number; // itens que só existem no local
  identicalCount: number; // itens idênticos nos dois lados
  conflictCount: number; // itens com diferenças
  toSendItems: Array<{ id: string; data: Record<string, any> }>;
  conflicts: ConflictItem[];
}

export interface FullAnalysisResult {
  collections: CollectionAnalysis[];
  totalToSend: number;
  totalIdentical: number;
  totalConflicts: number;
  allConflicts: ConflictItem[];
}

export interface SyncBatchProgress {
  currentBatch: number;
  totalBatches: number;
  totalItemsToWrite: number;
  processedItems: number;
  percent: number;
  message: string;
}

export interface SyncItemError {
  id: string;
  collection: string;
  error: string;
}

export interface SyncExecutionResult {
  successCount: number;
  errorCount: number;
  errors: SyncItemError[];
  totalBatches: number;
}

/**
 * Ordena chaves de forma determinística para comparação profunda
 */
function sortObjectKeys(obj: any): any {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  const sorted: Record<string, any> = {};
  Object.keys(obj)
    .sort()
    .forEach((k) => {
      sorted[k] = sortObjectKeys(obj[k]);
    });
  return sorted;
}

export function areRecordsIdentical(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const cleanA = sortObjectKeys(cleanFirestoreData(a));
  const cleanB = sortObjectKeys(cleanFirestoreData(b));
  return JSON.stringify(cleanA) === JSON.stringify(cleanB);
}

export function extractMainFields(colId: string, item: Record<string, any>): Record<string, any> {
  switch (colId) {
    case 'projetos':
      return {
        'Código': item.codigo || '-',
        'Descrição': item.descricao || '-',
        'Status': item.status || '-',
        'Prazo': item.prazo || '-',
        'Atualizado em': item.atualizado_em || item.criado_em || '-',
      };
    case 'componentes':
      return {
        'Código': item.codigo || '-',
        'Nome': item.nome || '-',
        'Tipo': item.tipo || '-',
        'Status': item.status || '-',
        'Qtd': item.quantidade,
        'Data Lista': item.data_lista || '-',
      };
    case 'operacoes':
      return {
        'Seq': item.sequencia,
        'Descrição': item.descricao || '-',
        'Status': item.status || '-',
        'Retorno Previsto': item.retorno_previsto || '-',
      };
    case 'apontamentos':
      return {
        'Início': item.inicio || '-',
        'Fim': item.fim || 'Em andamento',
        'Editado': item.editado_manualmente ? 'Sim' : 'Não',
      };
    case 'usuarios':
      return {
        'Nome': item.nome || '-',
        'Perfil': item.perfil || '-',
        'E-mail/Matrícula': item.email || item.matricula || '-',
        'Ativo': item.ativo ? 'Sim' : 'Não',
        'Último Login': item.ultimo_login || item.criado_em || '-',
      };
    case 'fornecedores':
      return {
        'Nome': item.nome || '-',
        'Contato': item.contato || '-',
        'E-mail': item.email || '-',
        'Ativo': item.ativo !== undefined ? (item.ativo ? 'Sim' : 'Não') : '-',
        'Criado em': item.criado_em || '-',
      };
    case 'itens_compra':
      return {
        'Descrição': item.descricao || '-',
        'Tipo': item.tipo || '-',
        'Status': item.status || '-',
        'Quantidade': `${item.quantidade ?? 0} ${item.unidade || ''}`,
        'Previsão / Data': item.previsao_entrega || item.data_lista || item.criado_em || '-',
      };
    case 'itens_estoque':
      return {
        'Código': item.codigo || '-',
        'Descrição': item.descricao || '-',
        'Categoria': item.categoria || '-',
        'Saldo': `${item.saldo ?? 0} ${item.unidade || ''}`,
        'Criado em': item.criado_em || '-',
      };
    case 'unidades_estoque':
      return {
        'Etiqueta': item.etiqueta || '-',
        'Material': item.material || '-',
        'Status': item.status || '-',
        'Localização': item.localizacao || '-',
        'Criado em': item.criado_em || '-',
      };
    case 'movimentos_estoque':
      return {
        'Tipo': item.tipo || '-',
        'Quantidade': item.quantidade,
        'Motivo': item.motivo || '-',
        'Data/Hora': item.data_hora || '-',
      };
    case 'reservas_estoque':
      return {
        'Quantidade': item.quantidade,
        'Status': item.status || '-',
        'Criado em': item.criado_em || '-',
      };
    case 'clientes':
      return {
        'Nome': item.nome || '-',
        'CNPJ': item.cnpj || '-',
        'Ativo': item.ativo !== undefined ? (item.ativo ? 'Sim' : 'Não') : '-',
        'Criado em': item.criado_em || '-',
      };
    case 'centros_custo':
      return {
        'Nome': item.nome || '-',
        'Código': item.codigo || '-',
        'Origem': item.origem || '-',
        'Ativo': item.ativo !== undefined ? (item.ativo ? 'Sim' : 'Não') : '-',
      };
    case 'operadores':
      return {
        'Nome': item.nome || '-',
        'Matrícula': item.matricula || '-',
        'Turno': item.turno || '-',
        'Ativo': item.ativo !== undefined ? (item.ativo ? 'Sim' : 'Não') : '-',
      };
    case 'configuracoes':
      return {
        'Restringir Postos': item.restringir_postos ? 'Sim' : 'Não',
        'Próx. Operação': item.liberar_apenas_proxima_operacao ? 'Sim' : 'Não',
        'Saldo Negativo': item.permitir_saldo_negativo ? 'Sim' : 'Não',
        'Atualizado em': item.atualizado_em || '-',
      };
    default:
      return {
        'Identificador': item.nome || item.codigo || item.descricao || item.id,
        'Status': item.status || (item.ativo !== undefined ? (item.ativo ? 'Ativo' : 'Inativo') : '-'),
        'Data': item.atualizado_em || item.criado_em || item.data_hora || '-',
      };
  }
}

/**
 * Lê os itens locais a partir de uma chave do localStorage
 */
function readLocalCollectionItems(def: CollectionSyncDef): Record<string, any>[] {
  try {
    const raw = localStorage.getItem(def.storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item && typeof item === 'object' && item.id);
    } else if (parsed && typeof parsed === 'object') {
      const itemWithId = { ...parsed, id: parsed.id || 'config_padrao' };
      return [itemWithId];
    }
    return [];
  } catch (err) {
    console.error(`Erro ao ler itens locais da chave ${def.storageKey}:`, err);
    return [];
  }
}

export class SyncService {
  /**
   * Baixa backup completo em arquivo JSON com todas as chaves 'toolshop_*' do localStorage
   */
  public downloadLocalBackup(): { filename: string; totalKeys: number; totalBytes: number } {
    const backupData: Record<string, any> = {};
    let totalKeys = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('toolshop_')) {
        totalKeys++;
        const raw = localStorage.getItem(key);
        try {
          backupData[key] = raw ? JSON.parse(raw) : null;
        } catch {
          backupData[key] = raw;
        }
      }
    }

    const payload = {
      sistema: 'ToolShop ERP',
      tipo: 'backup_local_storage',
      exportado_em: new Date().toISOString(),
      usuario_atual: auth.currentUser?.email || 'local',
      total_chaves: totalKeys,
      dados: backupData,
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const nowStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `toolshop_backup_navegador_${nowStr}.json`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      filename,
      totalKeys,
      totalBytes: blob.size,
    };
  }

  /**
   * Analisa e compara coleções locais com o Firestore
   */
  public async analyzeDifferences(): Promise<FullAnalysisResult> {
    if (!auth.currentUser) {
      throw new Error('Sessão do Firebase necessária para ler e comparar dados com o servidor.');
    }

    const results: CollectionAnalysis[] = [];
    const allConflicts: ConflictItem[] = [];
    let totalToSend = 0;
    let totalIdentical = 0;
    let totalConflicts = 0;

    for (const def of SYNC_COLLECTIONS) {
      const localItems = readLocalCollectionItems(def);

      // Busca registros correspondentes no Firestore
      const serverMap = new Map<string, Record<string, any>>();
      try {
        const colRef = collection(db, def.firestoreCollection);
        const snapshot = await getDocs(colRef);
        snapshot.forEach((d) => {
          serverMap.set(d.id, { ...d.data(), id: d.id });
        });
        syncStatusService.recordSuccess(`leitura ${def.label}`);
      } catch (err) {
        console.warn(`[Sincronização] Falha ao ler Firestore da coleção ${def.firestoreCollection}:`, err);
        syncStatusService.recordError(err, `leitura ${def.label}`);
        throw new Error(`Falha ao ler dados do servidor na coleção "${def.label}": ${err instanceof Error ? err.message : String(err)}`);
      }

      const toSendItems: Array<{ id: string; data: Record<string, any> }> = [];
      const conflicts: ConflictItem[] = [];
      let identicalCount = 0;

      for (const localItem of localItems) {
        const id = String(localItem.id);
        const serverItem = serverMap.get(id);

        if (!serverItem) {
          // Existe apenas no local: marcar para enviar
          toSendItems.push({ id, data: localItem });
        } else {
          // Existe em ambos
          const isIdentical = areRecordsIdentical(localItem, serverItem);

          if (isIdentical) {
            // Existe nos dois e é idêntico (inclui dados seed idênticos): ignorar
            identicalCount++;
          } else {
            // Existe nos dois e é diferente: CONFLITO
            const conflict: ConflictItem = {
              id,
              collectionId: def.id,
              collectionLabel: def.label,
              firestoreCollection: def.firestoreCollection,
              localItem,
              serverItem,
              localSummary: extractMainFields(def.id, localItem),
              serverSummary: extractMainFields(def.id, serverItem),
            };
            conflicts.push(conflict);
            allConflicts.push(conflict);
          }
        }
      }

      totalToSend += toSendItems.length;
      totalIdentical += identicalCount;
      totalConflicts += conflicts.length;

      results.push({
        collectionId: def.id,
        collectionLabel: def.label,
        firestoreCollection: def.firestoreCollection,
        totalLocal: localItems.length,
        totalServer: serverMap.size,
        toSendCount: toSendItems.length,
        identicalCount,
        conflictCount: conflicts.length,
        toSendItems,
        conflicts,
      });
    }

    return {
      collections: results,
      totalToSend,
      totalIdentical,
      totalConflicts,
      allConflicts,
    };
  }

  /**
   * Executa a gravação dos itens aprovados em lotes de até 400 escritas
   */
  public async executeSync(
    analysis: FullAnalysisResult,
    onProgress: (progress: SyncBatchProgress) => void
  ): Promise<SyncExecutionResult> {
    if (!auth.currentUser) {
      throw new Error('Sessão do Firebase necessária para gravar dados no servidor.');
    }

    // 1. Reúne todos os registros que devem ser gravados no Firestore
    const itemsToWrite: Array<{
      collection: string;
      id: string;
      data: Record<string, any>;
    }> = [];

    // Adiciona os itens que existem apenas no local
    for (const col of analysis.collections) {
      for (const item of col.toSendItems) {
        itemsToWrite.push({
          collection: col.firestoreCollection,
          id: item.id,
          data: item.data,
        });
      }
    }

    // Adiciona os conflitos cuja escolha foi 'usar_local'
    for (const conf of analysis.allConflicts) {
      if (conf.choice === 'usar_local') {
        itemsToWrite.push({
          collection: conf.firestoreCollection,
          id: conf.id,
          data: conf.localItem,
        });
      }
    }

    const totalItems = itemsToWrite.length;
    if (totalItems === 0) {
      return {
        successCount: 0,
        errorCount: 0,
        errors: [],
        totalBatches: 0,
      };
    }

    // Lotes de até 400 escritas conforme especificação
    const BATCH_SIZE = 400;
    const batches: Array<typeof itemsToWrite> = [];
    for (let i = 0; i < totalItems; i += BATCH_SIZE) {
      batches.push(itemsToWrite.slice(i, i + BATCH_SIZE));
    }

    let successCount = 0;
    const errors: SyncItemError[] = [];

    for (let bIndex = 0; bIndex < batches.length; bIndex++) {
      const currentBatch = batches[bIndex];
      const batchNum = bIndex + 1;

      onProgress({
        currentBatch: batchNum,
        totalBatches: batches.length,
        totalItemsToWrite: totalItems,
        processedItems: successCount + errors.length,
        percent: Math.round(((successCount + errors.length) / totalItems) * 100),
        message: `Gravando lote ${batchNum} de ${batches.length} (${currentBatch.length} registros)... Aguardando confirmação do servidor.`,
      });

      try {
        const batch = writeBatch(db);
        for (const item of currentBatch) {
          const docRef = doc(db, item.collection, item.id);
          batch.set(docRef, cleanFirestoreData(item.data));
        }

        // Aguarda a confirmação do servidor antes de avançar
        await batch.commit();
        successCount += currentBatch.length;
        syncStatusService.recordSuccess(`lote ${batchNum}/${batches.length}`);
      } catch (batchErr) {
        console.warn(`[Sincronização] Erro no lote ${batchNum}, tentando salvamento individual para identificar erros pontuais:`, batchErr);
        syncStatusService.recordError(batchErr, `lote ${batchNum}`);

        // Fallback: se o lote falhar como um todo, tenta escrita individual para isolar qual registro falhou
        for (const item of currentBatch) {
          try {
            const singleBatch = writeBatch(db);
            const docRef = doc(db, item.collection, item.id);
            singleBatch.set(docRef, cleanFirestoreData(item.data));
            await singleBatch.commit();
            successCount++;
          } catch (singleErr) {
            const errMsg = singleErr instanceof Error ? singleErr.message : String(singleErr);
            errors.push({
              id: item.id,
              collection: item.collection,
              error: errMsg,
            });
          }
        }
      }

      onProgress({
        currentBatch: batchNum,
        totalBatches: batches.length,
        totalItemsToWrite: totalItems,
        processedItems: successCount + errors.length,
        percent: Math.round(((successCount + errors.length) / totalItems) * 100),
        message: `Lote ${batchNum} concluído.`,
      });
    }

    if (errors.length === 0) {
      syncStatusService.recordSuccess('envio em lotes concluído');
    }

    return {
      successCount,
      errorCount: errors.length,
      errors,
      totalBatches: batches.length,
    };
  }
}

export const syncService = new SyncService();
