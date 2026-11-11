import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { leerTodasLasPaginas } from "@/lib/supabase/paginado";

export function fetchEmbarqueVentasDetalle(id: string) {
  return leerTodasLasPaginas<Tables<"conceptos_venta">>("embarque.detalle.ventas", (from, to) =>
    supabase.from("conceptos_venta").select("*").eq("embarque_id", id).is("deleted_at", null)
      .order("created_at").order("id").range(from, to));
}

export function fetchEmbarqueCostosDetalle(id: string) {
  return leerTodasLasPaginas<Tables<"conceptos_costo">>("embarque.detalle.costos", (from, to) =>
    supabase.from("conceptos_costo").select("*").eq("embarque_id", id).is("deleted_at", null)
      .order("created_at").order("id").range(from, to));
}

export function fetchEmbarqueDocumentosDetalle(id: string) {
  return leerTodasLasPaginas<Tables<"documentos_embarque">>("embarque.detalle.documentos", (from, to) =>
    supabase.from("documentos_embarque").select("*").eq("embarque_id", id).is("deleted_at", null)
      .order("created_at").order("id").range(from, to));
}

export function fetchEmbarqueNotasDetalle(id: string) {
  return leerTodasLasPaginas<Tables<"notas_embarque">>("embarque.detalle.notas", (from, to) =>
    supabase.from("notas_embarque").select("*").eq("embarque_id", id).is("deleted_at", null)
      .order("fecha", { ascending: false }).order("id").range(from, to));
}

export function fetchEmbarqueFacturasDetalle(id: string) {
  return leerTodasLasPaginas<Tables<"facturas">>("embarque.detalle.facturas", (from, to) =>
    supabase.from("facturas").select("*").eq("embarque_id", id).is("deleted_at", null)
      .order("created_at").order("id").range(from, to));
}
