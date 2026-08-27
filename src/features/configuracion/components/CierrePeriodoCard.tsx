/**
 * Card "Cierre de periodo contable" (Ola 3).
 *
 * Guarda `contabilidad.cierre_periodo_fecha`. Con esa fecha puesta, la base de
 * datos rechaza facturas, pagos y notas de crédito con fecha igual o anterior,
 * y también impide mover la fecha de un documento ya cerrado.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/FormField";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Save, Unlock } from "lucide-react";
import { useConfigValue, useUpdateConfiguracion } from "@/features/configuracion/hooks/useConfiguracion";

const CATEGORIA = "contabilidad";
const CLAVE = "cierre_periodo_fecha";

export default function CierrePeriodoCard() {
  const guardada = useConfigValue<string>(CATEGORIA, CLAVE, "");
  const updateConfig = useUpdateConfiguracion();

  const [fecha, setFecha] = useState<string>("");
  const [inicializado, setInicializado] = useState(false);

  useEffect(() => {
    if (inicializado) return;
    setFecha(typeof guardada === "string" ? guardada : "");
    setInicializado(true);
  }, [guardada, inicializado]);

  const guardar = (valor: string) => {
    updateConfig.mutate([{ categoria: CATEGORIA, clave: CLAVE, valor }]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Cierre de periodo contable
        </CardTitle>
        <CardDescription>
          Fija la fecha hasta la cual la contabilidad está cerrada. Nadie podrá registrar
          ni mover facturas, pagos o notas de crédito con fecha igual o anterior a ese día.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {guardada ? (
          <Alert>
            <AlertDescription>
              El periodo está cerrado hasta el <strong>{String(guardada)}</strong>. Los
              documentos con fecha posterior siguen editándose con normalidad.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="max-w-xs">
          <FormField
            label="Cerrado hasta"
            hint="Deja el campo vacío para reabrir todos los periodos"
          >
            <DatePickerMx value={fecha} onChange={(v) => setFecha(v ?? "")} />
          </FormField>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => guardar(fecha)} disabled={updateConfig.isPending || !fecha}>
            <Save className="h-4 w-4 mr-2" aria-hidden="true" />
            Guardar cierre
          </Button>
          {guardada ? (
            <Button
              variant="outline"
              onClick={() => {
                setFecha("");
                guardar("");
              }}
              disabled={updateConfig.isPending}
            >
              <Unlock className="h-4 w-4 mr-2" aria-hidden="true" />
              Reabrir periodo
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
