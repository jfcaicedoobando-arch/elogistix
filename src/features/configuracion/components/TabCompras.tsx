/**
 * Tab "Compras" en /configuracion (por organización).
 *
 * FP-000221: el aviso de aprobación de facturas de proveedor prometía que el
 * monto máximo autorizable sin respaldo de embarque se ajustaba aquí, pero la
 * pantalla no existía. Este tab expone la clave
 * `compras.umbral_aprobacion_sin_vinculo` que lee
 * `public.cxp_umbral_sin_vinculo` (por defecto 50,000 MXN).
 */
import { useEffect, useState } from "react";
import { Save } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/FormField";
import { useConfigValue, useUpdateConfiguracion } from "@/features/configuracion/hooks/useConfiguracion";

/** Mismo valor por defecto que la función de base `cxp_umbral_sin_vinculo`. */
export const UMBRAL_APROBACION_SIN_VINCULO_DEFAULT = 50000;

export function esUmbralValido(valor: number): boolean {
  return Number.isFinite(valor) && valor >= 0;
}

export default function TabCompras() {
  const umbralActual = useConfigValue<number>(
    "compras",
    "umbral_aprobacion_sin_vinculo",
    UMBRAL_APROBACION_SIN_VINCULO_DEFAULT,
  );
  const updateConfig = useUpdateConfiguracion();

  const [umbral, setUmbral] = useState<number>(umbralActual);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    setUmbral(Number(umbralActual));
    setInitialized(true);
  }, [umbralActual, initialized]);

  const valido = esUmbralValido(umbral);

  const handleGuardar = () => {
    if (!valido) return;
    updateConfig.mutate([
      { categoria: "compras", clave: "umbral_aprobacion_sin_vinculo", valor: umbral },
    ]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aprobación de facturas de proveedor</CardTitle>
        <CardDescription>
          Monto máximo (en pesos) que se puede aprobar cuando la factura es un costo de
          embarque y todavía no está ligada al embarque ni a sus costos. Los gastos de
          administración y de ventas no requieren esa liga: sólo se les pide la
          justificación del gasto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-3 rounded-lg border max-w-sm">
          <FormField
            label="Monto máximo sin liga a embarque (MXN)"
            hint="Arriba de este monto se pide vincular la factura al embarque o a sus costos"
          >
            <Input
              type="number"
              min={0}
              step={1000}
              value={umbral}
              onChange={(e) => setUmbral(Number(e.target.value))}
              className="w-40"
            />
          </FormField>
        </div>

        {!valido && (
          <p className="text-xs text-destructive">El monto debe ser un número mayor o igual a cero.</p>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={handleGuardar} disabled={updateConfig.isPending || !valido}>
            <Save className="h-4 w-4 mr-2" /> Guardar monto
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
