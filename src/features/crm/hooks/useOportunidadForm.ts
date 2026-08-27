/**
 * Estado del formulario de NuevaOportunidadDialog.
 * Extraído del componente para mantenerlo ≤200 LOC.
 */
import { useEffect, useRef, useState } from "react";
import type { CrmOportunidadRow } from "@/features/crm/hooks/useOportunidades";
import type { User } from "@supabase/supabase-js";
import {
  EMPTY_OPORTUNIDAD,
  type OportunidadFormState,
} from "@/features/crm/domain/oportunidadFormState";
import {
  buildFromOportunidad,
  buildEmptyForNueva,
  type OrigenInicial,
} from "@/features/crm/domain/oportunidadFormHelpers";

export type { OportunidadFormState };
export type { OrigenInicial };
export { EMPTY_OPORTUNIDAD };

interface Etapa {
  id: string;
  probabilidad_default: number;
}

export function useOportunidadForm(
  open: boolean,
  oportunidad: CrmOportunidadRow | null | undefined,
  etapas: Etapa[],
  user: User | null,
  origenInicial?: OrigenInicial | null,
) {
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
  etapasRef.current = etapas;
  userRef.current = user;
  oportunidadRef.current = oportunidad;
  origenRef.current = origenInicial;

  const oportunidadId = oportunidad?.id ?? null;
  // La identidad del origen prefijado también reinicia el formulario.
  const origenKey = origenInicial ? `${origenInicial.tipo}:${origenInicial.id}` : "";

  useEffect(() => {
    const current = oportunidadRef.current;
    if (current) {
      setForm(buildFromOportunidad(current));
    } else if (open) {
      setForm(buildEmptyForNueva(etapasRef.current, userRef.current, origenRef.current));
    }
    // La dependencia real es la *identidad* del registro (oportunidadId), el
    // origen prefijado y `open`; los objetos se leen vía ref para evitar loops
    // cuando el backend devuelve una referencia nueva con el mismo id.
  }, [oportunidadId, open, origenKey]);

  const set = <K extends keyof OportunidadFormState>(k: K, v: OportunidadFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return { form, setForm, set };
}
