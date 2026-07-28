/**
 * Hook unificado de actividad de un embarque: combina notas, eventos de
 * tracking y entradas de bitácora en un único feed ordenado por fecha desc.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchBitacoraEmbarque } from "@/features/embarques/services";
import { queryKeys } from "@/lib/query";
import type { EntradaBitacora } from "@/types/bitacora";
import type { EventoEmbarque, NotaEmbarqueRow } from "@/features/embarques/hooks";

export type ActividadEmbarqueTipo = "nota" | "evento" | "bitacora";

export interface ActividadEmbarqueItem {
  id: string;
  tipo: ActividadEmbarqueTipo;
  fecha: string;
  usuario: string;
  accion: string;
  titulo: string;
  descripcion?: string;
  detalles?: Record<string, unknown>;
}

interface Params {
  embarqueId: string | undefined;
  expediente: string | null | undefined;
  notas: NotaEmbarqueRow[];
  eventos: EventoEmbarque[];
  creadoPor?: string | null;
  creadoEn?: string | null;
}

export function useActividadEmbarque({ embarqueId, expediente, notas, eventos, creadoPor, creadoEn }: Params) {
  const bitacoraQ = useQuery<EntradaBitacora[]>({
    queryKey: queryKeys.embarques.bitacora(embarqueId, expediente ?? ""),
    queryFn: () => fetchBitacoraEmbarque(embarqueId!, expediente),
    enabled: !!embarqueId,
    staleTime: 30_000,
  });

  const items: ActividadEmbarqueItem[] = useMemo(() => {
    const out: ActividadEmbarqueItem[] = [];

    // B-039: minutos con una entrada de bitácora "cambiar_estado". La RPC
    // avanzar_estado_embarque escribe además una nota auto (tipo cambio_estado)
    // y un evento de tracking por la misma transición; la bitácora es la
    // representación más rica (trae estado_anterior/estado_nuevo en detalles),
    // así que suprimimos las otras dos cuando coinciden en el mismo minuto.
    const minutosCambioEstadoBitacora = new Set(
      (bitacoraQ.data ?? [])
        .filter((b) => b.accion === "cambiar_estado")
        .map((b) => b.created_at.slice(0, 16)),
    );

    for (const n of notas) {
      if (n.tipo === "cambio_estado" && minutosCambioEstadoBitacora.has(n.fecha.slice(0, 16))) continue;
      out.push({
        id: `nota-${n.id}`,
        tipo: "nota",
        fecha: n.fecha,
        usuario: n.usuario ?? "",
        accion: n.tipo === "cambio_estado" ? "Cambio de estado" : "Nota",
        titulo: n.contenido,
      });
    }

    for (const ev of eventos) {
      if (ev.descripcion?.startsWith("Estado cambiado a") && minutosCambioEstadoBitacora.has(ev.fecha.slice(0, 16))) continue;
      out.push({
        id: `ev-${ev.id}`,
        tipo: "evento",
        fecha: ev.fecha,
        usuario: ev.usuario ?? "",
        accion: ev.tipo,
        titulo: ev.descripcion || ev.tipo,
        descripcion: ev.ubicacion || undefined,
      });
    }

    for (const b of bitacoraQ.data ?? []) {
      out.push({
        id: `bit-${b.id}`,
        tipo: "bitacora",
        fecha: b.created_at,
        usuario: b.usuario_email ?? "",
        accion: b.accion,
        titulo: tituloBitacora(b.accion),
        detalles: b.detalles,
      });
    }

    if (creadoEn) {
      out.push({
        id: "creacion",
        tipo: "bitacora",
        fecha: creadoEn,
        usuario: creadoPor ?? "",
        accion: "crear",
        titulo: "Embarque creado",
      });
    }

    out.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
    // Deduplicar la entrada de creación si ya viene desde bitácora.
    const seenCreate = new Set<string>();
    return out.filter((it) => {
      if (it.accion !== "crear") return true;
      const key = it.fecha.slice(0, 16);
      if (seenCreate.has(key)) return false;
      seenCreate.add(key);
      return true;
    });
  }, [notas, eventos, bitacoraQ.data, creadoEn, creadoPor]);

  return { items, isLoading: bitacoraQ.isLoading };
}

function tituloBitacora(accion: string): string {
  const map: Record<string, string> = {
    crear: "Embarque creado",
    editar: "Embarque editado",
    cambiar_estado: "Cambio de estado",
    reabrir_embarque: "Embarque reabierto",
    agregar_nota: "Nota agregada",
    eliminar: "Embarque eliminado",
  };
  return map[accion] ?? `Acción: ${accion}`;
}
