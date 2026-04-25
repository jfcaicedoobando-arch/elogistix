import { Receipt, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  monto: number;
  total: number;
  vencidas: number;
  className?: string;
}

export function PortalFacturacionPendienteCard({ monto, total, vencidas, className }: Props) {
  if (total === 0) return null;
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Receipt className="h-4 w-4 text-amber-600" />
          Facturación Pendiente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{formatCurrency(monto, "MXN")}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {total} factura{total !== 1 ? "s" : ""} por pagar
        </p>
        <div className="mt-4 space-y-2">
          {vencidas > 0 && (
            <div className="flex items-center gap-2 text-xs p-2 rounded bg-destructive/10 text-destructive">
              <span className="font-medium">⚠️ {vencidas} vencida(s)</span>
            </div>
          )}
        </div>
        <Link to="/portal/facturas">
          <Button variant="outline" size="sm" className="w-full mt-4 text-xs">
            Ver facturas <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
