import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  margenMinimoPct: string;
  setMargenMinimoPct: (v: string) => void;
  diasProformaVencida: string;
  setDiasProformaVencida: (v: string) => void;
  diasHuerfano: string;
  setDiasHuerfano: (v: string) => void;
}

export default function TabAuditoria({
  margenMinimoPct,
  setMargenMinimoPct,
  diasProformaVencida,
  setDiasProformaVencida,
  diasHuerfano,
  setDiasHuerfano,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Umbrales de Auditoría</CardTitle>
        <CardDescription>
          Definen cuándo el módulo de Auditoría considera que un embarque
          presenta una fuga financiera u operativa.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Margen mínimo aceptable (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={margenMinimoPct}
            onChange={(e) => setMargenMinimoPct(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Embarques por debajo se marcan como "margen bajo".
          </p>
        </div>
        <div className="space-y-2">
          <Label>Días para considerar proforma vencida</Label>
          <Input
            type="number"
            min="1"
            value={diasProformaVencida}
            onChange={(e) => setDiasProformaVencida(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Días desde emisión sin convertir a factura.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Días sin movimiento (huérfano)</Label>
          <Input
            type="number"
            min="1"
            value={diasHuerfano}
            onChange={(e) => setDiasHuerfano(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Sin operador o sin entradas en bitácora en este lapso.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
