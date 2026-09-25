/**
 * Embarques donde el agente autenticado figura como agente de carga.
 * Sólo lectura, sin datos comerciales (RLS lo restringe a esta vista mínima).
 * v13.172.17: migrado a `DataTable` (Fase 4 homologación).
 */
import { useMemo } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { statusColumn } from "@/components/shared/dataTable/columnBuilders";
import { sortByString, sortByDate } from "@/components/shared/dataTable/sortingFns";
import { Ship } from "lucide-react";
import { useAgenteEmbarques } from "@/features/portal-agente/hooks";
import { useDocumentTitle } from "@/hooks/shared";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { etiquetaRutaTexto } from "@/features/costeo";
import { formatFechaDia } from "@/lib/formatters/dates";
import { etiquetaExpedienteAgente } from "./_sections/agenteEmbarqueLabels";

type EmbarqueAgente = ReturnType<typeof useAgenteEmbarques>["data"] extends readonly (infer U)[] | undefined ? U : never;

export default function AgenteEmbarques() {
  useDocumentTitle('Mis Embarques');
  const { data: embarques = [], isLoading, isError, refetch } = useAgenteEmbarques();

  const columns = useMemo<ColumnDef<EmbarqueAgente, unknown>[]>(
    () => defineColumns<EmbarqueAgente>([
      {
        id: "expediente",
        header: "Expediente",
        accessorFn: (e) => etiquetaExpedienteAgente(e.expediente, e.id),
        sortingFn: sortByString((e) => etiquetaExpedienteAgente(e.expediente, e.id)),
        enableSorting: true,
        meta: { sticky: true, className: "font-medium" },
        cell: ({ row }) => etiquetaExpedienteAgente(row.original.expediente, row.original.id),
      },
      {
        id: "modo",
        header: "Modo",
        accessorFn: (e) => e.modo,
        enableSorting: true,
        meta: { className: "text-xs" },
        cell: ({ row }) => row.original.modo,
      },
      {
        id: "ruta",
        header: "Ruta",
        accessorFn: (e) => etiquetaRutaTexto(e.puerto_origen, e.puerto_destino),
        meta: { className: "text-xs" },
        cell: ({ row }) => etiquetaRutaTexto(row.original.puerto_origen, row.original.puerto_destino),
      },
      {
        id: "bl_master",
        header: "BL Master",
        accessorFn: (e) => e.bl_master ?? "",
        meta: { className: "text-xs font-mono" },
        cell: ({ row }) => row.original.bl_master ?? "—",
      },
      {
        id: "etd",
        header: "ETD",
        accessorFn: (e) => e.etd,
        sortingFn: sortByDate((e) => e.etd),
        enableSorting: true,
        meta: { className: "text-xs" },
        cell: ({ row }) => formatFechaDia(row.original.etd),
      },
      {
        id: "eta",
        header: "ETA",
        accessorFn: (e) => e.eta,
        sortingFn: sortByDate((e) => e.eta),
        enableSorting: true,
        meta: { className: "text-xs" },
        cell: ({ row }) => formatFechaDia(row.original.eta),
      },
      statusColumn<EmbarqueAgente>({
        domain: "embarque",
        accessor: (e) => e.estado,
      }),
    ]),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Ship className="h-6 w-6 text-accent" />}
        title="Mis embarques"
        description="Embarques donde figuras como agente de carga. Sólo lectura — sin datos comerciales del cliente final."
      />

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
      <ResponsiveDataTable<EmbarqueAgente>
        columns={columns}
        data={embarques}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        emptyMessage="Aún no hay embarques asignados a tu agente. Operaciones asigna embarques al agente cuando la cotización u operación lo vincula."
        mobileCard={(e) => (
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium break-words">{etiquetaExpedienteAgente(e.expediente, e.id)}</span>
              <StatusBadge domain="embarque" status={e.estado} />
            </div>
            <p className="text-body-sm break-words">{etiquetaRutaTexto(e.puerto_origen, e.puerto_destino)}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {e.modo} · ETD {formatFechaDia(e.etd)} · ETA {formatFechaDia(e.eta)}
            </p>
            {e.bl_master && <p className="text-xs text-muted-foreground break-all">BL Master: {e.bl_master}</p>}
          </div>
        )}
      />
      )}

    </div>
  );
}
