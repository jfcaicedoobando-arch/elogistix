import type { TipoPropiedad } from "@/features/crm/services/propiedadesCrm";

/** Nombre visible de cada tipo de propiedad. */
export const ETIQUETA_TIPO: Record<TipoPropiedad, string> = {
  seleccion: "Lista (una opción)", multiseleccion: "Lista (varias opciones)",
  numero: "Número", fecha: "Fecha", texto: "Texto libre",
};
