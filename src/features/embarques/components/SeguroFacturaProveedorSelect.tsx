/**
 * Hallazgo 148 — Vínculo opcional póliza ↔ factura de proveedor.
 * Si la prima ya está facturada por la aseguradora, ligarla evita que la
 * utilidad cuente el mismo gasto dos veces (se cuenta la factura).
 */
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFacturasSeguroElegibles } from "@/features/embarques/hooks/useFacturasSeguroElegibles";
import { formatCurrency } from "@/lib/formatters";

const SIN = "sin";

interface Props {
  embarqueId: string;
  value: string | null;
  onChange: (id: string | null) => void;
}

export function SeguroFacturaProveedorSelect({ embarqueId, value, onChange }: Props) {
  const { data = [], isLoading, isError } = useFacturasSeguroElegibles(embarqueId);

  return (
    <div className="sm:col-span-2">
      <Label htmlFor="seguro-factura">Factura de proveedor que documenta la prima (opcional)</Label>
      <Select value={value ?? SIN} onValueChange={(v) => onChange(v === SIN ? null : v)} disabled={isLoading || isError}>
        <SelectTrigger id="seguro-factura"><SelectValue placeholder="Sin factura ligada" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={SIN}>Sin factura ligada (la prima cuenta como costo)</SelectItem>
          {data.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {(f.folio_interno ?? "Sin folio")} · {f.proveedor_nombre ?? "Sin proveedor"} · {formatCurrency(f.subtotal, f.moneda)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-body-sm text-muted-foreground mt-1">
        {isError
          ? "No se pudieron cargar las facturas del embarque."
          : "Si eliges una factura, la utilidad cuenta la factura y no la prima, para no sumar dos veces el mismo gasto."}
      </p>
    </div>
  );
}
