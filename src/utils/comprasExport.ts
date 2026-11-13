import * as XLSX from 'xlsx';
import { ItemCompraComDetalhes, ConfiguracoesSistema, Fornecedor } from '../types';
import { formatDateBR } from './formatters';

export function exportComprasToExcel(
  itens: ItemCompraComDetalhes[],
  fileNamePrefix: string = 'solicitacao_compras'
): void {
  if (!itens || itens.length === 0) {
    return;
  }

  // Colunas obrigatórias conforme especificação:
  // Código, Descrição, Especificação, Quantidade, Unidade, Fornecedor, Lista, Observações (NUNCA incluir valores).
  const rows = itens.map((i) => ({
    'Código': i.componente?.codigo || i.projeto?.codigo || '—',
    'Descrição': i.descricao,
    'Especificação': i.especificacao || '—',
    'Quantidade': i.quantidade,
    'Unidade': i.unidade,
    'Fornecedor': i.fornecedor?.nome || 'A definir',
    'Lista': i.numero_lista || '—',
    'Observações': i.observacoes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Ajuste automático de largura das colunas
  const colWidths = [
    { wch: 15 }, // Código
    { wch: 30 }, // Descrição
    { wch: 40 }, // Especificação
    { wch: 12 }, // Quantidade
    { wch: 10 }, // Unidade
    { wch: 25 }, // Fornecedor
    { wch: 15 }, // Lista
    { wch: 30 }, // Observações
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Itens de Compra');

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const fullFileName = `${fileNamePrefix}_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, fullFileName);
}
