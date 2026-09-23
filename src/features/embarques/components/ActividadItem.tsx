import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, nombreDesdeEmail } from "@/lib/formatters";
import { CATEGORIA_LABEL, type ActividadItem as Item } from "@/features/embarques/domain/actividadFeed";
import { etiquetaEvento } from "@/features/embarques/domain/actividadHumana";
import { descripcionHumana } from "@/features/embarques/domain/actividadDescripcion";

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

/** P2-3: registros técnicos del mismo hecho, colapsados y sin perder auditoría. */
function Relacionados({ items }: { items: Item[] }) {
  return (
    <details className="mt-1 text-body-sm text-muted-foreground">
      <summary className="cursor-pointer underline decoration-dotted rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {items.length === 1
          ? "Ver 1 registro relacionado"
          : `Ver ${items.length} registros relacionados`}
      </summary>
      <ul className="mt-1 space-y-1 pl-3 border-l">
        {items.map((r) => (
          <li key={r.id}>
            <span className="font-medium">{etiquetaEvento(r.accion)}</span>
            {" · "}
            {formatDate(r.fecha, "HH:mm")}
            {r.titulo && <span className="block break-words">{r.titulo}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ActividadItem({ item }: Props) {
  const usuario = item.usuario ? nombreDesdeEmail(item.usuario) : "Sistema";
  const monto =
    typeof item.monto === "number" ? formatCurrency(item.monto, item.moneda ?? "MXN") : null;
  const accion = etiquetaEvento(item.accion);
  // P2-A: título y descripción también pueden traer la clave técnica dentro
  // del texto ("Factura: factura.borrador_generado"); se humanizan sin tocar
  // las descripciones ya escritas en lenguaje natural.
  const titulo = item.titulo ? descripcionHumana(item.titulo) : accion;
  const descripcion = descripcionHumana(item.descripcion);
  const relacionados = item.relacionados ?? [];


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
        <span className="font-medium">{accion}</span>
        <span className="text-body-sm text-muted-foreground">
          <Hint label={item.usuario || undefined}>
            <span className="font-medium text-foreground">{usuario}</span>
          </Hint>
          {" · "}
          {formatDate(item.fecha, "HH:mm")}
        </span>
        {monto && <span className="ml-auto text-body-sm font-semibold tabular-nums">{monto}</span>}
      </div>
      {titulo !== accion && <p className="mt-1 break-words whitespace-pre-wrap">{titulo}</p>}
      {descripcion && descripcion !== titulo && (
        <p className="mt-0.5 text-body-sm text-muted-foreground break-words">{descripcion}</p>
      )}

      {item.detalles && <ActividadDetalles detalles={item.detalles} />}
      {relacionados.length > 0 && <Relacionados items={relacionados} />}
    </li>
  );
}
