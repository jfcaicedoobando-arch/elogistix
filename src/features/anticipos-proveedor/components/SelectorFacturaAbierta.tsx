/** Selector de facturas ABIERTAS (saldo > 0, no canceladas) de un proveedor. Usado por AplicarAnticipoDialog. */
import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import { useFacturasAbiertasProveedor } from "@/features/anticipos-proveedor/hooks/useFacturasAbiertasProveedor";

interface Props {
  proveedorId: string | null;
  value: string;
  onChange: (facturaId: string, saldo: number, moneda: string) => void;
}

export function SelectorFacturaAbierta({ proveedorId, value, onChange }: Props) {
  const { data: facturas = [], isLoading } = useFacturasAbiertasProveedor(proveedorId);
  const options = useMemo(() => facturas, [facturas]);

  if (!proveedorId) {
    return (
      <Select disabled value="">
        <SelectTrigger><SelectValue placeholder="Selecciona un proveedor primero" /></SelectTrigger>
        <SelectContent />
      </Select>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={(id) => {
        const f = options.find((x) => x.id === id);
        onChange(id, f?.saldo ?? 0, f?.moneda ?? "MXN");
      }}
      disabled={isLoading}
    >
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Cargando facturas…" : "Selecciona una factura abierta"} />
      </SelectTrigger>
      <SelectContent>
        {options.length === 0 && !isLoading && (
          <div className="px-3 py-2 text-xs text-muted-foreground">Sin facturas abiertas para este proveedor.</div>
        )}
        {options.map((f) => (
          <SelectItem key={f.id} value={f.id}>
            {f.folio_interno} · {formatCurrency(f.saldo, f.moneda)} saldo ({f.moneda})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
