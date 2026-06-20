/**
 * Tab "Operaciones" en /configuracion (por organización, Fase 2).
 * Cada empresa define sus propios umbrales de varianza para la
 * reconciliación Cotizado / Refrescado / Real.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { useConfigValue, useUpdateConfiguracion } from "@/features/configuracion/hooks/useConfiguracion";
import { UMBRALES_DEFAULT } from "@/features/cotizacion/domain/versionadoCotizacion";

export default function TabOperaciones() {
  const alertaActual = useConfigValue<number>(
    "operaciones",
    "reconciliacion_varianza_alerta_pct",
    UMBRALES_DEFAULT.alerta_pct,
  );
  const criticaActual = useConfigValue<number>(
    "operaciones",
    "reconciliacion_varianza_critica_pct",
    UMBRALES_DEFAULT.critica_pct,
  );
  const updateConfig = useUpdateConfiguracion();

  const [alertaPct, setAlertaPct] = useState<number>(alertaActual);
  const [criticaPct, setCriticaPct] = useState<number>(criticaActual);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    setAlertaPct(Number(alertaActual));
    setCriticaPct(Number(criticaActual));
    setInitialized(true);
  }, [alertaActual, criticaActual, initialized]);

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
          Define los umbrales de tu empresa para clasificar varianzas Cotizado → Real.
          Aplican a la matriz de reconciliación de cada embarque.
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
