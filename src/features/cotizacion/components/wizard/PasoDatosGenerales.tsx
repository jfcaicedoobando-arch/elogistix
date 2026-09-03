import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { WizardSection } from "@/components/shared/WizardSection";
import SeccionCierreCotizacion from "@/features/cotizacion/components/wizard/SeccionCierreCotizacion";
import SeccionDestinatario from "@/features/cotizacion/components/SeccionDestinatario";
import SeccionDatosGeneralesCotizacion from "@/features/cotizacion/components/SeccionDatosGeneralesCotizacion";
import SeccionRutaCotizacion from "@/features/cotizacion/components/SeccionRutaCotizacion";
import SeccionMercanciaMaritimaFCL from "@/features/cotizacion/components/SeccionMercanciaMaritimaFCL";
import SeccionMercanciaMaritimaLCL from "@/features/cotizacion/components/SeccionMercanciaMaritimaLCL";
import SeccionMercanciaGeneral from "@/features/cotizacion/components/SeccionMercanciaGeneral";
import SeccionMercanciaAerea from "@/features/cotizacion/components/SeccionMercanciaAerea";
import TarifaVinculadaPanel from "@/features/cotizacion/components/TarifaVinculadaPanel";
import SeccionFleteManualLCL from "@/features/cotizacion/components/SeccionFleteManualLCL";
import SeccionCondicionesComerciales from "@/features/cotizacion/components/SeccionCondicionesComerciales";
import AvisoIncotermCIF from "@/features/cotizacion/components/wizard/AvisoIncotermCIF";
import { usePaso1SectionStatus } from "@/features/cotizacion/hooks/usePaso1SectionStatus";
import { useConfigValue } from "@/features/configuracion/hooks/useConfiguracion";
import { esIncotermSinFleteVenta } from "@/features/cotizacion/utils/incotermRules";
import type { FilaCostoLocal } from "@/features/cotizacion/types";

import type { useCotizacionWizardForm } from "@/features/cotizacion/hooks";

interface Props {
  w: ReturnType<typeof useCotizacionWizardForm>;
  clientes: { id: string; nombre: string }[];
}

/**
 * Paso 1 del wizard de cotización.
 *
 * Orden conversacional:
 *   - Marítimo (v13.47.2 — tarifa-first reordenado):
 *       1. Cliente → 2. Operación → 3. Ruta (origen/destino/tipo movimiento) →
 *       4. Mercancía → 5. Tarifa → 6. Condiciones comerciales → 7. Cierre.
 *   - Aéreo / Terrestre / General:
 *       1. Cliente → 2. Operación → 3. Ruta → 4. Mercancía → 5. Cierre.
 *
 * Cada sección muestra un check verde cuando sus campos requeridos están
 * completos (`usePaso1SectionStatus`).
 */
export default function PasoDatosGenerales({ w, clientes }: Props) {
  const { form } = w;
  const tipoEmbarque = form.watch("tipoEmbarque");
  const incoterm = form.watch("incoterm");
  const modo = form.watch("modo");
  const numContenedores = form.watch("numContenedores") ?? 1;
  const status = usePaso1SectionStatus();
  const markup = useConfigValue<number>("cotizaciones", "markup_default_maritimo", 0.15);

  // Bajo incoterms tipo C/D marítimos (CIF, CFR, CIP, DAP, DDP, ...) el
  // shipper en origen ya paga flete (y a veces seguro). Libre Carga sólo
  // cotiza gastos locales destino: ocultamos tarifa y condiciones.
  const sinFleteVenta = esIncotermSinFleteVenta(incoterm, modo);

  const handleAutocargaCostos = (filas: FilaCostoLocal[]): void => {
    w.setCostosInternos((prev) => {
      const manuales = prev.filter((f) => f.notas !== "Auto-cargado desde tarifa marítima");
      return [...manuales, ...filas];
    });
  };

  const mercanciaBlock = (
    <div id="seccion-mercancia" className="scroll-mt-4">
      <WizardSection title="Mercancía" complete={status.mercancia}>
        {w.esMaritimo ? (
          <div className="space-y-4">
            <RadioGroup
              value={tipoEmbarque}
              onValueChange={(v) => w.handleCambiarTipoEmbarque(v as "FCL" | "LCL")}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="FCL" id="tipo-fcl" />
                <Label htmlFor="tipo-fcl" className="cursor-pointer text-body font-medium">
                  FCL (Contenedor completo)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="LCL" id="tipo-lcl" />
                <Label htmlFor="tipo-lcl" className="cursor-pointer text-body font-medium">
                  LCL (Carga consolidada)
                </Label>
              </div>
            </RadioGroup>
            {tipoEmbarque === "FCL" ? (
              <SeccionMercanciaMaritimaFCL msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile} />
            ) : (
              <SeccionMercanciaMaritimaLCL msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile} />
            )}
          </div>
        ) : w.esAereo ? (
          <SeccionMercanciaAerea msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile} />
        ) : (
          <SeccionMercanciaGeneral msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile} />
        )}
      </WizardSection>
    </div>
  );

  // v13.299.1: en Marítimo LCL se elimina por completo el panel de "Tarifa
  // marítima vinculada" (y sus sugerencias). LCL usa captura manual de flete
  // — consolidador + tarifa W/M + mínimo — mediante `SeccionFleteManualLCL`.
  const esLcl = w.esMaritimo && tipoEmbarque === "LCL";
  const tarifaBlock = w.esMaritimo && !sinFleteVenta ? (
    <div id="seccion-tarifa" className="scroll-mt-4 space-y-4">
      {esLcl ? (
        <SeccionFleteManualLCL complete={status.tarifa} />
      ) : (
        <TarifaVinculadaPanel
          complete={status.tarifa}
          onAutocargaCostos={handleAutocargaCostos}
          markup={markup}
          cantidad={numContenedores}
        />
      )}
    </div>
  ) : null;

  const condicionesBlock = w.esMaritimo && !sinFleteVenta ? (
    <div id="seccion-condiciones" className="scroll-mt-4">
      <SeccionCondicionesComerciales complete={status.condiciones} />
    </div>
  ) : null;

  const avisoIncotermCBlock = w.esMaritimo && sinFleteVenta ? (
    <AvisoIncotermCIF incoterm={incoterm} />
  ) : null;

  return (
    <>
      {/* 1. Cliente */}
      <div id="seccion-cliente" className="scroll-mt-4">
        <SeccionDestinatario
          clientes={clientes}
          complete={status.cliente}
          vinculoConfirmado={w.vinculoCrmConfirmado}
          onLimpiarVinculoError={w.limpiarVinculoCrmError}
        />
      </div>

      {/* 2. Operación */}
      <div id="seccion-operacion" className="scroll-mt-4">
        <SeccionDatosGeneralesCotizacion complete={status.operacion} />
      </div>

      {/* 3. Ruta */}
      <div id="seccion-ruta" className="scroll-mt-4">
        <SeccionRutaCotizacion complete={status.ruta} />
      </div>

      {/* Marítimo: Mercancía → Tarifa → Condiciones comerciales.
          Otros modos: sólo Mercancía. */}
      {mercanciaBlock}
      {tarifaBlock}
      {condicionesBlock}
      {avisoIncotermCBlock}

      {/* Cierre */}
      <SeccionCierreCotizacion form={form as never} complete={status.cierre} />
    </>
  );
}
