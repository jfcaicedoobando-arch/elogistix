import type { QueryClient } from "@tanstack/react-query";

/** Cola efímera por QueryClient/destino: ninguna captura cancelable se hidrata entre sesiones. */
const colas = new WeakMap<QueryClient, Map<string, Promise<void>>>();

export function encolarAutoSave<T>(qc: QueryClient, destino: string, guardar: () => Promise<T>): Promise<T> {
  const cola = colas.get(qc) ?? new Map<string, Promise<void>>();
  colas.set(qc, cola);
  const previo = cola.get(destino) ?? Promise.resolve();
  const resultado = previo.then(guardar);
  const terminado = resultado.then(() => undefined, () => undefined);
  cola.set(destino, terminado);
  void terminado.then(() => { if (cola.get(destino) === terminado) cola.delete(destino); });
  return resultado;
}
