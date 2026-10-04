/**
 * Navegación por pasos del modal "Capturar factura de proveedor" (v13.712.0).
 *
 * Arranca en el paso 1 (captura manual y buzón), clasifica pendientes y
 * valida antes de avanzar desde los datos de la factura. Permite volver
 * desde el footer al paso con errores y enfocar el primer campo inválido.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const PASOS_CAPTURA = [
  "Documento y conceptos",
  "Datos de la factura",
  "Vincular al embarque",
] as const;

export const TOTAL_PASOS_CAPTURA = PASOS_CAPTURA.length;

export interface PendientesPorPaso {
  /** Pendientes del paso 1 (documento/conceptos). */
  documento: string[];
  /** Pendientes del paso 2 (proveedor, folio, importes, T/C). */
  datos: string[];
  /** Pendientes del paso 3 (vinculación al embarque). */
  vinculacion: string[];
}

const REGLAS_PASO: ReadonlyArray<{ paso: 1 | 2 | 3; patron: RegExp }> = [
  { paso: 1, patron: /cfdi ya está capturado|conceptos/i },
  { paso: 3, patron: /vinculad|excede el subtotal/i },
];

/** Clasifica un pendiente textual en el paso donde se resuelve. */
export function pasoDePendiente(pendiente: string): 1 | 2 | 3 {
  const regla = REGLAS_PASO.find((r) => r.patron.test(pendiente));
  return regla ? regla.paso : 2;
}

/** Agrupa los pendientes por paso conservando su orden original. */
export function agruparPendientes(pendientes: readonly string[]): PendientesPorPaso {
  const grupos: PendientesPorPaso = { documento: [], datos: [], vinculacion: [] };
  for (const p of pendientes) {
    const paso = pasoDePendiente(p);
    if (paso === 1) grupos.documento.push(p);
    else if (paso === 3) grupos.vinculacion.push(p);
    else grupos.datos.push(p);
  }
  return grupos;
}

interface Args {
  /** El modal está abierto (para reiniciar el paso al reabrir). */
  abierto: boolean;
  /** Pendientes vigentes de la captura (texto plano). */
  pendientes: readonly string[];
  /** Valida los campos del paso 2 sin borrar la captura. */
  validarDatos?: () => boolean;
}

export interface CapturaPasos {
  paso: 1 | 2 | 3;
  totalPasos: number;
  etiquetas: readonly string[];
  esUltimo: boolean;
  esPrimero: boolean;
  irA: (paso: 1 | 2 | 3) => void;
  siguiente: () => void;
  revisarDatos: () => boolean;
  solicitudFoco: number;
  anterior: () => void;
  pendientesPorPaso: PendientesPorPaso;
  /** Pendientes que no se resuelven en el paso activo. */
  pendientesDeOtrosPasos: Array<{ paso: 1 | 2 | 3; texto: string }>;
}

export function useCapturaFacturaPasos({ abierto, pendientes, validarDatos }: Args): CapturaPasos {
  // v13.712.1: el wizard SIEMPRE arranca en el paso 1, incluso desde el buzón:
  // el usuario debe ver primero el documento y sus conceptos antes de capturar.
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const estabaAbierto = useRef(abierto);
  const [solicitudFoco, setSolicitudFoco] = useState(0);

  // Al reabrir el modal volvemos al primer paso.
  useEffect(() => {
    if (abierto && !estabaAbierto.current) setPaso(1);
    estabaAbierto.current = abierto;
  }, [abierto]);


  const irA = useCallback((destino: 1 | 2 | 3) => setPaso(destino), []);
  const revisarDatos = useCallback(() => {
    if (!validarDatos || validarDatos()) return true;
    setPaso(2);
    setSolicitudFoco((n) => n + 1);
    return false;
  }, [validarDatos]);
  const siguiente = useCallback(() => {
    if (paso === 2 && !revisarDatos()) return;
    setPaso((p) => (p < TOTAL_PASOS_CAPTURA ? ((p + 1) as 1 | 2 | 3) : p));
  }, [paso, revisarDatos]);
  const anterior = useCallback(
    () => setPaso((p) => (p > 1 ? ((p - 1) as 1 | 2 | 3) : p)),
    [],
  );

  const pendientesPorPaso = useMemo(() => agruparPendientes(pendientes), [pendientes]);

  const pendientesDeOtrosPasos = useMemo(
    () =>
      pendientes
        .map((texto) => ({ paso: pasoDePendiente(texto), texto }))
        .filter((p) => p.paso !== paso),
    [pendientes, paso],
  );

  return {
    paso,
    totalPasos: TOTAL_PASOS_CAPTURA,
    etiquetas: PASOS_CAPTURA,
    esUltimo: paso === TOTAL_PASOS_CAPTURA,
    esPrimero: paso === 1,
    irA,
    siguiente, revisarDatos, solicitudFoco,
    anterior,
    pendientesPorPaso,
    pendientesDeOtrosPasos,
  };
}
