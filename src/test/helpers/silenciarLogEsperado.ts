/**
 * Silencia SÓLO los logs que una prueba provoca a propósito.
 *
 * Contexto (Ola · limpieza de ruido en CI): el shard 4 imprimía el stack de
 * `[useNotaCreditoDraft] handleSubmit failed: LC_TC_NO_DISPONIBLE...` aunque ese
 * error es justamente lo que la prueba verifica. Un mock global de consola
 * ocultaría fallos ajenos, así que el silencio se acota a la prueba y se
 * restaura siempre.
 *
 * Uso:
 * ```ts
 * const log = silenciarLogEsperado();
 * try { ...  } finally { log.restaurar(); }
 * // o: afterEach(() => log.restaurar());
 * ```
 */
import { vi, type MockInstance } from "vitest";

type Metodo = "warn" | "error";

export interface LogSilenciado {
  /** Restaura los métodos originales de consola. Idempotente. */
  restaurar: () => void;
  /** Argumentos capturados, para afirmar que el mensaje esperado sí se registró. */
  llamadas: (metodo: Metodo) => unknown[][];
}

export function silenciarLogEsperado(
  metodos: Metodo[] = ["warn", "error"],
): LogSilenciado {
  const spies = new Map<Metodo, MockInstance>();
  for (const metodo of metodos) {
    spies.set(metodo, vi.spyOn(console, metodo).mockImplementation(() => {}));
  }
  return {
    restaurar() {
      for (const spy of spies.values()) spy.mockRestore();
      spies.clear();
    },
    llamadas(metodo) {
      const spy = spies.get(metodo);
      return spy ? (spy.mock.calls as unknown[][]) : [];
    },
  };
}
