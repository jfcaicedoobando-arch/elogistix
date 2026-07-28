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
    const bitacora = bitacoraQ.data ?? [];
    // B-039: minutos con una entrada de bitácora "cambiar_estado". Ver comentario abajo.
    const minutosCambioEstadoBitacora = new Set(
      bitacora
        .filter((b) => b.accion === "cambiar_estado")
        .map((b) => b.created_at.slice(0, 16)),
    );
    const out: ActividadEmbarqueItem[] = [
      ...mapNotas(notas, minutosCambioEstadoBitacora),
      ...mapEventos(eventos, minutosCambioEstadoBitacora),
      ...mapBitacora(bitacora),
    ];
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
    return dedupCreacion(out);
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
