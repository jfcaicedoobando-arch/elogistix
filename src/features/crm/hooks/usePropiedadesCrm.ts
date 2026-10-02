/**
 * Hooks de propiedades configurables y sus valores (Fase 3).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  actualizarPropiedad, archivarOpcion, crearOpcion, crearPropiedad, fetchPropiedades, renombrarOpcion,
  type CambioPropiedad, type NuevaPropiedad, type ObjetoCrm, type OpcionCrm,
} from "@/features/crm/services/propiedadesCrm";
import { fetchValores, guardarValor, type ValorEntrada } from "@/features/crm/services/valoresCrm";
import type { TipoPropiedad } from "@/features/crm/services/propiedadesCrm";

const BASE = ["crm", "propiedades"] as const;

export function usePropiedadesCrm(objeto: ObjetoCrm) {
  return useQuery({ queryKey: [...BASE, objeto], queryFn: () => fetchPropiedades(objeto), staleTime: 5 * 60_000 });
}

export function useValoresCrm(registroId: string) {
  return useQuery({ queryKey: [...BASE, "valores", registroId], queryFn: () => fetchValores(registroId) });
}

function useMutacion<V>(fn: (v: V) => Promise<void>, ok: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { if (ok) toast.success(ok); void qc.invalidateQueries({ queryKey: BASE }); void qc.invalidateQueries({ queryKey: ["crm", "scoring"] }); },
    onError: (e: Error) => toast.error(e.message || "No se pudo guardar"),
  });
}

export function useCrearPropiedad() {
  return useMutacion((p: NuevaPropiedad) => crearPropiedad(p), "Propiedad creada");
}

export function useActualizarPropiedad() {
  return useMutacion(({ id, cambio }: { id: string; cambio: CambioPropiedad }) => actualizarPropiedad(id, cambio), "");
}

export type AccionOpcion =
  | { tipo: "crear"; propiedadId: string; etiqueta: string; orden: number }
  | { tipo: "renombrar"; propiedadId: string; opcion: OpcionCrm; etiqueta: string }
  | { tipo: "archivar"; id: string; archivada: boolean };

export function useOpcionPropiedad() {
  return useMutacion((a: AccionOpcion) => {
    if (a.tipo === "crear") return crearOpcion(a.propiedadId, a.etiqueta, a.orden);
    if (a.tipo === "renombrar") return renombrarOpcion(a.propiedadId, a.opcion, a.etiqueta);
    return archivarOpcion(a.id, a.archivada);
  }, "");
}

export interface GuardarValorInput { propiedadId: string; tipo: TipoPropiedad; valor: ValorEntrada }

export function useGuardarValorCrm(registroId: string) {
  return useMutacion(
    ({ propiedadId, tipo, valor }: GuardarValorInput) => guardarValor(propiedadId, registroId, tipo, valor),
    "",
  );
}
