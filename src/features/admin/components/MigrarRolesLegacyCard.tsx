/**
 * MigrarRolesLegacyCard — Card en /admin/auditoria para migrar los roles legacy
 * (`admin`, `operador`, `viewer`) a los roles modernos equivalentes en
 * `organization_members` y `user_roles`. Sólo super_admin.
 *
 * Mapa aplicado:
 *   admin    → admin_org
 *   operador → coordinador_logistico
 *   viewer   → customer_service
 *
 * Flujo: al montar (o al abrir la card) se pide una vista previa (dry-run).
 * Si hay filas afectadas, muestra el detalle y habilita el botón "Ejecutar
 * migración" con doble confirmación tipeada.
 */
import { useState } from "react";
import { ShieldCheck, Loader2, RefreshCcw } from "lucide-react";
import {
  useMigrarRolesLegacy,
  useMigrarRolesLegacyDryRun,
} from "@/features/admin/hooks/useMigrarRolesLegacy";
import type { MigrarRolesLegacyResult } from "@/features/admin/services/migrarRolesLegacy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { MigrarRolesLegacyPreviewTable } from "./MigrarRolesLegacyPreviewTable";
import { MigrarRolesLegacyResultPanel } from "./MigrarRolesLegacyResultPanel";

export function MigrarRolesLegacyCard() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<MigrarRolesLegacyResult | null>(null);

  const preview = useMigrarRolesLegacyDryRun(true);
  const run = useMigrarRolesLegacy({
    onSuccess: (data) => {
      setResult(data);
      setOpen(false);
      setConfirmText("");
    },
  });

  const total = preview.data?.total_afectados ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Migración de roles legacy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Reemplaza los roles antiguos <code className="bg-muted px-1 rounded">admin</code>,{" "}
          <code className="bg-muted px-1 rounded">operador</code> y{" "}
          <code className="bg-muted px-1 rounded">viewer</code> por sus equivalentes
          modernos en <strong>membresías de organización</strong> y en{" "}
          <strong>roles globales</strong>.
        </p>

        <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
          <div className="font-medium text-foreground">Mapa aplicado:</div>
          <ul className="list-disc pl-5 text-muted-foreground">
            <li><code>admin</code> → <strong>Administrador</strong> (admin_org)</li>
            <li><code>operador</code> → <strong>Coordinador Logístico</strong></li>
            <li><code>viewer</code> → <strong>Atención a Clientes</strong> (customer_service)</li>
          </ul>
        </div>

        {preview.isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculando registros afectados…
          </div>
        ) : preview.isError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            No se pudo cargar la vista previa. Verifica que estás firmado como super_admin.
          </div>
        ) : preview.data ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={total > 0 ? "default" : "secondary"}>
                {total} registro(s) por migrar
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => preview.refetch()}
                disabled={preview.isFetching}
                aria-label="Refrescar vista previa"
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${preview.isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <MigrarRolesLegacyPreviewTable data={preview.data} />
            <Button
              variant="outline"
              onClick={() => setOpen(true)}
              disabled={run.isPending || total === 0}
            >
              {run.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ejecutar migración
            </Button>
          </div>
        ) : null}

        {result && <MigrarRolesLegacyResultPanel result={result} />}

        <ConfirmActionDialog
          open={open}
          onOpenChange={(o) => { setOpen(o); if (!o) setConfirmText(""); }}
          size="md"
          title="Ejecutar migración de roles legacy"
          confirmLabel="Ejecutar migración"
          confirmDisabled={confirmText !== "MIGRAR"}
          isPending={run.isPending}
          onConfirm={() => run.mutate()}
          description={
            <>
              Esta acción actualiza <strong>{total}</strong> registro(s) en{" "}
              <code className="bg-muted px-1 rounded">organization_members</code> y{" "}
              <code className="bg-muted px-1 rounded">user_roles</code>. Es idempotente
              pero no automáticamente reversible.
            </>
          }
        >
          <div className="space-y-1.5">
            <Label htmlFor="migrar-confirm" className="text-xs">
              Escribe <span className="font-mono font-semibold">MIGRAR</span> para confirmar
            </Label>
            <Input
              id="migrar-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="MIGRAR"
              autoFocus
              autoComplete="off"
            />
          </div>
        </ConfirmActionDialog>
      </CardContent>
    </Card>
  );
}
