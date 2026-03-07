import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  diasEta: string; setDiasEta: (v: string) => void;
  diasEtaCritica: string; setDiasEtaCritica: (v: string) => void;
  diasFactVencer: string; setDiasFactVencer: (v: string) => void;
}

export default function TabAlertas({ diasEta, setDiasEta, diasEtaCritica, setDiasEtaCritica, diasFactVencer, setDiasFactVencer }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Umbrales de Alertas</CardTitle>
        <CardDescription>Configuración de las alertas del Dashboard</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Días antes de ETA (alerta general)</Label>
          <Input type="number" value={diasEta} onChange={(e) => setDiasEta(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Días antes de ETA (alerta crítica)</Label>
          <Input type="number" value={diasEtaCritica} onChange={(e) => setDiasEtaCritica(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Días antes de vencimiento de factura</Label>
          <Input type="number" value={diasFactVencer} onChange={(e) => setDiasFactVencer(e.target.value)} />
        </div>
      </CardContent>
    </Card>
  );
}
