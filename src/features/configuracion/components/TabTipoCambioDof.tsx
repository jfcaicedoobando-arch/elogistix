import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, RefreshCw } from "lucide-react";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { useHistorialTcDof, useUpsertTcDofManual } from "@/features/catalogos/hooks/useTipoCambioDof";
import type { TipoCambioDof } from "@/features/catalogos/services/tipoCambioDof";
import { formatDate } from "@/lib/formatters/dates";
import { formatNumber } from "@/lib/formatters";

/** Formatea un TC con 4 decimales (convención Banxico/DOF). */
function fmtTc(valor: number | null): string {
  if (valor == null) return "—";
  return formatNumber(valor, { decimals: 4 });
}


function hoyIso(): string {
  const ahora = new Date();
  return new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function TabTipoCambioDof() {
  const { data: historial = [], isLoading, refetch, isFetching } = useHistorialTcDof(90);
  const upsert = useUpsertTcDofManual();

  const [fecha, setFecha] = useState(hoyIso());
  const [usd, setUsd] = useState("");
  const [eur, setEur] = useState("");

  const ultimo = historial[0];

  const handleGuardar = () => {
    const usdNum = Number(usd);
    if (!fecha || !Number.isFinite(usdNum) || usdNum <= 0) return;
    const eurNum = Number(eur);
    upsert.mutate(
      { fecha, usdMxn: usdNum, eurMxn: Number.isFinite(eurNum) && eurNum > 0 ? eurNum : null },
      { onSuccess: () => { setUsd(""); setEur(""); } },
    );
  };

  const columns: ColumnDef<TipoCambioDof, unknown>[] = useMemo(
    () => defineColumns<TipoCambioDof>([
      { id: "fecha", header: "Fecha", cell: ({ row }) => formatDate(row.original.fecha) },
      {
        id: "usd", header: "USD / MXN",
        meta: { className: "text-right font-mono tabular-nums", headerClassName: "text-right" },
        cell: ({ row }) => fmtTc(row.original.usd_mxn),
      },
      {
        id: "eur", header: "EUR / MXN",
        meta: { className: "text-right font-mono tabular-nums", headerClassName: "text-right" },
        cell: ({ row }) => fmtTc(row.original.eur_mxn),
      },
      {
        id: "origen", header: "Origen",
        meta: { className: "text-center", headerClassName: "text-center" },
        cell: ({ row }) => (
          <Badge variant={row.original.origen === "manual" ? "outline" : "secondary"}>
            {row.original.origen === "manual" ? "Manual" : "Automático"}
          </Badge>
        ),
      },
    ]),
    [],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Tipo de Cambio DOF</CardTitle>
            <CardDescription>
              Publicación oficial (Banxico FIX, Art. 20 CFF). Se actualiza automáticamente todos los días a las 7:05 AM (CDMX).
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {ultimo && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Última publicación</p>
              <p className="text-sm font-medium">{formatDate(ultimo.fecha)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">USD / MXN</p>
              <p className="text-lg font-semibold tabular-nums">{fmtTc(ultimo.usd_mxn)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">EUR / MXN</p>
              <p className="text-lg font-semibold tabular-nums">{fmtTc(ultimo.eur_mxn)}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
          <div className="space-y-1">
            <Label className="text-xs">Fecha</Label>
            <Input type="date" className="w-40" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">USD / MXN</Label>
            <Input className="w-32" inputMode="decimal" placeholder="17.4312" value={usd} onChange={(e) => setUsd(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">EUR / MXN (opcional)</Label>
            <Input className="w-32" inputMode="decimal" placeholder="19.9389" value={eur} onChange={(e) => setEur(e.target.value)} />
          </div>
          <Button size="sm" onClick={handleGuardar} disabled={upsert.isPending || !usd}>
            <Save className="h-4 w-4 mr-1" /> Guardar captura manual
          </Button>
        </div>

        <div className="max-h-[calc(100vh-24rem)] min-h-[280px] overflow-auto rounded-md border">
          <DataTable
            columns={columns}
            data={historial}
            isLoading={isLoading}
            emptyMessage="Aún no hay publicaciones registradas"
            rowKey={(t) => t.fecha}
            density="compact"
          />
        </div>
        <p className="text-xs text-muted-foreground">{historial.length} publicaciones en el historial (últimos 90 días).</p>
      </CardContent>
    </Card>
  );
}
