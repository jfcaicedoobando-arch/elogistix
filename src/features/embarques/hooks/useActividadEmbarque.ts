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

function mapNotas(notas: NotaEmbarqueRow[], minutosCambioEstado: Set<string>): ActividadEmbarqueItem[] {
  const out: ActividadEmbarqueItem[] = [];
  for (const n of notas) {
    if (n.tipo === "cambio_estado" && minutosCambioEstado.has(n.fecha.slice(0, 16))) continue;
    out.push({
      id: `nota-${n.id}`,
      tipo: "nota",
      fecha: n.fecha,
      usuario: n.usuario ?? "",
      accion: n.tipo === "cambio_estado" ? "Cambio de estado" : "Nota",
      titulo: n.contenido,
    });
  }
  return out;
}

function mapEventos(eventos: EventoEmbarque[], minutosCambioEstado: Set<string>): ActividadEmbarqueItem[] {
  const out: ActividadEmbarqueItem[] = [];
  for (const ev of eventos) {
    if (ev.descripcion?.startsWith("Estado cambiado a") && minutosCambioEstado.has(ev.fecha.slice(0, 16))) continue;
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
  return out;
}

function mapBitacora(bitacora: EntradaBitacora[]): ActividadEmbarqueItem[] {
  return bitacora.map((b) => ({
    id: `bit-${b.id}`,
    tipo: "bitacora" as const,
    fecha: b.created_at,
    usuario: b.usuario_email ?? "",
    accion: b.accion,
    titulo: tituloBitacora(b.accion),
    detalles: b.detalles,
  }));
}

function dedupCreacion(items: ActividadEmbarqueItem[]): ActividadEmbarqueItem[] {
  const seenCreate = new Set<string>();
  return items.filter((it) => {
    if (it.accion !== "crear") return true;
    const key = it.fecha.slice(0, 16);
    if (seenCreate.has(key)) return false;
    seenCreate.add(key);
    return true;
  });
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

