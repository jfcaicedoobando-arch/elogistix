import { useState } from "react";
import { Eye, EyeOff, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function maskClabe(clabe: string | null | undefined, reveal: boolean): string {
  if (!clabe) return "No capturado";
  if (reveal) return clabe;
  const last4 = clabe.slice(-4);
  return `${"•".repeat(Math.max(0, clabe.length - 4))}${last4}`;
}

interface Props {
  banco: string | null | undefined;
  clabe: string | null | undefined;
}

/**
 * Card de datos bancarios del proveedor con toggle para revelar/ocultar
 * la CLABE. Extraído de `ProveedorDetalle` para mantener ese archivo ≤200 líneas.
 */
export function ProveedorDatosBancariosCard({ banco, clabe }: Props) {
  const [revealClabe, setRevealClabe] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Landmark className="h-4 w-4 text-muted-foreground" />
          Datos bancarios
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Banco</p>
          <p className={banco ? "font-medium" : "text-muted-foreground italic"}>
            {banco || "No capturado"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">CLABE interbancaria</p>
          {clabe ? (
            <div className="flex items-center gap-2">
              <span className="font-mono tabular-nums tracking-wider">{maskClabe(clabe, revealClabe)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setRevealClabe((v) => !v)}
                aria-label={revealClabe ? "Ocultar CLABE" : "Mostrar CLABE"}
              >
                {revealClabe ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground italic">No capturado</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
