/** Reglas puras del alta de prospecto externo desde el Portal de Brokers. */
export const TRANSPORTES = ["Marítimo", "Aéreo", "Terrestre", "Ferroviario"] as const;

export interface ContactoBroker {
  nombre: string;
  email: string;
  movil: string;
  fijo: string;
  puesto: string;
}

export interface EmpresaBroker {
  nombre: string;
  pais: string;
  transporte: string[];
  volumen_usd: string;
  rutas: string;
  agente_propio: string;
  rfc: string;
  sector: string;
  origen: string;
  destino: string;
  incoterm: string;
  proveedor_actual: string;
  notas: string;
}

export const contactoVacio = (): ContactoBroker => ({ nombre: "", email: "", movil: "", fijo: "", puesto: "" });

export const empresaVacia = (): EmpresaBroker => ({
  nombre: "", pais: "", transporte: [], volumen_usd: "", rutas: "", agente_propio: "", rfc: "",
  sector: "", origen: "", destino: "", incoterm: "", proveedor_actual: "", notas: "",
});

/** Devuelve el primer problema a corregir, o null si se puede enviar. */
export function validarAlta(e: EmpresaBroker, contactos: readonly ContactoBroker[]): string | null {
  if (e.nombre.trim().length < 2) return "Escribe el nombre de la empresa.";
  if (e.pais.trim() === "") return "Indica el país.";
  if (e.transporte.length === 0) return "Elige al menos un tipo de transporte.";
  const conNombre = contactos.filter((c) => c.nombre.trim() !== "");
  if (conNombre.length === 0) return "Agrega al menos un contacto con nombre.";
  if (conNombre.some((c) => c.email.trim() !== "" && !c.email.includes("@"))) return "Revisa el correo de los contactos.";
  return null;
}

export function payloadAlta(e: EmpresaBroker, contactos: readonly ContactoBroker[]) {
  const t = (v: string) => v.trim();
  return {
    empresa: {
      nombre: t(e.nombre), pais: t(e.pais), transporte: e.transporte.join(", "), volumen_usd: t(e.volumen_usd),
      rutas: t(e.rutas), agente_propio: t(e.agente_propio), rfc: t(e.rfc).toUpperCase(), sector: t(e.sector),
      origen: t(e.origen), destino: t(e.destino), incoterm: t(e.incoterm), proveedor_actual: t(e.proveedor_actual),
      notas: t(e.notas),
    },
    contactos: contactos
      .filter((c) => c.nombre.trim() !== "")
      .map((c) => ({ nombre: t(c.nombre), email: t(c.email), movil: t(c.movil), fijo: t(c.fijo), puesto: t(c.puesto) })),
  };
}
