/**
 * Datos de contexto de un documento del buzón (fecha, folio, monto declarado,
 * conceptos sugeridos y notas). Separado de `FacturaEntranteItem` para mantener
 * cada función bajo el límite de complejidad (Power of 10).
 */
import { formatDate } from "@/lib/formatters/dates";
import { formatCurrency } from "@/lib/formatters/numbers";
import { diasEnEspera } from "@/lib/domain/facturasEntrantes";
import type { FacturaEntranteRow } from "@/features/cxp/services";

const Linea = ({ children }: { children: React.ReactNode }) => (
  <p className="text-body-sm text-muted-foreground">{children}</p>
);

function LineaOrigen({ row }: { row: FacturaEntranteRow }) {
  const espera = row.estado === "por_capturar" ? ` · ${diasEnEspera(row.created_at)} día(s) en espera` : "";
  const proveedor = row.proveedores?.nombre ? ` · ${row.proveedores.nombre}` : "";
  return <Linea>Subida el {formatDate(row.created_at)}{espera}{proveedor}</Linea>;
}

function LineaCfdi({ row }: { row: FacturaEntranteRow }) {
  const total = row.total_detectado;
  const subtotal = row.subtotal_detectado;
  if (!row.folio_serie && total == null && subtotal == null) return null;
  const moneda = row.moneda_detectada ?? "MXN";
  const folio = row.folio_serie ? `Folio proveedor ${row.folio_serie}` : "Sin folio del proveedor";
  // v13.744.0 — Primero el subtotal (sin IVA), que es el costo del ERP.
  const sinIva = subtotal == null ? "" : ` · ${formatCurrency(Number(subtotal), moneda)} sin IVA`;
  const conIva = total == null ? "" : ` · ${formatCurrency(Number(total), moneda)} con IVA`;
  return <Linea>{folio}{sinIva}{conIva}</Linea>;
}

function LineaDeclarado({ row }: { row: FacturaEntranteRow }) {
  if (row.monto_declarado == null) return null;
  return (
    <Linea>
      Monto declarado por operaciones (sin IVA):{" "}
      {formatCurrency(Number(row.monto_declarado), row.moneda_declarada ?? "MXN")}
    </Linea>
  );
}

function LineaSugerencias({ row }: { row: FacturaEntranteRow }) {
  const total = row.embarque_facturas_entrantes_conceptos?.length ?? 0;
  if (total === 0) return null;
  return <Linea>Conceptos sugeridos por operaciones: {total}</Linea>;
}

function LineasNotas({ row }: { row: FacturaEntranteRow }) {
  return (
    <>
      {row.sin_costo_capturado && !row.proveedor_factura_id && (
        <Linea>Operaciones indicó que aún no hay costo capturado para este documento.</Linea>
      )}
      {row.nota && <Linea>Nota: {row.nota}</Linea>}
      {row.rechazo_motivo && (
        <p className="text-body-sm text-destructive">Rechazada: {row.rechazo_motivo}</p>
      )}
    </>
  );
}

export function MetaEntrante({ row }: { row: FacturaEntranteRow }) {
  return (
    <>
      <LineaOrigen row={row} />
      <LineaCfdi row={row} />
      <LineaDeclarado row={row} />
      <LineaSugerencias row={row} />
      <LineasNotas row={row} />
    </>
  );
}
