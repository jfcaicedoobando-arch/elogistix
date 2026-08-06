/**
 * Tarjeta "Condiciones de crédito" en el detalle del cliente.
 * Muestra los valores del perfil (fuente única) y el consumo en vivo.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CreditCard } from "lucide-react";
import { useExposicionCreditoCliente } from "@/features/cliente/hooks/useExposicionCreditoCliente";
import { formatCurrency } from "@/lib/formatters";

function formatMXN(v: number) {
  return formatCurrency(v, "MXN");
}

interface Props {
  clienteId: string;
}

interface Vista {
  diasLabel: string;
  limiteLabel: string;
  enUsoLabel: string;
  disponibleLabel: string;
  disponibleTone: "default" | "danger";
  enUsoTone: "default" | "danger";
  excedido: boolean;
  facturasVivas: number;
}

function buildVista(
  data: ReturnType<typeof useExposicionCreditoCliente>["data"],
  isLoading: boolean,
): Vista {
  const dias = data?.diasCredito;
  const limite = data?.limiteMxn;
  const enUso = data?.enUsoMxn ?? 0;
  const disponible = data?.disponibleMxn;
  const excedido = data?.excedido === true;
  return {
    diasLabel: dias == null ? "—" : `${dias} días`,
    limiteLabel: limite == null ? "Sin límite" : formatMXN(limite),
    enUsoLabel: isLoading ? "…" : formatMXN(enUso),
    disponibleLabel: disponible == null ? "—" : formatMXN(disponible),
    disponibleTone: disponible != null && disponible < 0 ? "danger" : "default",
    enUsoTone: excedido ? "danger" : "default",
    excedido,
    facturasVivas: data?.facturasVivas ?? 0,
  };
}

export function ClienteCreditoCard({ clienteId }: Props) {
  const { data, isLoading } = useExposicionCreditoCliente(clienteId);
  const v = buildVista(data, isLoading);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          Condiciones de crédito
          {v.excedido && (
            <Badge variant="destructive" className="ml-auto gap-1">
              <AlertTriangle className="h-3 w-3" />
              Límite excedido
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Field label="Días de crédito" value={v.diasLabel} />
          <Field label="Límite (MXN)" value={v.limiteLabel} />
          <Field label="En uso" value={v.enUsoLabel} tone={v.enUsoTone} />
          <Field label="Disponible" value={v.disponibleLabel} tone={v.disponibleTone} />
        </div>
        {v.facturasVivas > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            Calculado sobre {v.facturasVivas} factura(s) vigente(s) con saldo.
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
