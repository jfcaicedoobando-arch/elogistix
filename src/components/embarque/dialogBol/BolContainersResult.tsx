import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AlertCircle, RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import type { BolLookupResponse } from "@/hooks/embarque";

interface Props {
  result: BolLookupResponse;
  selected: string | null;
  setSelected: (v: string) => void;
  contenedorActual: string | null;
  onRetry: () => void;
  loading: boolean;
}

export function BolContainersResult({
  result,
  selected,
  setSelected,
  contenedorActual,
  onRetry,
  loading,
}: Props) {
  if (!result.ok) {
    return (
      <div className="flex items-start gap-2 text-xs text-destructive p-3 rounded bg-destructive/5 border border-destructive/20">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">No se obtuvieron contenedores</p>
          <p className="mt-0.5">{result.error ?? "—"}</p>
        </div>
      </div>
    );
  }

  const containers = result.associated_container_numbers ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary">{result.shipping_line_name}</Badge>
        <Badge variant="outline">{result.associated_containers} contenedor(es)</Badge>
        {result.last_updated && (
          <span className="text-muted-foreground">
            Actualizado: {formatDate(result.last_updated, "dd MMM yyyy HH:mm")}
          </span>
        )}
      </div>

      {containers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay contenedores asociados.</p>
      ) : (
        <RadioGroup
          value={selected ?? ""}
          onValueChange={setSelected}
          className="max-h-72 overflow-y-auto space-y-1 pr-1"
        >
          {containers.map((c) => {
            const isCurrent = c === contenedorActual;
            return (
              <Label
                key={c}
                htmlFor={`bol-${c}`}
                className="flex items-center gap-2 rounded border p-2 cursor-pointer hover:bg-muted/40 has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/5"
              >
                <RadioGroupItem id={`bol-${c}`} value={c} />
                <span className="font-mono text-sm flex-1">{c}</span>
                {isCurrent && (
                  <Badge variant="outline" className="text-[10px]">actual</Badge>
                )}
              </Label>
            );
          })}
        </RadioGroup>
      )}

      <Button
        size="sm"
        variant="ghost"
        onClick={onRetry}
        disabled={loading}
        className="text-xs h-7"
      >
        <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
        Reintentar
      </Button>
    </div>
  );
}
