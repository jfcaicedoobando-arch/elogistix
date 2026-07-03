import { PageHeader } from "@/components/shared/PageHeader";
import { AlertCircle, Banknote, FileText } from "lucide-react";
import { formatCurrencyCompact } from "@/lib/formatters";

interface Props {
  saludo: string;
  nombre: string;
  hoyStr: string;
  vencidoMxn: number;
  porPagarMxn: number;
  porTimbrar: number;
}

interface Chip {
  icon: React.ReactNode;
  label: string;
  className: string;
}

/**
 * v13.96.0 (auditoría mobile): en lugar de una sola píldora con los 3 valores
 * concatenados con "·" — que en mobile se rompía a 2 líneas dentro del Badge
 * y quedaba ilegible — ahora renderizamos un chip por métrica con icono y
 * color semántico. Cada chip es ancho-contenido (`w-fit`) y wrappea de manera
 * natural en el flex container del PageHeader.
 *
 * El emoji de saludo se envuelve en `<span role="img">` para asegurar
 * fallback de fuente; antes podía renderizar como cuadro vacío en algunos
 * dispositivos sin la fuente Apple Color Emoji.
 */
export function FinanceHeader({
  saludo,
  nombre,
  hoyStr,
  vencidoMxn,
  porPagarMxn,
  porTimbrar,
}: Props) {
  const rawChips: (Chip | null)[] = [
    vencidoMxn > 0
      ? {
          icon: <AlertCircle className="h-3.5 w-3.5" />,
          label: `${formatCurrencyCompact(vencidoMxn, "MXN")} vencido`,
          className: "border-destructive/30 bg-destructive/10 text-destructive",
        }
      : null,
    porPagarMxn > 0
      ? {
          icon: <Banknote className="h-3.5 w-3.5" />,
          label: `${formatCurrencyCompact(porPagarMxn, "MXN")} por pagar`,
          className: "border-warning/50 bg-warning/10 text-warning dark:bg-warning/30 dark:text-warning",
        }
      : null,
    porTimbrar > 0
      ? {
          icon: <FileText className="h-3.5 w-3.5" />,
          label: `${porTimbrar} por timbrar`,
          className: "border-blue-300/50 bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300",
        }
      : null,
  ];
  const chips: Chip[] = rawChips.filter((c): c is Chip => c !== null);

  const titulo = (
    <>
      {saludo}
      {nombre ? `, ${nombre}` : ""}{" "}
      <span role="img" aria-label="saludo" className="font-emoji">👋</span>
    </>
  );

  return (
    <PageHeader
      title={titulo}
      description={hoyStr}
      actions={
        chips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
            {chips.map((c) => (
              <span
                key={c.label}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums ${c.className}`}
              >
                {c.icon}
                {c.label}
              </span>
            ))}
          </div>
        ) : undefined
      }
    />
  );
}
