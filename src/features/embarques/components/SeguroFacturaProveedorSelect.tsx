/**
 * Hallazgo 148 — Vínculo opcional póliza ↔ factura de proveedor.
 * La selección declara cobertura completa; esta lista no la verifica.
 * Conservar siempre el vínculo guardado aunque su información no esté disponible.
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
  const seleccionAusente = value !== null && !data.some((factura) => factura.id === value);

  return (
    <div className="sm:col-span-2">
      <Label htmlFor="seguro-factura">Factura de proveedor que documenta la prima (opcional)</Label>
      <Select value={value ?? SIN} onValueChange={(v) => onChange(v === SIN ? null : v)} disabled={isLoading || isError}>
        <SelectTrigger id="seguro-factura"><SelectValue placeholder="Sin factura ligada" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={SIN}>Sin factura ligada (la prima cuenta como costo)</SelectItem>
          {seleccionAusente && (
            <SelectItem value={value}>Factura ligada guardada · información no disponible en esta lista</SelectItem>
          )}
          {data.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {(f.folio_interno ?? "Sin folio")} · {f.proveedor_nombre ?? "Sin proveedor"} · Subtotal de factura: {formatCurrency(f.subtotal, f.moneda)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-body-sm text-muted-foreground mt-1">
        La factura debe documentar toda la prima y puede incluir otros gastos. El subtotal mostrado
        es el de la factura; esta lista no verifica la cobertura atribuida al embarque.
        La cobertura completa se valida al guardar.
      </p>
      {isLoading && <p className="text-body-sm text-muted-foreground mt-1">Cargando facturas; se conserva la selección.</p>}
      {isError && <p className="text-body-sm text-muted-foreground mt-1">No se pudieron cargar las facturas del embarque.</p>}
      {seleccionAusente && (
        <p className="text-body-sm text-muted-foreground mt-1">
          Se conserva el vínculo guardado. Su ausencia en esta lista no permite determinar su vigencia ni su cobertura.
        </p>
      )}
    </div>
  );
}
