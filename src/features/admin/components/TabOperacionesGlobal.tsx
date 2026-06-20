/**
 * Tab "Operaciones" en /admin/configuracion (Fase 2).
 * Permite ajustar los umbrales globales de reconciliación cotizado/refrescado/real.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { useConfigGlobalCategoria, useUpdateConfiguracionGlobal } from "@/features/configuracion/hooks";
import { UMBRALES_DEFAULT } from "@/lib/domain/versionadoCotizacion";

export default function TabOperacionesGlobal() {
  const config = useConfigGlobalCategoria("operaciones");
  const updateConfig = useUpdateConfiguracionGlobal();

  const [alertaPct, setAlertaPct] = useState<number>(UMBRALES_DEFAULT.alerta_pct);
  const [criticaPct, setCriticaPct] = useState<number>(UMBRALES_DEFAULT.critica_pct);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    if (Object.keys(config).length === 0) return;
    const a = Number(config.reconciliacion_varianza_alerta_pct);
    const c = Number(config.reconciliacion_varianza_critica_pct);
    if (Number.isFinite(a)) setAlertaPct(a);
    if (Number.isFinite(c)) setCriticaPct(c);
    setInitialized(true);
  }, [config, initialized]);

  const valido = alertaPct >= 0 && criticaPct > alertaPct;

  const handleGuardar = () => {
    if (!valido) return;
    updateConfig.mutate([
      { categoria: "operaciones", clave: "reconciliacion_varianza_alerta_pct", valor: alertaPct },
      { categoria: "operaciones", clave: "reconciliacion_varianza_critica_pct", valor: criticaPct },
    ]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reconciliación de embarques</CardTitle>
        <CardDescription>
          Umbrales globales para clasificar las varianzas Cotizado → Real.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
          <div className="space-y-2 p-3 rounded-lg border">
            <Label className="text-sm font-medium">Umbral de alerta (%)</Label>
            <p className="text-xs text-muted-foreground">
              A partir de este % la varianza se marca como <strong>alerta</strong>.
            </p>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={alertaPct}
              onChange={(e) => setAlertaPct(Number(e.target.value))}
              className="w-28"
            />
          </div>

          <div className="space-y-2 p-3 rounded-lg border">
            <Label className="text-sm font-medium">Umbral crítico (%)</Label>
            <p className="text-xs text-muted-foreground">
              A partir de este % la varianza se marca como <strong>crítica</strong>.
            </p>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={criticaPct}
              onChange={(e) => setCriticaPct(Number(e.target.value))}
              className="w-28"
            />
          </div>
        </div>

        {!valido && (
          <p className="text-xs text-destructive">
            El umbral crítico debe ser mayor que el de alerta.
          </p>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={handleGuardar} disabled={updateConfig.isPending || !valido}>
            <Save className="h-4 w-4 mr-2" /> Guardar umbrales
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
