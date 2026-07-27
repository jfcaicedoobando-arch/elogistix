import { useNavigate } from "react-router-dom";

import { useProveedorMutations } from "@/features/proveedor/hooks";
import { useRegistrarActividad } from "@/hooks/shared";
import { ProveedorDuplicadoError } from "@/features/proveedor/services";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import type { TablesInsert } from "@/integrations/supabase/types";

/**
 * Encapsula el flujo de crear un proveedor desde la página `Proveedores`:
 * mutación + telemetría + manejo de duplicado por RFC con navegación al
 * existente. Extraído de `Proveedores.tsx` para mantener el page ≤200 LOC.
 */
export function useProveedoresCrear() {
  const navigate = useNavigate();
  const { addProveedor } = useProveedorMutations();
  const registrarActividad = useRegistrarActividad();

  return async (data: TablesInsert<"proveedores">) => {
    try {
      const proveedorCreado = await addProveedor(data);
      registrarActividad.mutate({
        accion: "crear",
        modulo: "proveedores",
        entidad_id: proveedorCreado.id,
        entidad_nombre: data.nombre,
      });
      notifySuccess(undefined, { title: "Proveedor creado correctamente" });
    } catch (err) {
      if (err instanceof ProveedorDuplicadoError) {
        const existente = err.existente;
        notifyWarning(undefined, {
          title: "Proveedor duplicado",
          description: existente
            ? `Ya existe "${existente.nombre}" con este RFC en tu organización.`
            : "Ya existe un proveedor con este RFC en tu organización.",
          method: "PROVEEDOR_DUPLICADO",
          action: existente
            ? { label: "Ver", onClick: () => navigate(`/proveedores/${existente.id}`) }
            : undefined,
        });
        throw err; // mantiene el diálogo abierto
      }
      notifyError(undefined, {
        title: "Error al crear proveedor",
        method: "HANDLE_ADD",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    }
  };
}
