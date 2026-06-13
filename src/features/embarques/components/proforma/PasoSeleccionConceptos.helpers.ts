import type { Tables } from "@/types/db";

type EmbarqueContenedor = Tables<"embarque_contenedores">;

export function buildContenedorLabelMap(contenedores: EmbarqueContenedor[]) {
  return new Map(
    contenedores.map((c) => [c.id, c.numero_contenedor || `#${c.orden}`]),
  );
}
