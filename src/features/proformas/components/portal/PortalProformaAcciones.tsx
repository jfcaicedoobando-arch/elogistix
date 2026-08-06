/**
 * Bloque de acciones (Aceptar / Rechazar) del portal público de proformas.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

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
      setLocalError("Escribe brevemente el motivo del rechazo.");
      return;
    }
    try {
      await onResponder(respuesta, motivo.trim());
    } catch (e) {
      setLocalError((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle >Tu respuesta</CardTitle>
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
                disabled={submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
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
                onClick={() => void ejecutar("rechazada")}
                disabled={submitting}
              >
                {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Confirmar rechazo
              </Button>
              <Button variant="outline" onClick={() => setModo("idle")} disabled={submitting}>
                Cancelar
              </Button>
            </div>
          </>
        )}

        {(localError || error) && (
          <p className="text-sm text-destructive">{localError ?? error}</p>
        )}
      </CardContent>
    </Card>
  );
}
