/**
 * Comparativo de costo por concepto contra otros proveedores del mismo tipo (Ola 4).
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { BarChart3 } from "lucide-react";
import {
  clasificarComparativo,
  MIN_OPS_COMPARATIVO,
  type ComparativoConcepto,
  type VeredictoComparativo,
} from "@/features/proveedor/domain/inteligenciaProveedor";

const ETIQUETA: Record<VeredictoComparativo, string> = {
  mas_caro: "Más caro",
  en_linea: "En línea",
  mas_barato: "Más barato",
};

const TONO: Record<VeredictoComparativo, string> = {
  mas_caro: "bg-destructive/15 text-destructive border-destructive/30",
  en_linea: "bg-muted text-muted-foreground",
  mas_barato: "bg-success/15 text-success border-success/30",
};

interface Props {
  comparativo: ComparativoConcepto[];
  tipoProveedor: string | null;
}

export function ProveedorComparativoCard({ comparativo, tipoProveedor }: Props) {
  const filas = clasificarComparativo(comparativo);
  const tipoLabel = tipoProveedor ?? "mismo tipo";

  return (
    <Card>
      <CardContent className="p-4">
        <SectionHeading
          as="h3"
          variant="subsection"
          className="mb-3"
          description={
            <>
              Costo promedio por concepto en los últimos 12 meses frente a otros proveedores de tipo {tipoLabel}.
              Se muestran solo conceptos con al menos {MIN_OPS_COMPARATIVO} operaciones de cada lado.
            </>
          }
        >
          Comparativo con otros proveedores
        </SectionHeading>

        {filas.length === 0 ? (
          <EmptyStateInline
            icon={BarChart3}
            message="Aún no hay comparaciones con muestra suficiente."
          />
        ) : (
          <ul className="divide-y">
            {filas.map((f) => (
              <li key={`${f.concepto}-${f.moneda}`} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm truncate">{f.concepto}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatCurrency(f.unitarioPropio, f.moneda)} vs {formatCurrency(f.unitarioOtros, f.moneda)}
                    {" · "}{f.opsPropias}/{f.opsOtros} operaciones
                    {" · "}{f.proveedoresComparados} proveedor{f.proveedoresComparados === 1 ? "" : "es"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <Badge className={cn("mb-1", TONO[f.veredicto])}>{ETIQUETA[f.veredicto]}</Badge>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {f.diffPct > 0 ? "+" : ""}{f.diffPct.toFixed(1)}%
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
