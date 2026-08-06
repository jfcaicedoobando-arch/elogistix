/**
 * Bloque R — Tab Seguros: pólizas de carga del embarque.
 * La prima se incluye automáticamente como costo real en el P&L.
 */
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { KpiCard } from "@/components/shared/KpiCard";
import { KpiStrip } from "@/components/shared/KpiStrip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import EmptyState from "@/components/empty/EmptyState";
import { ConfirmDeleteAlert } from "@/features/costeo/components/ConfirmDeleteAlert";
import { Shield, Plus, ExternalLink, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useDeleteSeguro, useSegurosEmbarque } from "@/features/embarques/hooks/useSegurosEmbarque";
import type { SeguroEmbarque } from "@/features/embarques/services/seguros";
import { DialogSeguroForm } from "./DialogSeguroForm";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

interface Props {
  embarqueId: string;
  canEdit: boolean;
}

function diasRestantes(hasta: string): number {
  const end = new Date(hasta + "T23:59:59").getTime();
  return Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000));
}

function VigenciaBadge({ hasta }: { hasta: string }) {
  const dias = diasRestantes(hasta);
  if (dias < 0) return <Badge variant="destructive">Vencida</Badge>;
  if (dias <= 7) return <Badge className="bg-warning/10 text-warning">Vence en {dias}d</Badge>;
  return <Badge variant="secondary">Vigente · {dias}d</Badge>;
}

export function TabSeguros({ embarqueId, canEdit }: Props) {
  const { data: seguros = [] } = useSegurosEmbarque(embarqueId);
  const del = useDeleteSeguro(embarqueId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SeguroEmbarque | null>(null);
  const [deleting, setDeleting] = useState<SeguroEmbarque | null>(null);

  const totales = useMemo(() => {
    return seguros.reduce<Record<string, number>>((acc, s) => {
      acc[s.moneda] = (acc[s.moneda] ?? 0) + Number(s.prima || 0);
      return acc;
    }, {});
  }, [seguros]);

  const columns = useMemo<ColumnDef<SeguroEmbarque, unknown>[]>(() => defineColumns<SeguroEmbarque>([
    { id: "aseguradora", header: "Aseguradora",
      cell: ({ row }) => <span className="font-medium">{row.original.aseguradora}</span> },
    { id: "numero_poliza", header: "Póliza", cell: ({ row }) => row.original.numero_poliza },
    {
      id: "vigencia", header: "Vigencia",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <span className="text-xs">{formatDate(row.original.vigencia_desde)} → {formatDate(row.original.vigencia_hasta)}</span>
          <VigenciaBadge hasta={row.original.vigencia_hasta} />
        </div>
      ),
    },
    { id: "suma_asegurada", header: "Suma asegurada", meta: { align: "right", className: "tabular-nums" },
      cell: ({ row }) => formatCurrency(Number(row.original.suma_asegurada), row.original.moneda) },
    { id: "deducible", header: "Deducible", meta: { align: "right", className: "tabular-nums" },
      cell: ({ row }) => formatCurrency(Number(row.original.deducible), row.original.moneda) },
    { id: "prima", header: "Prima (costo)", meta: { align: "right", className: "tabular-nums font-semibold" },
      cell: ({ row }) => formatCurrency(Number(row.original.prima), row.original.moneda) },
    {
      id: "certificado", header: "Certificado",
      cell: ({ row }) => row.original.certificado_url ? (
        <Button variant="link" size="sm" asChild className="h-auto p-0" onClick={(e) => e.stopPropagation()}>
          <a href={row.original.certificado_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Ver
          </a>
        </Button>
      ) : <span className="text-muted-foreground">—</span>,
    },
    {
      id: "acciones", header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" disabled={!canEdit}
            onClick={() => { setEditing(row.original); setOpen(true); }} aria-label="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" disabled={!canEdit || del.isPending}
            onClick={() => setDeleting(row.original)} aria-label="Eliminar">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]), [canEdit, del]);

  const venceProntoCount = seguros.filter((s) => diasRestantes(s.vigencia_hasta) <= 7).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeading
          as="h3"
          icon={<Shield className="h-5 w-5" />}
          actions={venceProntoCount > 0 && (
            <Badge className="bg-warning/10 text-warning gap-1">
              <AlertTriangle className="h-3 w-3" /> {venceProntoCount} por vencer
            </Badge>
          )}
        >
          Seguros de carga
        </SectionHeading>
        <Button onClick={() => { setEditing(null); setOpen(true); }} disabled={!canEdit}>
          <Plus className="h-4 w-4 mr-2" /> Nueva póliza
        </Button>
      </div>

      {Object.keys(totales).length > 0 && (
        <KpiStrip desktopCols={Math.min(Math.max(Object.keys(totales).length, 2), 4) as 2 | 3 | 4}>
          {Object.entries(totales).map(([moneda, total]) => (
            <KpiCard
              key={moneda}
              label={`Prima total (${moneda})`}
              value={formatCurrency(total, moneda)}
              sublabel="Suma de pólizas"
            />
          ))}
        </KpiStrip>
      )}

      <Card>
        <CardContent className="p-0">
          <DataTable
            data={seguros}
            columns={columns}
            rowKey={(r) => r.id}
            density={TABLE_DENSITY.listado}
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={Shield}
                  title="Sin pólizas registradas"
                  description="Registra la póliza de seguro de carga del embarque para que la prima entre en el P&L."
                />
              </div>
            }
          />
        </CardContent>
      </Card>

      <DialogSeguroForm
        open={open}
        onOpenChange={setOpen}
        embarqueId={embarqueId}
        seguro={editing}
      />

      <ConfirmDeleteAlert
        open={!!deleting}
        onOpenChange={(v) => { if (!v) setDeleting(null); }}
        title={deleting ? `¿Eliminar póliza ${deleting.numero_poliza}?` : "¿Eliminar póliza?"}
        description="Se eliminará la póliza y la prima dejará de contar como costo en el P&L del embarque."
        confirmLabel="Eliminar"
        pending={del.isPending}
        onConfirm={() => {
          if (deleting) {
            del.mutate(deleting.id);
            setDeleting(null);
          }
        }}
      />
    </div>
  );
}
