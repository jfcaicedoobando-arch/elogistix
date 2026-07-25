/**
 * Bandeja "Por enviar": CFDI ya timbrados sin envío al cliente.
 * Estados unificados vía `<BandejaShell />`.
 *
 * v13.312.27 (QW8 Tanda 2): acción "Enviar" por fila que dispara
 * `facturapi-enviar-email`. Reutiliza el mismo edge del reenvío masivo;
 * no necesita seleccionar la factura ni abrir el detalle.
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MailWarning, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { clientColumn, moneyColumn, dateColumn } from "@/components/shared/dataTable/columnBuilders";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import { useFacturasPorEnviar, type FilaPorEnviar } from "@/features/facturacion/hooks/useBandejas";
import { enviarCfdiFactura } from "@/features/facturacion/services/enviarCfdiEmail";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";
import { notifyError } from "@/lib/ui/appFeedback";
import { BandejaShell } from "./BandejaShell";

interface EnviarButtonProps {
  facturaId: string;
  numero: string;
}

function EnviarButton({ facturaId, numero }: EnviarButtonProps) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 px-2 text-xs"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        e.preventDefault();
        setBusy(true);
        try {
          const r = await enviarCfdiFactura(facturaId);
          toast.success(`Factura ${numero} enviada a ${r.enviado_a}`);
          qc.invalidateQueries({ queryKey: facturasKeys.all });
        } catch (err) {
          notifyError(toast, {
            title: `No se pudo enviar ${numero}`,
            error: err as Error,
            method: "BANDEJA_POR_ENVIAR_ROW_ACTION",
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Mail className="h-3.5 w-3.5 mr-1" />}
      Enviar
    </Button>
  );
}

const columns = defineColumns<FilaPorEnviar>([
  {
    id: "numero",
    header: "Folio",
    accessorFn: (r) => r.numero,
    enableSorting: true,
    meta: { width: "w-[140px]", className: "font-mono whitespace-nowrap", sticky: true },
    cell: ({ row }) => row.original.numero,
  },
  clientColumn<FilaPorEnviar>({ accessor: (r) => r.cliente_nombre }),
  { ...dateColumn<FilaPorEnviar>({ id: "emision", header: "Emisión", accessor: (r) => r.fecha_emision }),
    meta: { width: "w-[110px]", className: "text-xs whitespace-nowrap" } },
  { ...moneyColumn<FilaPorEnviar>({ id: "total", header: "Total",
      accessor: (r) => r.total, currencyAccessor: (r) => r.moneda }),
    meta: { width: "w-[140px]", align: "right", className: "tabular-nums whitespace-nowrap font-medium" } },
  {
    id: "acciones",
    header: "",
    enableSorting: false,
    meta: { width: "w-[110px]", align: "right", className: "whitespace-nowrap" },
    cell: ({ row }) => (
      <EnviarButton facturaId={row.original.id} numero={row.original.numero} />
    ),
  },
]);

export function BandejaPorEnviar() {
  const { data, isLoading, isError, refetch } = useFacturasPorEnviar();
  const paged = useClientPagedList<FilaPorEnviar, Record<string, string>>({
    data,
    isLoading,
    defaultFilters: {},
    defaultSort: { key: "emision", dir: "desc" },
    searchAccessor: (r) => `${r.numero} ${r.cliente_nombre}`,
    sorters: {
      numero: (a, b) => a.numero.localeCompare(b.numero),
      cliente: (a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre),
      emision: (a, b) => a.fecha_emision.localeCompare(b.fecha_emision),
      total: (a, b) => a.total - b.total,
    },
  });
  const totalCount = data?.length ?? 0;

  return (
    <BandejaShell
      isError={isError}
      onRetry={() => refetch()}
      search={paged.search}
      onSearchChange={paged.setSearch}
      searchPlaceholder="Buscar folio o cliente…"
      chips={paged.activeChips}
      activeCount={paged.activeCount}
      onClearAll={paged.resetAll}
      counter={<>Mostrando <strong className="text-foreground">{paged.filteredCount}</strong> de {totalCount} CFDI por enviar</>}
    >
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={paged.rows}
            isLoading={paged.isLoading}
            emptyIcon={MailWarning}
            emptyMessage="Todos los CFDI timbrados ya se enviaron al cliente."
            emptyHint="Aparecerán aquí los CFDI ya timbrados que todavía no tienen registro de envío por correo. Criterio: timbrada = true y sin fecha_envio."
            rowKey={(r) => r.id}
            getRowHref={(r) => `/facturacion/${r.id}`}
            getRowAriaLabel={(r) => `Abrir factura ${r.numero}`}
            sortMode="server"
            controlledSort={paged.controlledSort}
            onSortChange={paged.setSort}
            pagination={paged.pagination}
          />
        </CardContent>
      </Card>
    </BandejaShell>
  );
}
