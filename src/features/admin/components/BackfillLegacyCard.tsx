/**
 * BackfillLegacyCard — Card en /admin/auditoria para ejecutar el backfill de
 * datos legacy (conceptos_venta facturados, proformas aceptadas) que generan
 * falsos positivos en la auditoría operativa de embarques previos al módulo
 * de facturación.
 *
 * Solo super_admin. Doble confirmación tipo EJECUTAR.
 *
 * v13.232.0 · Migrado a `ConfirmActionDialog` con Label a11y (Lote 7d.2).
 */
import { useState } from "react";
import { Database, Loader2, CheckCircle2 } from "lucide-react";
import { type BackfillLegacyResult } from "@/features/admin/services/backfillLegacy";
import { useBackfillLegacy } from "@/features/admin/hooks/useBackfillLegacy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { formatFechaHora } from "@/lib/formatters/dates";

export function BackfillLegacyCard() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<BackfillLegacyResult | null>(null);

  const run = useBackfillLegacy({
    onSuccess: (data) => {
      setResult(data);
      setOpen(false);
      setConfirmText("");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          Backfill de datos legacy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Repara conceptos de venta y proformas de embarques antiguos que se
          quedaron en estado <code className="bg-muted px-1 rounded">pendiente</code> aunque
          ya tienen facturas emitidas. Esto elimina los falsos positivos de la
          regla <strong>ventas_sin_facturar</strong> en la auditoría operativa.
        </p>
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          disabled={run.isPending}
        >
          {run.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Ejecutar backfill
        </Button>
        {result && (
          <div className="rounded-md border bg-success/5 border-success/30 p-3 text-xs space-y-1">
            <div className="flex items-center gap-1 font-semibold text-success dark:text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Último resultado ({formatFechaHora(result.ejecutado_at)})
            </div>
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>{result.totales.conceptos_actualizados} conceptos de venta marcados como facturados</li>
              <li>{result.totales.embarques_afectados} embarques afectados</li>
              <li>{result.totales.proformas_actualizadas} proformas marcadas como facturadas</li>
            </ul>
          </div>
        )}

        <ConfirmActionDialog
          open={open}
          onOpenChange={(o) => { setOpen(o); if (!o) setConfirmText(""); }}
          size="md"
          title="Ejecutar backfill legacy"
          confirmLabel="Ejecutar"
          confirmDisabled={confirmText !== "EJECUTAR"}
          isPending={run.isPending}
          onConfirm={() => run.mutate()}
          description={
            <>
              Esta acción modifica registros en <strong>conceptos_venta</strong> y{" "}
              <strong>proformas</strong> de TODAS las organizaciones. Solo afecta filas
              donde ya existe una factura emitida correspondiente. No es reversible.
            </>
          }
        >
          <div className="space-y-1.5">
            <Label htmlFor="backfill-confirm" className="text-xs">
              Escribe <span className="font-mono font-semibold">EJECUTAR</span> para confirmar
            </Label>
            <Input
              id="backfill-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="EJECUTAR"
              autoFocus
              autoComplete="off"
            />
          </div>
        </ConfirmActionDialog>
      </CardContent>
    </Card>
  );
}
