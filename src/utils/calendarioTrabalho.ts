import { ConfiguracoesSistema, ContagemPrazo, FeriadoCalendario } from '../types';

export const APP_TIME_ZONE = 'America/Sao_Paulo';

export interface CalendarioTrabalhoNormalized {
  contagem_prazo: ContagemPrazo;
  diasSemana: number[];
  diasSemanaSet: Set<number>;
  inicioMin: number;
  fimMin: number;
  expedienteInicio: string;
  expedienteFim: string;
  almocoHoras: number;
  almocoMin: number;
  horasExpedienteDia: number;
  feriados: FeriadoCalendario[];
  feriadosSet: Set<string>;
  atencao_percentual: number;
  disponibilidade_percentual_padrao: number;
}

export interface ZonedDateParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  hour: number; // 0..23
  minute: number; // 0..59
  second: number; // 0..59
  weekday: number; // 0 (Dom)..6 (Sáb)
}

const DEFAULT_DIAS_SEMANA = [1, 2, 3, 4, 5];

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const SAO_PAULO_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});

/**
 * Extrai ano, mês, dia, hora, minuto, segundo e dia da semana no fuso horário America/Sao_Paulo.
 */
export function getZonedParts(dateInput: Date | number | string): ZonedDateParts | null {
  const ms = parseDateTimeToMs(dateInput);
  if (!Number.isFinite(ms)) return null;
  const parts = SAO_PAULO_PARTS_FORMATTER.formatToParts(new Date(ms));
  let year = 0;
  let month = 1;
  let day = 1;
  let hour = 0;
  let minute = 0;
  let second = 0;
  let weekday = 0;

  for (const p of parts) {
    if (p.type === 'year') year = Number(p.value);
    else if (p.type === 'month') month = Number(p.value);
    else if (p.type === 'day') day = Number(p.value);
    else if (p.type === 'hour') hour = Number(p.value) % 24;
    else if (p.type === 'minute') minute = Number(p.value);
    else if (p.type === 'second') second = Number(p.value);
    else if (p.type === 'weekday') weekday = WEEKDAY_MAP[p.value] ?? 0;
  }

  return { year, month, day, hour, minute, second, weekday };
}

/**
 * Converte data/hora de parede em America/Sao_Paulo para timestamp UTC em milissegundos.
 */
export function zonedDateTimeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0,
  msRemainder: number = 0
): number {
  const targetWallMs = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  // Estimativa inicial: BRT = UTC-3 (UTC = parede + 3h)
  let guessUtc = targetWallMs + 3 * 3_600_000;

  for (let i = 0; i < 3; i++) {
    const p = getZonedParts(guessUtc);
    if (!p) break;
    const actualWallMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, 0);
    const diff = targetWallMs - actualWallMs;
    if (diff === 0) break;
    guessUtc += diff;
  }

  return guessUtc + msRemainder;
}

/**
 * Avança ou retrocede dias corridos em um calendário (Y, M, D) sem depender do fuso do SO.
 */
export function addCalendarDaysYMD(
  year: number,
  month: number,
  day: number,
  deltaDays: number
): { year: number; month: number; day: number; weekday: number } {
  const dt = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
    weekday: dt.getUTCDay(),
  };
}

/**
 * Faz o parse seguro de strings de data/hora tratando datas sem offset (YYYY-MM-DD ou YYYY-MM-DDTHH:mm)
 * explicitamente no fuso America/Sao_Paulo (nunca como meia-noite UTC).
 */
export function parseDateTimeToMs(input: Date | number | string | null | undefined): number {
  if (input === null || input === undefined || input === '') return NaN;
  if (input instanceof Date) return input.getTime();
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;

  const trimmed = String(input).trim();
  if (!trimmed) return NaN;

  // Data pura YYYY-MM-DD -> 00:00:00 em America/Sao_Paulo
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const y = Number(dateOnlyMatch[1]);
    const m = Number(dateOnlyMatch[2]);
    const d = Number(dateOnlyMatch[3]);
    return zonedDateTimeToUtcMs(y, m, d, 0, 0, 0);
  }

  // Datetime sem timezone (YYYY-MM-DDTHH:mm ou YYYY-MM-DDTHH:mm:ss) -> America/Sao_Paulo
  const localNoTzMatch = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (localNoTzMatch) {
    const y = Number(localNoTzMatch[1]);
    const m = Number(localNoTzMatch[2]);
    const d = Number(localNoTzMatch[3]);
    const hh = Number(localNoTzMatch[4]);
    const mm = Number(localNoTzMatch[5]);
    const ss = localNoTzMatch[6] ? Number(localNoTzMatch[6]) : 0;
    return zonedDateTimeToUtcMs(y, m, d, hh, mm, ss);
  }

  const parsed = new Date(trimmed).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function parseTimeToMinutes(hhmm: string | undefined, fallbackMinutes: number): number {
  if (!hhmm || typeof hhmm !== 'string') return fallbackMinutes;
  const parts = hhmm.trim().split(':');
  if (parts.length !== 2) return fallbackMinutes;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return fallbackMinutes;
  }
  return Math.floor(h) * 60 + Math.floor(m);
}

