import { Link } from "react-router-dom";
import { Plus, Ship, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { DetailTabSection } from "@/components/shared/DetailTabSection";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import EmptyState from "@/components/empty/EmptyState";
import { embarqueColumns, cotizacionColumns } from "@/features/cliente/components/clienteColumns";
import type { EmbarqueCliente, CotizacionCliente } from "@/features/cliente/components/clienteColumns";
import { EmbarqueClienteMobileCard } from "@/features/cliente/components/EmbarqueClienteMobileCard";
import { CotizacionClienteMobileCard } from "@/features/cliente/components/CotizacionClienteMobileCard";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

interface Props {
  canEdit: boolean;
  embarquesCliente: EmbarqueCliente[];
  loadingEmbarques: boolean;
  cotizacionesCliente: CotizacionCliente[];
  loadingCotizaciones: boolean;
}

/** Pestañas tabulares (embarques y cotizaciones) del detalle de cliente. */
export function ClienteDetalleTablasTabs({
  canEdit,
  embarquesCliente,
  loadingEmbarques,
  cotizacionesCliente,
  loadingCotizaciones,
}: Props) {
  return (
    <>
      <TabsContent value="embarques" className="mt-4">
        <DetailTabSection title="Embarques del cliente" count={embarquesCliente.length}>
          <ResponsiveDataTable
            columns={embarqueColumns}
            data={embarquesCliente}
            isLoading={loadingEmbarques}
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={Ship}
                  title="Sin embarques registrados"
                  description="Los embarques se generan al confirmar una cotización de este cliente."
                />
              </div>
            }
            getRowHref={(e) => `/embarques/${e.id}`}
            rowKey={(e) => e.id}
            density={TABLE_DENSITY.embebida}
            mobileCard={(e) => <EmbarqueClienteMobileCard e={e} />}
          />
        </DetailTabSection>
      </TabsContent>

      <TabsContent value="cotizaciones" className="mt-4">
        <DetailTabSection
          title="Cotizaciones del cliente"
          count={cotizacionesCliente.length}
          actions={
            canEdit ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/cotizaciones/nueva">
                  <Plus className="h-4 w-4 mr-1" /> Nueva cotización
                </Link>
              </Button>
            ) : undefined
          }
        >
          <ResponsiveDataTable
            columns={cotizacionColumns}
            data={cotizacionesCliente}
            isLoading={loadingCotizaciones}
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={ClipboardList}
                  title="Sin cotizaciones registradas"
                  description="Cotiza una ruta para este cliente y aparecerá aquí."
                />
              </div>
            }
            getRowHref={(c) => `/cotizaciones/${c.id}`}
            rowKey={(c) => c.id}
            density={TABLE_DENSITY.embebida}
            mobileCard={(c) => <CotizacionClienteMobileCard c={c} />}
          />
        </DetailTabSection>
      </TabsContent>
    </>
  );
}
