/** Helpers puros de `DemorasTarifaEditor` (Power of 10: ≤200 líneas). */
import type { DemorasTramoInput } from "@/features/costeo/types/navieraCondicion";

export interface TramoEditable extends DemorasTramoInput {
  _key: string;
}

export const nuevoTramo = (i: number): TramoEditable => ({
  _key: `new-${i}-${Date.now()}`,
  tipo_contenedor_id: "",
  desde_dia: 1,
  hasta_dia: null,
  monto_por_dia: 0,
  moneda: "USD",
});

interface TramoGuardado extends DemorasTramoInput {
  id?: string;
}

/** Tramos guardados del tipo elegido, en forma editable. */
export function tramosEditablesDeTipo(tramos: TramoGuardado[], tipoId: string): TramoEditable[] {
  return tramos
    .filter((t) => t.tipo_contenedor_id === tipoId)
    .map((t, i) => ({
      _key: t.id ?? `t-${i}`,
      tipo_contenedor_id: t.tipo_contenedor_id,
      desde_dia: t.desde_dia,
      hasta_dia: t.hasta_dia,
      monto_por_dia: Number(t.monto_por_dia),
      moneda: t.moneda,
    }));
}