export function formatMinutesToHHMM(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Retorna a chave YYYY-MM-DD no fuso America/Sao_Paulo (ou preserva YYYY-MM-DD puro).
 */
export function getLocalDateKey(dateInput: Date | number | string): string {
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }
  const parts = getZonedParts(dateInput);
  if (!parts) return '';
  const m = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${m}-${day}`;
}

export function normalizarConfigCalendario(
  cfg?: Partial<ConfiguracoesSistema> | null
): CalendarioTrabalhoNormalized {
  const contagem_prazo: ContagemPrazo =
    cfg?.contagem_prazo === 'expediente' ? 'expediente' : 'corridas';

  const rawDias = Array.isArray(cfg?.expediente_dias_semana)
    ? cfg!.expediente_dias_semana.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    : DEFAULT_DIAS_SEMANA;
  const diasSemana =
    rawDias.length > 0 ? Array.from(new Set(rawDias)).sort((a, b) => a - b) : DEFAULT_DIAS_SEMANA;

  const inicioMin = parseTimeToMinutes(cfg?.expediente_inicio, 8 * 60);
  let fimMin = parseTimeToMinutes(cfg?.expediente_fim, 17 * 60);
  if (fimMin <= inicioMin) {
    fimMin = Math.min(23 * 60 + 59, inicioMin + 60);
  }

  const totalSpanMin = fimMin - inicioMin;
  const rawAlmocoHoras =
    cfg?.expediente_almoco_horas !== undefined && cfg?.expediente_almoco_horas !== null
      ? Number(cfg.expediente_almoco_horas)
      : 1;
  const almocoHoras = Number.isFinite(rawAlmocoHoras) && rawAlmocoHoras >= 0 ? rawAlmocoHoras : 1;
  const rawAlmocoMin = Math.round(almocoHoras * 60);
  const almocoMin = rawAlmocoMin >= totalSpanMin ? 0 : rawAlmocoMin;
  const horasExpedienteDia = Math.max((totalSpanMin - almocoMin) / 60, 0.25);

  const feriados: FeriadoCalendario[] = Array.isArray(cfg?.feriados)
    ? cfg!.feriados.filter((f) => f && typeof f.data === 'string' && f.data.trim().length > 0)
    : [];
  const feriadosSet = new Set(feriados.map((f) => f.data.trim().slice(0, 10)));

  const rawAtencao =
    cfg?.atencao_percentual !== undefined && cfg?.atencao_percentual !== null
      ? Number(cfg.atencao_percentual)
      : 15;
  const atencao_percentual = Number.isFinite(rawAtencao)
    ? Math.max(0, Math.min(100, rawAtencao))
    : 15;

  const rawDisp =
    cfg?.disponibilidade_percentual_padrao !== undefined &&
    cfg?.disponibilidade_percentual_padrao !== null
      ? Number(cfg.disponibilidade_percentual_padrao)
      : 85;
  const disponibilidade_percentual_padrao = Number.isFinite(rawDisp)
    ? Math.max(1, Math.min(100, rawDisp))
    : 85;

  return {
    contagem_prazo,
    diasSemana,
    diasSemanaSet: new Set(diasSemana),
    inicioMin,
    fimMin,
    expedienteInicio: formatMinutesToHHMM(inicioMin),
    expedienteFim: formatMinutesToHHMM(fimMin),
    almocoHoras,
    almocoMin,
    horasExpedienteDia,
    feriados,
    feriadosSet,
    atencao_percentual,
    disponibilidade_percentual_padrao,
  };
}

export function isDiaUtilYMD(
  year: number,
  month: number,
  day: number,
  cal: CalendarioTrabalhoNormalized
): boolean {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (!cal.diasSemanaSet.has(weekday)) return false;
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return !cal.feriadosSet.has(key);
}

export function isDiaUtil(date: Date, cal: CalendarioTrabalhoNormalized): boolean {
  const p = getZonedParts(date);
  if (!p) return false;
  return isDiaUtilYMD(p.year, p.month, p.day, cal);
}

/**
 * Retorna intervalos úteis [startMs, endMs] em America/Sao_Paulo para um dia específico (Y, M, D).
 * Divide o intervalo de almoço simetricamente ao meio do expediente (ex.: 08:00-17:00 c/ 1h => 08:00-12:00 e 13:00-17:00).
 */
export function getIntervalosExpedienteDoDiaYMD(
  year: number,
  month: number,
  day: number,
  cal: CalendarioTrabalhoNormalized
): Array<[number, number]> {
  if (!isDiaUtilYMD(year, month, day, cal)) return [];

  const toMs = (minutes: number) => {
    const hh = Math.floor(minutes / 60);
    const mm = minutes % 60;
    return zonedDateTimeToUtcMs(year, month, day, hh, mm, 0);
  };

  if (cal.almocoMin > 0 && cal.fimMin - cal.inicioMin > cal.almocoMin) {
    const mid = Math.floor((cal.inicioMin + cal.fimMin) / 2);
    const lunchStart = mid - Math.floor(cal.almocoMin / 2);
    const lunchEnd = lunchStart + cal.almocoMin;
    const intervals: Array<[number, number]> = [];
    if (lunchStart > cal.inicioMin) {
      intervals.push([toMs(cal.inicioMin), toMs(lunchStart)]);
    }
    if (cal.fimMin > lunchEnd) {
      intervals.push([toMs(lunchEnd), toMs(cal.fimMin)]);
    }
    return intervals;
  }

  return [[toMs(cal.inicioMin), toMs(cal.fimMin)]];
}

export function getIntervalosExpedienteDoDia(
  dayDate: Date,
  cal: CalendarioTrabalhoNormalized
): Array<[number, number]> {
  const p = getZonedParts(dayDate);
  if (!p) return [];
  return getIntervalosExpedienteDoDiaYMD(p.year, p.month, p.day, cal);
}

/**
 * Conta horas de calendário entre início e fim respeitando contagem_prazo ('corridas' | 'expediente')
 * no fuso America/Sao_Paulo usando aritmética em milissegundos.
 */
export function contarHorasCalendario(
  inicio: string | number | Date,
  fim: string | number | Date,
  cal: CalendarioTrabalhoNormalized
): number {
  const startMs = parseDateTimeToMs(inicio);
  const endMs = parseDateTimeToMs(fim);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0;
  }

  if (cal.contagem_prazo === 'corridas') {
    return (endMs - startMs) / 3_600_000;
  }

  if (cal.diasSemanaSet.size === 0) {
    return 0;
  }

  const startParts = getZonedParts(startMs);
  const endParts = getZonedParts(endMs);
  if (!startParts || !endParts) return 0;

  let curY = startParts.year;
  let curM = startParts.month;
  let curD = startParts.day;
  const endDayCode = Date.UTC(endParts.year, endParts.month - 1, endParts.day);

  let totalMs = 0;
  let guard = 0;
  while (Date.UTC(curY, curM - 1, curD) <= endDayCode && guard < 20000) {
    guard++;
    const intervals = getIntervalosExpedienteDoDiaYMD(curY, curM, curD, cal);
    for (const [ivStart, ivEnd] of intervals) {
      const s = Math.max(startMs, ivStart);
      const e = Math.min(endMs, ivEnd);
      if (e > s) {
        totalMs += e - s;
      }
    }
    const next = addCalendarDaysYMD(curY, curM, curD, 1);
    curY = next.year;
    curM = next.month;
    curD = next.day;
  }

  return totalMs / 3_600_000;
}

/**
 * Adiciona prazo em horas (via milissegundos) a partir de inicio respeitando contagem_prazo ('corridas' | 'expediente')
 * no fuso America/Sao_Paulo.
 */
export function adicionarHorasCalendario(
  inicio: string | number | Date,
  horas: number,
  cal: CalendarioTrabalhoNormalized
): string {
  const parsedStart = parseDateTimeToMs(inicio);
  const safeStartMs = Number.isFinite(parsedStart) ? parsedStart : Date.now();
  const safeHoras = Number.isFinite(horas) ? Math.max(0, horas) : 0;
  const addMs = Math.round(safeHoras * 3_600_000);

  if (addMs === 0) {
    return new Date(safeStartMs).toISOString();
  }

  if (cal.contagem_prazo === 'corridas' || cal.diasSemanaSet.size === 0) {
    return new Date(safeStartMs + addMs).toISOString();
  }

  const startParts = getZonedParts(safeStartMs);
  if (!startParts) {
    return new Date(safeStartMs + addMs).toISOString();
  }

  let remainingMs = addMs;
  let curY = startParts.year;
  let curM = startParts.month;
  let curD = startParts.day;
  let timeFloorMs = safeStartMs;
  let guard = 0;

  while (remainingMs > 0 && guard < 20000) {
    guard++;
    const intervals = getIntervalosExpedienteDoDiaYMD(curY, curM, curD, cal);
    for (const [ivStart, ivEnd] of intervals) {
      const effectiveStart = Math.max(ivStart, timeFloorMs);
      if (ivEnd > effectiveStart) {
        const avail = ivEnd - effectiveStart;
        if (remainingMs <= avail) {
          return new Date(effectiveStart + remainingMs).toISOString();
        }
        remainingMs -= avail;
      }
    }
    const next = addCalendarDaysYMD(curY, curM, curD, 1);
    curY = next.year;
    curM = next.month;
    curD = next.day;
    timeFloorMs = zonedDateTimeToUtcMs(curY, curM, curD, 0, 0, 0);
  }

  return new Date(safeStartMs + addMs).toISOString();
}

/**
 * Retorna dias úteis restantes entre agoraMs e entregaMs (em America/Sao_Paulo), fracionando o dia atual
 * e o dia final conforme horas úteis do expediente. Usado para cálculo de capacidade até a entrega.
 */
export function calcularDiasUteisRestantes(
  agoraMs: number,
  entregaMs: number,
  cal: CalendarioTrabalhoNormalized
): number {
  if (
    !Number.isFinite(agoraMs) ||
    !Number.isFinite(entregaMs) ||
    entregaMs <= agoraMs ||
    cal.diasSemanaSet.size === 0 ||
    cal.horasExpedienteDia <= 0
  ) {
    return 0;
  }

  const startParts = getZonedParts(agoraMs);
  const endParts = getZonedParts(entregaMs);
  if (!startParts || !endParts) return 0;

  let curY = startParts.year;
  let curM = startParts.month;
  let curD = startParts.day;
  const endDayCode = Date.UTC(endParts.year, endParts.month - 1, endParts.day);

  let totalWorkMs = 0;
  let guard = 0;
  while (Date.UTC(curY, curM - 1, curD) <= endDayCode && guard < 20000) {
    guard++;
    const intervals = getIntervalosExpedienteDoDiaYMD(curY, curM, curD, cal);
    for (const [ivStart, ivEnd] of intervals) {
      const s = Math.max(agoraMs, ivStart);
      const e = Math.min(entregaMs, ivEnd);
      if (e > s) {
        totalWorkMs += e - s;
      }
    }
    const next = addCalendarDaysYMD(curY, curM, curD, 1);
    curY = next.year;
    curM = next.month;
    curD = next.day;
  }

  const fullDayWorkMs = cal.horasExpedienteDia * 3_600_000;
  return fullDayWorkMs > 0 ? totalWorkMs / fullDayWorkMs : 0;
}

/**
 * Converte uma data YYYY-MM-DD para o horário de fim do expediente configurado no mesmo dia (America/Sao_Paulo).
 */
export function snapFimExpediente(
  dateYYYYMMDD: string,
  cal: CalendarioTrabalhoNormalized
): string {
  if (!dateYYYYMMDD) return '';
  const clean = dateYYYYMMDD.trim().split('T')[0];
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return '';
  }
  const [y, m, d] = parts;
  const hh = Math.floor(cal.fimMin / 60);
  const mm = cal.fimMin % 60;
  const utcMs = zonedDateTimeToUtcMs(y, m, d, hh, mm, 0);
  return Number.isFinite(utcMs) ? new Date(utcMs).toISOString() : '';
}

/**
 * Formata ISO para valor de input <input type="datetime-local"> em America/Sao_Paulo.
 */
export function formatLocalDateTimeInput(isoStr?: string | null): string {
  if (!isoStr) return '';
  const p = getZonedParts(isoStr);
  if (!p) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Converte valor de input datetime-local (YYYY-MM-DDTHH:mm) em America/Sao_Paulo para ISO string UTC.
 */
export function parseLocalDateTimeInput(localStr: string): string {
  if (!localStr) return '';
  const ms = parseDateTimeToMs(localStr);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : '';
}

export function formatHorasCompactas(horas: number): string {
  if (!Number.isFinite(horas)) return '0h';
  const rounded = Math.round(horas * 10) / 10;
  const formatted = rounded.toLocaleString('pt-BR', {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });
  return `${formatted}h`;
}

export function formatPrazoHorasComContagem(
  horas: number | undefined | null,
  contagem: ContagemPrazo
): string {
  const val = Number.isFinite(horas) ? Number(horas) : 0;
  const rounded = Math.round(val * 100) / 100;
  const formatted = rounded.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${formatted} h ${contagem === 'expediente' ? 'de expediente' : 'corridas'}`;
}
