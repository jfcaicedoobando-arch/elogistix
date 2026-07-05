/**
 * Placeholder de `/compras/reportes` — Ola F. Reportes analíticos de gasto:
 * top proveedores, gasto por categoría de presupuesto, evolución mensual.
 */
import { BarChart3 } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function ComprasReportes() {
  return (
    <PageContainer>
      <PageHeader
        icon={<BarChart3 className="h-6 w-6 text-accent" />}
        title="Reportes de Compras"
        description="Analítica de gasto por proveedor, categoría y período."
      />
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Próximamente. Mientras tanto puedes consultar la
          <span className="font-medium"> antigüedad de saldos</span> en{" "}
          <span className="font-medium">/compras/aging</span>.
        </CardContent>
      </Card>
    </PageContainer>
  );
}
