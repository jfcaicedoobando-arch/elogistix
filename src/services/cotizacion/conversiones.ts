/**
 * Cotizaciones — Conversiones de alto nivel:
 *  - duplicar cotización (con costos)
 *  - prospecto → cliente
 *  - cotización → embarques (uno por contenedor) con copia de costos como conceptos_costo
 *  - respuesta del portal (RPC)
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";
import type { CotizacionRow } from "@/types/cotizacionTypes";
import {
  calcularFechaVigencia,
  filtrarCostosParaContenedor,
  mapCostosACostosEmbarque,
} from "@/lib/domain/cotizacion";
import { generarFolioCotizacion } from "./crud";

type CotizacionInsert = TablesInsert<"cotizaciones">;
type EmbarqueInsert = TablesInsert<"embarques">;

// ─── Duplicar ───────────────────────────────────────────────────────────────
export async function duplicarCotizacion(
  cotizacionId: string,
): Promise<{ id: string; folio: string }> {
  const { data: orig, error: errOrig } = await supabase
    .from("cotizaciones")
    .select("*")
    .eq("id", cotizacionId)
    .single();
  if (errOrig) throw errOrig;

  const folio = await generarFolioCotizacion();
  const fechaVigencia = calcularFechaVigencia(new Date(), orig.vigencia_dias);

  const {
    id: _id,
    created_at: _ca,
    updated_at: _ua,
    folio: _f,
    estado: _e,
    embarque_id: _eid,
    fecha_vigencia: _fv,
    ...rest
  } = orig;

  const payload: CotizacionInsert = {
    ...rest,
    folio,
    estado: "Borrador",
    embarque_id: null,
    fecha_vigencia: fechaVigencia,
    conceptos_venta: rest.conceptos_venta as Json,
    dimensiones_lcl: rest.dimensiones_lcl as Json,
    dimensiones_aereas: rest.dimensiones_aereas as Json,
  } as CotizacionInsert;

  const { data, error } = await supabase
    .from("cotizaciones")
    .insert(payload)
    .select("id, folio")
    .single();
  if (error) throw error;

  // Duplicate costos
  const { data: costos } = await supabase
    .from("cotizacion_costos")
    .select("*")
    .eq("cotizacion_id", cotizacionId);
  if (costos && costos.length > 0) {
    const nuevos = costos.map(
      ({ id: _cid, created_at: _cca, updated_at: _cua, cotizacion_id: _ccid, ...c }) => ({
        ...c,
        cotizacion_id: data.id,
      }),
    );
    await supabase.from("cotizacion_costos").insert(nuevos);
  }

  return data as { id: string; folio: string };
}

// ─── Conversions: prospecto → cliente ───────────────────────────────────────
export interface ProspectoAClienteInput {
  cotizacionId: string;
  clienteData: {
    nombre: string;
    contacto: string;
    email: string;
    telefono: string;
    rfc?: string;
    direccion?: string;
    ciudad?: string;
    estado?: string;
    cp?: string;
  };
  user: { id: string; email?: string | null } | null;
}

export async function convertirProspectoACliente(input: ProspectoAClienteInput) {
  const { cotizacionId, clienteData, user } = input;
  const { data: clienteCreado, error: errorCliente } = await supabase
    .from("clientes")
    .insert({
      nombre: clienteData.nombre,
      contacto: clienteData.contacto,
      email: clienteData.email,
      telefono: clienteData.telefono,
      rfc: clienteData.rfc || "",
      direccion: clienteData.direccion || "",
      ciudad: clienteData.ciudad || "",
      estado: clienteData.estado || "",
      cp: clienteData.cp || "",
    })
    .select()
    .single();
  if (errorCliente) throw errorCliente;

  const { error: errorUpdate } = await supabase
    .from("cotizaciones")
    .update({
      cliente_id: clienteCreado.id,
      cliente_nombre: clienteCreado.nombre,
      es_prospecto: false,
    })
    .eq("id", cotizacionId);
  if (errorUpdate) throw errorUpdate;

  if (user) {
    await supabase.from("bitacora_actividad").insert({
      usuario_id: user.id,
      usuario_email: user.email ?? "",
      accion: "Convertir prospecto a cliente",
      modulo: "Cotizaciones",
      entidad_id: cotizacionId,
      entidad_nombre: clienteCreado.nombre,
      detalles: { cliente_id: clienteCreado.id } as unknown as Json,
    });
  }

  return clienteCreado;
}

// ─── Conversions: cotización → embarques ────────────────────────────────────
export async function convertirCotizacionAEmbarques(
  cotizacion: CotizacionRow,
): Promise<Tables<"embarques">[]> {
  const { data: costos, error: errorCostos } = await supabase
    .from("cotizacion_costos")
    .select("*")
    .eq("cotizacion_id", cotizacion.id);
  if (errorCostos) throw errorCostos;

  const numContenedores = cotizacion.num_contenedores ?? 1;
  const embarquesCreados: Tables<"embarques">[] = [];

  for (let i = 0; i < numContenedores; i++) {
    const { data: expediente, error: errorExp } = await supabase.rpc("generar_expediente", {
      tipo_op: cotizacion.tipo,
    });
    if (errorExp) throw errorExp;

    const embarqueInsert: EmbarqueInsert = {
      cotizacion_id: cotizacion.id,
      expediente: expediente as string,
      cliente_id: cotizacion.cliente_id!,
      cliente_nombre: cotizacion.cliente_nombre,
      estado: "Confirmado",
      modo: cotizacion.modo,
      tipo: cotizacion.tipo,
      incoterm: cotizacion.incoterm,
      descripcion_mercancia: cotizacion.descripcion_mercancia,
      peso_kg: cotizacion.peso_kg,
      volumen_m3: cotizacion.volumen_m3,
      piezas: cotizacion.piezas,
      operador: cotizacion.operador,
      tipo_carga: cotizacion.tipo_carga,
      tipo_contenedor: cotizacion.tipo_contenedor,
    };

    const { data: embarque, error: errorEmb } = await supabase
      .from("embarques")
      .insert(embarqueInsert)
      .select()
      .single();
    if (errorEmb) throw errorEmb;

    if (costos && costos.length > 0) {
      const conceptosParaInsertar = costos.filter((c) => {
        const um = c.unidad_medida ?? "Contenedor";
        if (um === "BL") return i === 0;
        return true;
      });

      if (conceptosParaInsertar.length > 0) {
        const rows: TablesInsert<"conceptos_costo">[] = conceptosParaInsertar.map((c) => ({
          embarque_id: embarque.id,
          concepto: c.concepto,
          monto: c.costo_unitario,
          moneda: c.moneda as TablesInsert<"conceptos_costo">["moneda"],
          proveedor_nombre: c.proveedor,
        }));

        const { error: errorConceptos } = await supabase.from("conceptos_costo").insert(rows);
        if (errorConceptos) throw errorConceptos;
      }
    }

    embarquesCreados.push(embarque);
  }

  const { error: errorUpdate } = await supabase
    .from("cotizaciones")
    .update({ estado: "Embarcada" as CotizacionInsert["estado"] })
    .eq("id", cotizacion.id);
  if (errorUpdate) throw errorUpdate;

  return embarquesCreados;
}

// ─── Portal: responder cotización ───────────────────────────────────────────
export async function portalResponderCotizacion(
  cotizacionId: string,
  respuesta: "Aceptada" | "Rechazada",
  comentario: string,
): Promise<void> {
  const { error } = await supabase.rpc("portal_responder_cotizacion", {
    p_cotizacion_id: cotizacionId,
    p_respuesta: respuesta,
    p_comentario: comentario,
  });
  if (error) throw error;
}
