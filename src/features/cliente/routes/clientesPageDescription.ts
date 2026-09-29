import { pluralizar } from "@/lib/format/pluralizar";

export function getClientesPageDescription(isError: boolean, isLoading: boolean, totalCount: number) {
  if (isError) return "No se pudo cargar el listado de clientes";
  if (isLoading) return "Cargando clientes…";
  return `${pluralizar(totalCount, "cliente")} ${totalCount === 1 ? "registrado" : "registrados"}`;
}
