import { useNavigate } from "react-router-dom";
import { toast as sonnerToast } from "sonner";
import { useProveedorMutations } from "@/features/proveedor/hooks";
import { useToast, useRegistrarActividad } from "@/hooks/shared";
import { ProveedorDuplicadoError } from "@/features/proveedor/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
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
  const { toast } = useToast();

  return async (data: TablesInsert<"proveedores">) => {
    try {
      const proveedorCreado = await addProveedor(data);
      registrarActividad.mutate({
        accion: "crear",
        modulo: "proveedores",
        entidad_id: proveedorCreado.id,
        entidad_nombre: data.nombre,
      });
      notifySuccess(toast, { title: "Proveedor creado correctamente" });
    } catch (err) {
      if (err instanceof ProveedorDuplicadoError) {
        const existente = err.existente;
        sonnerToast.error("Proveedor duplicado", {
          description: existente
            ? `Ya existe "${existente.nombre}" con este RFC en tu organización.`
            : "Ya existe un proveedor con este RFC en tu organización.",
          action: existente
            ? { label: "Ver", onClick: () => navigate(`/proveedores/${existente.id}`) }
            : undefined,
        });
        throw err; // mantiene el diálogo abierto
      }
      notifyError(toast, {
        title: "Error al crear proveedor",
        method: "HANDLE_ADD",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    }
  };
}
