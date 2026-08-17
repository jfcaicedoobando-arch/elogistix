/**
 * Validaciones puras del formulario de tarifas de demoras (venta).
 * Extraído de CosteoDemorasVenta.tsx para respetar el límite de líneas.
 */
import { notifyError } from "@/lib/ui/appFeedback";
import { tramosSeSolapan, vigenciasSeSolapan } from "@/features/costeo/utils/demorasTramos";
import type { DemoraVentaTarifaInput } from "@/features/costeo/services/demorasVenta";

type Tarifa = DemoraVentaTarifaInput & { id: string };

/** EC-20: valida que el tramo de días sea coherente (enteros, desde <= hasta). */
export function validarTramoDias(form: DemoraVentaTarifaInput): boolean {
  if (!Number.isInteger(form.desde_dia) || form.desde_dia < 1) {
    notifyError(undefined, {
      title: "Tramo inválido",
      description: "El día inicial debe ser un entero mayor o igual a 1.",
    });
    return false;
  }
  if (form.hasta_dia !== null && (!Number.isInteger(form.hasta_dia) || form.hasta_dia < form.desde_dia)) {
    notifyError(undefined, {
      title: "Tramo inválido",
      description: "El día final debe ser un entero mayor o igual al día inicial (o quedar vacío).",
    });
    return false;
  }
  return true;
}

/** B-096: impide tramos solapados con los vigentes del mismo contenedor. */
export function validarSinSolape(tarifas: Tarifa[], form: DemoraVentaTarifaInput): boolean {
  const solapada = tarifas.find((t) =>
    t.tipo_contenedor_id === form.tipo_contenedor_id &&
    tramosSeSolapan(t, form) &&
    vigenciasSeSolapan(t.vigente_desde, t.vigente_hasta, form.vigente_desde, form.vigente_hasta),
  );
  if (solapada) {
    notifyError(undefined, {
      title: "El tramo se solapa con uno existente",
      description: `Ya hay un tramo días ${solapada.desde_dia}–${solapada.hasta_dia ?? "∞"} para este contenedor en vigencias traslapadas. Ajusta el rango o la vigencia.`,
    });
    return false;
  }
  return true;
}
