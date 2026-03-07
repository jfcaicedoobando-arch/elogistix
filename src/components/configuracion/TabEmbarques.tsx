import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  prefijo: string; setPrefijo: (v: string) => void;
  tipoCargaDefault: string; setTipoCargaDefault: (v: string) => void;
  monedaEmb: string; setMonedaEmb: (v: string) => void;
}

export default function TabEmbarques({ prefijo, setPrefijo, tipoCargaDefault, setTipoCargaDefault, monedaEmb, setMonedaEmb }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parámetros de Embarques</CardTitle>
        <CardDescription>Valores predeterminados para nuevos embarques</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Prefijo de expediente</Label>
          <Input value={prefijo} onChange={(e) => setPrefijo(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Tipo de carga por defecto</Label>
          <Select value={tipoCargaDefault} onValueChange={setTipoCargaDefault}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Carga General">Carga General</SelectItem>
              <SelectItem value="Mercancía Peligrosa">Mercancía Peligrosa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Moneda predeterminada</Label>
          <Select value={monedaEmb} onValueChange={setMonedaEmb}>
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
