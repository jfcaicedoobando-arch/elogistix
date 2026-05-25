/**
 * Servicio de aplicación de fechas JSONCargo al embarque.
 * Extraído de `hooks/embarque/useJsonCargoTracking.ts` (Power of 10: ≤200 LOC).
 */
import { supabase } from "@/integrations/supabase/client";

export interface ApplyFechasArgs {
  embarqueId: string;
  eta?: string | null;
  etd?: string | null;
  ata?: string | null;
}

export type FechasUpdate = {
  eta?: string;
  etd?: string;
  fecha_llegada_real?: string;
  estado?: "Arribo";
};

export function buildFechasUpdate({
  eta,
  etd,
  ata,
}: Omit<ApplyFechasArgs, "embarqueId">): FechasUpdate {
  const update: FechasUpdate = {};
  if (eta) update.eta = eta;
  if (etd) update.etd = etd;
  if (ata) {
    update.fecha_llegada_real = ata;
    if (!eta) update.eta = ata;
  }
  return update;
}

export async function shouldAvanzarArribo(
  embarqueId: string,
  ata: string | null | undefined,
): Promise<boolean> {
  if (!ata) return false;
  const { data, error } = await supabase
    .from("embarques")
    .select("estado")
    .eq("id", embarqueId)
    .maybeSingle();
  if (error) throw error;
  const estado = (data?.estado as string | undefined) ?? "";
  return estado === "Confirmado" || estado === "En Tránsito";
}

export async function registrarEventoArribo(embarqueId: string, ata: string) {
  const { data: existentes } = await supabase
    .from("eventos_embarque")
    .select("id, fecha")
    .eq("embarque_id", embarqueId)
    .eq("tipo", "Arribo a Puerto");
  const yaExiste = (existentes ?? []).some(
    (e: { fecha: string }) => (e.fecha ?? "").slice(0, 10) === ata,
  );
  if (yaExiste) return;
  const { data: userData } = await supabase.auth.getUser();
  const usuario = userData?.user?.email ?? "Sistema";
  await supabase.from("eventos_embarque").insert({
    embarque_id: embarqueId,
    tipo: "Arribo a Puerto",
    descripcion: 'Estado cambiado a "Arribo" (arribo real registrado)',
    ubicacion: "",
    fecha: `${ata}T00:00:00Z`,
    usuario,
  });
}
