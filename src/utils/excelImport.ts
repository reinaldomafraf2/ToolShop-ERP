import * as XLSX from 'xlsx';
import { TipoMaquina, ModeloComponente, TipoComponente } from '../types';

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_ROWS_ALLOWED = 500;

export const TIPOS_MAQUINA_PERMITIDOS: string[] = [
  'CNC',
  'Eletroerosão',
  'Retífica',
  'Torno',
  'Fresa',
  'Ajustagem/Bancada',
  'Bancada',
  'Tratamento térmico',
  'Tratamento superficial',
  'Polimento',
  'Corte',
  'Outro',
];

/**
 * Normaliza strings removendo acentos, convertendo para minúsculas e retirando espaços extras
 */
export function normalizeString(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Converte valor numérico aceitando ponto (.) ou vírgula (,) como separador decimal.
 * Sanitiza valores contra injeção de fórmulas e trata dados puramente como texto/número.
 */
export function parseDecimalNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }
  let str = String(val).trim();
  // Se começar com caracteres de fórmula (=, +, -, @), trata como string sanitizada
  if (str.startsWith('=') || str.startsWith('+') || str.startsWith('@')) {
    str = str.substring(1).trim();
  }
  // Substitui vírgula por ponto
  str = str.replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Remove qualquer prefixo executável de fórmula para segurança de dados (anti-formula injection)
 */
export function sanitizeDataValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
    str = `'${str}`;
  }
  return str;
}

// ============================================================================
// 1. IMPORTAÇÃO DE COMPONENTES PARA PROJETO (REG-103 OS 1842 & FORMATO SIMPLES)
// ============================================================================

export interface BlocoProjetoPlanilha {
  cliente?: string;
  produto?: string;
  osFerramentaria?: string;
  projetista?: string;
  data?: string;
}

export interface LinhaImportComponente {
  linhaNumero: number;
  codigoLido: string;
  nomeLido: string;
  descricaoOriginal: string;
  quantidadeLida: number;
  materialLido: string;
  tipo: TipoComponente; // 'fabricado' | 'comprado' | 'estoque'
  idReferPai?: string;
  dimensoes?: string;
  observacoesLidas: string;
  tratamentoLido?: string;
  numLista?: string;
  dataLida?: string;
  status: 'Reconhecido' | 'Não encontrado' | 'Erro';
  modeloEncontrado?: ModeloComponente;
  acaoNaoEncontrado?: 'branco' | 'escolher_modelo' | 'ignorar';
  modeloEscolhidoId?: string;
  erroMotivo?: string;
}

export interface ParseArquivoComponentesResult {
  linhas: LinhaImportComponente[];
  blocoProjeto: BlocoProjetoPlanilha;
  errosGerais: string[];
}

/**
 * Gera e dispara download da planilha modelo de Componentes ("Lista de Materiais e Serviços" - Reg-103) (.xlsx)
 */
