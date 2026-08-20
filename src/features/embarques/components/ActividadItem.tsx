import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, nombreDesdeEmail } from "@/lib/formatters";
import { CATEGORIA_LABEL, type ActividadItem as Item } from "@/features/embarques/domain/actividadFeed";
import { ActividadDetalles } from "@/features/embarques/components/ActividadDetalles";
import { Hint } from "@/components/shared/Hint";

const CATEGORIA_VARIANT: Record<string, "default" | "secondary" | "outline" | "warning" | "success"> = {
  operacion: "secondary",
  comercial: "default",
  finanzas: "success",
  riesgo: "warning",
  cierre: "outline",
};

interface Props {
  item: Item;
}

export function ActividadItem({ item }: Props) {
  const usuario = item.usuario ? nombreDesdeEmail(item.usuario) : "Sistema";
  const monto =
    typeof item.monto === "number" ? formatCurrency(item.monto, item.moneda ?? "MXN") : null;

  return (
    <li className="relative text-body">
      <span
        aria-hidden
        className="absolute -left-[21px] top-2 h-2 w-2 rounded-full bg-border ring-4 ring-background"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={CATEGORIA_VARIANT[item.categoria] ?? "secondary"} className="text-2xs uppercase">
          {CATEGORIA_LABEL[item.categoria]}
        </Badge>
        <span className="font-medium">{item.accion}</span>
        <span className="text-body-sm text-muted-foreground">
          <Hint label={item.usuario || undefined}>
            <span className="font-medium text-foreground">{usuario}</span>
          </Hint>
          {" · "}
          {formatDate(item.fecha, "HH:mm")}
        </span>
        {monto && <span className="ml-auto text-body-sm font-semibold tabular-nums">{monto}</span>}
      </div>
      <p className="mt-1 break-words whitespace-pre-wrap">{item.titulo}</p>
      {item.descripcion && (
        <p className="mt-0.5 text-body-sm text-muted-foreground break-words">{item.descripcion}</p>
      )}
      {item.detalles && <ActividadDetalles detalles={item.detalles} />}
    </li>
  );
}
