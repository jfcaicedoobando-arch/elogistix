/**
 * Cuerpo de pasos del wizard de cotización — extraído de CotizacionWizardLayout.tsx
 * para cumplir Power of 10 (≤200 líneas).
 *
 * P16 (perf 2026-07-25): reemplazados los 8 `form.watch()` globales por
 * `useWatch` por campo para evitar re-renders del wizard completo al teclear.
 */
import { Info } from "lucide-react";
import { useWatch } from "react-hook-form";
import SeccionConceptosVentaCotizacion from "@/features/cotizacion/components/SeccionConceptosVentaCotizacion";
import SeccionCostosInternosPLUnificado from "@/features/cotizacion/components/SeccionCostosInternosPLUnificado";
import PasoResumenCotizacion from "@/features/cotizacion/components/PasoResumenCotizacion";
import PasoDatosGenerales from "@/features/cotizacion/components/wizard/PasoDatosGenerales";
import Paso1ProgressSidebar from "@/features/cotizacion/components/wizard/Paso1ProgressSidebar";
import { SinDesgloseBanner } from "@/features/cotizacion/components/SinDesgloseBanner";

type WizardForm = ReturnType<typeof import("@/features/cotizacion/hooks").useCotizacionWizardForm>;

interface Props {
  w: WizardForm;
  clientes: { id: string; nombre: string }[];
  esMaritimo: boolean;
  sinDesgloseFlag: boolean;
  irACargarCostos: () => void;
}

export function CotizacionWizardSteps({ w, clientes, esMaritimo, sinDesgloseFlag, irACargarCostos }: Props) {
  const { form } = w;
  // Suscripciones puntuales: solo re-renderea el resumen cuando cambia ese campo.
  const control = form.control;
  const esProspecto = useWatch({ control, name: "esProspecto" });
  const prospectoEmpresa = useWatch({ control, name: "prospectoEmpresa" });
  const origen = useWatch({ control, name: "origen" });
  const destino = useWatch({ control, name: "destino" });
  const numContenedores = useWatch({ control, name: "numContenedores" });
  const modo = useWatch({ control, name: "modo" });
  const incoterm = useWatch({ control, name: "incoterm" });
  const tipo = useWatch({ control, name: "tipo" });

  if (w.currentStep === 1) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[14rem_1fr] gap-6">
        <Paso1ProgressSidebar esMaritimo={esMaritimo} />
        <div className="space-y-6 min-w-0">
          <PasoDatosGenerales w={w} clientes={clientes} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {w.currentStep === 2 && (
        <SeccionCostosInternosPLUnificado
          tipo="local"
          filas={w.costosInternos}
          setFilas={w.setCostosInternos}
        />
      )}

      {w.currentStep === 3 && (
        <>
          {sinDesgloseFlag && <SinDesgloseBanner onCargarCostos={irACargarCostos} />}
          {w.costosPreLlenados && !sinDesgloseFlag && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-info/10 border border-info/30 [color:hsl(var(--info))] text-sm">
              <Info className="h-4 w-4 flex-shrink-0" />
              Pre-llenado desde Costos & P&L. Puedes ajustar si es necesario.
            </div>
          )}
          <SeccionConceptosVentaCotizacion
            conceptosUSD={w.conceptosUSD}
            conceptosMXN={w.conceptosMXN}
            actualizarConceptoUSD={(i, c, v) => w.actualizarConcepto("USD", i, c, v)}
            actualizarConceptoMXN={(i, c, v) => w.actualizarConcepto("MXN", i, c, v)}
            agregarConceptoUSD={() => w.agregarConcepto("USD")}
            agregarConceptoMXN={() => w.agregarConcepto("MXN")}
            agregarConceptoPrefill={w.agregarConceptoPrefill}
            eliminarConceptoUSD={(i) => w.eliminarConcepto("USD", i)}
            eliminarConceptoMXN={(i) => w.eliminarConcepto("MXN", i)}
            totalUSD={w.totalUSD}
            subtotalMXN={w.subtotalMXN}
            ivaMXN={w.ivaMXN}
            totalMXN={w.totalMXN}
          />
        </>
      )}

      {w.currentStep === 4 && (
        <>
          {sinDesgloseFlag && <SinDesgloseBanner onCargarCostos={irACargarCostos} />}
          <PasoResumenCotizacion
            plUSD={w.plUSD}
            plMXN={w.plMXN}
            tieneCostosUSD={w.costosUSD.length > 0}
            tieneCostosMXN={w.costosMXN.length > 0}
            nombreCliente={
              form.watch("esProspecto")
                ? form.watch("prospectoEmpresa")
                : (w.clienteSeleccionado?.nombre || "—")
            }
            origen={form.watch("origen")}
            destino={form.watch("destino")}
            numContenedores={form.watch("numContenedores")}
            modo={form.watch("modo")}
            incoterm={form.watch("incoterm")}
            tipo={form.watch("tipo")}
            totalUSD={w.totalUSD}
            totalMXN={w.totalMXN}
          />
        </>
      )}
    </div>
  );
}
