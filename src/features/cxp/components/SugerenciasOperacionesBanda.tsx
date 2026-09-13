/**
 * v13.507.0 — Explica al contador qué conceptos de costo sugirió operaciones al
 * subir el documento, y le deja quitarlos o volver a aplicarlos.
 */
import { Sparkles, RotateCcw, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters/numbers";
import type { ConceptoSugeridoEntrante } from "@/features/cxp/services/facturasEntrantesConceptos";
import { SugerenciasListaAviso } from "./SugerenciasListaAviso";

interface Props {
  aplicados: readonly ConceptoSugeridoEntrante[];
  descartados: readonly ConceptoSugeridoEntrante[];
  /** Sugerencias en otra moneda sin T/C DOF disponible: no se pre-marcaron. */
  sinTipoCambio?: readonly ConceptoSugeridoEntrante[];
  sinCostoCapturado: boolean;
  /** Cuántos conceptos están marcados ahora mismo en el formulario. */
  marcadosAhora: number;
  /** Bug 10 — no se pudo consultar qué costos ya tienen factura: no se pre-marcó nada. */
  errorCubiertos?: boolean;
  onReintentar?: () => void;
  onQuitarTodos: () => void;
  onReaplicar: () => void;
}

export function SugerenciasOperacionesBanda({
  aplicados, descartados, sinTipoCambio = [], sinCostoCapturado, marcadosAhora,
  errorCubiertos = false, onReintentar, onQuitarTodos, onReaplicar,
}: Props) {
  if (errorCubiertos) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
        <p className="flex items-center gap-2 text-body-sm text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          No se pudo revisar qué costos ya tienen factura: por seguridad no se pre-marcó nada.
          Vincula a mano o vuelve a intentar.
        </p>
        {onReintentar && (
          <Button size="sm" variant="outline" onClick={onReintentar}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reintentar
          </Button>
        )}
      </section>
    );
  }

  if (sinCostoCapturado && aplicados.length === 0 && descartados.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-3 py-2 text-body-sm text-muted-foreground">
        Operaciones indicó que este documento aún no corresponde a un costo capturado del embarque:
        vincúlalo a mano si ya existe el concepto.
      </p>
    );
  }
  if (aplicados.length === 0 && descartados.length === 0 && sinTipoCambio.length === 0) return null;

  return (
    <section className="space-y-2 rounded-md border border-info/40 bg-info/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-body-sm font-medium">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-info" aria-hidden />
          Operaciones sugirió {aplicados.length} concepto{aplicados.length === 1 ? "" : "s"} de costo
          {aplicados.length > 0 ? " · ya vienen marcados" : ""}
        </p>
        <div className="flex gap-2">
          {marcadosAhora > 0 && (
            <Button size="sm" variant="ghost" onClick={onQuitarTodos}>
              <XCircle className="mr-1.5 h-3.5 w-3.5" /> Quitar todos
            </Button>
          )}
          {aplicados.length > 0 && (
            <Button size="sm" variant="ghost" onClick={onReaplicar}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Volver a aplicar
            </Button>
          )}
        </div>
      </div>

      {aplicados.length > 0 && (
        <>
          <ul className="space-y-0.5 text-body-sm text-muted-foreground">
            {aplicados.map((c) => (
              <li key={c.conceptoCostoId}>
                {c.concepto} · {formatCurrency(c.monto, c.moneda)}
              </li>
            ))}
          </ul>
          <p className="text-body-sm text-muted-foreground">
            Los montos marcados van en la moneda de la factura: si cambias la moneda en el paso 1,
            se vuelven a calcular con el tipo de cambio del día.
          </p>
        </>
      )}

      <SugerenciasListaAviso
        items={descartados}
        motivo="el concepto ya tiene otra factura vigente:"
      />

      <SugerenciasListaAviso
        items={sinTipoCambio}
        motivo={
          "el costo está en otra moneda y no hay tipo de cambio del día para convertirlo. " +
          "Márcalo a mano cuando el tipo de cambio esté disponible:"
        }
      />
    </section>
  );
}