export function downloadPlanilhaModeloComponentes(): void {
  const wb = XLSX.utils.book_new();

  const dadosExemplo = [
    // Linhas 1 e 2: Bloco de metadados do projeto
    ['CLIENTE:', 'Autometal Indústria Automotiva Ltda', '', 'O.S. FERRAMENTARIA:', '1842', '', 'DATA:', '15/10/2026'],
    ['PRODUTO:', 'Molde de Injeção Plástica Conector 4 Vias', '', 'PROJETISTA:', 'Eng. Roberto Silveira', '', '', ''],
    ['', '', '', '', '', '', '', ''], // Linha 3 vazia de respiro
    // Linha 4: Cabeçalho oficial Reg-103
    [
      'CÓDIGO',
      'DESCRIÇÃO',
      'QTDE',
      'ID. Refer. PAI',
      'OBSERVAÇÕES',
      'Cód. MATERIAL',
      'Descr. MATERIAL',
      'Qtde Mat.',
      'FORMATO',
      'DIMENSÕES',
      'OBSERVAÇÕES',
      'Link DESENHO .Pdf',
      'ITEM PADRAO',
      'STATUS',
      'FORNECEDOR',
      'N° LISTA',
      'DATA',
    ],
    // Linha 5: Exemplo 1 - Peça Usinada / Fabricada internamente
    [
      '001',
      '100_MACHO POSTIÇADO',
      2,
      'CONJUNTO PRINCIPAL',
      'Tolerância H7 nos canais de alinhamento',
      'ACO-H13',
      'Aço H13 Temperado e Revenido',
      2,
      'Bloco',
      '120x80x45',
      'Têmpera 52-54 HRC',
      'desenhos/001_macho.pdf',
      'NÃO',
      'Aprovado',
      'Villares Metals',
      'LST-01',
      '15/10/2026',
    ],
    // Linha 6: Exemplo 2 - Peça Comprada (ID. Refer. PAI = FINANCEIRO)
    [
      '002',
      '200_BUCHA GUIA DE PRECISÃO',
      4,
      'FINANCEIRO',
      'Comprar temperada e retificada DIN 9831',
      'PAD-01',
      'Aço Cementado',
      4,
      'Cilíndrico',
      'D25x60',
      'Cementação 60 HRC',
      '',
      'SIM',
      'Pendente',
      'Polimold Industrial',
      '',
      '',
    ],
    // Linha 7: Exemplo 3 - Peça do Estoque / Almoxarifado (Observações = estoque)
    [
      '003',
      '300_COLUNA GUIA DE RETORNO',
      4,
      'ESTRUTURA BASE',
      'Retirar do estoque do almoxarifado',
      'EST-02',
      'Aço SAE 8620',
      4,
      'Cilíndrico',
      'D30x140',
      'Retificado',
      '',
      'SIM',
      'Em estoque',
      'Almoxarifado Central',
      '',
      '',
    ],
    // Linha 8: Exemplo 4 - Outro componente fabricado
    [
      '004',
      '400_PLACA CAVINHA SUPERIOR',
      1,
      'CONJUNTO PRINCIPAL',
      'Canal de refrigeração vedado',
      'ACO-P20',
      'Aço P20 Beneficiado',
      1,
      'Placa',
      '350x250x50',
      'Alívio de tensões',
      'desenhos/004_placa.pdf',
      'NÃO',
      'Aprovado',
      'Aços Gerdau',
      'LST-02',
      '16/10/2026',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(dadosExemplo);

  // Configuração das larguras das colunas
  ws['!cols'] = [
    { wch: 12 }, // CÓDIGO
    { wch: 32 }, // DESCRIÇÃO
    { wch: 8 },  // QTDE
    { wch: 22 }, // ID. Refer. PAI
    { wch: 30 }, // OBSERVAÇÕES 1 (Item)
    { wch: 14 }, // Cód. MATERIAL
    { wch: 28 }, // Descr. MATERIAL
    { wch: 10 }, // Qtde Mat.
    { wch: 12 }, // FORMATO
    { wch: 16 }, // DIMENSÕES
    { wch: 22 }, // OBSERVAÇÕES 2 (Tratamento)
    { wch: 20 }, // Link DESENHO
    { wch: 12 }, // ITEM PADRAO
    { wch: 12 }, // STATUS
    { wch: 22 }, // FORNECEDOR
    { wch: 12 }, // N° LISTA
    { wch: 12 }, // DATA
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Lista Materiais Reg-103');
  XLSX.writeFile(wb, 'planilha_modelo_componentes_reg103.xlsx');
}

/**
 * Lê arquivo (.xlsx ou .csv) e mapeia os componentes conforme a especificação Reg-103 OS 1842
 * (ou formato simples legado), reconhecendo itens na biblioteca e classificando em fabricado/comprado/estoque.
 */
export async function parseArquivoComponentes(
  file: File,
  modelosBiblioteca: ModeloComponente[]
): Promise<ParseArquivoComponentesResult> {
  const errosGerais: string[] = [];
  const blocoProjeto: BlocoProjetoPlanilha = {};

  if (file.size > MAX_FILE_SIZE_BYTES) {
    errosGerais.push(
      `O arquivo enviado possui ${(file.size / (1024 * 1024)).toFixed(1)} MB. O limite máximo permitido é de 5 MB.`
    );
    return { linhas: [], blocoProjeto, errosGerais };
  }

  const arrayBuffer = await file.arrayBuffer();
  // raw: false garante a recuperação do texto formatado das células (ex: "001" preserva os zeros à esquerda)
  const wb = XLSX.read(arrayBuffer, { type: 'array', raw: false });

  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    errosGerais.push('A planilha está vazia ou não contém abas válidas.');
    return { linhas: [], blocoProjeto, errosGerais };
  }

  const ws = wb.Sheets[firstSheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

  if (rows.length === 0) {
    errosGerais.push('A planilha está completamente vazia.');
    return { linhas: [], blocoProjeto, errosGerais };
  }

  // 2. DETECÇÃO AUTOMÁTICA DA LINHA DE CABEÇALHO
  // A tabela pode não começar na linha 1. Procuramos pela linha que contém "CÓDIGO" e "DESCRIÇÃO" (ou sinônimos)
  let headerRowIndex = -1;
  const candidateHeadersLog: string[] = [];

  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r] as unknown[];
    if (!row || !Array.isArray(row)) continue;

    const normalizedCells = row.map((cell) => normalizeString(String(cell || '')));
    const nonEmptyRaw = row.map((cell) => String(cell || '').trim()).filter(Boolean);

    if (nonEmptyRaw.length > 0) {
      candidateHeadersLog.push(`Linha ${r + 1}: [${nonEmptyRaw.slice(0, 8).join(', ')}]`);
    }

    // Procura "CÓDIGO"
    const hasCodigo = normalizedCells.some(
      (c) => c === 'codigo' || c === 'cod' || c === 'codigo do componente'
    );

    // Procura "DESCRIÇÃO" ou "COMPONENTE" ou "NOME" (excluindo "Descr. MATERIAL")
    const hasNome = normalizedCells.some(
      (c) =>
        (c === 'descricao' ||
          c === 'componente' ||
          c === 'nome' ||
          c === 'nome do componente') &&
        !c.includes('material')
    );

    if (hasCodigo && hasNome) {
      headerRowIndex = r;
      break;
    }
  }

  // 9. EM CASO DE ERRO DE LEITURA, MOSTRAR CABEÇALHOS ENCONTRADOS E O QUE FALTOU
  if (headerRowIndex === -1) {
    errosGerais.push(
      `Não foi possível localizar a linha de cabeçalho da tabela contendo 'CÓDIGO' e 'DESCRIÇÃO' (ou 'Componente').\n` +
      `Cabeçalhos identificados nas linhas iniciais:\n${candidateHeadersLog.slice(0, 6).join('\n')}\n` +
      `Coluna obrigatória ausente: verifique se constam as colunas 'CÓDIGO' e 'DESCRIÇÃO' (ou 'Componente').`
    );
    return { linhas: [], blocoProjeto, errosGerais };
  }

  // 1. EXTRAÇÃO DO BLOCO DO PROJETO (linhas acima do cabeçalho da tabela)
  // Localiza rótulos: CLIENTE, PRODUTO, O.S. FERRAMENTARIA, PROJETISTA, DATA
  for (let r = 0; r < headerRowIndex; r++) {
    const row = rows[r] as unknown[];
    if (!row || !Array.isArray(row)) continue;

    for (let c = 0; c < row.length; c++) {
      const rawVal = String(row[c] || '').trim();
      if (!rawVal) continue;
      const norm = normalizeString(rawVal);

      const getNextNonEmpty = (): string => {
        // Se já contiver ":" na própria célula
        if (rawVal.includes(':')) {
          const part = rawVal.split(':')[1]?.trim();
          if (part) return part;
        }
        // Busca na mesma linha nas próximas colunas
        for (let nextC = c + 1; nextC < Math.min(row.length, c + 8); nextC++) {
          const nextVal = String(row[nextC] || '').trim();
          if (nextVal && !nextVal.endsWith(':')) return nextVal;
        }
        // Busca na linha de baixo (r + 1, c)
        if (r + 1 < headerRowIndex) {
          const belowRow = rows[r + 1] as unknown[];
          if (belowRow && belowRow[c]) {
            const belowVal = String(belowRow[c] || '').trim();
            if (belowVal) return belowVal;
          }
        }
        return '';
      };

      if (norm.includes('cliente') && !blocoProjeto.cliente) {
        blocoProjeto.cliente = getNextNonEmpty();
      } else if (norm.includes('produto') && !blocoProjeto.produto) {
        blocoProjeto.produto = getNextNonEmpty();
      } else if (
        (norm.includes('o.s. ferramentaria') ||
          norm.includes('os ferramentaria') ||
          norm === 'o.s.' ||
          norm === 'os' ||
          norm.startsWith('o.s') ||
          norm.startsWith('os ') ||
          norm.includes('ordem de servico')) &&
        !blocoProjeto.osFerramentaria
      ) {
        blocoProjeto.osFerramentaria = getNextNonEmpty();
      } else if (norm.includes('projetista') && !blocoProjeto.projetista) {
        blocoProjeto.projetista = getNextNonEmpty();
      } else if (norm === 'data' && !blocoProjeto.data) {
        blocoProjeto.data = getNextNonEmpty();
      }
    }
  }

  // 2, 3 e 4. IDENTIFICAÇÃO E MAPEAMENTO DAS COLUNAS
  const headerRow = rows[headerRowIndex] as unknown[];
  let colIndexCodigo = -1;
  let colIndexNome = -1;
  let colIndexQuantidade = -1;
  let colIndexIdReferPai = -1;
  let colIndexMaterial = -1;
  let colIndexDimensoes = -1;
  let colIndexNumLista = -1;
  let colIndexData = -1;

  const obsColIndices: number[] = [];

  headerRow.forEach((col, idx) => {
    const raw = String(col || '').trim();
    const norm = normalizeString(raw);
    if (!norm) return;

    // Código
    if (norm === 'codigo' || norm === 'cod' || norm === 'codigo do componente') {
      if (colIndexCodigo === -1) colIndexCodigo = idx;
    }
    // Nome / Descrição (excluindo Descr. MATERIAL)
    else if (
      (norm === 'descricao' ||
        norm === 'componente' ||
        norm === 'nome' ||
        norm === 'nome do componente') &&
      !norm.includes('material')
    ) {
      if (colIndexNome === -1) colIndexNome = idx;
    }
    // Quantidade
    else if (
      (norm === 'qtde' || norm === 'quantidade' || norm === 'qtd' || norm === 'quant') &&
      !norm.includes('mat')
    ) {
      if (colIndexQuantidade === -1) colIndexQuantidade = idx;
    }
    // ID. Refer. PAI
    else if (norm.includes('refer') || norm.includes('pai')) {
      if (colIndexIdReferPai === -1) colIndexIdReferPai = idx;
    }
    // Material (Descr. MATERIAL ou Material)
    else if (
      (norm === 'descr. material' ||
        norm === 'descr material' ||
        norm === 'material' ||
        norm === 'tipo de aco' ||
        norm === 'materia-prima') &&
      !norm.includes('cod') &&
      !norm.includes('qtde')
    ) {
      if (colIndexMaterial === -1) colIndexMaterial = idx;
    }
    // Dimensões
    else if (norm.includes('dimens') || norm === 'dimensoes') {
      if (colIndexDimensoes === -1) colIndexDimensoes = idx;
    }
    // N° LISTA
    else if (norm.includes('lista') || norm.includes('n° lista') || norm.includes('no lista')) {
      if (colIndexNumLista === -1) colIndexNumLista = idx;
    }
    // DATA da tabela
    else if (norm === 'data') {
      if (colIndexData === -1) colIndexData = idx;
    }

    // 4. DUAS COLUNAS "OBSERVAÇÕES":
    // 1ª: logo após ID. Refer. PAI -> observação do item
    // 2ª: logo após DIMENSÕES -> tratamento/acabamento
    if (norm.startsWith('observ') || norm === 'obs' || norm === 'notas') {
      obsColIndices.push(idx);
    }
  });

  let colIndexObsItem = -1;
  let colIndexTratamento = -1;

  if (obsColIndices.length >= 2) {
    colIndexObsItem = obsColIndices[0];
    colIndexTratamento = obsColIndices[1];
  } else if (obsColIndices.length === 1) {
    colIndexObsItem = obsColIndices[0];
  }

  const dataRows = rows.slice(headerRowIndex + 1);
  if (dataRows.length > MAX_ROWS_ALLOWED) {
    errosGerais.push(
      `O arquivo contém ${dataRows.length} linhas de dados. O limite máximo por importação é de ${MAX_ROWS_ALLOWED} linhas.`
    );
    return { linhas: [], blocoProjeto, errosGerais };
  }

  // Mapas para busca rápida na biblioteca
  const modeloPorCodigo = new Map<string, ModeloComponente>();
  const modeloPorNome = new Map<string, ModeloComponente>();

  modelosBiblioteca.forEach((m) => {
    if (m.codigo) {
      modeloPorCodigo.set(m.codigo.trim().toUpperCase(), m);
    }
    if (m.nome) {
      modeloPorNome.set(normalizeString(m.nome), m);
    }
  });

  const resultadoLinhas: LinhaImportComponente[] = [];

  // 6. HERANÇA DE CÉLULAS EM BRANCO (fill-down)
  let lastNumLista = '';
  let lastData = '';

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i] as unknown[];
    const linhaNumero = headerRowIndex + 1 + i + 1; // Linha real no Excel (1-based)

    // 6. Ignora linhas totalmente vazias
    const isEmpty =
      !r || r.every((cell) => cell === '' || cell === null || cell === undefined);
    if (isEmpty) continue;

    // Herança de N° LISTA e DATA
    let currentNumLista =
      colIndexNumLista >= 0 ? String(r[colIndexNumLista] || '').trim() : '';
    if (currentNumLista) {
      lastNumLista = currentNumLista;
    } else {
      currentNumLista = lastNumLista;
    }

    let currentData = colIndexData >= 0 ? String(r[colIndexData] || '').trim() : '';
    if (currentData) {
      lastData = currentData;
    } else {
      currentData = lastData;
    }

    // 5. CÓDIGO sempre como texto, preservando zeros à esquerda ("001")
    let rawCodigo = '';
    if (colIndexCodigo >= 0 && r[colIndexCodigo] !== undefined && r[colIndexCodigo] !== null) {
      rawCodigo = String(r[colIndexCodigo]).trim();
    }

    // 5. Nome do componente: DESCRIÇÃO sem prefixo "<código>_" (regex ^[\d.]+_), guardando texto original
    let rawDescricao = '';
    if (colIndexNome >= 0 && r[colIndexNome] !== undefined && r[colIndexNome] !== null) {
      rawDescricao = String(r[colIndexNome]).trim();
    }

    const descricaoOriginal = rawDescricao;
    // Regex remove prefixos como "100_", "01.02_", "001_", "10_" etc.
    const cleanedNome = rawDescricao.replace(/^[\d.]+\s*_\s*/, '').trim() || rawDescricao;

    // 7. CLASSIFICAÇÃO DE TIPO:
    // Itens do grupo FINANCEIRO (coluna "ID. Refer. PAI") viram tipo "comprado",
    // e os com observação "estoque" viram "estoque". Os demais são "fabricado".
    const rawIdReferPai =
      colIndexIdReferPai >= 0 ? String(r[colIndexIdReferPai] || '').trim() : '';
    const rawObsItem = colIndexObsItem >= 0 ? String(r[colIndexObsItem] || '').trim() : '';
    const rawTratamento =
      colIndexTratamento >= 0 ? String(r[colIndexTratamento] || '').trim() : '';
    const rawDimensoes =
      colIndexDimensoes >= 0 ? String(r[colIndexDimensoes] || '').trim() : '';
    const rawMaterial =
      colIndexMaterial >= 0 ? String(r[colIndexMaterial] || '').trim() : '';
    const rawQtd = colIndexQuantidade >= 0 ? r[colIndexQuantidade] : 1;

    let tipo: TipoComponente = 'fabricado';
    if (normalizeString(rawIdReferPai).includes('financeiro')) {
      tipo = 'comprado';
    } else if (
      normalizeString(rawObsItem).includes('estoque') ||
      normalizeString(rawTratamento).includes('estoque')
    ) {
      tipo = 'estoque';
    }

    // Se linha não tem nem código nem nome, ignora
    if (!cleanedNome && !rawCodigo) {
      continue;
    }

    if (!cleanedNome) {
      resultadoLinhas.push({
        linhaNumero,
        codigoLido: rawCodigo,
        nomeLido: '',
        descricaoOriginal,
        quantidadeLida: 1,
        materialLido: rawMaterial,
        tipo,
        idReferPai: rawIdReferPai,
        dimensoes: rawDimensoes,
        observacoesLidas: rawObsItem,
        tratamentoLido: rawTratamento,
        numLista: currentNumLista,
        dataLida: currentData,
        status: 'Erro',
        erroMotivo: 'A descrição/nome do componente é obrigatória.',
      });
      continue;
    }

    // Conversão de Quantidade
    let parsedQtd = 1;
    if (rawQtd !== '' && rawQtd !== undefined && rawQtd !== null) {
      const parsedNum = parseDecimalNumber(rawQtd);
      if (parsedNum === null || parsedNum < 1 || !Number.isInteger(parsedNum)) {
        resultadoLinhas.push({
          linhaNumero,
          codigoLido: rawCodigo,
          nomeLido: cleanedNome,
          descricaoOriginal,
          quantidadeLida: 1,
          materialLido: rawMaterial,
          tipo,
          idReferPai: rawIdReferPai,
          dimensoes: rawDimensoes,
          observacoesLidas: rawObsItem,
          tratamentoLido: rawTratamento,
          numLista: currentNumLista,
          dataLida: currentData,
          status: 'Erro',
          erroMotivo: `Quantidade inválida: "${rawQtd}". Deve ser um número inteiro maior ou igual a 1.`,
        });
        continue;
      }
      parsedQtd = parsedNum;
    }

    // 7. ITENS COMPRADOS E DE ESTOQUE:
    // Não recebem operações de usinagem e não precisam de modelo de roteiro
    if (tipo === 'comprado' || tipo === 'estoque') {
      resultadoLinhas.push({
        linhaNumero,
        codigoLido: rawCodigo,
        nomeLido: cleanedNome,
        descricaoOriginal,
        quantidadeLida: parsedQtd,
        materialLido: rawMaterial || (tipo === 'comprado' ? 'Item Comercial' : 'Almoxarifado'),
        tipo,
        idReferPai: rawIdReferPai,
        dimensoes: rawDimensoes,
        observacoesLidas: rawObsItem,
        tratamentoLido: rawTratamento,
        numLista: currentNumLista,
        dataLida: currentData,
        status: 'Reconhecido',
      });
      continue;
    }

    // ITENS FABRICADOS:
    // Reconhecimento inteligente contra a biblioteca de componentes-modelo:
    // 1º: Por Código (exato, case-insensitive)
    let modeloEncontrado: ModeloComponente | undefined;
    if (rawCodigo) {
      modeloEncontrado = modeloPorCodigo.get(rawCodigo.toUpperCase());
    }

    // 2º: Por Nome sanitizado normalizado
    if (!modeloEncontrado) {
      modeloEncontrado = modeloPorNome.get(normalizeString(cleanedNome));
    }

    // 3º: Por Descrição original se diferente
    if (!modeloEncontrado && rawDescricao !== cleanedNome) {
      modeloEncontrado = modeloPorNome.get(normalizeString(rawDescricao));
    }

    if (modeloEncontrado) {
      resultadoLinhas.push({
        linhaNumero,
        codigoLido: rawCodigo || modeloEncontrado.codigo,
        nomeLido: cleanedNome,
        descricaoOriginal,
        quantidadeLida: parsedQtd,
        materialLido: rawMaterial || modeloEncontrado.material,
        tipo,
        idReferPai: rawIdReferPai,
        dimensoes: rawDimensoes,
        observacoesLidas: rawObsItem || modeloEncontrado.observacoes || '',
        tratamentoLido: rawTratamento,
        numLista: currentNumLista,
        dataLida: currentData,
        status: 'Reconhecido',
        modeloEncontrado,
      });
    } else {
      resultadoLinhas.push({
        linhaNumero,
        codigoLido: rawCodigo,
        nomeLido: cleanedNome,
        descricaoOriginal,
        quantidadeLida: parsedQtd,
        materialLido: rawMaterial || 'Aço P20',
        tipo,
        idReferPai: rawIdReferPai,
        dimensoes: rawDimensoes,
        observacoesLidas: rawObsItem,
        tratamentoLido: rawTratamento,
        numLista: currentNumLista,
        dataLida: currentData,
        status: 'Não encontrado',
        acaoNaoEncontrado: 'branco',
      });
    }
  }

  return { linhas: resultadoLinhas, blocoProjeto, errosGerais };
}

