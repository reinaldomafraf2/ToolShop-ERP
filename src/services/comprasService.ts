import {
  Fornecedor,
  ItemCompra,
  ItemCompraComDetalhes,
  StatusItemCompra,
  TipoItemCompra,
  ProjetoComDetalhes,
  ComponenteComOperacoes,
} from '../types';
import {
  fornecedorRepository,
  itemCompraRepository,
  FirestoreFornecedorRepository,
  FirestoreItemCompraRepository,
} from '../repositories/comprasRepository';
import { toolShopService } from './toolShopService';
import { normalizeString } from '../utils/excelImport';
import { DEFAULT_EMPRESA_ID } from '../utils/uuid';
import { cleanFirestoreData } from '../firebase/config';

export interface PreviaGeracaoNecessidades {
  projeto: ProjetoComDetalhes;
  novos: {
    tempId: string;
    item: Omit<ItemCompra, 'id' | 'empresa_id'>;
    componenteNome: string;
    componenteCodigo?: string;
    fornecedorNomeOriginal?: string;
    fornecedorIdSugerido?: string;
    fornecedorNomeNaoEncontrado?: string;
  }[];
  existentesCount: number;
  fornecedoresSugeridosParaCriar: string[];
}

export interface SnapshotDesfazer {
  id: string;
  anterior: Partial<ItemCompra>;
}

export class ComprasService {
  constructor(
    private fornecedoresRepo: FirestoreFornecedorRepository = fornecedorRepository,
    private itensCompraRepo: FirestoreItemCompraRepository = itemCompraRepository
  ) {}

  // =========================================================================
  // FORNECEDORES
  // =========================================================================

