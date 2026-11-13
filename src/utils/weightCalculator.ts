/**
 * Utilitário de cálculo de peso bruto/estimado para componentes e peças de ferramentaria.
 * 
 * Regra:
 * Quando o formato for BLOCO e as dimensões estiverem em milímetros no padrão "A X B X C"
 * (ex.: 605 X 689 X 65), calcula o peso estimado:
 * peso_estimado = A x B x C (mm³) / 1.000.000 x 7,85 (kg)
 * Densidade padrão do aço: 7,85 kg/dm³ (ou 7,85 g/cm³).
 */

export interface CalculoPesoResult {
  peso: number;
  calculado: boolean;
  dimensoesFormatadas?: string;
  volumeDm3?: number;
}

/**
 * Calcula o peso estimado de um bloco de aço a partir das dimensões em milímetros.
 * Aceita padrões como "605 X 689 X 65", "605x689x65", "605.5 x 689 x 65", "605,5 X 689 X 65".
 * Retorna null se o formato não for BLOCO ou se as dimensões não coincidirem com o padrão A X B X C.
 */
export function calcularPesoBloco(
  formato?: string,
  dimensoes?: string
): CalculoPesoResult | null {
  if (!formato || formato.trim().toUpperCase() !== 'BLOCO') {
    return null;
  }

  if (!dimensoes || !dimensoes.trim()) {
    return null;
  }

  // Regex para padrão A X B X C (números com ponto ou vírgula, separados por x, X ou *)
  const trimmed = dimensoes.trim();
  const match = trimmed.match(
    /^([0-9]+(?:[.,][0-9]+)?)\s*[xX*]\s*([0-9]+(?:[.,][0-9]+)?)\s*[xX*]\s*([0-9]+(?:[.,][0-9]+)?)$/
  );

  if (!match) {
    return null;
  }

  const a = parseFloat(match[1].replace(',', '.'));
  const b = parseFloat(match[2].replace(',', '.'));
  const c = parseFloat(match[3].replace(',', '.'));

  if (isNaN(a) || isNaN(b) || isNaN(c) || a <= 0 || b <= 0 || c <= 0) {
    return null;
  }

  // Volume em mm³
  const volumeMm3 = a * b * c;
  // Volume em dm³ (litros): mm³ / 1.000.000
  const volumeDm3 = volumeMm3 / 1000000;
  // Peso em kg: volumeDm3 * 7,85 (densidade do aço padrão)
  const pesoKg = volumeDm3 * 7.85;

  // Arredonda para 2 casas decimais (ex: 212.70)
  const pesoArredondado = Math.round(pesoKg * 100) / 100;

  return {
    peso: pesoArredondado,
    calculado: true,
    dimensoesFormatadas: `${a} X ${b} X ${c}`,
    volumeDm3: Math.round(volumeDm3 * 1000) / 1000,
  };
}

/**
 * Formata o peso em kg para exibição em tela ou na folha técnica (ex.: "212,70 kg (est.)" ou "212,70 kg")
 */
export function formatarPesoKg(peso?: number | null, calculado?: boolean): string {
  if (peso === undefined || peso === null || isNaN(peso) || peso <= 0) {
    return '—';
  }
  const valorStr = peso.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return calculado ? `${valorStr} kg (est.)` : `${valorStr} kg`;
}
