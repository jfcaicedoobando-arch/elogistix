import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { textoCargaLcl } from "@/lib/domain/resumenCargaLcl";

interface Props {
  piezas: number | null | undefined;
  pesoKg: number | string | null | undefined;
  volumenM3: number | string | null | undefined;
}

/** LCL: la carga viaja consolidada; no se pide número de contenedor físico. */
export function CargaConsolidadaCard({ piezas, pesoKg, volumenM3 }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle>Carga consolidada (LCL)</CardTitle></CardHeader>
      <CardContent className="text-body space-y-1">
        <p>{textoCargaLcl(Number(piezas) || 0, Number(pesoKg) || 0, Number(volumenM3) || 0)}</p>
        <p className="text-body-sm text-muted-foreground">
          El consolidador asigna el contenedor; no se captura número de contenedor.
        </p>
      </CardContent>
    </Card>
  );
}
