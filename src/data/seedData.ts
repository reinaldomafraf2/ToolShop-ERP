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
} from '../types';
import { DEFAULT_EMPRESA_ID } from '../utils/uuid';

export const SEED_CLIENTES: Cliente[] = [
  {
    id: 'c1000000-0000-4000-8000-000000000001',
    empresa_id: DEFAULT_EMPRESA_ID,
    nome: 'Autometal Indústria Automotiva Ltda',
    contato: 'Eng. Marcos Ramos · marcos@autometal.ind.br · (11) 98765-4321',
  },
  {
    id: 'c1000000-0000-4000-8000-000000000002',
    empresa_id: DEFAULT_EMPRESA_ID,
    nome: 'PlasTech Soluções em Injeção Plástica',
    contato: 'Fernando Silveira · fernando@plastechmoldes.com.br · (19) 99123-4567',
  },
  {
    id: 'c1000000-0000-4000-8000-000000000003',
    empresa_id: DEFAULT_EMPRESA_ID,
    nome: 'EletroMec Dispositivos Industriais S/A',
    contato: 'Dra. Juliana Prado · compras@eletromec.com.br · (41) 98456-7890',
  },
];

export const SEED_CENTROS_CUSTO: CentroCusto[] = [
  // --- POSTOS DE TRABALHO INTERNOS ---
  {
    id: 'm1000000-0000-4000-8000-000000000001',
    empresa_id: DEFAULT_EMPRESA_ID,
    nome: 'Centro de Usinagem CNC Romi D800 (Vertical)',
    origem: 'interno',
    categoria: 'CNC',
    modelo_custo: 'hora',
    valor_unitario: 195.0,
    custo_hora: 195.0,
    tipo: 'CNC',
    ativo: true,
    observacoes: 'Centro vertical 3 eixos para moldes de médio porte.',
  },
  {
    id: 'm1000000-0000-4000-8000-000000000002',
    empresa_id: DEFAULT_EMPRESA_ID,
    nome: 'Eletroerosão por Penetração Charmilles Roboform 35',
    origem: 'interno',
    categoria: 'Eletroerosão',
    modelo_custo: 'hora',
    valor_unitario: 165.0,
    custo_hora: 165.0,
    tipo: 'Eletroerosão',
    ativo: true,
    observacoes: 'Usinagem de cavidades profundas, nervuras e detalhes sem saída.',
  },
  {
    id: 'm1000000-0000-4000-8000-000000000003',
    empresa_id: DEFAULT_EMPRESA_ID,
    nome: 'Retífica Plana Sulmecânica 1000 x 400',
    origem: 'interno',
    categoria: 'Retífica',
    modelo_custo: 'hora',
    valor_unitario: 95.0,
    custo_hora: 95.0,
    tipo: 'Retífica',
    ativo: true,
    observacoes: 'Retífica tangencial de placas e faces de partição.',
  },
  {
    id: 'm1000000-0000-4000-8000-000000000004',
    empresa_id: DEFAULT_EMPRESA_ID,
    nome: 'Torno CNC Nardini Logic 195',
    origem: 'interno',
    categoria: 'Torno',
    modelo_custo: 'hora',
    valor_unitario: 135.0,
    custo_hora: 135.0,
    tipo: 'Torno',
    ativo: true,
    observacoes: 'Torneamento de buchas, colunas, machos cilíndricos e postiços.',
  },
  {
    id: 'm1000000-0000-4000-8000-000000000005',
    empresa_id: DEFAULT_EMPRESA_ID,
    nome: 'Fresadora Ferramenteira Universal Kone K30',
    origem: 'interno',
    categoria: 'Fresa',
    modelo_custo: 'hora',
    valor_unitario: 85.0,
    custo_hora: 85.0,
    tipo: 'Fresa',
    ativo: true,
    observacoes: 'Desbastes iniciais, esquadrejamento de blocos e furações rápidas.',
  },

  // --- SERVIÇOS E PROCESSOS TERCEIRIZADOS ---
  {
    id: 'm1000000-0000-4000-8000-000000000006',
    empresa_id: DEFAULT_EMPRESA_ID,
    nome: 'Têmpera e Revenimento',
    origem: 'terceirizado',
    categoria: 'Tratamento térmico',
    modelo_custo: 'kg',
    valor_unitario: 18.5,
    custo_hora: 18.5,
    tipo: 'Tratamento térmico',
    fornecedor_nome: 'Têmpera Industrial ABC',
    fornecedor_contato: '(11) 98765-4321 · contato@temperaabc.com.br',
    prazo_padrao_dias: 3,
    ativo: true,
    observacoes: 'Tratamento térmico sob atmosfera controlada com laudo de dureza Rockwell C.',
  },
  {
    id: 'm1000000-0000-4000-8000-000000000007',
    empresa_id: DEFAULT_EMPRESA_ID,
    nome: 'Niquelação Química',
    origem: 'terceirizado',
    categoria: 'Tratamento superficial',
    modelo_custo: 'peca',
    valor_unitario: 35.0,
    custo_hora: 35.0,
    tipo: 'Tratamento superficial',
    fornecedor_nome: 'GalvanoTech Revestimentos',
    fornecedor_contato: '(19) 3888-1200 · vendas@galvanotech.com.br',
    prazo_padrao_dias: 5,
    ativo: true,
    observacoes: 'Camada protetiva uniforme de níquel químico alto fósforo para postiços.',
  },
  {
    id: 'm1000000-0000-4000-8000-000000000008',
    empresa_id: DEFAULT_EMPRESA_ID,
    nome: 'Polimento',
    origem: 'terceirizado',
    categoria: 'Polimento',
    modelo_custo: 'hora',
    valor_unitario: 85.0,
    custo_hora: 85.0,
    tipo: 'Polimento',
    fornecedor_nome: 'Lapidação & Polimento Silva',
    fornecedor_contato: '(11) 91234-5678 · silva.polimento@gmail.com',
    prazo_padrao_dias: 2,
    ativo: true,
    observacoes: 'Polimento espelhado para cavidades ópticas e acabamentos espelhados SPI-A2.',
  },
];

