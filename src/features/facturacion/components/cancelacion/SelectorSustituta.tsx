import { ArrowRight, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SustitutaCandidata } from "@/features/facturacion/services/sustitutasDeFactura";

interface Props {
  isLoading: boolean;
  sustitutasTimbradas: SustitutaCandidata[];
  value: string;
  onChange: (id: string) => void;
  onAbrirSustituir?: () => void;
}

/**
 * Bloque de selección de sustituta para el motivo 01 de cancelación.
 * Extraído para respetar el límite de 200 líneas del dialog padre.
 */
export function SelectorSustituta({ isLoading, sustitutasTimbradas, value, onChange, onAbrirSustituir }: Props) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Buscando sustitutas…</p>;
  }
  if (sustitutasTimbradas.length === 0) {
    return (
      <Alert className="border-warning/30 bg-warning/10">
        <Info className="h-4 w-4 text-warning" />
        <AlertTitle className="text-warning">No hay sustituta timbrada</AlertTitle>
        <AlertDescription className="text-foreground space-y-2">
          <p>
            El motivo 01 requiere que primero timbres una factura sustituta con relación 04.
            Usa el asistente de sustitución para crearla, editarla y timbrarla; después regresa a cancelar.
          </p>
          {onAbrirSustituir && (
            <Button size="sm" variant="outline" onClick={onAbrirSustituir}>
              Abrir asistente de sustitución <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <>
      <Label className="sr-only">Sustituta</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Elige la sustituta" /></SelectTrigger>
        <SelectContent>
          {sustitutasTimbradas.map((s) => {
            const label = s.numero ?? `${s.serie ?? ""}${s.folio_fiscal ?? ""}`;
            const uuidHint = s.uuid_fiscal ? ` · UUID ${s.uuid_fiscal.slice(0, 8)}…` : "";
            return (
              <SelectItem key={s.id} value={s.id}>
                {label}{uuidHint}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Se enviará a FacturAPI el <code>facturapi_id</code> interno de la sustituta seleccionada
        (parámetro <code>substitution</code>). El UUID SAT queda en bitácora para auditoría.
      </p>
    </>
  );
}
