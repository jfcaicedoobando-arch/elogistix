/**
 * Tabs Kanban/Tabla de /crm/oportunidades. Extraído de `Oportunidades` para
 * mantenerlo compacto.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/shared/DataTable";
import { LoadingState } from "@/components/shared/states/LoadingState";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import OportunidadKanban from "@/features/crm/components/OportunidadKanban";
import type { ColumnDef } from "@tanstack/react-table";
import type { CrmEtapaRow, CrmOportunidadRow } from "@/features/crm/hooks";

interface Props {
  vista: string;
  onVistaChange: (v: "kanban" | "tabla") => void;
  isError: boolean;
  isLoading: boolean;
  refetch: () => void;
  etapas: CrmEtapaRow[];
  ops: CrmOportunidadRow[];
  onMover: (id: string, etapaId: string, probDefault: number) => void;
  puedeMover: (o: CrmOportunidadRow) => boolean;
  onClickCard: (id: string) => void;
  onNuevo?: (etapaId: string) => void;
  columnas: ColumnDef<CrmOportunidadRow, unknown>[];
}

export default function OportunidadesTabsView({
  vista, onVistaChange, isError, isLoading, refetch,
  etapas, ops, onMover, puedeMover, onClickCard, onNuevo, columnas,
}: Props) {
  return (
    <Tabs value={vista} onValueChange={(v) => onVistaChange(v === "tabla" ? "tabla" : "kanban")}>
      <TabsList variant="vista">
        <TabsTrigger variant="vista" value="kanban">Kanban</TabsTrigger>
        <TabsTrigger variant="vista" value="tabla">Tabla</TabsTrigger>
      </TabsList>
      <TabsContent value="kanban" className="mt-4">
        {isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : isLoading ? (
          <LoadingState label="Cargando oportunidades…" />
        ) : (
          <OportunidadKanban
            etapas={etapas}
            oportunidades={ops}
            onMover={onMover}
            puedeMover={puedeMover}
            onClickCard={onClickCard}
            onNuevo={onNuevo}
          />
        )}
      </TabsContent>
      <TabsContent value="tabla" className="mt-4">
        <Card>
          <CardContent className="p-0">
            {isError ? (
              <ErrorState className="m-4" onRetry={() => void refetch()} />
            ) : (
              <DataTable
                columns={columnas}
                data={ops}
                isLoading={isLoading}
                emptyMessage="No hay oportunidades"
                getRowHref={(o) => `/crm/oportunidades/${o.id}`}
                rowKey={(o) => o.id}
                density={TABLE_DENSITY.listado}
              />
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
