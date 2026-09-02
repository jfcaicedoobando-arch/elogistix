import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { BulkImportDialog } from "@/components/shared/BulkImportDialog";
import { PROVEEDOR_TEMPLATE_HEADERS, mapProveedorRows } from "@/lib/csv/importSchemas";
import { insertProveedoresLote } from "@/features/proveedor/services";
import { useRegistrarActividad, useOrgFilter } from "@/hooks/shared";
import { notifySuccess } from "@/lib/ui/appFeedback";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Diálogo de importación masiva de proveedores desde CSV.
 * Extraído de `Proveedores.tsx` para mantener el page ≤200 LOC.
 */
export function ProveedoresImportDialog({ open, onOpenChange }: Props) {
  const { organizationId } = useOrgFilter();
  const queryClient = useQueryClient();
  const registrarActividad = useRegistrarActividad();

  return (
    <BulkImportDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Importar proveedores desde CSV"
      description="Carga un CSV con proveedores. Incluye la columna 'categoria' (Logistico o GastoOperativo) y, según el caso, 'tipo' o 'subtipo_gasto'."
      templateHeaders={PROVEEDOR_TEMPLATE_HEADERS}
      templateExampleRow={[
        "Maersk Line",
        "Logistico",
        "Naviera",
        "",
        "MLI010101AAA",
        "Sandra López",
        "55 1111 2222",
        "contacto@maersk.com",
        "USD",
        "Dinamarca",
      ]}
      templateFileName="plantilla-proveedores.csv"
      mapRows={(rows) => mapProveedorRows(rows, organizationId)}
      onCommit={async (payloads, reportarProgreso) => {
        // N-05 (QA r2): un INSERT por lote de 200 filas (no uno por fila).
        // L3: se reporta el avance por lote para informar cortes parciales.
        const { creados, omitidos } = await insertProveedoresLote(payloads, reportarProgreso);
        registrarActividad.mutate({
          accion: "crear",
          modulo: "proveedores",
          entidad_nombre: `Importación CSV (${creados.length})`,
        });
        return { creados: creados.length, omitidos };
      }}
      onSuccess={(n) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.proveedores.all });
        notifySuccess(undefined, { title: `Importados ${n} proveedores` });
      }}
    />
  );
}
