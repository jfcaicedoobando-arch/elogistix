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

interface Props {
  cotizacion: Cotizacion;
}

export function CotizacionDatosGeneralesCard({ cotizacion }: Props) {
  const esMaritimo = cotizacion.modo === "Marítimo";
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Datos Generales</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm [&>div]:min-w-0 [&>div>p]:truncate">
          <div><span className="text-muted-foreground">Modo</span><p className="font-medium" title={cotizacion.modo}>{cotizacion.modo}</p></div>
          <div><span className="text-muted-foreground">Tipo</span><p className="font-medium" title={cotizacion.tipo}>{cotizacion.tipo}</p></div>
          <div><span className="text-muted-foreground">Incoterm</span><p className="font-medium" title={cotizacion.incoterm}>{cotizacion.incoterm}</p></div>
          <div><span className="text-muted-foreground">Origen</span><p className="font-medium" title={cotizacion.origen || ''}>{cotizacion.origen || '-'}</p></div>
          <div><span className="text-muted-foreground">Destino</span><p className="font-medium" title={cotizacion.destino || ''}>{cotizacion.destino || '-'}</p></div>
          <div><span className="text-muted-foreground">Vigencia</span><p className="font-medium">{cotizacion.vigencia_dias} días ({cotizacion.fecha_vigencia ? formatDate(cotizacion.fecha_vigencia) : '-'})</p></div>
          <div><span className="text-muted-foreground">Operador</span><p className="font-medium" title={cotizacion.operador || ''}>{cotizacion.operador ? nombreDesdeEmail(cotizacion.operador) : '-'}</p></div>
          {cotizacion.tiempo_transito_dias != null && (
            <div><span className="text-muted-foreground">Tiempo de tránsito</span><p className="font-medium">{cotizacion.tiempo_transito_dias} días</p></div>
          )}
          {esMaritimo && cotizacion.tipo_embarque === 'FCL' && cotizacion.dias_libres_destino > 0 && (
            <div><span className="text-muted-foreground">Días libres en destino</span><p className="font-medium">{cotizacion.dias_libres_destino} días</p></div>
          )}
          {esMaritimo && cotizacion.tipo_embarque === 'FCL' && (
            <div><span className="text-muted-foreground">Carta garantía</span><p className="font-medium">{cotizacion.carta_garantia ? 'Sí' : 'No'}</p></div>
          )}
          {esMaritimo && cotizacion.tipo_embarque === 'LCL' && cotizacion.dias_almacenaje > 0 && (
            <div><span className="text-muted-foreground">Días libres de almacenaje</span><p className="font-medium">{cotizacion.dias_almacenaje} días</p></div>
          )}
          {cotizacion.frecuencia && (
            <div><span className="text-muted-foreground">Frecuencia</span><p className="font-medium">{cotizacion.frecuencia}</p></div>
          )}
          {cotizacion.ruta_texto && (
            <div className="col-span-2"><span className="text-muted-foreground">Ruta</span><p className="font-medium" title={cotizacion.ruta_texto}>{cotizacion.ruta_texto}</p></div>
          )}
          {cotizacion.validez_propuesta && (
            <div><span className="text-muted-foreground">Validez propuesta</span><p className="font-medium">{formatDate(cotizacion.validez_propuesta)}</p></div>
          )}
          {cotizacion.tipo_movimiento && (
            <div><span className="text-muted-foreground">Tipo de movimiento</span><p className="font-medium">{cotizacion.tipo_movimiento}</p></div>
          )}
          <div><span className="text-muted-foreground">Seguro</span><p className="font-medium">{cotizacion.seguro ? `Sí — ${formatCurrency(Number(cotizacion.valor_seguro_usd || 0), 'USD')}` : 'No'}</p></div>
        </div>
      </CardContent>
    </Card>
  );
}
