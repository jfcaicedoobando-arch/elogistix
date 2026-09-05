/**
 * Estado del formulario de NuevaOportunidadDialog.
 * Extraído del componente para mantenerlo ≤200 LOC.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CrmOportunidadRow } from "@/features/crm/hooks/useOportunidades";
import type { User } from "@supabase/supabase-js";
import {
  EMPTY_OPORTUNIDAD,
  type OportunidadFormState,
} from "@/features/crm/domain/oportunidadFormState";
import {
  buildFromOportunidad,
  buildEmptyForNueva,
  primeraEtapaAbierta,
  type OrigenInicial,
} from "@/features/crm/domain/oportunidadFormHelpers";

export type { OportunidadFormState };
export type { OrigenInicial };
export { EMPTY_OPORTUNIDAD };

interface Etapa {
  id: string;
  probabilidad_default: number;
  tipo?: string;
}

/** Comparación estable de dos estados del formulario (objeto plano y pequeño). */
function mismoForm(a: OportunidadFormState, b: OportunidadFormState): boolean {
  return (Object.keys(a) as (keyof OportunidadFormState)[]).every((k) => a[k] === b[k]);
}

export function useOportunidadForm(
  open: boolean,
  oportunidad: CrmOportunidadRow | null | undefined,
  etapas: Etapa[],
  user: User | null,
  /**
   * Datos precapturados que viajan del alta express al formulario completo
   * (origen/ownership ya elegido y nombre escrito).
   */
  precapturado?: { origen?: OrigenInicial | null; nombre?: string | null; etapaId?: string | null },
) {
  const origenInicial = precapturado?.origen ?? null;
  const nombreInicial = precapturado?.nombre ?? null;
  // CTA de columna del Kanban: etapa destino prefijada (sólo si es abierta).
  const etapaIdInicial = precapturado?.etapaId ?? null;
  const [form, setForm] = useState<OportunidadFormState>(EMPTY_OPORTUNIDAD);

  // Sólo recalculamos cuando cambia la *identidad* del registro o el estado
  // open. `etapas` y `user` se leen vía ref para evitar que padres que pasen
  // arreglos/objetos nuevos en cada render provoquen un loop infinito
  // (setForm → re-render → useEffect → setForm…) que en suites grandes
  // termina en OOM (~8GB). Ref + lectura perezosa rompe el ciclo sin
  // perder el valor más reciente.
  const etapasRef = useRef(etapas);
  const userRef = useRef(user);
  const oportunidadRef = useRef(oportunidad);
  const origenRef = useRef(origenInicial);
  const nombreRef = useRef(nombreInicial);
  const etapaRef = useRef(etapaIdInicial);
  const formRef = useRef(form);
  etapasRef.current = etapas;
  userRef.current = user;
  oportunidadRef.current = oportunidad;
  origenRef.current = origenInicial;
  nombreRef.current = nombreInicial;
  etapaRef.current = etapaIdInicial;
  formRef.current = form;

  /** Fotografía del estado inicial construido: base para `isDirty`. */
  const inicialRef = useRef<OportunidadFormState>(EMPTY_OPORTUNIDAD);

  const oportunidadId = oportunidad?.id ?? null;
  // La identidad del origen prefijado también reinicia el formulario.
  const origenKey = origenInicial ? `${origenInicial.tipo}:${origenInicial.id}` : "";
  const nombreKey = nombreInicial ?? "";
  const etapaKey = etapaIdInicial ?? "";

  useEffect(() => {
    const current = oportunidadRef.current;
    let inicial: OportunidadFormState;
    if (current) {
      inicial = buildFromOportunidad(current);
    } else if (open) {
      inicial = buildEmptyForNueva(etapasRef.current, userRef.current, origenRef.current);
      const nombrePrecapturado = (nombreRef.current ?? "").trim();
      if (nombrePrecapturado) inicial = { ...inicial, nombre: nombrePrecapturado };
      // Etapa prefijada por el CTA de la columna: sólo se respeta si existe
      // y es ABIERTA (la regla "nunca crear en Ganada/Perdida" se mantiene).
      const etapaPreId = etapaRef.current;
      if (etapaPreId) {
        const pre = etapasRef.current.find((e) => e.id === etapaPreId && e.tipo === "abierta");
        if (pre) inicial = { ...inicial, etapa_id: pre.id, probabilidad: pre.probabilidad_default };
      }
    } else {
      return;
    }
    inicialRef.current = inicial;
    setForm(inicial);
    // La dependencia real es la *identidad* del registro (oportunidadId), el
    // origen prefijado, el nombre/etapa precapturados y `open`; los objetos
    // se leen vía ref para evitar loops cuando el backend devuelve una
    // referencia nueva con el mismo id.
  }, [oportunidadId, open, origenKey, nombreKey, etapaKey]);

  // Etapas que llegan tarde (creación): si el pipeline aún no había cargado al
  // abrir, hidratamos SÓLO etapa/probabilidad y sincronizamos la fotografía
  // inicial para que el arribo de datos no marque el formulario como sucio.
  // Etapa por omisión: la prefijada por la columna del Kanban si es abierta;
  // si no, la primera etapa abierta del pipeline.
  const etapaDefault = useMemo(() => {
    if (etapaIdInicial) {
      const pre = etapas.find((e) => e.id === etapaIdInicial && e.tipo === "abierta");
      if (pre) return pre;
    }
    return primeraEtapaAbierta(etapas);
  }, [etapas, etapaIdInicial]);
  const etapaDefaultId = etapaDefault?.id ?? "";
  const etapaDefaultProb = etapaDefault?.probabilidad_default ?? 0;

  useEffect(() => {
    if (!open || oportunidadRef.current || !etapaDefaultId) return;
    if (formRef.current.etapa_id) return;
    setForm((f) => ({ ...f, etapa_id: etapaDefaultId, probabilidad: etapaDefaultProb }));
    inicialRef.current = {
      ...inicialRef.current,
      etapa_id: etapaDefaultId,
      probabilidad: etapaDefaultProb,
    };
  }, [open, etapaDefaultId, etapaDefaultProb]);

  const set = <K extends keyof OportunidadFormState>(k: K, v: OportunidadFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const isDirty = !mismoForm(form, inicialRef.current);

  /** Marca el estado actual como "guardado" (evita confirmación de descarte). */
  const markClean = useCallback(() => {
    inicialRef.current = formRef.current;
  }, []);

  return { form, setForm, set, isDirty, markClean };
}
