import * as XLSX from 'xlsx';
import {
  ItemEstoqueComDetalhes,
  MovimentoEstoqueComDetalhes,
  UnidadeEstoqueComDetalhes,
} from '../types';
import { formatDateBR, formatDateTimeBR } from './formatters';

export function exportItensEstoqueToExcel(itens: ItemEstoqueComDetalhes[]): void {
  const dados = itens.map((item) => ({
    Código: item.codigo,
    Descrição: item.descricao,
    Categoria:
      item.categoria === 'materia_prima'
        ? 'Matéria-prima'
        : item.categoria === 'item_comercial'
        ? 'Item Comercial'
        : item.categoria === 'consumivel'
        ? 'Consumível'
        : 'Outro',
    Unidade: item.unidade,
    Especificação: item.especificacao || '—',
    'Tipo de Controle':
      item.tipo_controle === 'unidade_fisica' ? 'Unidade Física' : 'Quantidade',
    'Saldo Físico': item.saldo,
    Reservado: item.reservado,
    Disponível: item.disponivel,
    'Estoque Mínimo': item.estoque_minimo !== undefined ? item.estoque_minimo : '—',
    'Abaixo do Mínimo?': item.abaixo_minimo ? 'SIM' : 'NÃO',
    Localização: item.localizacao_padrao || '—',
    Status: item.ativo ? 'Ativo' : 'Inativo',
  }));

  const worksheet = XLSX.utils.json_to_sheet(dados);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Itens de Estoque');

  const dataStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Itens_Estoque_${dataStr}.xlsx`);
}

export function exportMovimentosEstoqueToExcel(
  movimentos: MovimentoEstoqueComDetalhes[]
): void {
  const dados = movimentos.map((m) => ({
    'Data/Hora': formatDateTimeBR(m.data_hora),
    Tipo:
      m.tipo === 'entrada'
        ? 'Entrada (+)'
        : m.tipo === 'saida'
        ? 'Saída (-)'
        : 'Ajuste (±)',
    Quantidade: m.quantidade,
    Unidade: m.item?.unidade || 'un',
    'Cód. Item': m.item?.codigo || '—',
    'Descrição do Item': m.item?.descricao || '—',
    'Etiqueta Peça Física': m.unidade?.etiqueta || '—',
    Motivo:
      m.motivo === 'compra'
        ? 'Compra'
        : m.motivo === 'producao'
        ? 'Produção'
        : m.motivo === 'inventario'
        ? 'Inventário Físico'
        : m.motivo === 'perda'
        ? 'Perda/Sucata'
        : m.motivo === 'devolucao'
        ? 'Devolução/Sobra'
        : 'Outro',
    Usuário: m.usuario_nome || '—',
    Projeto: m.projeto_codigo || '—',
    Componente: m.componente_nome || '—',
    Observações: m.observacoes || '—',
  }));

  const worksheet = XLSX.utils.json_to_sheet(dados);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Histórico de Movimentos');

  const dataStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Movimentos_Estoque_${dataStr}.xlsx`);
}

export function exportUnidadesEstoqueToExcel(
  unidades: UnidadeEstoqueComDetalhes[]
): void {
  const dados = unidades.map((u) => ({
    Etiqueta: u.etiqueta,
    'Cód. Item': u.item?.codigo || '—',
    Descrição: u.item?.descricao || '—',
    Material: u.material || u.item?.especificacao || '—',
    Formato: u.formato || '—',
    'Comprimento (mm)': u.comprimento_mm ?? '—',
    'Largura (mm)': u.largura_mm ?? '—',
    'Espessura (mm)': u.espessura_mm ?? '—',
    'Diâmetro (mm)': u.diametro_mm ?? '—',
    'Peso (kg)': u.peso_kg ?? '—',
    Localização: u.localizacao || '—',
    Origem:
      u.origem === 'compra'
        ? 'Compra'
        : u.origem === 'sobra'
        ? 'Retalho/Sobra'
        : 'Ajuste',
    'Projeto Origem': u.origem_projeto_codigo || '—',
    'Peça Origem': u.origem_componente_nome || '—',
    'Lote / Certificado': u.lote_ou_certificado || '—',
    Status:
      u.status === 'disponivel'
        ? 'Disponível'
        : u.status === 'reservada'
        ? 'Reservada'
        : u.status === 'consumida'
        ? 'Consumida'
        : 'Descartada',
    'Data Cadastro': formatDateBR(u.criado_em.split('T')[0]),
  }));

  const worksheet = XLSX.utils.json_to_sheet(dados);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Peças e Sobras');

  const dataStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Pecas_Sobras_Estoque_${dataStr}.xlsx`);
}