export const SEED_MAQUINAS: Maquina[] = SEED_CENTROS_CUSTO;

export const SEED_OPERADORES: Operador[] = [
  {
    id: 'o1000000-0000-4000-8000-000000000001',
    empresa_id: DEFAULT_EMPRESA_ID,
    nome: 'Carlos Eduardo Silva',
  },
  {
    id: 'o1000000-0000-4000-8000-000000000002',
    empresa_id: DEFAULT_EMPRESA_ID,
    nome: 'Roberto Albuquerque',
  },
  {
    id: 'o1000000-0000-4000-8000-000000000003',
    empresa_id: DEFAULT_EMPRESA_ID,
    nome: 'Marcos Vinicius Santos',
  },
  {
    id: 'o1000000-0000-4000-8000-000000000004',
    empresa_id: DEFAULT_EMPRESA_ID,
    nome: 'Lucas Ferreira',
  },
];

// Projeto 1: Molde de Injeção
export const SEED_PROJETOS: Projeto[] = [
  {
    id: 'p1000000-0000-4000-8000-000000000001',
    empresa_id: DEFAULT_EMPRESA_ID,
    cliente_id: 'c1000000-0000-4000-8000-000000000001', // Autometal
    codigo: 'PRJ-2026-001',
    descricao: 'Molde de Injeção Plástica 4 Cavidades - Tampa Frontal do Painel Automotivo',
    prazo: '2026-11-28',
    status: 'Em andamento',
  },
  {
    id: 'p1000000-0000-4000-8000-000000000002',
    empresa_id: DEFAULT_EMPRESA_ID,
    cliente_id: 'c1000000-0000-4000-8000-000000000003', // EletroMec
    codigo: 'PRJ-2026-002',
    descricao: 'Estampo Progressivo de Corte e Dobra - Suporte Metálico de Fixação',
    prazo: '2026-11-20',
    status: 'Em tryout',
  },
];

