import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  vigenciaDias: string; setVigenciaDias: (v: string) => void;
  diasLibres: string; setDiasLibres: (v: string) => void;
  monedaCot: string; setMonedaCot: (v: string) => void;
  terminos: string; setTerminos: (v: string) => void;
}

export default function TabCotizaciones({ vigenciaDias, setVigenciaDias, diasLibres, setDiasLibres, monedaCot, setMonedaCot, terminos, setTerminos }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parámetros de Cotizaciones</CardTitle>
        <CardDescription>Valores predeterminados al crear nuevas cotizaciones</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Vigencia por defecto (días)</Label>
          <Input type="number" value={vigenciaDias} onChange={(e) => setVigenciaDias(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Días libres en destino</Label>
          <Input type="number" value={diasLibres} onChange={(e) => setDiasLibres(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Moneda predeterminada</Label>
          <Select value={monedaCot} onValueChange={setMonedaCot}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MXN">MXN</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Términos y condiciones</Label>
          <Textarea value={terminos} onChange={(e) => setTerminos(e.target.value)} rows={4} placeholder="Texto que aparecerá al pie de las cotizaciones..." />
        </div>
      </CardContent>
    </Card>
  );
}
