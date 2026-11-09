/**
 * MÓDULO DE CRIPTOGRAFIA & HASHING DE CREDENCIAIS (PBKDF2)
 * 
 * Implementa derivação de chaves criptográficas usando a Web Crypto API (crypto.subtle):
 * - Algoritmo: PBKDF2 com HMAC-SHA-256
 * - Salt: 16 bytes (128 bits) aleatórios e exclusivos por usuário
 * - Iterações: 200.000 iterações (mínimo exigido)
 * - Nenhuma credencial em texto puro é armazenada ou mantida no código
 */

export interface PBKDF2Result {
  hash: string;
  salt: string;
  iterations: number;
}

export const MIN_PBKDF2_ITERATIONS = 200000;

/**
 * Gera um salt criptograficamente seguro com comprimento especificado (padrão 16 bytes).
 * Retorna uma string hexadecimal.
 */
export function generateRandomSalt(byteLength: number = 16): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converte string hexadecimal para Uint8Array.
 */
function hexToUint8Array(hex: string): Uint8Array {
  const clean = hex.trim();
  const match = clean.match(/.{1,2}/g);
  if (!match) return new Uint8Array(0);
  return new Uint8Array(match.map((byte) => parseInt(byte, 16)));
}

/**
 * Calcula o hash PBKDF2 de uma credencial (senha ou PIN).
 * @param secret Texto da credencial
 * @param providedSalt Salt hexadecimal opcional (se omitido, gera novo salt aleatório)
 * @param iterations Número de iterações (padrão 200.000)
 */
export async function hashSecretPBKDF2(
  secret: string,
  providedSalt?: string,
  iterations: number = MIN_PBKDF2_ITERATIONS
): Promise<PBKDF2Result> {
  const normalized = (secret || '').trim();
  const saltHex = providedSalt || generateRandomSalt(16);
  const saltBytes = hexToUint8Array(saltHex);
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(normalized);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBytes as unknown as BufferSource,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes as unknown as BufferSource,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      256 // 32 bytes = 256 bits
    );

    const hashHex = Array.from(new Uint8Array(derivedBits))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      hash: hashHex,
      salt: saltHex,
      iterations,
    };
  }

  throw new Error('Web Crypto API (crypto.subtle) não suportada neste ambiente.');
}

/**
 * Valida se um secret fornecido confere com o hash PBKDF2 esperado.
 */
export async function verifySecretPBKDF2(
  secret: string,
  expectedHash?: string,
  salt?: string,
  iterations: number = MIN_PBKDF2_ITERATIONS
): Promise<boolean> {
  if (!secret || !expectedHash || !salt) return false;
  try {
    const result = await hashSecretPBKDF2(secret, salt, iterations);
    return result.hash === expectedHash;
  } catch (err) {
    console.error('Erro na verificação criptográfica:', err);
    return false;
  }
}
