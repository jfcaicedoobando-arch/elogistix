import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { papelMovimientoTraspaso, type TraspasoDetalle } from "@/features/tesoreria/domain/traspasoDetalle";

export function TraspasoDetalleContent({ detalle, movimientoId }: { detalle: TraspasoDetalle; movimientoId?: string }) {
  const { traspaso: t, origen, destino, movimientos } = detalle;
  return <section className="space-y-4 text-body">
    <p className="font-medium">{t.folio} · {formatDate(t.fecha)}</p>
    <p>{t.concepto}</p>
    {t.referencia && <p className="text-body-sm text-muted-foreground">Referencia: {t.referencia}</p>}
    <dl className="grid grid-cols-2 gap-3">
      <div><dt className="text-body-sm text-muted-foreground">Cuenta origen</dt><dd>{origen?.alias ?? origen?.banco ?? "Cuenta no disponible"} · {t.moneda_origen}</dd></div>
      <div><dt className="text-body-sm text-muted-foreground">Cuenta destino</dt><dd>{destino?.alias ?? destino?.banco ?? "Cuenta no disponible"} · {t.moneda_destino}</dd></div>
      <div><dt className="text-body-sm text-muted-foreground">Salida</dt><dd>{formatCurrency(t.monto_origen, t.moneda_origen)}</dd></div>
      <div><dt className="text-body-sm text-muted-foreground">Entrada</dt><dd>{formatCurrency(t.monto_destino, t.moneda_destino)}</dd></div>
      <div><dt className="text-body-sm text-muted-foreground">Comisión en origen</dt><dd>{formatCurrency(t.comision, t.moneda_origen)}</dd></div>
      <div><dt className="text-body-sm text-muted-foreground">Estado del traspaso</dt><dd>{t.estado}</dd></div>
    </dl>
    {t.moneda_origen !== t.moneda_destino && <p className="text-body-sm">
      Conversión registrada: 1 {t.moneda_origen} = {t.tipo_cambio} {t.moneda_destino}.
    </p>}
    <SectionHeading as="h3" variant="subsection">Movimientos del traspaso</SectionHeading>
    <ul className="space-y-2">
      {movimientos.map((m) => {
        const moneda = m.cuenta_bancaria_id === t.cuenta_origen_id ? t.moneda_origen : t.moneda_destino;
        return <li key={m.id} className="rounded-md border p-3 space-y-1" aria-current={m.id === movimientoId ? "true" : undefined}>
          <div className="flex flex-wrap justify-between gap-2">
            <strong>{papelMovimientoTraspaso(t.id, m)}</strong>
            <StatusBadge domain="conciliacion" status={m.estado_conciliacion} />
          </div>
          <p>{formatDate(m.fecha)} · {formatCurrency(m.cargo > 0 ? -m.cargo : m.abono, moneda)}</p>
          <Link className="text-primary text-body-sm hover:underline" to={`/tesoreria/estado-cuenta?cuenta=${m.cuenta_bancaria_id}`}>Ver en su cuenta bancaria</Link>
        </li>;
      })}
    </ul>
    {movimientos.length === 0 && <p className="text-warning">No se encontraron los movimientos del traspaso. Revisa su estado y permisos.</p>}
  </section>;
}
