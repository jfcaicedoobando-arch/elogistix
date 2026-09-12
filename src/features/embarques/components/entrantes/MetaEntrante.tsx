/**
 * Datos de contexto de un documento del buzón (proveedor, folio, montos,
 * conceptos sugeridos y notas), repartidos en columnas para el acomodo
 * denso de `FacturaEntranteItem`. Cada bloque es un componente pequeño
 * (Power of 10).
 */
import { formatDate } from "@/lib/formatters/dates";
import { formatCurrency } from "@/lib/formatters/numbers";
import { diasEnEspera } from "@/lib/domain/facturasEntrantes";
import type { FacturaEntranteRow } from "@/features/cxp/services";

const Dato = ({ children }: { children: React.ReactNode }) => (
  <span className="text-body-sm text-muted-foreground">{children}</span>
);

const Etiqueta = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
    {children}
  </span>
);

/** Col 2 — Proveedor, folio del proveedor y fecha de subida. */
export function MetaEntranteProveedor({ row }: { row: FacturaEntranteRow }) {
  const espera = row.estado === "por_capturar" ? ` · ${diasEnEspera(row.created_at)} día(s) en espera` : "";
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-body-sm font-medium text-foreground">
        {row.proveedores?.nombre ?? "Sin proveedor identificado"}
      </span>
      <Dato>
        {row.folio_serie ? `Folio: ${row.folio_serie}` : "Sin folio del proveedor"}
      </Dato>
      <Dato>
        Subida el {formatDate(row.created_at)}{espera}
      </Dato>
    </div>
  );
}

function MontoCfdi({ row }: { row: FacturaEntranteRow }) {
  const total = row.total_detectado;
  const subtotal = row.subtotal_detectado;
  if (total == null && subtotal == null) {
    return <Dato>Sin montos detectados en el CFDI</Dato>;
  }
  const moneda = row.moneda_detectada ?? "MXN";
  return (
    <>
      {subtotal != null && (
        <Dato>{formatCurrency(Number(subtotal), moneda)} sin IVA</Dato>
      )}
      {total != null && (
        <span className="text-body-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(Number(total), moneda)} con IVA
        </span>
      )}
    </>
  );
}

/** Col 3 — Montos detectados, monto declarado y conceptos sugeridos. */
export function MetaEntranteMontos({ row }: { row: FacturaEntranteRow }) {
  const sugeridos = row.embarque_facturas_entrantes_conceptos?.length ?? 0;
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <MontoCfdi row={row} />
      {row.monto_declarado != null && (
        <Dato>
          Declarado (sin IVA): {formatCurrency(Number(row.monto_declarado), row.moneda_declarada ?? "MXN")}
        </Dato>
      )}
      {sugeridos > 0 && <Dato>Conceptos sugeridos: {sugeridos}</Dato>}
    </div>
  );
}

/** Notas discretas (nota libre y aviso de "sin costo capturado"). */
export function MetaEntranteNotas({ row }: { row: FacturaEntranteRow }) {
  const sinCosto = row.sin_costo_capturado && !row.proveedor_factura_id;
  if (!sinCosto && !row.nota) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {sinCosto && (
        <Dato>Operaciones indicó que aún no hay costo capturado para este documento.</Dato>
      )}
      {row.nota && <Dato>Nota: {row.nota}</Dato>}
    </div>
  );
}

/** Franja de motivo de rechazo a todo el ancho del renglón. */
export function MetaEntranteRechazo({ row }: { row: FacturaEntranteRow }) {
  if (!row.rechazo_motivo) return null;
  return (
    <p className="text-body-sm text-destructive">
      <span className="font-semibold">Rechazada:</span> {row.rechazo_motivo}
    </p>
  );
}
