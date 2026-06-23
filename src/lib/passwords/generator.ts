/**
 * Generador y evaluador de contraseñas para el modal de creación de
 * usuarios. Sin dependencias externas — heurística simple basada en
 * longitud y variedad de charsets.
 *
 * NOTA: no es un reemplazo de zxcvbn. Sólo evita las contraseñas
 * triviales tipo "123456" y empuja al admin a usar algo razonable.
 */

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sin I, O para evitar ambigüedad
const LOWER = "abcdefghijkmnpqrstuvwxyz"; // sin l, o
const DIGITS = "23456789"; // sin 0, 1
const SYMBOLS = "!@#$%&*+-=?";

const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

/**
 * Genera una contraseña aleatoria criptográficamente segura.
 * Garantiza al menos un char de cada charset.
 */
export function generarPassword(length: number = 12): string {
  if (length < 8) length = 8;
  if (length > 64) length = 64;

  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);

  // Garantizar 1 char de cada charset en posiciones 0..3.
  const chars: string[] = [
    UPPER[buf[0] % UPPER.length],
    LOWER[buf[1] % LOWER.length],
    DIGITS[buf[2] % DIGITS.length],
    SYMBOLS[buf[3] % SYMBOLS.length],
  ];
  for (let i = 4; i < length; i++) {
    chars.push(ALL[buf[i] % ALL.length]);
  }

  // Mezclar usando Fisher-Yates con la misma fuente aleatoria.
  const shuf = new Uint32Array(length);
  crypto.getRandomValues(shuf);
  for (let i = length - 1; i > 0; i--) {
    const j = shuf[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export type FuerzaPassword = {
  /** 0 = vacía, 1 = débil, 2 = aceptable, 3 = buena, 4 = fuerte. */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
};

/**
 * Evalúa la fuerza de una contraseña con heurística simple:
 * 1 punto por cada charset presente + bonus por longitud ≥12.
 */
export function evaluarFuerza(password: string): FuerzaPassword {
  if (!password) return { score: 0, label: "" };

  let score = 0;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // Penalización por longitud corta.
  if (password.length < 8) score = Math.min(score, 1);
  else if (password.length < 10) score = Math.min(score, 2);

  // Bonus por longitud generosa.
  if (password.length >= 12 && score >= 3) score = 4;

  const final = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  const labels: Record<typeof final, string> = {
    0: "",
    1: "Débil",
    2: "Aceptable",
    3: "Buena",
    4: "Fuerte",
  };
  return { score: final, label: labels[final] };
}
