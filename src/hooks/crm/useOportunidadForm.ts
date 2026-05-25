/**
 * Estado del formulario de NuevaOportunidadDialog.
 * Extraído del componente para mantenerlo ≤200 LOC.
 */
import { useEffect, useState } from "react";
import type { CrmOportunidadRow } from "@/hooks/crm/useOportunidades";
import type { User } from "@supabase/supabase-js";
import {
  EMPTY_OPORTUNIDAD,
  type OportunidadFormState,
} from "./oportunidadFormState";
import {
  buildFromOportunidad,
  buildEmptyForNueva,
} from "./oportunidadFormHelpers";

export type { OportunidadFormState };
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
) {
  const [form, setForm] = useState<OportunidadFormState>(EMPTY_OPORTUNIDAD);

  useEffect(() => {
    if (oportunidad) {
      setForm(buildFromOportunidad(oportunidad));
    } else if (open) {
      setForm(buildEmptyForNueva(etapas, user));
    }
  }, [oportunidad, open, etapas, user]);

  const set = <K extends keyof OportunidadFormState>(k: K, v: OportunidadFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return { form, setForm, set };
}
