/**
 * Sub-piezas UI de `InfoFacturaSection` extraídas para mantener el archivo
 * principal < 200 líneas (Power of 10).
 * v13.307.17 — `AdjuntoRow` movido a su propio archivo (`./AdjuntoRow.tsx`)
 *              para bajar complejidad ciclomática y respetar `max-lines`.
 */
import { Loader2, ShieldCheck, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFechaHora } from "@/lib/formatters";

export { AdjuntoRow } from "./AdjuntoRow";

export function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-label uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
      <span className={`text-sm text-foreground truncate ${mono ? "font-mono" : ""}`}>
        {value ?? <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  );
}

export function CanceladaBanner({ fecha, motivo }: { fecha: string | null; motivo: string | null }) {
  const fechaTxt = fecha ? formatFechaHora(fecha) : null;
  return (
    <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs">
      <div className="flex items-center gap-2 font-medium text-destructive">
        <Ban className="h-3.5 w-3.5" /> Factura cancelada{fechaTxt ? ` · ${fechaTxt}` : ""}
      </div>
      {motivo && (
        <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
          <span className="font-medium">Motivo:</span> {motivo}
        </p>
      )}
    </div>
  );
}

export function UuidFiscalField({
  uuid, estatus, verifDate, isPending, onVerify, esExtranjero = false,
}: {
  uuid: string | null;
  estatus: string | null;
  verifDate: string | null;
  isPending: boolean;
  onVerify: () => void;
  esExtranjero?: boolean;
}) {
  // "No verificable" (601): el SAT rechazó la consulta automática, no es un
  // CFDI inválido — se muestra ámbar para invitar a revisión manual.
  const variant: "default" | "secondary" | "destructive" | "warning" =
    estatus === "Vigente"
      ? "default"
      : estatus === "Cancelado"
        ? "destructive"
        : estatus === "No verificable"
          ? "warning"
          : "secondary";
  return (
    <div className="flex flex-col gap-1 min-w-0 col-span-2 md:col-span-1">
      <span className="text-label uppercase tracking-wider text-muted-foreground font-medium">
        UUID fiscal (CFDI)
      </span>
      <span className="text-sm text-foreground truncate font-mono">
        {uuid ?? <span className="text-muted-foreground font-sans">—</span>}
      </span>
      {esExtranjero ? (
        <span className="text-2xs text-muted-foreground mt-0.5">
          No aplica (proveedor internacional)
        </span>
      ) : uuid && (
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          {estatus && (
            <Badge variant={variant} className="text-2xs">
              SAT: {estatus}
            </Badge>
          )}
          {verifDate && (
            <span className="text-2xs text-muted-foreground">
              Verificado {verifDate}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-label"
            disabled={isPending}
            onClick={onVerify}
          >
            {isPending
              ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              : <ShieldCheck className="h-3 w-3 mr-1" />}
            Verificar en SAT
          </Button>
        </div>
      )}
    </div>
  );
}
