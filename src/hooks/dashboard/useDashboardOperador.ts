/**
 * Datos operativos del dashboard del rol Operador.
 * - Embarques con documentación pendiente (operador = email del usuario).
 * - Embarques sin actualización de tracking reciente. Reglas (v12.51.0):
 *     · Más de 7 días sin un evento manual nuevo, o
 *     · Faltan ≤ 2 días para la ETA y el último evento es anterior a (ETA − 2 días).
 *
 * Fuente del "último evento": tabla `eventos_embarque` (eventos manuales que el
 * operador registra al consultar la web de la naviera), no `tracking_externo`
 * (queda como tabla legacy reservada para integraciones automáticas futuras).
 *
 * Las queries se filtran por `operador = user.email` (cómo se asigna el campo
 * al crear/editar un embarque — ver `useEmbarqueSubmitOrchestrator`).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ESTADOS_ACTIVOS } from "@/constants/embarqueConstants";

export interface OperadorEmbarqueLite {
  id: string;
  expediente: string;
  cliente_nombre: string;
  estado: string;
  eta: string | null;
}

export interface DocsFaltantesItem extends OperadorEmbarqueLite {
  pendientes: number;
}

export interface SinTrackingItem extends OperadorEmbarqueLite {
  diasSinUpdate: number | null;
  /** True si está dentro de los 2 días previos a la ETA (alerta de "pre-arribo"). */
  proximoArribo: boolean;
}

const DIAS_TRACKING_ESTANCADO = 7;
const DIAS_PRE_ARRIBO = 2;

export function useDocsFaltantesOperador() {
  const { user } = useAuth();
  const email = user?.email ?? null;
  return useQuery<DocsFaltantesItem[]>({
    queryKey: ["dashboard-operador", "docs-faltantes", email],
    enabled: !!email,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: embarques, error } = await supabase
        .from("embarques")
        .select("id, expediente, cliente_nombre, estado, eta")
        .eq("operador", email!)
        .in("estado", [...ESTADOS_ACTIVOS])
        .limit(200);
      if (error) throw error;
      if (!embarques || embarques.length === 0) return [];
      const ids = embarques.map((e) => e.id);
      const { data: docs, error: docsErr } = await supabase
        .from("documentos_embarque")
        .select("embarque_id, estado")
        .in("embarque_id", ids)
        .is("deleted_at", null)
        .eq("estado", "Pendiente");
      if (docsErr) throw docsErr;
      const conteo = new Map<string, number>();
      for (const d of docs ?? []) {
        conteo.set(d.embarque_id, (conteo.get(d.embarque_id) ?? 0) + 1);
      }
      return embarques
        .filter((e) => (conteo.get(e.id) ?? 0) > 0)
        .map((e) => ({
          id: e.id,
          expediente: e.expediente,
          cliente_nombre: e.cliente_nombre ?? "",
          estado: e.estado,
          eta: e.eta,
          pendientes: conteo.get(e.id) ?? 0,
        }))
        .sort((a, b) => b.pendientes - a.pendientes);
    },
  });
}

export function useSinTrackingOperador() {
  const { user } = useAuth();
  const email = user?.email ?? null;
  return useQuery<SinTrackingItem[]>({
    queryKey: ["dashboard-operador", "sin-tracking", email],
    enabled: !!email,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: embarques, error } = await supabase
        .from("embarques")
        .select("id, expediente, cliente_nombre, estado, eta")
        .eq("operador", email!)
        .in("estado", ["En Tránsito", "Arribo", "En Aduana"])
        .limit(200);
      if (error) throw error;
      if (!embarques || embarques.length === 0) return [];
      const ids = embarques.map((e) => e.id);
      const { data: tracking, error: tErr } = await supabase
        .from("tracking_externo")
        .select("embarque_id, last_event_at")
        .in("embarque_id", ids);
      if (tErr) throw tErr;
      const ultimo = new Map<string, string | null>();
      for (const t of tracking ?? []) {
        const prev = ultimo.get(t.embarque_id);
        if (!prev || (t.last_event_at && (!prev || new Date(t.last_event_at) > new Date(prev)))) {
          ultimo.set(t.embarque_id, t.last_event_at);
        }
      }
      const ahora = Date.now();
      return embarques
        .map((e) => {
          const last = ultimo.get(e.id);
          const dias = last ? Math.floor((ahora - new Date(last).getTime()) / 86_400_000) : null;
          return {
            id: e.id,
            expediente: e.expediente,
            cliente_nombre: e.cliente_nombre ?? "",
            estado: e.estado,
            eta: e.eta,
            diasSinUpdate: dias,
          };
        })
        .filter((e) => e.diasSinUpdate === null || e.diasSinUpdate >= DIAS_TRACKING_ESTANCADO)
        .sort((a, b) => (b.diasSinUpdate ?? 999) - (a.diasSinUpdate ?? 999));
    },
  });
}
