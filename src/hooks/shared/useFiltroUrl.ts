/**
 * Ola 8 (hallazgo M8) — Deep linking de filtros.
 *
 * Estos hooks sustituyen `useState` en los filtros de listados para que el
 * estado viva en el query string: la URL se puede compartir, el botón atrás
 * funciona y un refresh no pierde el filtro.
 *
 * `useFiltroUrl` es para filtros con valores cerrados (enum/literales);
 * `useTextoUrl` para búsquedas y valores abiertos (folio, método de pago, id).
 * En ambos casos el valor por defecto NO se escribe en la URL (se limpia con
 * `null`), así el link queda corto y legible.
 */
import { useCallback } from "react";
import { useQueryState, parseAsString, parseAsStringLiteral } from "nuqs";

export function useFiltroUrl<T extends string>(
  key: string,
  valores: readonly T[],
  porDefecto: T,
): readonly [T, (v: T) => void] {
  const [valor, setRaw] = useQueryState(
    key,
    parseAsStringLiteral(valores).withDefault(porDefecto),
  );
  const setValor = useCallback(
    (v: T) => { void setRaw(v === porDefecto ? null : v); },
    [setRaw, porDefecto],
  );
  return [valor as T, setValor] as const;
}

export function useTextoUrl(
  key: string,
  porDefecto = "",
): readonly [string, (v: string) => void] {
  const [valor, setRaw] = useQueryState(key, parseAsString.withDefault(porDefecto));
  const setValor = useCallback(
    (v: string) => { void setRaw(!v || v === porDefecto ? null : v); },
    [setRaw, porDefecto],
  );
  return [valor, setValor] as const;
}
