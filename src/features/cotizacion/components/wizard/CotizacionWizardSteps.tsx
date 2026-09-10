/**
 * Cuerpo de pasos del wizard de cotización — extraído de CotizacionWizardLayout.tsx
 * para cumplir Power of 10 (≤200 líneas).
 *
 * P16 (perf 2026-07-25): reemplazados los 8 `form.watch()` globales por
 * `useWatch` por campo para evitar re-renders del wizard completo al teclear.
 */
import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWatch } from "react-hook-form";

import SeccionConceptosVentaCotizacion from "@/features/cotizacion/components/SeccionConceptosVentaCotizacion";
import SeccionCostosInternosPLUnificado from "@/features/cotizacion/components/SeccionCostosInternosPLUnificado";
import PasoResumenCotizacion from "@/features/cotizacion/components/PasoResumenCotizacion";
import PasoDatosGenerales from "@/features/cotizacion/components/wizard/PasoDatosGenerales";
import Paso1ProgressSidebar from "@/features/cotizacion/components/wizard/Paso1ProgressSidebar";
import { SinDesgloseBanner } from "@/features/cotizacion/components/SinDesgloseBanner";
import { TipoCambioCotizacionCard } from "@/features/cotizacion/components/wizard/TipoCambioCotizacionCard";
import { hayMezclaDeMonedas } from "@/features/cotizacion/domain/mezclaMonedas";

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

  // 13.823.281: el TC sólo se pide cuando de verdad hay importes en ambas monedas.
  const hayMezclaMonedas = hayMezclaDeMonedas(w.conceptosUSD, w.conceptosMXN);

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

  // Un solo marco: los pasos 2-4 ya no se encajonan en un contenedor más
  // angosto que el paso 1; el ancho lo fija `WizardShell` (max-w-6xl).
  return (
    <div className="space-y-6">
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
            <Alert variant="info">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Pre-llenado desde Costos y utilidad. Puedes ajustar si es necesario.
              </AlertDescription>
            </Alert>
          )}

          {hayMezclaMonedas && (
            <TipoCambioCotizacionCard value={w.tipoCambioUsd} onChange={w.setTipoCambioUsd} />
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
              esProspecto
                ? prospectoEmpresa
                : (w.clienteSeleccionado?.nombre || "—")
            }
            origen={origen}
            destino={destino}
            numContenedores={numContenedores}
            modo={modo}
            incoterm={incoterm}
            tipo={tipo}
            totalUSD={w.totalUSD}
            totalMXN={w.totalMXN}
          />
        </>
      )}
    </div>
  );
}
