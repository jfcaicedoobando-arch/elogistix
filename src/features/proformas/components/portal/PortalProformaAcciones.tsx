/**
 * Bloque de acciones (Aceptar / Rechazar) del portal público de proformas.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle } from "lucide-react";
import { COPY_ENLACE, COPY_PASOS, COPY_VALIDACION } from "@/lib/copy/publicoCopy";

interface Props {
  submitting: boolean;
  onResponder: (respuesta: "aceptada" | "rechazada", motivo: string) => Promise<void>;
  error: string | null;
}

export function PortalProformaAcciones({ submitting, onResponder, error }: Props) {
  const [modo, setModo] = useState<"idle" | "rechazar">("idle");
  const [motivo, setMotivo] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  async function ejecutar(respuesta: "aceptada" | "rechazada") {
    setLocalError(null);
    if (respuesta === "rechazada" && motivo.trim().length < 3) {
      setLocalError(COPY_VALIDACION.motivoRechazo);
      return;
    }
    try {
      await onResponder(respuesta, motivo.trim());
    } catch (e) {
      // Superficie pública: nunca exponer `error.message` crudo al cliente.
      console.error("[portal-proforma]", e);
      setLocalError(COPY_ENLACE.noDisponible);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tu respuesta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {modo === "idle" && (
          <>
            <p className="text-sm text-muted-foreground">
              Revisa los conceptos y totales. Puedes aceptar la proforma para autorizar la facturación, o
              rechazarla indicando el motivo.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                className="flex-1"
                onClick={() => void ejecutar("aceptada")}
                loading={submitting}
              >
                {!submitting && <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                Aceptar proforma
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setModo("rechazar")}
                disabled={submitting}
              >
                <XCircle className="h-4 w-4 mr-1.5" />
                Rechazar
              </Button>
            </div>
          </>
        )}

        {modo === "rechazar" && (
          <>
            <div>
              <Label htmlFor="motivo">Motivo del rechazo *</Label>
              <Textarea
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={4}
                placeholder="Ej.: los conceptos no coinciden con lo acordado; requerimos ajuste en flete."
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => void ejecutar("rechazada")} loading={submitting}>
                Confirmar rechazo
              </Button>
              <Button variant="outline" onClick={() => setModo("idle")} disabled={submitting}>
                Cancelar
              </Button>
            </div>
          </>
        )}

        {(localError || error) && (
          <div className="space-y-1">
            <p className="text-sm text-destructive">{localError ?? error}</p>
            {(localError ?? error) === COPY_ENLACE.noDisponible && (
              <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                {COPY_PASOS.servicioNoDisponible.map((paso) => (
                  <li key={paso}>{paso}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
