/**
 * Celda con los folios de factura de una partida del estado de cuenta.
 *
 * Vive fuera de `*columns.tsx` a propósito: una partida puede estar respaldada
 * por VARIAS facturas del proveedor, así que el drilldown de la fila
 * (`getRowHref` → expediente) no puede representar todos esos destinos. Estos
 * enlaces son secundarios y no compiten con la navegación principal de la fila.
 */
import { Link } from "react-router-dom";
import type { PartidaEstadoCuenta } from "@/features/proveedor/domain/estadoCuentaProveedor";

interface Props {
  partida: PartidaEstadoCuenta;
}

export function ProveedorFacturasCell({ partida }: Props) {
  if (partida.facturas.length === 0) {
    return <span className="text-body-sm text-muted-foreground">Sin factura</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {partida.facturas.map((f) => (
        <Link
          key={f.factura_id}
          to={`/compras/facturas/${f.factura_id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-body-sm text-accent underline-offset-2 hover:underline"
          title={f.folio_proveedor ? `Folio proveedor: ${f.folio_proveedor}` : undefined}
        >
          {f.folio_interno ?? f.folio_proveedor ?? "Ver factura"}
        </Link>
      ))}
    </div>
  );
}
