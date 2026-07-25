/** Selector de facturas ABIERTAS (saldo > 0, no canceladas) de un proveedor. Usado por AplicarAnticipoDialog. */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchFacturasCxP } from "@/features/cxp/services";
import { formatCurrency } from "@/lib/formatters";

const OPEN_ESTATUS = new Set(["Vigente", "Parcial", "Por vencer", "Vencida"]);

interface Props {
  proveedorId: string | null;
  value: string;
  onChange: (facturaId: string, saldo: number, moneda: string) => void;
}

export function useFacturasAbiertasProveedor(proveedorId: string | null) {
  return useQuery({
    queryKey: ["anticipos-proveedor", "facturas-abiertas", proveedorId ?? null],
    queryFn: () => fetchFacturasCxP({ proveedor_id: proveedorId ?? undefined, pageSize: 500 }),
    enabled: Boolean(proveedorId),
    select: (rows) => rows.filter((f) => OPEN_ESTATUS.has(f.estatus) && f.saldo > 0.01),
    staleTime: 15_000,
  });
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
