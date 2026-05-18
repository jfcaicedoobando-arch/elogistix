import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatCurrency, nombreDesdeEmail } from "@/lib/formatters";

interface Cotizacion {
  modo: string;
  tipo: string;
  incoterm: string;
  origen?: string | null;
  destino?: string | null;
  vigencia_dias: number;
  fecha_vigencia?: string | null;
  operador?: string | null;
  tiempo_transito_dias?: number | null;
  tipo_embarque?: string | null;
  dias_libres_destino: number;
  dias_almacenaje: number;
  carta_garantia?: boolean | null;
  frecuencia?: string | null;
  ruta_texto?: string | null;
  validez_propuesta?: string | null;
  tipo_movimiento?: string | null;
  seguro?: boolean | null;
  valor_seguro_usd?: number | string | null;
}

interface Row {
  label: string;
  value: string;
  title?: string;
  colSpan2?: boolean;
}

function buildRows(c: Cotizacion): Row[] {
  const esMaritimo = c.modo === "Marítimo";
  const isFCL = esMaritimo && c.tipo_embarque === "FCL";
  const isLCL = esMaritimo && c.tipo_embarque === "LCL";
  const rows: (Row | null)[] = [
    { label: "Modo", value: c.modo, title: c.modo },
    { label: "Tipo", value: c.tipo, title: c.tipo },
    { label: "Incoterm", value: c.incoterm, title: c.incoterm },
    { label: "Origen", value: c.origen || "-", title: c.origen || "" },
    { label: "Destino", value: c.destino || "-", title: c.destino || "" },
    { label: "Vigencia", value: `${c.vigencia_dias} días (${c.fecha_vigencia ? formatDate(c.fecha_vigencia) : "-"})` },
    { label: "Operador", value: c.operador ? nombreDesdeEmail(c.operador) : "-", title: c.operador || "" },
    c.tiempo_transito_dias != null ? { label: "Tiempo de tránsito", value: `${c.tiempo_transito_dias} días` } : null,
    isFCL && c.dias_libres_destino > 0 ? { label: "Días libres en destino", value: `${c.dias_libres_destino} días` } : null,
    isFCL ? { label: "Carta garantía", value: c.carta_garantia ? "Sí" : "No" } : null,
    isLCL && c.dias_almacenaje > 0 ? { label: "Días libres de almacenaje", value: `${c.dias_almacenaje} días` } : null,
    c.frecuencia ? { label: "Frecuencia", value: c.frecuencia } : null,
    c.ruta_texto ? { label: "Ruta", value: c.ruta_texto, title: c.ruta_texto, colSpan2: true } : null,
    c.validez_propuesta ? { label: "Validez propuesta", value: formatDate(c.validez_propuesta) } : null,
    c.tipo_movimiento ? { label: "Tipo de movimiento", value: c.tipo_movimiento } : null,
    { label: "Seguro", value: c.seguro ? `Sí — ${formatCurrency(Number(c.valor_seguro_usd || 0), "USD")}` : "No" },
  ];
  return rows.filter((r): r is Row => r !== null);
}

interface Props {
  cotizacion: Cotizacion;
}

export function CotizacionDatosGeneralesCard({ cotizacion }: Props) {
  const rows = buildRows(cotizacion);
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Datos Generales</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm [&>div]:min-w-0 [&>div>p]:truncate">
          {rows.map((r) => (
            <div key={r.label} className={r.colSpan2 ? "col-span-2" : undefined}>
              <span className="text-muted-foreground">{r.label}</span>
              <p className="font-medium" title={r.title}>{r.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
