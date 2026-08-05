/**
 * Bandeja "Por enviar": CFDI ya timbrados sin envío al cliente.
 * Estados unificados vía `<BandejaShell />`.
 *
 * v13.315.1: la acción "Enviar" ahora abre `<DialogEnviarCfdi />` para
 * que el usuario vea y confirme el destinatario antes de mandar el CFDI.
 * Antes se disparaba directo con la heurística "contacto más antiguo",
 * lo que provocaba envíos al buzón equivocado.
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MailWarning, Mail } from "lucide-react";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { clientColumn, moneyColumn, dateColumn } from "@/components/shared/dataTable/columnBuilders";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import { useFacturasPorEnviar, type FilaPorEnviar } from "@/features/facturacion/hooks/useBandejas";
import { DialogEnviarCfdi } from "@/features/facturacion/components/DialogEnviarCfdi";
import { BandejaShell } from "./BandejaShell";
import { COL_W } from "@/components/shared/dataTable/columnWidths";

interface EnviarButtonProps {
  onClick: () => void;
}

function EnviarButton({ onClick }: EnviarButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      }}
    >
      <Mail className="h-3.5 w-3.5 mr-1" />
      Enviar
    </Button>
  );
}

interface SeleccionEnvio {
  facturaId: string;
  numero: string;
  clienteId: string;
}

export function BandejaPorEnviar() {
  const { data, isLoading, isError, refetch } = useFacturasPorEnviar();
  const [seleccion, setSeleccion] = useState<SeleccionEnvio | null>(null);

  const columns = defineColumns<FilaPorEnviar>([
    {
      id: "numero",
      header: "Folio",
      accessorFn: (r) => r.numero,
      enableSorting: true,
      meta: { width: COL_W.monto, className: "font-mono whitespace-nowrap", sticky: true },
      cell: ({ row }) => row.original.numero,
    },
    clientColumn<FilaPorEnviar>({ accessor: (r) => r.cliente_nombre }),
    { ...dateColumn<FilaPorEnviar>({ id: "emision", header: "Emisión", accessor: (r) => r.fecha_emision }),
      meta: { width: COL_W.fecha, className: "text-xs whitespace-nowrap" } },
    { ...moneyColumn<FilaPorEnviar>({ id: "total", header: "Total",
        accessor: (r) => r.total, currencyAccessor: (r) => r.moneda }),
      meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap font-medium" } },
    {
      id: "acciones",
      header: "",
      enableSorting: false,
      meta: { width: COL_W.fecha, align: "right", className: "whitespace-nowrap" },
      cell: ({ row }) => (
        <EnviarButton
          onClick={() => setSeleccion({
            facturaId: row.original.id,
            numero: row.original.numero,
            clienteId: row.original.cliente_id,
          })}
        />
      ),
    },
  ]);

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
    <>
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
              emptyHint="Aquí aparecerán las facturas ya timbradas que todavía no se han enviado por correo al cliente."
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

      <DialogEnviarCfdi
        open={seleccion !== null}
        onOpenChange={(o) => { if (!o) setSeleccion(null); }}
        facturaId={seleccion?.facturaId}
        clienteId={seleccion?.clienteId}
        titulo={seleccion ? `Enviar factura ${seleccion.numero}` : undefined}
      />
    </>
  );
}
