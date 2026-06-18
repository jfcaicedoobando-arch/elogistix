/**
 * Pre-check de captura: para embarques Marítimo FCL exige que cada
 * contenedor tenga `peso_kg > 0` y `volumen_m3 > 0` antes de generar
 * proformas o cerrar el embarque.
 *
 * La misma regla vive también en la RPC `validar_cierre_embarque`
 * (regla `contenedores_datos_completos`); esta utilidad cliente se
 * usa para abortar el flujo de proforma antes de llegar a la RPC
 * de creación, que no conoce la regla.
 */
import type { Tables } from "@/integrations/supabase/types";

type EmbarqueLike = Pick<Tables<"embarques">, "modo" | "tipo_servicio">;
type ContenedorLike = Pick<Tables<"embarque_contenedores">, "peso_kg" | "volumen_m3">;

export interface ValidacionContenedoresFCL {
  ok: boolean;
  aplica: boolean;
  incompletos: number;
  mensaje?: string;
}

export function validarContenedoresFCL(
  embarque: EmbarqueLike,
  contenedores: ContenedorLike[],
): ValidacionContenedoresFCL {
  const aplica = embarque.modo === "Marítimo" && embarque.tipo_servicio === "FCL";
  if (!aplica) {
    return { ok: true, aplica: false, incompletos: 0 };
  }

  const incompletos = contenedores.filter(
    (c) => Number(c.peso_kg ?? 0) <= 0 || Number(c.volumen_m3 ?? 0) <= 0,
  ).length;

  if (incompletos === 0) {
    return { ok: true, aplica: true, incompletos: 0 };
  }

  return {
    ok: false,
    aplica: true,
    incompletos,
    mensaje:
      incompletos === 1
        ? "Captura peso y volumen del contenedor antes de generar la proforma."
        : `Captura peso y volumen de los ${incompletos} contenedores antes de generar la proforma.`,
  };
}
