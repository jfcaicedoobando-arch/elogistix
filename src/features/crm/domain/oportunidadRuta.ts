/**
 * Etapa 4 · helpers puros de la ruta de una oportunidad CRM (modo + puertos).
 *
 * Reglas de negocio que viven aquí (y no en el componente, Power of 10):
 * - El modo puede quedar vacío: la oportunidad comercial no se bloquea. El
 *   candado al convertir a cotización sigue viviendo en el flujo de conversión.
 * - Al hidratar un registro legacy se normalizan las variantes reconocibles
 *   ("Maritimo", "Marítimo FCL", "Aereo consolidado"). Si el texto NO es
 *   reconocible se conserva tal cual, con una advertencia accionable: nunca se
 *   asume "Marítimo" ni se borra en silencio al guardar otros campos.
 * - Sólo el modo Marítimo persiste identidad de puerto (IDs del catálogo). Al
 *   salir de Marítimo se conserva el texto y se limpian los IDs obsoletos.
 * - Jamás se persisten IDs de origen y destino iguales.
 */
import { mapModoCrmACotizacion, type ModoCotizacion } from "@/features/crm/domain/modoCotizacion";

export const MODOS_OPORTUNIDAD: ModoCotizacion[] = [
  "Marítimo",
  "Aéreo",
  "Terrestre",
  "Multimodal",
];

/** Estado mínimo de ruta compartido por el formulario y los payloads. */
export interface RutaOportunidad {
  modo: string;
  origen: string;
  destino: string;
  puerto_origen_id: string | null;
  puerto_destino_id: string | null;
}

export type ExtremoRuta = "origen" | "destino";

export function esModoMaritimo(modo: string): boolean {
  return mapModoCrmACotizacion(modo) === "Marítimo";
}

/**
 * Normaliza el modo guardado. Devuelve el valor a mostrar y, cuando el texto no
 * corresponde a ningún modo, una advertencia accionable para el usuario.
 */
export function normalizarModoOportunidad(
  modo: string | null | undefined,
): { valor: string; advertencia: string | null } {
  const texto = (modo ?? "").trim();
  if (!texto) return { valor: "", advertencia: null };
  const canonico = mapModoCrmACotizacion(texto);
  if (canonico) return { valor: canonico, advertencia: null };
  return {
    valor: texto,
    advertencia: `El modo capturado ("${texto}") no corresponde a Marítimo, Aéreo, Terrestre ni Multimodal. Elige uno antes de cotizar.`,
  };
}

/**
 * Cambio de modo: conserva origen/destino en texto y limpia los IDs de puerto
 * cuando el modo destino no es Marítimo.
 */
export function aplicarCambioModo<T extends RutaOportunidad>(ruta: T, modo: string): T {
  if (esModoMaritimo(modo)) return { ...ruta, modo };
  return { ...ruta, modo, puerto_origen_id: null, puerto_destino_id: null };
}

/**
 * Captura atómica de un extremo: texto + ID (ID `null` para texto libre). Si el
 * ID elegido coincide con el del otro extremo, se limpia el ID del otro extremo
 * (su texto se conserva) para que nunca queden dos IDs iguales.
 */
export function aplicarCambioPuerto<T extends RutaOportunidad>(
  ruta: T,
  extremo: ExtremoRuta,
  texto: string,
  puertoId: string | null,
): T {
  const esOrigen = extremo === "origen";
  const otroId = esOrigen ? ruta.puerto_destino_id : ruta.puerto_origen_id;
  const colisiona = Boolean(puertoId) && puertoId === otroId;
  if (esOrigen) {
    return {
      ...ruta,
      origen: texto,
      puerto_origen_id: puertoId,
      puerto_destino_id: colisiona ? null : ruta.puerto_destino_id,
    };
  }
  return {
    ...ruta,
    destino: texto,
    puerto_destino_id: puertoId,
    puerto_origen_id: colisiona ? null : ruta.puerto_origen_id,
  };
}

/**
 * IDs que deben persistirse: sólo en Marítimo y nunca iguales entre sí.
 */
export function idsPuertoPersistibles(
  ruta: RutaOportunidad,
): { puerto_origen_id: string | null; puerto_destino_id: string | null } {
  if (!esModoMaritimo(ruta.modo)) {
    return { puerto_origen_id: null, puerto_destino_id: null };
  }
  const origen = ruta.puerto_origen_id ?? null;
  const destino = ruta.puerto_destino_id ?? null;
  if (origen && destino && origen === destino) {
    return { puerto_origen_id: origen, puerto_destino_id: null };
  }
  return { puerto_origen_id: origen, puerto_destino_id: destino };
}
