import {
  Cliente,
  CentroCusto,
  Maquina,
  Operador,
  Projeto,
  Componente,
  Operacao,
  Apontamento,
  ModeloComponente,
  HistoricoImportacao,
  OperadorCentroCusto,
  ConfiguracoesSistema,
} from '../types';
import { DEFAULT_EMPRESA_ID } from '../utils/uuid';

// Listas de dados de exemplo limpas a pedido do usuário
export const SEED_CLIENTES: Cliente[] = [];
export const SEED_CENTROS_CUSTO: CentroCusto[] = [];
export const SEED_MAQUINAS: Maquina[] = [];
export const SEED_OPERADORES: Operador[] = [];
export const SEED_PROJETOS: Projeto[] = [];
export const SEED_COMPONENTES: Componente[] = [];
export const SEED_OPERACOES: Operacao[] = [];
export const SEED_APONTAMENTOS: Apontamento[] = [];
export const SEED_MODELOS_COMPONENTES: ModeloComponente[] = [];
export const SEED_HISTORICO_IMPORTACOES: HistoricoImportacao[] = [];
export const SEED_OPERADOR_CENTROS_CUSTO: OperadorCentroCusto[] = [];

export const SEED_CONFIGURACOES: ConfiguracoesSistema = {
  id: 'config_padrao',
  empresa_id: DEFAULT_EMPRESA_ID,
  restringir_postos: true, // Ligada por padrão
  liberar_apenas_proxima_operacao: false, // Desligada por padrão
  avisar_operador_material_pendente: true,
  operacoes_sem_material_recebido: 'avisar',
  categorias_isentas_bloqueio_material: ['Programação'],
  permitir_saldo_negativo: false,
  dias_alerta_reserva_parada: 30,
  empresa_nome: 'TOOLSHOP FERRAMENTARIA & USINAGEM LTDA',
  empresa_cnpj: '12.345.678/0001-90',
  empresa_endereco: 'Rua das Indústrias, 1000 - Distrito Industrial - Joinville/SC',
  empresa_telefone: '(47) 3456-7890',
  atualizado_por: 'Sistema ToolShop',
  atualizado_em: '2026-01-01T00:00:00.000Z',
};

// IDs de registros de demonstração para exclusão e purga completa
export const DEMO_SEED_IDS = {
  clientes: [
    'c1000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000003',
  ],
  centros_custo: [
    'm1000000-0000-4000-8000-000000000001',
    'm1000000-0000-4000-8000-000000000002',
    'm1000000-0000-4000-8000-000000000003',
    'm1000000-0000-4000-8000-000000000004',
    'm1000000-0000-4000-8000-000000000005',
    'm1000000-0000-4000-8000-000000000006',
    'm1000000-0000-4000-8000-000000000007',
    'm1000000-0000-4000-8000-000000000008',
  ],
  operadores: [
    'o1000000-0000-4000-8000-000000000001',
    'o1000000-0000-4000-8000-000000000002',
    'o1000000-0000-4000-8000-000000000003',
    'o1000000-0000-4000-8000-000000000004',
  ],
  projetos: [
    'p1000000-0000-4000-8000-000000000001',
    'p1000000-0000-4000-8000-000000000002',
  ],
  componentes: [
    'cmp00000-0000-4000-8000-000000000001',
    'cmp00000-0000-4000-8000-000000000002',
    'cmp00000-0000-4000-8000-000000000003',
    'cmp00000-0000-4000-8000-000000000004',
    'cmp00000-0000-4000-8000-000000000005',
    'cmp00000-0000-4000-8000-000000000006',
  ],
  operacoes: [
    'op100000-0000-4000-8000-000000000001',
    'op100000-0000-4000-8000-000000000002',
    'op100000-0000-4000-8000-000000000003',
    'op100000-0000-4000-8000-000000000004',
    'op100000-0000-4000-8000-000000000005',
    'op100000-0000-4000-8000-000000000006',
    'op100000-0000-4000-8000-000000000007',
    'op100000-0000-4000-8000-000000000008',
    'op100000-0000-4000-8000-000000000009',
    'op100000-0000-4000-8000-000000000010',
    'op100000-0000-4000-8000-000000000011',
    'op100000-0000-4000-8000-000000000012',
    'op100000-0000-4000-8000-000000000013',
    'op100000-0000-4000-8000-000000000014',
    'op100000-0000-4000-8000-000000000015',
  ],
  apontamentos: [
    'apt00000-0000-4000-8000-000000000001',
    'apt00000-0000-4000-8000-000000000002',
    'apt00000-0000-4000-8000-000000000003',
    'apt00000-0000-4000-8000-000000000004',
    'apt00000-0000-4000-8000-000000000005',
    'apt00000-0000-4000-8000-000000000006',
    'apt00000-0000-4000-8000-000000000007',
  ],
  modelos_componentes: [
    'mod00000-0000-4000-8000-000000000001',
    'mod00000-0000-4000-8000-000000000002',
    'mod00000-0000-4000-8000-000000000003',
    'mod00000-0000-4000-8000-000000000004',
  ],
  historico_importacoes: [
    'imp00000-0000-4000-8000-000000000001',
  ],
  operador_centros_custo: [
    'occ00000-0000-4000-8000-000000000001',
    'occ00000-0000-4000-8000-000000000002',
    'occ00000-0000-4000-8000-000000000003',
    'occ00000-0000-4000-8000-000000000004',
    'occ00000-0000-4000-8000-000000000005',
  ],
};

