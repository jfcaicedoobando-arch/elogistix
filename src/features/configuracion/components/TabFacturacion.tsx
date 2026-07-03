import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FacturapiCredencialesCard from "@/features/configuracion/components/FacturapiCredencialesCard";
import { CatalogoClavesSATCard } from "@/features/configuracion/components/CatalogoClavesSATCard";

interface Props {
  tasaIva: string; setTasaIva: (v: string) => void;
}

export default function TabFacturacion({ tasaIva, setTasaIva }: Props) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Parámetros de Facturación</CardTitle>
          <CardDescription>
            La tasa de IVA se aplica automáticamente en cotizaciones, proformas y facturas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Tasa de IVA (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={tasaIva}
              onChange={(e) => setTasaIva(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Valor entero (ej. 16 = 16%). Se almacena en `facturacion.tasa_iva`.
            </p>
          </div>
        </CardContent>
      </Card>

      <FacturapiCredencialesCard />
    </div>
  );
}
