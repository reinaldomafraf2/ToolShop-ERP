/**
 * Formata valores numéricos para Moeda Brasileira (BRL)
 */
export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata data ISO (YYYY-MM-DD ou ISO string) para formato brasileiro DD/MM/AAAA
 */
export function formatDateBR(dateString: string): string {
  if (!dateString) return '-';
  try {
    const parts = dateString.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateString);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateString;
  }
}

/**
 * Formata data e hora para DD/MM/AAAA HH:mm
 */
export function formatDateTimeBR(dateString: string | null): string {
  if (!dateString) return 'Em andamento';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Calcula a duração em horas decimais entre duas datas ISO.
 * Não arredonda na origem para evitar erro acumulado em somas.
 */
export function calculateDurationHours(inicio: string, fim: string | null): number {
  if (!inicio) return 0;
  const start = new Date(inicio).getTime();
  const end = fim ? new Date(fim).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);
  return diffMs / (1000 * 60 * 60);
}

/**
 * Formata horas decimais sem truncar para 1 casa decimal.
 * Exibe até 3 casas decimais, sem zeros à direita desnecessários, com vírgula padrão BR (ex.: 0,25h; 1,5h; 4h; 37,75h).
 */
export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || isNaN(hours)) return '0h';
  // Arredonda para até 3 casas decimais apenas para prevenir resíduos binários de ponto flutuante
  const num = Math.round((hours + Number.EPSILON) * 1000) / 1000;
  const formatted = num.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
  return `${formatted}h`;
}
