import { useQuery } from "@tanstack/react-query";
import { fetchEmpresas } from "../services/objetosCrm";
import { crm } from "../queryKeys";

export function useEmpresasSimilares(termino: string) {
  return useQuery({
    queryKey: crm.objetos.empresasSimilares(termino),
    queryFn: () => fetchEmpresas(termino, 0),
    enabled: termino.length >= 2,
    staleTime: 30_000,
  });
}
