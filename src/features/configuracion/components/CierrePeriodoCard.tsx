/**
 * Card "Cierre de periodo contable" (Ola 3).
 *
 * Guarda `contabilidad.cierre_periodo_fecha` vía la RPC
 * `actualizar_cierre_periodo` (Defecto 4): permite avanzar el cierre
 * libremente, pero exige un motivo (≥10 caracteres) para retroceder o vaciar
 * un cierre existente, y deja bitácora siempre.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/FormField";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Save, Unlock } from "lucide-react";
import { useConfigValue } from "@/features/configuracion/hooks/useConfiguracion";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";
import { useActualizarCierrePeriodo } from "@/features/configuracion/hooks/useActualizarCierrePeriodo";
import { CierrePeriodoMotivoField, MOTIVO_MIN_LARGO } from "./CierrePeriodoMotivoField";

const CATEGORIA = "contabilidad";
const CLAVE = "cierre_periodo_fecha";

export default function CierrePeriodoCard() {
  const guardada = useConfigValue<string>(CATEGORIA, CLAVE, "");
  const { organizationId } = useOrgActiva();

  const [fecha, setFecha] = useState<string>("");
  const [motivo, setMotivo] = useState("");
  const [motivoError, setMotivoError] = useState<string | undefined>();
  const [inicializado, setInicializado] = useState(false);

  useEffect(() => {
    if (inicializado) return;
    setFecha(typeof guardada === "string" ? guardada : "");
    setInicializado(true);
  }, [guardada, inicializado]);

  const esRetroceso = (nuevaFecha: string): boolean =>
    !!guardada && (!nuevaFecha || nuevaFecha < guardada);

  const mutation = useActualizarCierrePeriodo({
    organizationId,
    motivo,
    onExito: () => {
      setMotivo("");
      setMotivoError(undefined);
    },
  });

  const guardar = (valor: string) => {
    if (esRetroceso(valor)) {
      const motivoLimpio = motivo.trim();
      if (motivoLimpio.length < MOTIVO_MIN_LARGO) {
        setMotivoError(`Captura un motivo de al menos ${MOTIVO_MIN_LARGO} caracteres.`);
        return;
      }
    }
    setMotivoError(undefined);
    mutation.mutate(valor);
  };

  const mostrarMotivo = esRetroceso(fecha);

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
            <DatePickerMx value={fecha} onChange={setFecha} title="Cerrado hasta" />
          </FormField>
        </div>

        {mostrarMotivo ? (
          <CierrePeriodoMotivoField motivo={motivo} onChange={setMotivo} error={motivoError} />
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => guardar(fecha)} disabled={mutation.isPending || (!fecha && !guardada)}>
            <Save className="h-4 w-4 mr-2" aria-hidden="true" />
            Guardar cierre
          </Button>
          {guardada && fecha !== "" ? (
            <Button
              variant="outline"
              onClick={() => setFecha("")}
              disabled={mutation.isPending}
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
