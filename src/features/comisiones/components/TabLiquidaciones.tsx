/**
 * Tabla migrada a `DataTable` (Ola F, punto 8).
 */
import { useState } from "react";
import { Plus, CheckCircle2, Receipt, Ban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useLiquidaciones } from "@/features/comisiones/hooks";
import { useAuth } from "@/lib/contexts/AuthContext";
import { DialogCancelarLiquidacion } from "./DialogCancelarLiquidacion";
import { DialogGenerarLiquidacion } from "./DialogGenerarLiquidacion";
import { DialogRegistrarPagoLiquidacion } from "./DialogRegistrarPagoLiquidacion";
import type { LiquidacionRow } from "@/features/comisiones/services";

interface VendedoraOpt { id: string; nombre: string }

export function TabLiquidaciones({ vendedoras }: { vendedoras: VendedoraOpt[] }) {
  const { data: liquidaciones = [], isLoading } = useLiquidaciones();
  const [genOpen, setGenOpen] = useState(false);
  const [pagoOpen, setPagoOpen] = useState<LiquidacionRow | null>(null);
  const [cancelOpen, setCancelOpen] = useState<LiquidacionRow | null>(null);
  // Ola 4 · N28: mismos roles que la RPC/RLS — gerentes son sólo lectura.
  const { effectiveRole } = useAuth();
  const puedeGestionar =
    effectiveRole != null &&
    ["admin", "admin_org", "super_admin", "contador", "tesorero"].includes(effectiveRole);

  const columns: ColumnDef<LiquidacionRow, unknown>[] = defineColumns<LiquidacionRow>([
    { id: "periodo", header: "Periodo", meta: { width: COL_W.folio, className: "font-mono text-body-sm" }, cell: ({ row }) => row.original.periodo },
    {
      id: "vendedora", header: "Vendedora", meta: { width: COL_W.nombre },
      cell: ({ row }) => vendedoras.find((x) => x.id === row.original.vendedora_id)?.nombre ?? row.original.vendedora_id,
    },
    {
      id: "total", header: "Total MXN", meta: { width: COL_W.monto, align: "right", className: "font-semibold" },
      cell: ({ row }) => formatCurrency(Number(row.original.total_mxn), "MXN"),
    },
    {
      id: "fecha_pago", header: "Fecha pago", meta: { width: COL_W.fecha },
      cell: ({ row }) => row.original.fecha_pago
        ? formatDate(row.original.fecha_pago)
        : <span className="text-muted-foreground italic">pendiente</span>,
    },
    {
      id: "estado", header: "Estado", meta: { width: COL_W.estado ?? COL_W.fecha, className: "text-body-sm" },
      cell: ({ row }) => row.original.estado ?? "Generada",
    },
    {
      id: "referencia", header: "Referencia", meta: { width: COL_W.texto, className: "text-muted-foreground text-body-sm" },
      cell: ({ row }) => row.original.referencia ?? "—",
    },
    {
      id: "acciones", header: "", meta: { width: COL_W.acciones ?? COL_W.ruta, align: "right" },
      cell: ({ row }) => {
        const l = row.original;
        if (l.fecha_pago || l.estado === "Cancelada" || !puedeGestionar) return null;
        return (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setPagoOpen(l)}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Registrar pago
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCancelOpen(l)}>
              <Ban className="h-4 w-4 mr-1" /> Cancelar
            </Button>
          </div>
        );
      },
    },
  ]);


  return (
    <div className="space-y-4">
      {puedeGestionar && (
        <div className="flex justify-end">
          <Button onClick={() => setGenOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Generar liquidación
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={liquidaciones}
            isLoading={isLoading}
            rowKey={(l) => l.id}
            density={TABLE_DENSITY.embebida}
            emptyIcon={Receipt}
            emptyMessage="Sin liquidaciones registradas."
          />
        </CardContent>
      </Card>

      <DialogGenerarLiquidacion open={genOpen} onOpenChange={setGenOpen} vendedoras={vendedoras} />
      <DialogRegistrarPagoLiquidacion
        open={!!pagoOpen}
        onOpenChange={(o) => !o && setPagoOpen(null)}
        liq={pagoOpen}
      />
      <DialogCancelarLiquidacion
        open={!!cancelOpen}
        onOpenChange={(o) => !o && setCancelOpen(null)}
        liq={cancelOpen}
      />
    </div>
  );
}