export const SEED_COMPONENTES: Componente[] = [
  // Componentes do Projeto 1 (Molde de Injeção)
  {
    id: 'cmp00000-0000-4000-8000-000000000001',
    empresa_id: DEFAULT_EMPRESA_ID,
    projeto_id: 'p1000000-0000-4000-8000-000000000001',
    codigo: 'MOD-PLACA-SUP',
    nome: 'Placa Cavidade Superior',
    quantidade: 1,
    material: 'Aço P20 Beneficiado (WNr 1.2311)',
    observacoes: 'Usinagem de canais de água com vedação NBR',
    status: 'Em produção',
    modelo_origem_id: 'mod00000-0000-4000-8000-000000000001',
  },
  {
    id: 'cmp00000-0000-4000-8000-000000000002',
    empresa_id: DEFAULT_EMPRESA_ID,
    projeto_id: 'p1000000-0000-4000-8000-000000000001',
    codigo: 'MOD-MACHO-POST',
    nome: 'Macho Inferior Postiçado',
    quantidade: 4,
    material: 'Aço H13 Temperado e Revenido',
    observacoes: 'Postiços intercambiáveis para 4 cavidades',
    status: 'Em produção',
    modelo_origem_id: 'mod00000-0000-4000-8000-000000000002',
  },
  {
    id: 'cmp00000-0000-4000-8000-000000000003',
    empresa_id: DEFAULT_EMPRESA_ID,
    projeto_id: 'p1000000-0000-4000-8000-000000000001',
    codigo: 'MOD-EXTRATORA',
    nome: 'Conjunto Placa Extratora & Guias',
    quantidade: 1,
    material: 'Aço SAE 1045 Laminado',
    observacoes: 'Furos alargados para buchas guia de precisão',
    status: 'Pendente',
  },

  // Componentes do Projeto 2 (Estampo Progressivo)
  {
    id: 'cmp00000-0000-4000-8000-000000000004',
    empresa_id: DEFAULT_EMPRESA_ID,
    projeto_id: 'p1000000-0000-4000-8000-000000000002',
    codigo: 'MOD-MATRIZ-CORTE',
    nome: 'Matriz de Corte Temperada',
    quantidade: 1,
    material: 'Aço VC131 (Aço D2 alta liga)',
    observacoes: 'Têmpera a vácuo com alívio triplo (60 HRC)',
    status: 'Concluído',
    modelo_origem_id: 'mod00000-0000-4000-8000-000000000003',
  },
  {
    id: 'cmp00000-0000-4000-8000-000000000005',
    empresa_id: DEFAULT_EMPRESA_ID,
    projeto_id: 'p1000000-0000-4000-8000-000000000002',
    codigo: 'MOD-PUNCAO-DOBRA',
    nome: 'Punção de Conformação e Dobra',
    quantidade: 2,
    material: 'Aço Ferramenta VND',
    observacoes: 'Polimento espelhado nos raios de dobra',
    status: 'Concluído',
    modelo_origem_id: 'mod00000-0000-4000-8000-000000000004',
  },
  {
    id: 'cmp00000-0000-4000-8000-000000000006',
    empresa_id: DEFAULT_EMPRESA_ID,
    projeto_id: 'p1000000-0000-4000-8000-000000000002',
    codigo: 'MOD-BASE-PADRAO',
    nome: 'Base Inferior Padronizada',
    quantidade: 1,
    material: 'Aço SAE 1020',
    observacoes: 'Furos de fixação com roscas M16',
    status: 'Concluído',
  },
];

