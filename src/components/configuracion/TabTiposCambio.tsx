import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  usdMxn: string; setUsdMxn: (v: string) => void;
  eurMxn: string; setEurMxn: (v: string) => void;
  fuente: string; setFuente: (v: string) => void;
}

export default function TabTiposCambio({ usdMxn, setUsdMxn, eurMxn, setEurMxn, fuente, setFuente }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tipos de Cambio por Defecto</CardTitle>
        <CardDescription>Valores usados cuando la API no está disponible o se elige modo manual</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>USD → MXN</Label>
          <Input type="number" step="0.01" value={usdMxn} onChange={(e) => setUsdMxn(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>EUR → MXN</Label>
          <Input type="number" step="0.01" value={eurMxn} onChange={(e) => setEurMxn(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Fuente de tipos de cambio</Label>
          <Select value={fuente} onValueChange={setFuente}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="api">API automática (frankfurter.app)</SelectItem>
              <SelectItem value="manual">Manual (usar valores por defecto)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
