/**
 * Línea de tiempo del caso de refacturación: qué pasó, cuándo y quién lo hizo.
 */
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { formatFechaHoraTexto } from "@/lib/formatters";
import { nombreDesdeEmail } from "@/lib/formatters/text";
import { PASOS_REFACTURACION } from "@/features/facturacion/domain/refacturacionPasos";
import type { EventoRefacturacion, SeveridadEvento } from "@/features/facturacion/domain/refacturacionEventos";

const ICONO: Record<SeveridadEvento, typeof CheckCircle2> = {
  ok: CheckCircle2,
  pendiente: Clock,
  error: AlertTriangle,
};

const COLOR: Record<SeveridadEvento, string> = {
  ok: "text-success",
  pendiente: "text-warning",
  error: "text-destructive",
};

export function RefacturacionTimeline({ eventos }: { eventos: EventoRefacturacion[] }) {
  if (eventos.length === 0) {
    return (
      <p className="py-3 text-sm text-muted-foreground">
        Aún no hay movimientos registrados en este caso.
      </p>
    );
  }

  return (
    <ol className="relative space-y-4 border-l pl-5">
      {eventos.map((e) => {
        const Icono = ICONO[e.severidad];
        const pasoNombre = e.paso ? PASOS_REFACTURACION[e.paso - 1] : null;
        return (
          <li key={e.id} className="relative">
            <span className="absolute -left-[1.6rem] top-0.5 bg-background">
              <Icono className={`h-4 w-4 ${COLOR[e.severidad]}`} aria-hidden />
            </span>
            <p className="text-sm font-medium leading-tight">{e.titulo}</p>
            <p className="text-xs text-muted-foreground">
              {formatFechaHoraTexto(e.ts)}
              {" · "}
              {nombreDesdeEmail(e.usuarioEmail) || e.usuarioEmail}
              {pasoNombre ? ` · Paso ${e.paso}: ${pasoNombre}` : ""}
              {e.referencia ? ` · ${e.referencia}` : ""}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