  async getFornecedores(empresaId: string = DEFAULT_EMPRESA_ID): Promise<Fornecedor[]> {
    const list = await this.fornecedoresRepo.getAll(empresaId);
    return list.sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async getFornecedorById(id: string): Promise<Fornecedor | null> {
    return this.fornecedoresRepo.getById(id);
  }

  async createFornecedor(
    data: Omit<Fornecedor, 'id' | 'empresa_id'>,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<Fornecedor> {
    if (!data.nome || !data.nome.trim()) {
      throw new Error('O nome do fornecedor é obrigatório.');
    }
    return this.fornecedoresRepo.create({
      ...data,
      nome: data.nome.trim(),
      empresa_id: empresaId,
      ativo: data.ativo ?? true,
    });
  }

  async updateFornecedor(id: string, updates: Partial<Fornecedor>): Promise<Fornecedor> {
    if (updates.nome !== undefined && !updates.nome.trim()) {
      throw new Error('O nome do fornecedor não pode ser vazio.');
    }
    return this.fornecedoresRepo.update(id, updates);
  }

  async deactivateFornecedor(id: string): Promise<Fornecedor> {
    return this.fornecedoresRepo.update(id, { ativo: false });
  }

  async deleteFornecedor(id: string, empresaId: string = DEFAULT_EMPRESA_ID): Promise<boolean> {
    // Verifica se algum item de compra já utiliza este fornecedor
    const itensVinculados = await this.itensCompraRepo.getByFornecedorId(id, empresaId);
    if (itensVinculados.length > 0) {
      throw new Error(
        `Este fornecedor possui ${itensVinculados.length} item(ns) de compra vinculado(s) e não pode ser excluído. Você pode desativá-lo para que não apareça em novas seleções.`
      );
    }
    return this.fornecedoresRepo.delete(id);
  }

  // =========================================================================
  // ITENS DE COMPRA
  // =========================================================================

  async getItensCompra(empresaId: string = DEFAULT_EMPRESA_ID): Promise<ItemCompra[]> {
    return this.itensCompraRepo.getAll(empresaId);
  }

  async getItensCompraPorProjeto(
    projetoId: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<ItemCompra[]> {
    return this.itensCompraRepo.getByProjetoId(projetoId, empresaId);
  }

  async getItemCompraById(id: string): Promise<ItemCompra | null> {
    return this.itensCompraRepo.getById(id);
  }

  async getItensCompraComDetalhes(
    empresaId: string = DEFAULT_EMPRESA_ID,
    projetoId?: string
  ): Promise<ItemCompraComDetalhes[]> {
    const [itens, projetos, fornecedores] = await Promise.all([
      projetoId
        ? this.itensCompraRepo.getByProjetoId(projetoId, empresaId)
        : this.itensCompraRepo.getAll(empresaId),
      toolShopService.getProjetosComDetalhes(empresaId),
      this.getFornecedores(empresaId),
    ]);

    const projetosMap = new Map(projetos.map((p) => [p.id, p]));
    const fornecedoresMap = new Map(fornecedores.map((f) => [f.id, f]));

    // Mapa de componentes para lookup rápido
    const componentesMap = new Map<string, any>();
    projetos.forEach((p) => {
      p.componentes.forEach((c) => {
        componentesMap.set(c.id, c);
      });
    });

    const todayStr = new Date().toISOString().split('T')[0];

    return itens.map((item) => {
      const proj = item.projeto_id ? projetosMap.get(item.projeto_id) : undefined;
      const comp = item.componente_id ? componentesMap.get(item.componente_id) : undefined;
      const forn = item.fornecedor_id ? fornecedoresMap.get(item.fornecedor_id) : undefined;

      // Cálculo de atraso: previsão_entrega passada e status diferente de recebido, cancelado ou atendido_estoque
      let atrasado = false;
      let diasAtraso = 0;

      if (
        item.previsao_entrega &&
        item.status !== 'recebido' &&
        item.status !== 'cancelado' &&
        item.status !== 'atendido_estoque'
      ) {
        if (item.previsao_entrega < todayStr) {
          atrasado = true;
          const target = new Date(item.previsao_entrega + 'T00:00:00');
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const diffMs = today.getTime() - target.getTime();
          diasAtraso = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        }
      }

      return {
        ...item,
        projeto: proj,
        componente: comp,
        fornecedor: forn,
        atrasado,
        diasAtraso,
      };
    });
  }

  async createItemCompra(
    data: Omit<ItemCompra, 'id' | 'empresa_id'>,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<ItemCompra> {
    if (!data.descricao || !data.descricao.trim()) {
      throw new Error('A descrição do item de compra é obrigatória.');
    }
    if (!data.projeto_id) {
      throw new Error('O projeto de origem é obrigatório.');
    }
    if (!data.quantidade || data.quantidade <= 0) {
      throw new Error('A quantidade deve ser maior que zero.');
    }

    return this.itensCompraRepo.create(
      cleanFirestoreData({
        ...data,
        empresa_id: empresaId,
        status: data.status || 'a_solicitar',
        criado_em: new Date().toISOString(),
      })
    );
  }

  async updateItemCompra(id: string, updates: Partial<ItemCompra>): Promise<ItemCompra> {
    return this.itensCompraRepo.update(id, updates);
  }

  async deleteItemCompra(id: string): Promise<boolean> {
    return this.itensCompraRepo.delete(id);
  }

  async deleteItensLote(ids: string[]): Promise<number> {
    let count = 0;
    for (const id of ids) {
      await this.itensCompraRepo.delete(id);
      count++;
    }
    return count;
  }

  // =========================================================================
  // AÇÕES EM LOTE E DESFAZER (UNDO)
  // =========================================================================

  async updateStatusLote(
    ids: string[],
    novoStatus: StatusItemCompra,
    extras?: {
      numero_pedido?: string;
      previsao_entrega?: string;
      data_recebimento?: string;
      nota_fiscal?: string;
    }
  ): Promise<SnapshotDesfazer[]> {
    const snapshots: SnapshotDesfazer[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    for (const id of ids) {
      const atual = await this.itensCompraRepo.getById(id);
      if (!atual) continue;

      snapshots.push({
        id,
        anterior: {
          status: atual.status,
          data_solicitacao: atual.data_solicitacao,
          numero_pedido: atual.numero_pedido,
          previsao_entrega: atual.previsao_entrega,
          data_recebimento: atual.data_recebimento,
          nota_fiscal: atual.nota_fiscal,
        },
      });

      const updates: Partial<ItemCompra> = {
        status: novoStatus,
      };

      if (novoStatus === 'solicitado') {
        updates.data_solicitacao = todayStr;
      } else if (novoStatus === 'comprado') {
        if (extras?.numero_pedido) updates.numero_pedido = extras.numero_pedido;
        if (extras?.previsao_entrega) updates.previsao_entrega = extras.previsao_entrega;
      } else if (novoStatus === 'recebido') {
        updates.data_recebimento = extras?.data_recebimento || todayStr;
        if (extras?.nota_fiscal) updates.nota_fiscal = extras.nota_fiscal;
      }

      await this.itensCompraRepo.update(id, updates);
    }

    return snapshots;
  }

  async alterarFornecedorLote(ids: string[], fornecedorId: string | undefined): Promise<SnapshotDesfazer[]> {
    const snapshots: SnapshotDesfazer[] = [];

    for (const id of ids) {
      const atual = await this.itensCompraRepo.getById(id);
      if (!atual) continue;

      snapshots.push({
        id,
        anterior: {
          fornecedor_id: atual.fornecedor_id,
        },
      });

      await this.itensCompraRepo.update(id, {
        fornecedor_id: fornecedorId || undefined,
      });
    }

    return snapshots;
  }

  async desfazerAlteracaoLote(snapshots: SnapshotDesfazer[]): Promise<void> {
    for (const snap of snapshots) {
      await this.itensCompraRepo.update(snap.id, snap.anterior);
    }
  }

  // =========================================================================
  // GERAÇÃO AUTOMÁTICA DE NECESSIDADES DE COMPRA (IDEMPOTENTE)
  // =========================================================================

  async gerarPreviaNecessidadesCompra(
    projetoId: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<PreviaGeracaoNecessidades> {
    const [projetos, itensExistentes, fornecedores] = await Promise.all([
      toolShopService.getProjetosComDetalhes(empresaId),
      this.itensCompraRepo.getByProjetoId(projetoId, empresaId),
      this.getFornecedores(empresaId),
    ]);

    const projeto = projetos.find((p) => p.id === projetoId);
    if (!projeto) {
      throw new Error(`Projeto ${projetoId} não encontrado.`);
    }

    // Chave de idempotência: componente_id + tipo
    const chavesExistentes = new Set(
      itensExistentes.map((i) => `${i.componente_id}:${i.tipo}`)
    );

    // Mapa normalizado de fornecedores existentes
    const fornecedoresNormMap = new Map<string, Fornecedor>();
    fornecedores.forEach((f) => {
      fornecedoresNormMap.set(normalizeString(f.nome), f);
    });

    const novos: PreviaGeracaoNecessidades['novos'] = [];
    const fornecedoresSugeridosSet = new Set<string>();

    for (const comp of projeto.componentes) {
      const tipoComp = comp.tipo || 'fabricado';

      if (tipoComp === 'fabricado') {
        if (!comp.material || !comp.material.trim()) continue;

        const chave = `${comp.id}:materia_prima`;
        if (chavesExistentes.has(chave)) continue;

        // Monta especificação técnica completa: Material + Formato + Dimensões
        const partesSpec: string[] = [comp.material.trim()];
        if (comp.formato) partesSpec.push(comp.formato.trim());
        if (comp.dimensoes) partesSpec.push(comp.dimensoes.trim());
        const especificacao = partesSpec.join(' - ');

        // Busca fornecedor
        const nomeFornOriginal = comp.fornecedor_material || (comp as any).fornecedor;
        let fornecedorIdSugerido: string | undefined = undefined;
        let fornecedorNomeNaoEncontrado: string | undefined = undefined;

        if (nomeFornOriginal && nomeFornOriginal.trim()) {
          const norm = normalizeString(nomeFornOriginal);
          const encontrado = fornecedoresNormMap.get(norm);
          if (encontrado) {
            fornecedorIdSugerido = encontrado.id;
          } else {
            fornecedorNomeNaoEncontrado = nomeFornOriginal.trim();
            fornecedoresSugeridosSet.add(nomeFornOriginal.trim());
          }
        }

        const itemMP: Omit<ItemCompra, 'id' | 'empresa_id'> = {
          projeto_id: projeto.id,
          componente_id: comp.id,
          tipo: 'materia_prima',
          descricao: `Matéria-prima: ${comp.nome}`,
          especificacao,
          quantidade: comp.quantidade || 1,
          unidade: 'un',
          status: 'a_solicitar',
          criado_em: new Date().toISOString(),
        };
        if (comp.peso_kg !== undefined && comp.peso_kg !== null && !isNaN(Number(comp.peso_kg))) {
          itemMP.peso_kg = Number(comp.peso_kg);
        }
        if (fornecedorIdSugerido) {
          itemMP.fornecedor_id = fornecedorIdSugerido;
        }
        if (comp.num_lista) {
          itemMP.numero_lista = comp.num_lista;
        }
        if (comp.data_lista || projeto.prazo) {
          itemMP.data_lista = comp.data_lista || projeto.prazo;
        }

        novos.push({
          tempId: `tmp_${comp.id}_mp`,
          item: itemMP,
          componenteNome: comp.nome,
          componenteCodigo: comp.codigo,
          fornecedorNomeOriginal: nomeFornOriginal,
          fornecedorIdSugerido,
          fornecedorNomeNaoEncontrado,
        });
      } else if (tipoComp === 'comprado') {
        const chave = `${comp.id}:item_comercial`;
        if (chavesExistentes.has(chave)) continue;

        const nomeFornOriginal = comp.fornecedor_material || (comp as any).fornecedor;
        let fornecedorIdSugerido: string | undefined = undefined;
        let fornecedorNomeNaoEncontrado: string | undefined = undefined;

        if (nomeFornOriginal && nomeFornOriginal.trim()) {
          const norm = normalizeString(nomeFornOriginal);
          const encontrado = fornecedoresNormMap.get(norm);
          if (encontrado) {
            fornecedorIdSugerido = encontrado.id;
          } else {
            fornecedorNomeNaoEncontrado = nomeFornOriginal.trim();
            fornecedoresSugeridosSet.add(nomeFornOriginal.trim());
          }
        }

        const itemComercial: Omit<ItemCompra, 'id' | 'empresa_id'> = {
          projeto_id: projeto.id,
          componente_id: comp.id,
          tipo: 'item_comercial',
          descricao: `Item comercial: ${comp.nome}`,
          especificacao: comp.material || comp.nome,
          quantidade: comp.quantidade || 1,
          unidade: 'pç',
          status: 'a_solicitar',
          criado_em: new Date().toISOString(),
        };
        if (fornecedorIdSugerido) {
          itemComercial.fornecedor_id = fornecedorIdSugerido;
        }
        if (comp.num_lista) {
          itemComercial.numero_lista = comp.num_lista;
        }
        if (comp.data_lista || projeto.prazo) {
          itemComercial.data_lista = comp.data_lista || projeto.prazo;
        }

        novos.push({
          tempId: `tmp_${comp.id}_comercial`,
          item: itemComercial,
          componenteNome: comp.nome,
          componenteCodigo: comp.codigo,
          fornecedorNomeOriginal: nomeFornOriginal,
          fornecedorIdSugerido,
          fornecedorNomeNaoEncontrado,
        });
      } else if (tipoComp === 'estoque') {
        const chave = `${comp.id}:item_comercial`;
        if (chavesExistentes.has(chave)) continue;

        const itemEstoque: Omit<ItemCompra, 'id' | 'empresa_id'> = {
          projeto_id: projeto.id,
          componente_id: comp.id,
          tipo: 'item_comercial',
          descricao: `Atendido em estoque: ${comp.nome}`,
          especificacao: comp.material || comp.nome,
          quantidade: comp.quantidade || 1,
          unidade: 'pç',
          status: 'atendido_estoque',
          criado_em: new Date().toISOString(),
        };
        if (comp.num_lista) {
          itemEstoque.numero_lista = comp.num_lista;
        }
        if (comp.data_lista || projeto.prazo) {
          itemEstoque.data_lista = comp.data_lista || projeto.prazo;
        }

        novos.push({
          tempId: `tmp_${comp.id}_estoque`,
          item: itemEstoque,
          componenteNome: comp.nome,
          componenteCodigo: comp.codigo,
        });
      }
    }

    return {
      projeto,
      novos,
      existentesCount: chavesExistentes.size,
      fornecedoresSugeridosParaCriar: Array.from(fornecedoresSugeridosSet),
    };
  }

  async confirmarGeracaoNecessidades(
    itensConfirmados: Omit<ItemCompra, 'id' | 'empresa_id'>[],
    novosFornecedoresParaCadastrar: string[] = [],
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<ItemCompra[]> {
    // 1. Cadastra fornecedores novos solicitados
    const fornecedorMap = new Map<string, string>();
    for (const nomeForn of novosFornecedoresParaCadastrar) {
      try {
        const criado = await this.createFornecedor({ nome: nomeForn.trim(), ativo: true }, empresaId);
        fornecedorMap.set(normalizeString(nomeForn), criado.id);
      } catch (err) {
        console.warn('Erro ao criar fornecedor sugerido:', err);
      }
    }

    // 2. Grava os itens com limpeza estrita de undefined
    const gravados: ItemCompra[] = [];
    for (const it of itensConfirmados) {
      let fId = it.fornecedor_id;
      if (!fId && (it as any).fornecedorNomeOriginal) {
        const norm = normalizeString((it as any).fornecedorNomeOriginal);
        if (fornecedorMap.has(norm)) {
          fId = fornecedorMap.get(norm);
        }
      }

      const itemPayload = cleanFirestoreData({
        ...it,
        fornecedor_id: fId || undefined,
      });

      const itemCriado = await this.createItemCompra(
        itemPayload,
        empresaId
      );
      gravados.push(itemCriado);
    }

    return gravados;
  }

  // =========================================================================
  // INTEGRAÇÃO COM PRODUÇÃO E STATUS DE MATERIAIS
  // =========================================================================

  async getMapStatusMaterialComponentes(
    projetoId: string,
    empresaId: string = DEFAULT_EMPRESA_ID
  ): Promise<Map<string, { status: StatusItemCompra; atrasado: boolean; item: ItemCompra }>> {
    const itens = await this.itensCompraRepo.getByProjetoId(projetoId, empresaId);
    const map = new Map<string, { status: StatusItemCompra; atrasado: boolean; item: ItemCompra }>();
    const todayStr = new Date().toISOString().split('T')[0];

    for (const item of itens) {
      const atrasado = Boolean(
        item.previsao_entrega &&
        item.status !== 'recebido' &&
        item.status !== 'cancelado' &&
        item.status !== 'atendido_estoque' &&
        item.previsao_entrega < todayStr
      );

      // Peças fabricadas priorizam matéria-prima
      if (item.componente_id) {
        if (item.tipo === 'materia_prima' || !map.has(item.componente_id)) {
          map.set(item.componente_id, {
            status: item.status,
            atrasado,
            item,
          });
        }
      }
    }

    return map;
  }

  async getResumoComprasPainel(empresaId: string = DEFAULT_EMPRESA_ID) {
    const itensComDetalhes = await this.getItensCompraComDetalhes(empresaId);

    const total = itensComDetalhes.length;
    const a_solicitar = itensComDetalhes.filter((i) => i.status === 'a_solicitar').length;
    const solicitados = itensComDetalhes.filter((i) => i.status === 'solicitado').length;
    const comprados = itensComDetalhes.filter((i) => i.status === 'comprado').length;
    const recebidos = itensComDetalhes.filter((i) => i.status === 'recebido' || i.status === 'atendido_estoque').length;
    const atrasados = itensComDetalhes.filter((i) => i.atrasado);

    // Peças aguardando material (fabricadas com operações e sem matéria-prima recebida)
    const pecasAguardandoMaterial: {
      componente: ComponenteComOperacoes;
      projeto: ProjetoComDetalhes;
      statusMaterial: StatusItemCompra | 'pendente_geracao';
    }[] = [];

    const projetos = await toolShopService.getProjetosComDetalhes(empresaId);
    const mpPorComponente = new Map<string, ItemCompra>();
    itensComDetalhes.forEach((it) => {
      if (it.tipo === 'materia_prima' && it.componente_id) {
        mpPorComponente.set(it.componente_id, it);
      }
    });

    for (const proj of projetos) {
      if (proj.status === 'Concluído' || proj.status === 'Cancelado') continue;
      for (const comp of proj.componentes) {
        if (comp.tipo && comp.tipo !== 'fabricado') continue;
        if (comp.operacoes.length === 0) continue;

        const mp = mpPorComponente.get(comp.id);
        if (!mp) {
          pecasAguardandoMaterial.push({
            componente: comp,
            projeto: proj,
            statusMaterial: 'pendente_geracao',
          });
        } else if (mp.status !== 'recebido' && mp.status !== 'atendido_estoque') {
          pecasAguardandoMaterial.push({
            componente: comp,
            projeto: proj,
            statusMaterial: mp.status,
          });
        }
      }
    }

    return {
      total,
      a_solicitar,
      solicitados,
      comprados,
      recebidos,
      atrasados,
      pecasAguardandoMaterial,
    };
  }
}

export const comprasService = new ComprasService();
