/**
 * BackfillLegacyCard — Card en /admin/auditoria para ejecutar el backfill de
 * datos legacy (conceptos_venta facturados, proformas aceptadas) que generan
 * falsos positivos en la auditoría operativa de embarques previos al módulo
 * de facturación.
 *
 * Solo super_admin. Doble confirmación tipo ELIMINAR.
 */
import { useState } from "react";
import { Database, Loader2, CheckCircle2 } from "lucide-react";
import { type BackfillLegacyResult } from "@/features/admin/services/backfillLegacy";
import { useBackfillLegacy } from "@/features/admin/hooks/useBackfillLegacy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { dialogSize } from "@/components/shared/utils/dialogTokens";

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
        <CardTitle className="text-base flex items-center gap-2">
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
          <div className="rounded-md border bg-emerald-500/5 border-emerald-500/30 p-3 text-xs space-y-1">
            <div className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Último resultado ({new Date(result.ejecutado_at).toLocaleString("es-MX")})
            </div>
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>{result.totales.conceptos_actualizados} conceptos de venta marcados como facturados</li>
              <li>{result.totales.embarques_afectados} embarques afectados</li>
              <li>{result.totales.proformas_actualizadas} proformas marcadas como facturadas</li>
            </ul>
          </div>
        )}

        <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setConfirmText(""); }}>
          <AlertDialogContent className={dialogSize.md}>
            <AlertDialogHeader>
              <AlertDialogTitle>Ejecutar backfill legacy</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción modifica registros en <strong>conceptos_venta</strong> y{" "}
                <strong>proformas</strong> de TODAS las organizaciones. Solo afecta filas
                donde ya existe una factura emitida correspondiente. No es reversible.
                Escribe <strong>EJECUTAR</strong> para confirmar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="EJECUTAR"
              autoFocus
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={confirmText !== "EJECUTAR" || run.isPending}
                onClick={(e) => { e.preventDefault(); run.mutate(); }}
              >
                Ejecutar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
