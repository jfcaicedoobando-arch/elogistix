/**
 * Hooks del CRM por objetos (Fase 2): Empresas, Contactos y vínculos.
 * Todas las llaves cuelgan de ['crm','objetos'] para invalidar en bloque.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  crearContacto, crearEmpresa, fetchContacto, fetchContactos, fetchEmpresa, fetchEmpresas,
  type NuevoContactoInput,
} from "@/features/crm/services/objetosCrm";
import {
  contactosDeEmpresa, contactosDeOportunidad, desligar, empresasDeContacto, empresasDeOportunidad,
  ligar, oportunidadesDe, type TipoVinculo,
} from "@/features/crm/services/vinculosCrm";

const BASE = ["crm", "objetos"] as const;

export function useEmpresasCrm(busqueda: string, pagina: number) {
  return useQuery({
    queryKey: [...BASE, "empresas", busqueda, pagina],
    queryFn: () => fetchEmpresas(busqueda, pagina),
    placeholderData: keepPreviousData,
  });
}

export function useContactosCrm(busqueda: string, pagina: number) {
  return useQuery({
    queryKey: [...BASE, "contactos", busqueda, pagina],
    queryFn: () => fetchContactos(busqueda, pagina),
    placeholderData: keepPreviousData,
  });
}

export function useEmpresaCrm(id?: string) {
  return useQuery({ queryKey: [...BASE, "empresa", id], queryFn: () => fetchEmpresa(id!), enabled: !!id });
}

export function useContactoCrm(id?: string) {
  return useQuery({ queryKey: [...BASE, "contacto", id], queryFn: () => fetchContacto(id!), enabled: !!id });
}

/** Lista de registros ligados a un objeto. */
export type Relacion =
  | "contactos-de-empresa" | "empresas-de-contacto"
  | "oportunidades-de-empresa" | "oportunidades-de-contacto"
  | "empresas-de-oportunidad" | "contactos-de-oportunidad";

const LECTORES: Record<Relacion, (id: string) => Promise<{ id: string; nombre: string }[]>> = {
  "contactos-de-empresa": contactosDeEmpresa,
  "empresas-de-contacto": empresasDeContacto,
  "oportunidades-de-empresa": (id) => oportunidadesDe("empresa", id),
  "oportunidades-de-contacto": (id) => oportunidadesDe("contacto", id),
  "empresas-de-oportunidad": empresasDeOportunidad,
  "contactos-de-oportunidad": contactosDeOportunidad,
};

export function useRelacionCrm(relacion: Relacion, id: string) {
  return useQuery({ queryKey: [...BASE, "rel", relacion, id], queryFn: () => LECTORES[relacion](id) });
}

function useInvalidarObjetos() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: BASE });
}

export function useCrearEmpresaCrm() {
  const invalidar = useInvalidarObjetos();
  return useMutation({
    mutationFn: crearEmpresa,
    onSuccess: () => { toast.success("Empresa creada"); void invalidar(); },
    onError: (e: Error) => toast.error(e.message || "No se pudo crear la empresa"),
  });
}

export function useCrearContactoCrm() {
  const invalidar = useInvalidarObjetos();
  return useMutation({
    mutationFn: (input: NuevoContactoInput) => crearContacto(input),
    onSuccess: () => { toast.success("Contacto creado"); void invalidar(); },
    onError: (e: Error) => toast.error(e.message || "No se pudo crear el contacto"),
  });
}

export interface VinculoInput { tipo: TipoVinculo; aId: string; bId: string; quitar?: boolean }

export function useVinculoCrm() {
  const invalidar = useInvalidarObjetos();
  return useMutation({
    mutationFn: ({ tipo, aId, bId, quitar }: VinculoInput) =>
      quitar ? desligar(tipo, aId, bId) : ligar(tipo, aId, bId),
    onSuccess: (_d, v) => { toast.success(v.quitar ? "Vínculo quitado" : "Registro ligado"); void invalidar(); },
    onError: () => toast.error("No se pudo actualizar el vínculo"),
  });
}
