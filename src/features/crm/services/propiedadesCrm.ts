/**
 * Propiedades configurables del CRM (Fase 3). Catálogo global: solo el
 * súper administrador escribe (RLS). Nada se borra: se archiva.
 * Renombrar una opción crea una opción nueva que la reemplaza y archiva la anterior,
 * así los valores guardados con la opción vieja siguen cuadrando.
 */
import { supabase } from "@/integrations/supabase/client";

export type ObjetoCrm = "empresa" | "contacto" | "oportunidad" | "actividad";
export type TipoPropiedad = "seleccion" | "multiseleccion" | "numero" | "fecha" | "texto";

export interface OpcionCrm { id: string; etiqueta: string; orden: number; archivada: boolean; reemplaza_a: string | null }
export interface PropiedadCrm {
  id: string; objeto: ObjetoCrm; clave: string; etiqueta: string; tipo: TipoPropiedad;
  obligatoria: boolean; orden: number; archivada: boolean; opciones: OpcionCrm[];
}

const COLS = "id, objeto, clave, etiqueta, tipo, obligatoria, orden, archivada, opciones:crm_propiedad_opciones(id, etiqueta, orden, archivada, reemplaza_a)";

export async function fetchPropiedades(objeto: ObjetoCrm): Promise<PropiedadCrm[]> {
  const { data, error } = await supabase.from("crm_propiedades").select(COLS)
    .eq("objeto", objeto).order("orden").limit(200);
  if (error) throw error;
  // SAFE-CAST: los CHECK de la tabla restringen `objeto` y `tipo` a estas uniones.
  return ((data ?? []) as unknown as PropiedadCrm[]).map((p) => ({
    ...p, opciones: [...p.opciones].sort((a, b) => a.orden - b.orden),
  }));
}

export function claveDesdeEtiqueta(etiqueta: string): string {
  return etiqueta.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}

export interface NuevaPropiedad { objeto: ObjetoCrm; etiqueta: string; tipo: TipoPropiedad; orden: number }

export async function crearPropiedad(p: NuevaPropiedad): Promise<void> {
  const etiqueta = p.etiqueta.trim();
  const clave = claveDesdeEtiqueta(etiqueta);
  if (!clave) throw new Error("Escribe un nombre para la propiedad");
  const { error } = await supabase.from("crm_propiedades").insert({ ...p, etiqueta, clave });
  if (error?.code === "23505") throw new Error("Ya existe una propiedad con ese nombre");
  if (error) throw error;
}

export type CambioPropiedad = Partial<Pick<PropiedadCrm, "etiqueta" | "obligatoria" | "orden" | "archivada">>;

export async function actualizarPropiedad(id: string, cambio: CambioPropiedad): Promise<void> {
  if (cambio.etiqueta !== undefined && !cambio.etiqueta.trim()) throw new Error("El nombre no puede quedar vacío");
  const { error } = await supabase.from("crm_propiedades").update(cambio).eq("id", id);
  if (error) throw error;
}

export async function crearOpcion(propiedadId: string, etiqueta: string, orden: number): Promise<void> {
  const limpio = etiqueta.trim();
  if (!limpio) throw new Error("Escribe el nombre de la opción");
  const { error } = await supabase.from("crm_propiedad_opciones").insert({ propiedad_id: propiedadId, etiqueta: limpio, orden });
  if (error) throw error;
}

/** Renombrar = opción nueva que reemplaza a la anterior + archivar la anterior. */
export async function renombrarOpcion(propiedadId: string, anterior: OpcionCrm, etiqueta: string): Promise<void> {
  const limpio = etiqueta.trim();
  if (!limpio || limpio === anterior.etiqueta) return;
  const { error } = await supabase.from("crm_propiedad_opciones")
    .insert({ propiedad_id: propiedadId, etiqueta: limpio, orden: anterior.orden, reemplaza_a: anterior.id });
  if (error) throw error;
  await archivarOpcion(anterior.id, true);
}

export async function archivarOpcion(id: string, archivada: boolean): Promise<void> {
  const { error } = await supabase.from("crm_propiedad_opciones").update({ archivada }).eq("id", id);
  if (error) throw error;
}

/** Sigue la cadena de reemplazos para mostrar el nombre vigente de una opción guardada. */
export function etiquetaVigente(opciones: OpcionCrm[], id: string): string | null {
  const porId = new Map(opciones.map((o) => [o.id, o]));
  const sucesor = new Map(opciones.filter((o) => o.reemplaza_a).map((o) => [o.reemplaza_a!, o]));
  let actual = porId.get(id);
  for (let i = 0; actual && i < 20; i++) {
    const sig = sucesor.get(actual.id);
    if (!sig) break;
    actual = sig;
  }
  return actual?.etiqueta ?? null;
}

/** Id vigente (resuelve reemplazos) para que el selector muestre la opción actual. */
export function idVigente(opciones: OpcionCrm[], id: string): string {
  const sucesor = new Map(opciones.filter((o) => o.reemplaza_a).map((o) => [o.reemplaza_a!, o.id]));
  let actual = id;
  for (let i = 0; i < 20 && sucesor.has(actual); i++) actual = sucesor.get(actual)!;
  return actual;
}