export const SEED_OPERACOES: Operacao[] = [
  // Operações - Componente 1 (Placa Cavidade Superior)
  {
    id: 'op000000-0000-4000-8000-000000000001',
    empresa_id: DEFAULT_EMPRESA_ID,
    componente_id: 'cmp00000-0000-4000-8000-000000000001',
    centro_custo_id: 'm1000000-0000-4000-8000-000000000005', // Fresa Kone
    maquina_id: 'm1000000-0000-4000-8000-000000000005',
    sequencia: 10,
    descricao: 'Desbaste e esquadrejamento de faces e canais de refrigeração',
    horas_estimadas: 5.0,
    status: 'Concluída',
  },
  {
    id: 'op000000-0000-4000-8000-000000000002',
    empresa_id: DEFAULT_EMPRESA_ID,
    componente_id: 'cmp00000-0000-4000-8000-000000000001',
    centro_custo_id: 'm1000000-0000-4000-8000-000000000001', // Centro CNC Romi
    maquina_id: 'm1000000-0000-4000-8000-000000000001',
    sequencia: 20,
    descricao: 'Usinagem CNC de alta velocidade das 4 cavidades 3D',
    horas_estimadas: 16.0,
    status: 'Em andamento',
  },
  {
    id: 'op000000-0000-4000-8000-000000000003',
    empresa_id: DEFAULT_EMPRESA_ID,
    componente_id: 'cmp00000-0000-4000-8000-000000000001',
    centro_custo_id: 'm1000000-0000-4000-8000-000000000002', // Eletroerosão
    maquina_id: 'm1000000-0000-4000-8000-000000000002',
    sequencia: 30,
    descricao: 'Eletroerosão por penetração de nervuras e cantos vivos',
    horas_estimadas: 7.0,
    status: 'Pendente',
  },
  {
    id: 'op000000-0000-4000-8000-000000000004',
    empresa_id: DEFAULT_EMPRESA_ID,
    componente_id: 'cmp00000-0000-4000-8000-000000000001',
    centro_custo_id: 'm1000000-0000-4000-8000-000000000003', // Retífica Plana
    maquina_id: 'm1000000-0000-4000-8000-000000000003',
    sequencia: 40,
    descricao: 'Retífica de precisão na linha de partição e paralelismo',
    horas_estimadas: 3.5,
    status: 'Pendente',
  },

  // Operações - Componente 2 (Macho Inferior Postiçado)
  {
    id: 'op000000-0000-4000-8000-000000000005',
    empresa_id: DEFAULT_EMPRESA_ID,
    componente_id: 'cmp00000-0000-4000-8000-000000000002',
    centro_custo_id: 'm1000000-0000-4000-8000-000000000004', // Torno CNC Nardini
    maquina_id: 'm1000000-0000-4000-8000-000000000004',
    sequencia: 10,
    descricao: 'Torneamento de desbaste e pré-acabamento dos postiços',
    horas_estimadas: 4.5,
    status: 'Concluída',
  },
  {
    id: 'op000000-0000-4000-8000-000000000006',
    empresa_id: DEFAULT_EMPRESA_ID,
    componente_id: 'cmp00000-0000-4000-8000-000000000002',
    centro_custo_id: 'm1000000-0000-4000-8000-000000000001', // Centro CNC Romi
    maquina_id: 'm1000000-0000-4000-8000-000000000001',
    sequencia: 20,
    descricao: 'Fresamento de acabamento geométrico e encaixes',
    horas_estimadas: 10.0,
    status: 'Em andamento',
  },

  // Operações - Componente 3 (Conjunto Placa Extratora)
  {
    id: 'op000000-0000-4000-8000-000000000007',
    empresa_id: DEFAULT_EMPRESA_ID,
    componente_id: 'cmp00000-0000-4000-8000-000000000003',
    centro_custo_id: 'm1000000-0000-4000-8000-000000000005', // Fresa Kone
    maquina_id: 'm1000000-0000-4000-8000-000000000005',
    sequencia: 10,
    descricao: 'Furação de coordenadas e alargamento de buchas guia',
    horas_estimadas: 6.0,
    status: 'Pendente',
  },

  // Operações - Projeto 2 (Estampo de Corte e Dobra)
  // Componente 4 (Matriz de Corte)
  {
    id: 'op000000-0000-4000-8000-000000000008',
    empresa_id: DEFAULT_EMPRESA_ID,
    componente_id: 'cmp00000-0000-4000-8000-000000000004',
    centro_custo_id: 'm1000000-0000-4000-8000-000000000005', // Fresa Kone
    maquina_id: 'm1000000-0000-4000-8000-000000000005',
    sequencia: 10,
    descricao: 'Desbaste de canais de extração e alívios',
    horas_estimadas: 3.5,
    status: 'Concluída',
  },
  {
    id: 'op000000-0000-4000-8000-000000000009',
    empresa_id: DEFAULT_EMPRESA_ID,
    componente_id: 'cmp00000-0000-4000-8000-000000000004',
    centro_custo_id: 'm1000000-0000-4000-8000-000000000003', // Retífica
    maquina_id: 'm1000000-0000-4000-8000-000000000003',
    sequencia: 20,
    descricao: 'Retífica de precisão pós-têmpera das superfícies de corte',
    horas_estimadas: 4.0,
    status: 'Concluída',
  },

  // Componente 5 (Punção de Dobra)
  {
    id: 'op000000-0000-4000-8000-000000000010',
    empresa_id: DEFAULT_EMPRESA_ID,
    componente_id: 'cmp00000-0000-4000-8000-000000000005',
    centro_custo_id: 'm1000000-0000-4000-8000-000000000004', // Torno CNC
    maquina_id: 'm1000000-0000-4000-8000-000000000004',
    sequencia: 10,
    descricao: 'Torneamento e perfilamento dos raios de conformação',
    horas_estimadas: 5.5,
    status: 'Concluída',
  },
  {
    id: 'op000000-0000-4000-8000-000000000011',
    empresa_id: DEFAULT_EMPRESA_ID,
    componente_id: 'cmp00000-0000-4000-8000-000000000005',
    centro_custo_id: 'm1000000-0000-4000-8000-000000000002', // Eletroerosão
    maquina_id: 'm1000000-0000-4000-8000-000000000002',
    sequencia: 20,
    descricao: 'Eletroerosão de acabamento e raios de dobra fechados',
    horas_estimadas: 4.0,
    status: 'Concluída',
  },

  // Componente 6 (Base Inferior)
  {
    id: 'op000000-0000-4000-8000-000000000012',
    empresa_id: DEFAULT_EMPRESA_ID,
    componente_id: 'cmp00000-0000-4000-8000-000000000006',
    centro_custo_id: 'm1000000-0000-4000-8000-000000000005', // Fresa Kone
    maquina_id: 'm1000000-0000-4000-8000-000000000005',
    sequencia: 10,
    descricao: 'Fresamento de alojamentos e furos de fixação para prensa',
    horas_estimadas: 4.5,
    status: 'Concluída',
  },
];

