/**
 * Estado del formulario de NuevaOportunidadDialog.
 * Extraído del componente para mantenerlo ≤200 LOC.
 */
import { useEffect, useState } from "react";
import type { CrmOportunidadRow, Moneda } from "@/hooks/crm/useOportunidades";
import type { User } from "@supabase/supabase-js";

export interface OportunidadFormState {
  nombre: string;
  cliente_id: string | null;
  cliente_nombre: string;
  etapa_id: string;
  monto_estimado: number;
  moneda: Moneda;
  probabilidad: number;
  fecha_estimada_cierre: string;
  modo: string;
  origen: string;
  destino: string;
  notas: string;
  vendedor_id: string | null;
  vendedor_email: string;
}

export const EMPTY_OPORTUNIDAD: OportunidadFormState = {
  nombre: "",
  cliente_id: null,
  cliente_nombre: "",
  etapa_id: "",
  monto_estimado: 0,
  moneda: "MXN",
  probabilidad: 0,
  fecha_estimada_cierre: "",
  modo: "",
  origen: "",
  destino: "",
  notas: "",
  vendedor_id: null,
  vendedor_email: "",
};

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
      setForm({
        nombre: oportunidad.nombre,
        cliente_id: oportunidad.cliente_id ?? null,
        cliente_nombre: oportunidad.cliente_nombre ?? "",
        etapa_id: oportunidad.etapa_id,
        monto_estimado: Number(oportunidad.monto_estimado ?? 0),
        moneda: (oportunidad.moneda as Moneda) ?? "MXN",
        probabilidad: oportunidad.probabilidad ?? 0,
        fecha_estimada_cierre: oportunidad.fecha_estimada_cierre ?? "",
        modo: oportunidad.modo ?? "",
        origen: oportunidad.origen ?? "",
        destino: oportunidad.destino ?? "",
        notas: oportunidad.notas ?? "",
        vendedor_id: oportunidad.vendedor_id ?? null,
        vendedor_email: oportunidad.vendedor_email ?? "",
      });
    } else if (open) {
      const primera = etapas[0];
      setForm({
        ...EMPTY_OPORTUNIDAD,
        etapa_id: primera?.id ?? "",
        probabilidad: primera?.probabilidad_default ?? 0,
        vendedor_id: user?.id ?? null,
        vendedor_email: user?.email ?? "",
      });
    }
  }, [oportunidad, open, etapas, user]);

  const set = <K extends keyof OportunidadFormState>(k: K, v: OportunidadFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return { form, setForm, set };
}
