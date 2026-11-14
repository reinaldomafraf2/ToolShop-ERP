import { APP_TIME_ZONE, parseDateTimeToMs } from './calendarioTrabalho';

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
 * Formata data ISO (YYYY-MM-DD ou ISO string) para formato brasileiro DD/MM/AAAA no fuso America/Sao_Paulo.
 * Datas puras YYYY-MM-DD são formatadas diretamente sem conversão de fuso (nunca tratadas como meia-noite UTC).
 */
export function formatDateBR(dateString: string): string {
  if (!dateString) return '-';
  try {
    const trimmed = dateString.trim();
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnlyMatch) {
      return `${dateOnlyMatch[3]}/${dateOnlyMatch[2]}/${dateOnlyMatch[1]}`;
    }
    const ms = parseDateTimeToMs(trimmed);
    if (!Number.isFinite(ms)) return dateString;
    return new Date(ms).toLocaleDateString('pt-BR', {
      timeZone: APP_TIME_ZONE,
    });
  } catch {
    return dateString;
  }
}

/**
 * Formata data e hora para DD/MM/AAAA HH:mm em America/Sao_Paulo.
 */
export function formatDateTimeBR(dateString: string | null): string {
  if (!dateString) return 'Em andamento';
  try {
    const ms = parseDateTimeToMs(dateString);
    if (!Number.isFinite(ms)) return dateString;
    return new Date(ms).toLocaleDateString('pt-BR', {
      timeZone: APP_TIME_ZONE,
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
  const start = parseDateTimeToMs(inicio);
  const end = fim ? parseDateTimeToMs(fim) : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  const diffMs = Math.max(0, end - start);
  return diffMs / 3_600_000;
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
