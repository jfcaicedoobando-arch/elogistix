/**
 * Vista previa del resultado de la etapa activa: qué se cancela, qué se crea,
 * cómo se reasigna el pago y cómo quedan los saldos. Sólo lectura.
 */
import { Ban, FilePlus2, Loader2, Repeat2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useRefacturacionSimulacion } from "@/features/facturacion/hooks/useRefacturacionSimulacion";
import type { AccionSimulada } from "@/features/facturacion/services/refacturacionSimulacion";
import { RefacturacionPreviewCodigos } from "./RefacturacionPreviewCodigos";
import { RefacturacionPreviewSaldos } from "./RefacturacionPreviewSaldos";

interface Props {
  casoId: string | null;
  paso: number;
  activo: boolean;
}

function importe(a: AccionSimulada): string | null {
  if (a.monto === null || a.monto === undefined) return null;
  return formatCurrency(Number(a.monto), a.moneda ?? "MXN");
}

function BloqueAcciones({
  titulo,
  acciones,
  icono: Icono,
  tono,
}: {
  titulo: string;
  acciones: AccionSimulada[];
  icono: typeof Ban;
  tono: "destructive" | "success";
}) {
  if (acciones.length === 0) return null;
  const borde = tono === "destructive" ? "border-destructive/30" : "border-success/30";
  const color = tono === "destructive" ? "text-destructive" : "text-success";

  return (
    <div className={`rounded-md border ${borde} p-3`}>
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
        <Icono className={`h-3.5 w-3.5 ${color}`} aria-hidden="true" />
        {titulo}
      </p>
      <ul className="space-y-1.5">
        {acciones.map((a) => (
          <li key={`${a.tipo}-${a.etiqueta}`} className="text-xs">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{a.etiqueta}</span>
              {importe(a) && <span className="tabular-nums">{importe(a)}</span>}
            </div>
            {a.detalle && <p className="text-muted-foreground">{a.detalle}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RefacturacionPreviewPaso({ casoId, paso, activo }: Props) {
  const { data, isFetching, isError } = useRefacturacionSimulacion(casoId, paso, activo);

  if (!casoId || !activo) return null;

  if (isFetching && !data) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Calculando la vista previa del resultado…
      </p>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-xs text-muted-foreground">
        No fue posible calcular la vista previa de esta etapa.
      </p>
    );
  }

  const reasigna = data.reasigna;

  return (
    <section className="mt-5 space-y-3 rounded-lg border bg-muted/30 p-4">
      <header>
        <h3 className="text-sm font-semibold">Vista previa del resultado</h3>
        <p className="text-xs text-muted-foreground">
          Así queda la operación si confirmas esta etapa. Nada se guarda hasta que confirmes.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <BloqueAcciones titulo="Se cancela" acciones={data.cancela} icono={Ban} tono="destructive" />
        <BloqueAcciones titulo="Se crea" acciones={data.crea} icono={FilePlus2} tono="success" />
      </div>

      {reasigna && (
        <div className="rounded-md border p-3 text-xs">
          <p className="mb-1 flex items-center gap-2 font-semibold uppercase tracking-wide">
            <Repeat2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Se reasigna el pago
          </p>
          <p>
            {formatCurrency(Number(reasigna.monto ?? 0), reasigna.moneda ?? "MXN")} pasa de{" "}
            <span className="font-medium">{reasigna.de}</span> a{" "}
            <span className="font-medium">{reasigna.a}</span>.
          </p>
          {reasigna.ordenante_nombre && (
            <p className="text-muted-foreground">
              Ordenante del depósito: {reasigna.ordenante_nombre}
              {reasigna.ordenante_rfc ? ` · ${reasigna.ordenante_rfc}` : ""}
            </p>
          )}
        </div>
      )}

      <RefacturacionPreviewSaldos saldos={data.saldos} />

      <RefacturacionPreviewCodigos codigos={data.bloqueos} tono="bloqueo" />
      <RefacturacionPreviewCodigos codigos={data.pendientes} tono="pendiente" />

    </section>
  );
}
