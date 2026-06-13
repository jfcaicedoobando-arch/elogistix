/**
 * Tipos del dominio "cotización informativa" (tarifario).
 * Capa neutra, sin dependencias UI.
 */

export interface TarifaInformativa {
  /** Identificador estable de fila (uuid o random) para keys en RHF/UI. */
  id: string;
  modo: string;                  // Marítimo | Aéreo | Terrestre
  modalidad_equipo?: string;     // Terrestre: Caja Seca, Porta Contenedor, ...
  origen: string;
  punto_intermedio?: string;     // Terrestre Porta Contenedor
  destino: string;
  tipo_contenedor?: string;      // Marítimo FCL
  unidad_medida: string;         // Contenedor, BL, Tonelada, Viaje, ...
  precio: number;
  moneda: string;                // USD | MXN
  notas?: string;
}

export interface CotizacionInformativaInput {
  cliente_id: string | null;
  cliente_nombre: string;
  es_prospecto: boolean;
  prospecto_empresa?: string;
  prospecto_contacto?: string;
  prospecto_email?: string;
  prospecto_telefono?: string;
  vigencia_desde: string;        // ISO yyyy-mm-dd
  vigencia_hasta: string;        // ISO yyyy-mm-dd
  tarifas: TarifaInformativa[];
  notas?: string;
  operador: string;
}

export function nuevaTarifaInformativa(): TarifaInformativa {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `t-${Math.random().toString(36).slice(2, 10)}`,
    modo: "Marítimo",
    modalidad_equipo: "",
    origen: "",
    punto_intermedio: "",
    destino: "",
    tipo_contenedor: "",
    unidad_medida: "Contenedor",
    precio: 0,
    moneda: "USD",
    notas: "",
  };
}

export interface ValidacionInformativa {
  ok: boolean;
  errores: string[];
}

export function validateCotizacionInformativa(input: CotizacionInformativaInput): ValidacionInformativa {
  const errores: string[] = [];
  if (!input.es_prospecto && !input.cliente_id) errores.push("Cliente requerido");
  if (input.es_prospecto && !input.prospecto_empresa) errores.push("Empresa del prospecto requerida");
  if (!input.vigencia_desde) errores.push("Vigencia desde requerida");
  if (!input.vigencia_hasta) errores.push("Vigencia hasta requerida");
  if (input.vigencia_desde && input.vigencia_hasta && input.vigencia_desde > input.vigencia_hasta) {
    errores.push("La vigencia desde no puede ser posterior a vigencia hasta");
  }
  if (!input.tarifas || input.tarifas.length < 1) errores.push("Debe agregar al menos una tarifa");
  input.tarifas?.forEach((t, i) => {
    const r = i + 1;
    if (!t.origen) errores.push(`Tarifa ${r}: origen requerido`);
    if (!t.destino) errores.push(`Tarifa ${r}: destino requerido`);
    if (!(t.precio > 0)) errores.push(`Tarifa ${r}: precio debe ser mayor a 0`);
    if (!t.moneda) errores.push(`Tarifa ${r}: moneda requerida`);
  });
  return { ok: errores.length === 0, errores };
}
