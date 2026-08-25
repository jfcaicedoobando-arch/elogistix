/**
 * Paso 3 del wizard de captura: sugerencias de operaciones, vinculación a los
 * costos del embarque y resumen final antes de guardar (v13.712.0).
 */
import type { useNuevaFacturaProveedorForm } from "@/features/cxp/hooks";
import type { EntranteParaCaptura } from "@/features/cxp/types";
import type { HerenciaSugerencias } from "@/features/cxp/hooks/usePrefillVinculosEntrante";
import { SugerenciasOperacionesBanda } from "../SugerenciasOperacionesBanda";
import { VincularEmbarqueSection } from "../VincularEmbarqueSection";
import { ResumenCapturaFactura } from "../ResumenCapturaFactura";
import { embarqueIdUnico } from "@/features/cxp/hooks/useNuevaFacturaProveedorForm.helpers";
import { AvisoAnticipoEmbarque } from "@/features/anticipos-proveedor/components/AvisoAnticipoEmbarque";

type Ctl = ReturnType<typeof useNuevaFacturaProveedorForm>;

interface Props {
  ctl: Ctl;
  entrante: EntranteParaCaptura | null;
  herencia?: HerenciaSugerencias | null;
  sinCostoCapturado?: boolean;
  onIrADatos: () => void;
}

export function PasoVinculacion({
  ctl, entrante, herencia, sinCostoCapturado, onIrADatos,
}: Props) {
  const embarqueCruce = entrante?.embarqueId ?? embarqueIdUnico(ctl.vinculos);
  const expedienteCruce = entrante?.expediente ?? null;

  if (!ctl.values.provId) {
    return (
      <div className="space-y-4">
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-body-sm text-muted-foreground">
          Elige el proveedor en «Datos de la factura» para poder vincularla a un embarque.
        </p>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onIrADatos}
            className="text-body-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Ir a los datos de la factura
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 min-w-0">
      {embarqueCruce && (
        <AvisoAnticipoEmbarque
          proveedorId={ctl.values.provId}
          embarqueId={embarqueCruce}
          expediente={expedienteCruce}
        />
      )}

      {herencia && (
        <SugerenciasOperacionesBanda
          aplicados={herencia.aplicados}
          descartados={herencia.descartados}
          sinCostoCapturado={Boolean(sinCostoCapturado)}
          marcadosAhora={Object.keys(ctl.vinculos).length}
          onQuitarTodos={ctl.limpiarVinculos}
          onReaplicar={herencia.reaplicar}
        />
      )}

      <VincularEmbarqueSection
        proveedorId={ctl.values.provId}
        proveedorNombre={ctl.values.provNombre}
        organizationId={ctl.organizationId}
        seleccion={ctl.vinculos}
        onToggle={ctl.toggleVinculo}
        onChangeMonto={ctl.setVinculoMonto}
        onAplicarSugerencias={ctl.aplicarSugerencias}
        facturaDescripcion={ctl.values.notas || `Factura ${ctl.values.folio}`}
        facturaMonto={Number(ctl.values.subtotal) || 0}
        facturaMoneda={ctl.values.moneda}
        embarqueAdHoc={ctl.embarqueAdHoc}
        onEmbarqueAdHoc={ctl.setEmbarqueAdHoc}
        tope={ctl.topeVinculacion}
        embarqueIdPrioritario={entrante?.embarqueId ?? null}
        expedientePrioritario={entrante?.expediente ?? null}
        fechaEmision={ctl.values.emision}
      />

      <ResumenCapturaFactura
        values={ctl.values}
        total={ctl.total}
        vinculos={Object.keys(ctl.vinculos).length}
        onEditarDatos={onIrADatos}
      />
    </div>
  );
}