// ============================================================================
// 2. IMPORTAÇÃO DE ROTEIROS PARA A BIBLIOTECA (COMPONENTES-MODELO)
// ============================================================================

export interface LinhaOperacaoBibliotecaLida {
  linhaNumero: number;
  codigo: string;
  componente: string;
  categoria: string;
  material: string;
  seq: number;
  operacao: string;
  tipoMaquina: TipoMaquina;
  horas: number;
}

export interface ModeloImportAgrupado {
  codigo: string;
  nome: string;
  categoria: string;
  material: string;
  observacoes?: string;
  operacoes: Array<{
    sequencia: number;
    descricao: string;
    instrucoes?: string;
    tipo_maquina: TipoMaquina;
    horas_estimadas: number;
    prazo_dias?: number;
    fornecedor?: string;
  }>;
  jaExisteNaBiblioteca: boolean;
  modeloExistente?: ModeloComponente;
  acaoConflito: 'atualizar' | 'ignorar';
  totalHoras: number;
  linhasComErro: Array<{ linhaNumero: number; motivo: string }>;
  status: 'Valido' | 'Com aviso' | 'Erro';
}

/**
 * Gera e dispara download da planilha modelo de Roteiros da Biblioteca (.xlsx)
 */
export function downloadPlanilhaModeloBiblioteca(): void {
  const wb = XLSX.utils.book_new();

  const dadosExemplo = [
    [
      'Código',
      'Componente',
      'Categoria',
      'Material',
      'Seq',
      'Operação',
      'Centro de custo',
      'Horas',
      'Instruções',
    ],
    [
      'MOD-PLACA-SUP',
      'Placa Cavidade Superior',
      'Placas e Bases',
      'Aço P20 Beneficiado',
      10,
      'Desbaste de faces e canais',
      'Fresa',
      5.0,
      'LADO SUPERIOR:\n#CALÇO#\n_facear;\n_usinar contorno pronto;\n_furação de rosca e passagens pronto;',
    ],
    [
      'MOD-PLACA-SUP',
      'Placa Cavidade Superior',
      'Placas e Bases',
      'Aço P20 Beneficiado',
      20,
      'Usinagem CNC de cavidades',
      'CNC',
      16.0,
    ],
    [
      'MOD-PLACA-SUP',
      'Placa Cavidade Superior',
      'Placas e Bases',
      'Aço P20 Beneficiado',
      30,
      'Eletroerosão por penetração',
      'Eletroerosão',
      7.0,
    ],
    [
      'MOD-PLACA-SUP',
      'Placa Cavidade Superior',
      'Placas e Bases',
      'Aço P20 Beneficiado',
      40,
      'Retífica de paralelismo',
      'Retífica',
      3.5,
    ],
    [
      'MOD-MACHO-POST',
      'Macho Inferior Postiçado',
      'Postiços e Machos',
      'Aço H13 Temperado',
      10,
      'Torneamento dos postiços',
      'Torno',
      4.5,
    ],
    [
      'MOD-MACHO-POST',
      'Macho Inferior Postiçado',
      'Postiços e Machos',
      'Aço H13 Temperado',
      20,
      'Fresamento CNC de encaixes',
      'CNC',
      10.0,
    ],
    [
      'MOD-MACHO-POST',
      'Macho Inferior Postiçado',
      'Postiços e Machos',
      'Aço H13 Temperado',
      30,
      'Ajuste manual de bancada',
      'Bancada',
      3.0,
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(dadosExemplo);

  ws['!cols'] = [
    { wch: 18 }, // Código
    { wch: 28 }, // Componente
    { wch: 20 }, // Categoria
    { wch: 24 }, // Material
    { wch: 8 }, // Seq
    { wch: 34 }, // Operação
    { wch: 18 }, // Tipo de máquina
    { wch: 10 }, // Horas
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Roteiros_Biblioteca');
  XLSX.writeFile(wb, 'planilha_modelo_roteiros_biblioteca.xlsx');
}

/**
 * Lê e agrupa as linhas da planilha de roteiros por Código do componente-modelo
 */
export async function parseArquivoBiblioteca(
  file: File,
  modelosExistentes: ModeloComponente[]
): Promise<{
  modelosAgrupados: ModeloImportAgrupado[];
  errosGerais: string[];
}> {
  const errosGerais: string[] = [];

  if (file.size > MAX_FILE_SIZE_BYTES) {
    errosGerais.push(
      `O arquivo enviado possui ${(file.size / (1024 * 1024)).toFixed(1)} MB. O limite máximo permitido é de 5 MB.`
    );
    return { modelosAgrupados: [], errosGerais };
  }

  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array', raw: true });

  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    errosGerais.push('A planilha está vazia ou não contém abas válidas.');
    return { modelosAgrupados: [], errosGerais };
  }

  const ws = wb.Sheets[firstSheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (rows.length === 0) {
    errosGerais.push('A planilha está completamente vazia.');
    return { modelosAgrupados: [], errosGerais };
  }

  const headerRow = rows[0] as string[];
  let colCodigo = -1;
  let colComponente = -1;
  let colCategoria = -1;
  let colMaterial = -1;
  let colSeq = -1;
  let colOperacao = -1;
  let colTipoMaquina = -1;
  let colHoras = -1;
  let colPrazo = -1;
  let colFornecedor = -1;
  let colInstrucoes = -1;

  headerRow.forEach((col, idx) => {
    const norm = normalizeString(col);
    if (norm === 'codigo' || norm === 'cod') {
      colCodigo = idx;
    } else if (norm === 'componente' || norm === 'nome' || norm === 'modelo') {
      colComponente = idx;
    } else if (norm === 'categoria' || norm === 'grupo') {
      colCategoria = idx;
    } else if (norm === 'material' || norm === 'aco') {
      colMaterial = idx;
    } else if (norm === 'seq' || norm === 'sequencia' || norm === 'ordem') {
      colSeq = idx;
    } else if (norm === 'operacao' || norm === 'descricao' || norm === 'processo') {
      colOperacao = idx;
    } else if (
      norm === 'centro de custo' ||
      norm === 'centro custo' ||
      norm === 'centrocusto' ||
      norm === 'posto' ||
      norm === 'posto de trabalho' ||
      norm === 'tipo de maquina' ||
      norm === 'tipo maquina' ||
      norm === 'maquina' ||
      norm === 'tipo'
    ) {
      colTipoMaquina = idx;
    } else if (norm === 'horas' || norm === 'horas estimadas' || norm === 'tempo') {
      colHoras = idx;
    } else if (norm === 'prazo' || norm === 'prazo (dias)' || norm === 'dias' || norm === 'prazo dias') {
      colPrazo = idx;
    } else if (norm === 'fornecedor' || norm === 'terceiro') {
      colFornecedor = idx;
    } else if (
      norm === 'instrucoes' ||
      norm === 'instrucao' ||
      norm === 'instrucoes de execucao' ||
      norm === 'plano de fabricacao' ||
      norm === 'plano fabricacao' ||
      norm === 'observacoes da operacao'
    ) {
      colInstrucoes = idx;
    }
  });

  if (colCodigo === -1 || colComponente === -1 || colOperacao === -1) {
    errosGerais.push(
      'A planilha precisa conter no mínimo as colunas "Código", "Componente" e "Operação".'
    );
    return { modelosAgrupados: [], errosGerais };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_ROWS_ALLOWED) {
    errosGerais.push(
      `O arquivo contém ${dataRows.length} linhas. O limite máximo por importação é de ${MAX_ROWS_ALLOWED} linhas.`
    );
    return { modelosAgrupados: [], errosGerais };
  }

  // Mapa de modelos existentes para consulta rápida
  const mapExistentes = new Map<string, ModeloComponente>();
  modelosExistentes.forEach((m) => {
    mapExistentes.set(m.codigo.trim().toUpperCase(), m);
  });

  // Agrupamento por Código
  const gruposMap = new Map<string, ModeloImportAgrupado>();

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i] as unknown[];
    const linhaNumero = i + 2;

    const isEmpty = r.every((cell) => cell === '' || cell === null || cell === undefined);
    if (isEmpty) continue;

    const rawCodigo = colCodigo >= 0 ? String(r[colCodigo] || '').trim().toUpperCase() : '';
    const rawComponente = colComponente >= 0 ? String(r[colComponente] || '').trim() : '';
    const rawCategoria = colCategoria >= 0 ? String(r[colCategoria] || '').trim() : 'Geral';
    const rawMaterial = colMaterial >= 0 ? String(r[colMaterial] || '').trim() : 'Aço Ferramenta';
    const rawSeq = colSeq >= 0 ? r[colSeq] : null;
    const rawOperacao = colOperacao >= 0 ? String(r[colOperacao] || '').trim() : '';
    const rawTipoMaquina = colTipoMaquina >= 0 ? String(r[colTipoMaquina] || '').trim() : '';
    const rawHoras = colHoras >= 0 ? r[colHoras] : 0;
    const rawPrazo = colPrazo >= 0 ? r[colPrazo] : null;
    const rawFornecedor = colFornecedor >= 0 ? String(r[colFornecedor] || '').trim() : '';
    let rawInstrucoes = colInstrucoes >= 0 ? String(r[colInstrucoes] || '') : '';

    if (!rawCodigo) {
      errosGerais.push(`Linha ${linhaNumero}: O campo "Código" está em branco.`);
      continue;
    }

    if (!gruposMap.has(rawCodigo)) {
      const existente = mapExistentes.get(rawCodigo);
      gruposMap.set(rawCodigo, {
        codigo: rawCodigo,
        nome: rawComponente || existente?.nome || rawCodigo,
        categoria: rawCategoria || existente?.categoria || 'Geral',
        material: rawMaterial || existente?.material || 'Aço Ferramenta',
        operacoes: [],
        jaExisteNaBiblioteca: Boolean(existente),
        modeloExistente: existente,
        acaoConflito: 'atualizar', // Padrão se existir
        totalHoras: 0,
        linhasComErro: [],
        status: 'Valido',
      });
    }

    const grupo = gruposMap.get(rawCodigo)!;

    // Se o grupo ainda não tem nome preenchido e esta linha tem
    if (rawComponente && (!grupo.nome || grupo.nome === rawCodigo)) {
      grupo.nome = rawComponente;
    }
    if (rawCategoria && grupo.categoria === 'Geral') {
      grupo.categoria = rawCategoria;
    }
    if (rawMaterial && grupo.material === 'Aço Ferramenta') {
      grupo.material = rawMaterial;
    }

    // Validação da Operação
    if (!rawOperacao) {
      grupo.linhasComErro.push({
        linhaNumero,
        motivo: 'A descrição da operação está em branco.',
      });
      continue;
    }

    // Validação do Tipo de Máquina
    let tipoMaquinaEncontrado: TipoMaquina | null = null;
    const normTipo = normalizeString(rawTipoMaquina);

    for (const tipo of TIPOS_MAQUINA_PERMITIDOS) {
      if (normalizeString(tipo) === normTipo) {
        tipoMaquinaEncontrado = tipo;
        break;
      }
    }

    if (!tipoMaquinaEncontrado) {
      if (rawTipoMaquina && rawTipoMaquina.trim()) {
        tipoMaquinaEncontrado = rawTipoMaquina.trim();
      } else {
        grupo.linhasComErro.push({
          linhaNumero,
          motivo: `Centro de custo inválido ou em branco.`,
        });
        continue;
      }
    }

    const parsedPrazo = rawPrazo !== null && rawPrazo !== undefined && rawPrazo !== '' ? parseInt(String(rawPrazo), 10) : undefined;
    const isOutsourcedCategory =
      normTipo === 'tratamento termico' ||
      normTipo === 'tratamento superficial' ||
      normTipo === 'polimento' ||
      normTipo === 'corte' ||
      normTipo === 'terceirizado' ||
      normTipo === 'servico' ||
      (parsedPrazo !== undefined && !isNaN(parsedPrazo) && parsedPrazo > 0);

    // Validação de Horas (aceita vírgula ou ponto)
    const parsedHoras = parseDecimalNumber(rawHoras);
    if (!isOutsourcedCategory && (parsedHoras === null || parsedHoras <= 0)) {
      grupo.linhasComErro.push({
        linhaNumero,
        motivo: `Horas estimadas inválidas: "${rawHoras}". Deve ser um número maior que zero.`,
      });
      continue;
    }

    // Sequência
    let parsedSeq = (grupo.operacoes.length + 1) * 10;
    if (rawSeq !== null && rawSeq !== undefined && rawSeq !== '') {
      const s = parseInt(String(rawSeq), 10);
      if (!isNaN(s) && s > 0) {
        parsedSeq = s;
      }
    }

    if (rawInstrucoes && rawInstrucoes.length > 5000) {
      rawInstrucoes = rawInstrucoes.substring(0, 5000);
      grupo.linhasComErro.push({
        linhaNumero,
        motivo: `Instruções da operação "${rawOperacao || parsedSeq}" excederam 5.000 caracteres e foram truncadas para o limite máximo.`,
      });
    }

    const finalHoras = parsedHoras && parsedHoras > 0 ? parsedHoras : 0;
    grupo.operacoes.push({
      sequencia: parsedSeq,
      descricao: rawOperacao,
      instrucoes: rawInstrucoes.trim() ? rawInstrucoes : undefined,
      tipo_maquina: tipoMaquinaEncontrado,
      horas_estimadas: finalHoras,
      prazo_dias: parsedPrazo && !isNaN(parsedPrazo) && parsedPrazo > 0 ? parsedPrazo : (isOutsourcedCategory ? 5 : undefined),
      fornecedor: rawFornecedor || undefined,
    });

    grupo.totalHoras = grupo.totalHoras + finalHoras;
  }

  // Ordena operações de cada grupo e determina status final
  const modelosAgrupados: ModeloImportAgrupado[] = [];
  gruposMap.forEach((grupo) => {
    grupo.operacoes.sort((a, b) => a.sequencia - b.sequencia);

    if (grupo.operacoes.length === 0 && grupo.linhasComErro.length > 0) {
      grupo.status = 'Erro';
    } else if (grupo.linhasComErro.length > 0) {
      grupo.status = 'Com aviso';
    } else {
      grupo.status = 'Valido';
    }

    modelosAgrupados.push(grupo);
  });

  return { modelosAgrupados, errosGerais };
}
