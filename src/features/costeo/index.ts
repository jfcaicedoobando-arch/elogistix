/**
 * Barrel público del feature Costeo.
 * Sólo expone lo que otros features pueden consumir sin imports profundos.
 * Etapa 2: utilidad única de presentación de identidad de puertos.
 */
export {
  contextoPuerto,
  contextoRuta,
  destinoDe,
  etiquetaPuertoCompleta,
  etiquetaRutaCompleta,
  nombrePuerto,
  origenDe,
  rutaCorta,
  textoBusquedaPuertos,
} from "./utils/puertoLabel";
export type { FilaConPuertos, PuertoIdentidad } from "./utils/puertoLabel";
