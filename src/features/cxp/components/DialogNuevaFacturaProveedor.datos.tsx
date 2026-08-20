/**
 * Columna derecha del modal "Capturar factura de proveedor": proveedor,
 * categoría contable, sugerencias del buzón y vinculación al embarque.
 * v13.510.1 — Extraída de `DialogNuevaFacturaProveedor.columnas.tsx`
 * (Power of 10: archivos ≤ 200 líneas).
 */
import type { useNuevaFacturaProveedorForm } from "@/features/cxp/hooks";
import type { CategoriaPresupuestoLite, EntranteParaCaptura } from "@/features/cxp/types";
import type { HerenciaSugerencias } from "@/features/cxp/hooks/usePrefillVinculosEntrante";
import type { CategoriaCogsBuzon } from "@/features/cxp/hooks/useCategoriaCogsBuzon";
import { SugerenciasOperacionesBanda } from "./SugerenciasOperacionesBanda";
import { FacturaProveedorFormFields } from "./FacturaProveedorFormFields";
import { VincularEmbarqueSection } from "./VincularEmbarqueSection";
import { embarqueIdUnico } from "@/features/cxp/hooks/useNuevaFacturaProveedorForm.helpers";
import { AvisoAnticipoEmbarque } from "@/features/anticipos-proveedor/components/AvisoAnticipoEmbarque";

type Ctl = ReturnType<typeof useNuevaFacturaProveedorForm>;

interface DatosProps {
  ctl: Ctl;
  categorias: CategoriaPresupuestoLite[];
  /** v13.507.0 — Sugerencias heredadas del buzón (sólo en modo buzón). */
  herencia?: HerenciaSugerencias | null;
  sinCostoCapturado?: boolean;
  /** v13.510.0 — Documento del buzón: fija COGS y prioriza su expediente. */
  entrante?: EntranteParaCaptura | null;
  categoriaCogs?: CategoriaCogsBuzon | null;
}

/** Columna derecha: proveedor, categoría, notas y vinculación al embarque. */
export function ColumnaDatosFactura({
  ctl, categorias, herencia, sinCostoCapturado, entrante, categoriaCogs,
}: DatosProps) {
  // Embarque al que apunta la captura: el del buzón o el único vinculado.
  const embarqueCruce = entrante?.embarqueId ?? embarqueIdUnico(ctl.vinculos);
  const expedienteCruce = entrante?.expediente ?? null;

  return (
    <div className="space-y-5 min-w-0">
      <FacturaProveedorFormFields
        values={ctl.values}
        onChange={ctl.handleChange}
        onProveedor={ctl.handleProveedor}
        categorias={categorias}
        total={ctl.total}
        errors={ctl.errors}
        sinFechasEImportes
        categoriaCogs={categoriaCogs}
      />

      {ctl.values.provId && embarqueCruce && (
        <AvisoAnticipoEmbarque
          proveedorId={ctl.values.provId}
          embarqueId={embarqueCruce}
          expediente={expedienteCruce}
        />
      )}

      {herencia && ctl.values.provId && (
        <SugerenciasOperacionesBanda
          aplicados={herencia.aplicados}
          descartados={herencia.descartados}
          sinCostoCapturado={Boolean(sinCostoCapturado)}
          marcadosAhora={Object.keys(ctl.vinculos).length}
          onQuitarTodos={ctl.limpiarVinculos}
          onReaplicar={herencia.reaplicar}
        />
      )}

      {ctl.values.provId ? (
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
        />
      ) : (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-body-sm text-muted-foreground">
          Elige el proveedor para poder vincular la factura a un embarque.
        </p>
      )}
    </div>
  );
}

