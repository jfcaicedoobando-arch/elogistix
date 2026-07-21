/**
 * Tarjeta "Condiciones de crédito" en el detalle del cliente.
 * Muestra los valores del perfil (fuente única) y el consumo en vivo.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CreditCard } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { useExposicionCreditoCliente } from "@/features/cliente/hooks/useExposicionCreditoCliente";

function formatMXN(v: number) {
  return v.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  });
}

interface Props {
  clienteId: string;
}

export function ClienteCreditoCard({ clienteId }: Props) {
  const { data, isLoading } = useExposicionCreditoCliente(clienteId);

  const dias = data?.diasCredito ?? null;
  const limite = data?.limiteMxn ?? null;
  const enUso = data?.enUsoMxn ?? 0;
  const disponible = data?.disponibleMxn;
  const excedido = data?.excedido ?? false;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          Condiciones de crédito
          {excedido && (
            <Badge variant="destructive" className="ml-auto gap-1">
              <AlertTriangle className="h-3 w-3" />
              Límite excedido
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Field label="Días de crédito" value={dias == null ? "—" : `${dias} días`} />
          <Field
            label="Límite (MXN)"
            value={limite == null ? "Sin límite" : formatMoney(limite, "MXN")}
          />
          <Field
            label="En uso"
            value={isLoading ? "…" : formatMoney(enUso, "MXN")}
            tone={excedido ? "danger" : "default"}
          />
          <Field
            label="Disponible"
            value={
              disponible == null
                ? "—"
                : formatMoney(disponible, "MXN")
            }
            tone={disponible != null && disponible < 0 ? "danger" : "default"}
          />
        </div>
        {data && data.facturasVivas > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            Calculado sobre {data.facturasVivas} factura(s) vigente(s) con saldo.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-medium ${tone === "danger" ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}