export function isExampleId(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  const clean = id.trim();
  return (
    clean.startsWith('c1000000-') ||
    clean.startsWith('m1000000-') ||
    clean.startsWith('o1000000-') ||
    clean.startsWith('p1000000-') ||
    clean.startsWith('cmp00000-') ||
    clean.startsWith('op100000-') ||
    clean.startsWith('apt00000-') ||
    clean.startsWith('mod00000-') ||
    clean.startsWith('imp00000-') ||
    clean.startsWith('occ00000-') ||
    clean.startsWith('u1000000-') ||
    clean.startsWith('op-') ||
    clean.startsWith('apt-') ||
    clean.startsWith('prj-') ||
    clean.startsWith('cmp-') ||
    /^(o|m|p|c|op|apt|cmp|mod)[0-9]{1,3}$/i.test(clean)
  );
}

export function isExampleItem(item: any): boolean {
  if (!item) return false;
  if (typeof item === 'string') return isExampleId(item);
  if (typeof item !== 'object') return false;

  const id = item.id;
  if (isExampleId(id)) return true;

  // Se tem vínculo com entidade de exemplo
  if (
    isExampleId(item.projeto_id) ||
    isExampleId(item.cliente_id) ||
    isExampleId(item.componente_id) ||
    isExampleId(item.operacao_id) ||
    isExampleId(item.operador_id) ||
    isExampleId(item.centro_custo_id) ||
    isExampleId(item.maquina_id)
  ) {
    return true;
  }

  // Projetos de exemplo
  if (item.codigo === 'PRJ-2026-001' || item.codigo === 'PRJ-2026-002') return true;
  if (typeof item.descricao === 'string' && (item.descricao.includes('Tampa Frontal') || item.descricao.includes('Estampo Progressivo'))) return true;

  // Componentes de exemplo
  if (typeof item.codigo === 'string' && item.codigo.startsWith('MOD-')) return true;
  if (typeof item.nome === 'string' && (item.nome.includes('Placa Cavidade') || item.nome.includes('Macho Inferior') || item.nome.includes('Extratora') || item.nome.includes('Matriz de Corte') || item.nome.includes('Punção de Dobra') || item.nome.includes('Coluna Guia'))) return true;

  // Operações de exemplo
  if (typeof item.descricao === 'string' && (
    item.descricao.includes('Usinagem CNC de Desbaste') ||
    item.descricao.includes('Canais de Refrigeração') ||
    item.descricao.includes('Eletroerosão por Penetração') ||
    item.descricao.includes('Usinagem CNC de Acabamento') ||
    item.descricao.includes('Retífica de Precisão') ||
    item.descricao.includes('Torneamento e Furação') ||
    item.descricao.includes('Desbaste e Furação') ||
    item.descricao.includes('Têmpera e Revenimento') ||
    item.descricao.includes('Niquelação Química') ||
    item.descricao.includes('Polimento Espelhado')
  )) {
    return true;
  }

  // Operadores de exemplo
  if (typeof item.nome === 'string' && (
    item.nome.includes('Carlos Eduardo Silva') ||
    item.nome.includes('Roberto Albuquerque') ||
    item.nome.includes('Marcos Vinicius Santos') ||
    item.nome.includes('Lucas Ferreira')
  )) {
    return true;
  }
  if (typeof item.matricula === 'string' && ['OP-01', 'OP-02', 'OP-03', 'OP-04'].includes(item.matricula)) {
    return true;
  }

  // Centros de Custo de exemplo
  if (typeof item.nome === 'string' && (
    item.nome.includes('Romi D800') ||
    item.nome.includes('Charmilles Roboform') ||
    item.nome.includes('Sulmecânica') ||
    item.nome.includes('Nardini Logic') ||
    item.nome.includes('Kone K30') ||
    item.nome.includes('Têmpera Industrial ABC') ||
    item.nome.includes('GalvanoTech') ||
    item.nome.includes('Lapidação & Polimento Silva')
  )) {
    return true;
  }

  // Clientes de exemplo
  if (typeof item.nome === 'string' && (
    item.nome.includes('Autometal') ||
    item.nome.includes('PlasTech') ||
    item.nome.includes('EletroMec')
  )) {
    return true;
  }

  // Apontamentos de exemplo
  if (item.inicio && typeof item.inicio === 'string' && item.inicio.startsWith('2026-01-10')) return true;
  if (item.projeto && (item.projeto.codigo === 'PRJ-2026-001' || item.projeto.codigo === 'PRJ-2026-002' || isExampleItem(item.projeto))) return true;
  if (item.componente && (isExampleItem(item.componente) || (typeof item.componente.nome === 'string' && (item.componente.nome.includes('Placa') || item.componente.nome.includes('Macho') || item.componente.nome.includes('Extratora'))))) return true;
  if (item.operacao && isExampleItem(item.operacao)) return true;
  if (item.operador && isExampleItem(item.operador)) return true;
  if (item.maquina && isExampleItem(item.maquina)) return true;
  if (item.centro_custo && isExampleItem(item.centro_custo)) return true;
  if (typeof item.motivo_edicao === 'string' && item.motivo_edicao.includes('Operador esqueceu')) return true;

  return false;
}
