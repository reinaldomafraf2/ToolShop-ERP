import { ProjetoComDetalhes } from '../types';
import { formatDateBR, formatHours } from './formatters';

/**
 * Exporta a lista de projetos para um arquivo CSV compatível com Excel brasileiro (separador ';' e BOM UTF-8).
 */
export function exportProjetosToCSV(projetos: ProjetoComDetalhes[]): void {
  if (!projetos || projetos.length === 0) {
    alert('Nenhum projeto disponível para exportação.');
    return;
  }

  const headers = [
    'Código',
    'Cliente',
    'Descrição da Ferramenta',
    'Prazo de Entrega',
    'Status',
    'Qtd Componentes',
    'Total Operações',
    'Operações Concluídas',
    'Progresso (%)',
    'Horas Estimadas',
    'Horas Apontadas',
    'Custo Real Acumulado (R$)',
  ];

  const escapeCSV = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = projetos.map((p) => {
    const percent =
      p.totalOperacoes > 0
        ? Math.round((p.operacoesConcluidasCount / p.totalOperacoes) * 100)
        : 0;

    return [
      escapeCSV(p.codigo),
      escapeCSV(p.cliente?.nome || 'Não definido'),
      escapeCSV(p.descricao),
      escapeCSV(formatDateBR(p.prazo)),
      escapeCSV(p.status),
      escapeCSV(p.totalComponentes),
      escapeCSV(p.totalOperacoes),
      escapeCSV(p.operacoesConcluidasCount),
      escapeCSV(`${percent}%`),
      escapeCSV(formatHours(p.horasEstimadasTotal).replace('h', '')),
      escapeCSV(formatHours(p.horasApontadasTotal).replace('h', '')),
      escapeCSV(p.custoRealAcumulado.toFixed(2).replace('.', ',')),
    ].join(';');
  });

  // Prefixo UTF-8 BOM (\uFEFF) para que o Excel abra acentuações em português perfeitamente
  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateSuffix = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;

  link.setAttribute('href', url);
  link.setAttribute('download', `projetos_toolshop_${dateSuffix}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
