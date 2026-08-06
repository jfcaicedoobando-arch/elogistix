import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/formatters";

interface CotDatos {
  modo: string;
  tipo: string;
  incoterm: string;
  moneda: string;
  origen?: string | null;
  destino?: string | null;
  fecha_vigencia?: string | null;
  tiempo_transito_dias?: number | null;
  ruta_texto?: string | null;
  frecuencia?: string | null;
}

function Item({ label, value }: { label: string; value: React.ReactNode; colSpan?: boolean }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}</span>
      <p className="font-medium">{value}</p>
    </div>
  );
}

export default function DatosGeneralesCard({ cot }: { cot: CotDatos }) {
  const vigencia = cot.fecha_vigencia ? formatDate(cot.fecha_vigencia) : "—";
  return (
    <Card>
      <CardHeader>
        <CardTitle >Datos Generales</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Item label="Modo" value={cot.modo} />
          <Item label="Tipo" value={cot.tipo} />
          <Item label="Incoterm" value={cot.incoterm} />
          <Item label="Moneda" value={cot.moneda} />
          <Item label="Origen" value={cot.origen || "—"} />
          <Item label="Destino" value={cot.destino || "—"} />
          <Item label="Vigencia" value={vigencia} />
          {cot.tiempo_transito_dias != null && (
            <Item label="Tiempo de Tránsito" value={`${cot.tiempo_transito_dias} días`} />
          )}
          {cot.ruta_texto && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Ruta</span>
              <p className="font-medium">{cot.ruta_texto}</p>
            </div>
          )}
          {cot.frecuencia && <Item label="Frecuencia" value={cot.frecuencia} />}
        </div>
      </CardContent>
    </Card>
  );
}