export const SEED_APONTAMENTOS: Apontamento[] = [
  // Apontamento op 1 (Concluída - Lucas na Fresa Kone)
  {
    id: 'apt00000-0000-4000-8000-000000000001',
    empresa_id: DEFAULT_EMPRESA_ID,
    operacao_id: 'op000000-0000-4000-8000-000000000001',
    operador_id: 'o1000000-0000-4000-8000-000000000004', // Lucas Ferreira
    inicio: '2026-11-04T08:00:00.000Z',
    fim: '2026-11-04T13:00:00.000Z', // 5h
  },
  // Apontamento op 2 (Em andamento - Carlos Eduardo no CNC Romi)
  {
    id: 'apt00000-0000-4000-8000-000000000002',
    empresa_id: DEFAULT_EMPRESA_ID,
    operacao_id: 'op000000-0000-4000-8000-000000000002',
    operador_id: 'o1000000-0000-4000-8000-000000000001', // Carlos Eduardo Silva
    inicio: '2026-11-05T07:30:00.000Z',
    fim: '2026-11-05T16:30:00.000Z', // 9h
  },
  {
    id: 'apt00000-0000-4000-8000-000000000003',
    empresa_id: DEFAULT_EMPRESA_ID,
    operacao_id: 'op000000-0000-4000-8000-000000000002',
    operador_id: 'o1000000-0000-4000-8000-000000000001', // Carlos Eduardo Silva
    inicio: '2026-11-06T07:30:00.000Z',
    fim: null, // atualmente apontando em máquina!
  },
  // Apontamento op 5 (Concluída - Marcos Vinicius no Torno Nardini)
  {
    id: 'apt00000-0000-4000-8000-000000000004',
    empresa_id: DEFAULT_EMPRESA_ID,
    operacao_id: 'op000000-0000-4000-8000-000000000005',
    operador_id: 'o1000000-0000-4000-8000-000000000003', // Marcos Vinicius
    inicio: '2026-11-04T13:30:00.000Z',
    fim: '2026-11-04T18:00:00.000Z', // 4.5h
  },
  // Apontamentos Projeto 2 (Estampo - Concluídas)
  {
    id: 'apt00000-0000-4000-8000-000000000005',
    empresa_id: DEFAULT_EMPRESA_ID,
    operacao_id: 'op000000-0000-4000-8000-000000000008',
    operador_id: 'o1000000-0000-4000-8000-000000000004', // Lucas
    inicio: '2026-11-02T08:00:00.000Z',
    fim: '2026-11-02T11:30:00.000Z', // 3.5h
  },
  {
    id: 'apt00000-0000-4000-8000-000000000006',
    empresa_id: DEFAULT_EMPRESA_ID,
    operacao_id: 'op000000-0000-4000-8000-000000000009',
    operador_id: 'o1000000-0000-4000-8000-000000000004', // Lucas
    inicio: '2026-11-02T13:00:00.000Z',
    fim: '2026-11-02T17:00:00.000Z', // 4h
  },
  {
    id: 'apt00000-0000-4000-8000-000000000007',
    empresa_id: DEFAULT_EMPRESA_ID,
    operacao_id: 'op000000-0000-4000-8000-000000000010',
    operador_id: 'o1000000-0000-4000-8000-000000000003', // Marcos Vinicius
    inicio: '2026-11-03T08:00:00.000Z',
    fim: '2026-11-03T13:30:00.000Z', // 5.5h
  },
  {
    id: 'apt00000-0000-4000-8000-000000000008',
    empresa_id: DEFAULT_EMPRESA_ID,
    operacao_id: 'op000000-0000-4000-8000-000000000011',
    operador_id: 'o1000000-0000-4000-8000-000000000002', // Roberto Albuquerque
    inicio: '2026-11-03T14:00:00.000Z',
    fim: '2026-11-03T18:00:00.000Z', // 4h
  },
  {
    id: 'apt00000-0000-4000-8000-000000000009',
    empresa_id: DEFAULT_EMPRESA_ID,
    operacao_id: 'op000000-0000-4000-8000-000000000012',
    operador_id: 'o1000000-0000-4000-8000-000000000004', // Lucas
    inicio: '2026-11-04T08:00:00.000Z',
    fim: '2026-11-04T12:30:00.000Z', // 4.5h
  },
];



