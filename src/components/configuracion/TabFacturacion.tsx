import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  tasaIva: string; setTasaIva: (v: string) => void;
  diasVenc: string; setDiasVenc: (v: string) => void;
  serieFact: string; setSerieFact: (v: string) => void;
  folioInicial: string; setFolioInicial: (v: string) => void;
  monedaFact: string; setMonedaFact: (v: string) => void;
}

export default function TabFacturacion({ tasaIva, setTasaIva, diasVenc, setDiasVenc, serieFact, setSerieFact, folioInicial, setFolioInicial, monedaFact, setMonedaFact }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parámetros de Facturación</CardTitle>
        <CardDescription>Configuración para la emisión de facturas</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Tasa de IVA (%)</Label>
          <Input type="number" value={tasaIva} onChange={(e) => setTasaIva(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Días de vencimiento</Label>
          <Input type="number" value={diasVenc} onChange={(e) => setDiasVenc(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Serie de factura</Label>
          <Input value={serieFact} onChange={(e) => setSerieFact(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Folio inicial</Label>
          <Input type="number" value={folioInicial} onChange={(e) => setFolioInicial(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Moneda predeterminada</Label>
          <Select value={monedaFact} onValueChange={setMonedaFact}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MXN">MXN</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
