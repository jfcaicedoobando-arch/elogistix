/**
 * Si la empresa asociada ya es cliente, el origen de la oportunidad queda fijo
 * en «Cliente»: un cliente nunca vuelve a ser prospecto de origen.
 */
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { crm } from "@/features/crm/queryKeys";
import { fetchOrigenEmpresa } from "@/features/crm/services/origenEmpresaCrm";
import type { OportunidadFormState } from "@/features/crm/domain/oportunidadFormState";

export function useOrigenClienteForzado(
  empresaId: string | null,
  activo: boolean,
  setForm: React.Dispatch<React.SetStateAction<OportunidadFormState>>,
): boolean {
  const q = useQuery({
    queryKey: crm.origenEmpresa(empresaId ?? ""),
    queryFn: () => fetchOrigenEmpresa(empresaId as string),
    enabled: activo && !!empresaId,
    staleTime: 60_000,
  });
  const origen = q.data?.ok ? q.data.origen : null;
  const clienteId = origen?.tipo === "cliente" ? origen.id : null;
  const clienteNombre = origen?.tipo === "cliente" ? origen.nombre : "";
  useEffect(() => {
    if (!activo || !clienteId) return;
    setForm((f) => (f.origen_tipo === "cliente" && f.cliente_id === clienteId ? f : {
      ...f, origen_tipo: "cliente", lead_id: null, lead_nombre: "",
      cliente_id: clienteId, cliente_nombre: clienteNombre,
    }));
  }, [activo, clienteId, clienteNombre, setForm]);
  return activo && !!clienteId;
}
