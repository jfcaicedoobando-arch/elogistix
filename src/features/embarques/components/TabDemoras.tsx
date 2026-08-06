/**
 * Tab Demoras — fechas reales por contenedor para el cálculo escalonado de demoras.
 *
 * v13.66.11: el RPC `calcular_demoras_embarque` ahora usa `fecha_descarga`,
 * `fecha_devolucion` y `dias_libres_override` de cada `embarque_contenedores`
 * (con fallback al timeline del embarque cuando están en NULL). Esta tab
 * permite capturar esos valores; un trigger AFTER UPDATE recalcula
 * automáticamente al guardar.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import EmptyState from "@/components/empty/EmptyState";
import { Clock } from "lucide-react";
import { useTabDemorasController } from "@/features/embarques/hooks/useTabDemorasController";
import { buildDemorasColumns } from "./_sections/tabDemorasColumns";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

interface Props {
  embarqueId: string;
  canEdit: boolean;
}

export function TabDemoras({ embarqueId, canEdit }: Props) {
  const { rows, isLoading, drafts, isPending, setDraft, valorActual, guardar } =
    useTabDemorasController(embarqueId);

  const columns = useMemo(
    () => buildDemorasColumns({ canEdit, drafts, isPending, valorActual, setDraft, guardar }),
    [canEdit, drafts, isPending, valorActual, setDraft, guardar],
  );


  if (isLoading) return <EmptyStateInline loading message="Cargando contenedores…" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle >Demoras por contenedor</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Captura la fecha real de descarga y devolución de cada contenedor para calcular las
            demoras con el tabulador de la naviera. Si dejas un campo vacío, usamos las fechas del
            timeline del embarque. El campo "Días libres" solo sobreescribe el default de la naviera
            cuando lo capturas. Al guardar, recalculamos automáticamente los conceptos de demora.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(r) => r.id}
            density="compact"
            tableClassName="w-full"
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={Clock}
                  title="Sin contenedores"
                  description="Agrega contenedores al embarque para capturar sus demoras."
                />
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