export const SEED_MODELOS_COMPONENTES: ModeloComponente[] = [
  {
    id: 'mod00000-0000-4000-8000-000000000001',
    empresa_id: DEFAULT_EMPRESA_ID,
    codigo: 'MOD-PLACA-SUP',
    nome: 'Placa Cavidade Superior',
    categoria: 'Placas e Bases',
    material: 'Aço P20 Beneficiado (WNr 1.2311)',
    observacoes: 'Roteiro padrão para cavidades com canais profundos de refrigeração',
    criado_em: '2026-01-10T10:00:00.000Z',
    operacoes: [
      {
        id: 'mop00000-0000-4000-8000-000000000001',
        modelo_componente_id: 'mod00000-0000-4000-8000-000000000001',
        sequencia: 10,
        descricao: 'Desbaste e esquadrejamento de faces e canais de refrigeração',
        categoria: 'Fresa',
        tipo_maquina: 'Fresa',
        horas_estimadas: 5.0,
      },
      {
        id: 'mop00000-0000-4000-8000-000000000002',
        modelo_componente_id: 'mod00000-0000-4000-8000-000000000001',
        sequencia: 20,
        descricao: 'Usinagem CNC de alta velocidade das cavidades 3D',
        categoria: 'CNC',
        tipo_maquina: 'CNC',
        horas_estimadas: 16.0,
      },
      {
        id: 'mop00000-0000-4000-8000-000000000003',
        modelo_componente_id: 'mod00000-0000-4000-8000-000000000001',
        sequencia: 30,
        descricao: 'Eletroerosão por penetração de nervuras e cantos vivos',
        categoria: 'Eletroerosão',
        tipo_maquina: 'Eletroerosão',
        horas_estimadas: 7.0,
      },
      {
        id: 'mop00000-0000-4000-8000-000000000004',
        modelo_componente_id: 'mod00000-0000-4000-8000-000000000001',
        sequencia: 40,
        descricao: 'Retífica de precisão na linha de partição e paralelismo',
        categoria: 'Retífica',
        tipo_maquina: 'Retífica',
        horas_estimadas: 3.5,
      },
    ],
  },
  {
    id: 'mod00000-0000-4000-8000-000000000002',
    empresa_id: DEFAULT_EMPRESA_ID,
    codigo: 'MOD-MACHO-POST',
    nome: 'Macho Inferior Postiçado',
    categoria: 'Postiços e Machos',
    material: 'Aço H13 Temperado e Revenido',
    observacoes: 'Usinagem cilíndrica e fresamento de encaixes de alta precisão',
    criado_em: '2026-01-10T10:00:00.000Z',
    operacoes: [
      {
        id: 'mop00000-0000-4000-8000-000000000005',
        modelo_componente_id: 'mod00000-0000-4000-8000-000000000002',
        sequencia: 10,
        descricao: 'Torneamento de desbaste e pré-acabamento dos postiços',
        categoria: 'Torno',
        tipo_maquina: 'Torno',
        horas_estimadas: 4.5,
      },
      {
        id: 'mop00000-0000-4000-8000-000000000006',
        modelo_componente_id: 'mod00000-0000-4000-8000-000000000002',
        sequencia: 20,
        descricao: 'Fresamento CNC de alta precisão e encaixes',
        categoria: 'CNC',
        tipo_maquina: 'CNC',
        horas_estimadas: 10.0,
      },
      {
        id: 'mop00000-0000-4000-8000-000000000007',
        modelo_componente_id: 'mod00000-0000-4000-8000-000000000002',
        sequencia: 30,
        descricao: 'Ajuste manual de bancada e polimento espelhado',
        categoria: 'Ajustagem/Bancada',
        tipo_maquina: 'Bancada',
        horas_estimadas: 3.0,
      },
    ],
  },
  {
    id: 'mod00000-0000-4000-8000-000000000003',
    empresa_id: DEFAULT_EMPRESA_ID,
    codigo: 'MOD-MATRIZ-CORTE',
    nome: 'Matriz de Corte Temperada',
    categoria: 'Matrizes',
    material: 'Aço VC131 (Aço D2 alta liga)',
    observacoes: 'Roteiro de alta durabilidade com têmpera a vácuo e eletroerosão a fio',
    criado_em: '2026-01-12T14:30:00.000Z',
    operacoes: [
      {
        id: 'mop00000-0000-4000-8000-000000000008',
        modelo_componente_id: 'mod00000-0000-4000-8000-000000000003',
        sequencia: 10,
        descricao: 'Desbaste de canais de extração e alívios na fresa',
        categoria: 'Fresa',
        tipo_maquina: 'Fresa',
        horas_estimadas: 3.5,
      },
      {
        id: 'mop00000-0000-4000-8000-000000000009',
        modelo_componente_id: 'mod00000-0000-4000-8000-000000000003',
        sequencia: 20,
        descricao: 'Eletroerosão a fio de contorno de corte fechado',
        categoria: 'Eletroerosão',
        tipo_maquina: 'Eletroerosão',
        horas_estimadas: 5.5,
      },
      {
        id: 'mop00000-0000-4000-8000-000000000010',
        modelo_componente_id: 'mod00000-0000-4000-8000-000000000003',
        sequencia: 30,
        descricao: 'Retífica plana de precisão pós-têmpera',
        categoria: 'Retífica',
        tipo_maquina: 'Retífica',
        horas_estimadas: 4.0,
      },
    ],
  },
  {
    id: 'mod00000-0000-4000-8000-000000000004',
    empresa_id: DEFAULT_EMPRESA_ID,
    codigo: 'MOD-PUNCAO-DOBRA',
    nome: 'Punção de Conformação e Dobra',
    categoria: 'Punções',
    material: 'Aço Ferramenta VND',
    observacoes: 'Roteiro para punções de estampos de repuxo e dobra fina',
    criado_em: '2026-01-12T14:30:00.000Z',
    operacoes: [
      {
        id: 'mop00000-0000-4000-8000-000000000011',
        modelo_componente_id: 'mod00000-0000-4000-8000-000000000004',
        sequencia: 10,
        descricao: 'Torneamento e perfilamento dos raios de conformação',
        categoria: 'Torno',
        tipo_maquina: 'Torno',
        horas_estimadas: 5.5,
      },
      {
        id: 'mop00000-0000-4000-8000-000000000012',
        modelo_componente_id: 'mod00000-0000-4000-8000-000000000004',
        sequencia: 20,
        descricao: 'Fresamento CNC dos raios e alojamento de fixação',
        categoria: 'CNC',
        tipo_maquina: 'CNC',
        horas_estimadas: 4.0,
      },
      {
        id: 'mop00000-0000-4000-8000-000000000013',
        modelo_componente_id: 'mod00000-0000-4000-8000-000000000004',
        sequencia: 30,
        descricao: 'Ajuste fino de bancada e polimento espelhado dos raios',
        categoria: 'Ajustagem/Bancada',
        tipo_maquina: 'Bancada',
        horas_estimadas: 2.5,
      },
    ],
  },
  {
    id: 'mod00000-0000-4000-8000-000000000005',
    empresa_id: DEFAULT_EMPRESA_ID,
    codigo: 'MOD-BASE-PADRAO',
    nome: 'Base Inferior Padronizada',
    categoria: 'Placas e Bases',
    material: 'Aço SAE 1020',
    observacoes: 'Base usinada para fixação em mesas de prensa e máquinas injetoras',
    criado_em: '2026-01-15T09:00:00.000Z',
    operacoes: [
      {
        id: 'mop00000-0000-4000-8000-000000000014',
        modelo_componente_id: 'mod00000-0000-4000-8000-000000000005',
        sequencia: 10,
        descricao: 'Fresamento de alojamentos e furos de fixação para prensa',
        categoria: 'Fresa',
        tipo_maquina: 'Fresa',
        horas_estimadas: 4.5,
      },
      {
        id: 'mop00000-0000-4000-8000-000000000015',
        modelo_componente_id: 'mod00000-0000-4000-8000-000000000005',
        sequencia: 20,
        descricao: 'Furação de coordenadas e alargamento de buchas guia',
        categoria: 'Fresa',
        tipo_maquina: 'Fresa',
        horas_estimadas: 3.0,
      },
    ],
  },
];

export const SEED_HISTORICO_IMPORTACOES: HistoricoImportacao[] = [
  {
    id: 'h1000000-0000-4000-8000-000000000001',
    empresa_id: DEFAULT_EMPRESA_ID,
    usuario_id: 'u1000000-0000-4000-8000-000000000002',
    usuario_nome: 'Carlos Gerente de Produção',
    tipo: 'biblioteca_modelos',
    arquivo_nome: 'catalogo_roteiros_padrao_2026.xlsx',
    total_linhas: 15,
    linhas_sucesso: 15,
    linhas_erro: 0,
    data_hora: '2026-02-01T10:15:00.000Z',
    detalhes: 'Carga inicial de roteiros técnicos da biblioteca da ferramentaria.',
  },
];

