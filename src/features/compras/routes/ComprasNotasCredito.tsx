/**
 * Placeholder de `/compras/notas-credito` — Ola E. Listado global de notas
 * de crédito de proveedor. La captura ya existe dentro del detalle de factura.
 */
import { ReceiptText } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function ComprasNotasCredito() {
  return (
    <PageContainer>
      <PageHeader
        icon={<ReceiptText className="h-6 w-6 text-accent" />}
        title="Notas de crédito de proveedor"
        description="Listado global de notas de crédito aplicadas a facturas de proveedor."
      />
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Próximamente. Hoy las notas se emiten desde el detalle de cada
          factura en <span className="font-medium">/compras/facturas</span>.
        </CardContent>
      </Card>
    </PageContainer>
  );
}
