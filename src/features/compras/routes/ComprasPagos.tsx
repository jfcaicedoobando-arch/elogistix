/**
 * Placeholder de `/compras/pagos` — Ola E del plan de rediseño de Compras.
 * Vista global de pagos a proveedor (tabla `pagos_proveedor`). Pendiente.
 */
import { Landmark } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function ComprasPagos() {
  return (
    <PageContainer>
      <PageHeader
        icon={<Landmark className="h-6 w-6 text-accent" />}
        title="Pagos a proveedor"
        description="Listado global de pagos aplicados a facturas de proveedor."
      />
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Próximamente. Por ahora los pagos se consultan desde el detalle de cada
          factura en <span className="font-medium">/compras/facturas</span>.
        </CardContent>
      </Card>
    </PageContainer>
  );
}
