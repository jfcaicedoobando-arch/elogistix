/**
 * Paso 2 del wizard de captura: proveedor, folio, fechas, importes, T/C,
 * categoría contable y notas (v13.712.0).
 */
import type { useNuevaFacturaProveedorForm } from "@/features/cxp/hooks";
import type { CategoriaPresupuestoLite, EntranteParaCaptura } from "@/features/cxp/types";
import type { CategoriaCogsBuzon } from "@/features/cxp/hooks/useCategoriaCogsBuzon";
import { FacturaProveedorFormFields } from "../FacturaProveedorFormFields";
import { AvisoMontoDeclarado } from "../AvisoMontoDeclarado";

type Ctl = ReturnType<typeof useNuevaFacturaProveedorForm>;

interface Props {
  ctl: Ctl;
  categorias: CategoriaPresupuestoLite[];
  entrante: EntranteParaCaptura | null;
  categoriaCogs?: CategoriaCogsBuzon | null;
}

export function PasoDatos({ ctl, categorias, entrante, categoriaCogs }: Props) {
  return (
    <div className="space-y-5 min-w-0">
      {entrante && (
        <AvisoMontoDeclarado
          montoDeclarado={entrante.montoDeclarado}
          monedaDeclarada={entrante.monedaDeclarada}
          montoCapturado={Number(ctl.values.subtotal) || 0}
          monedaCapturada={ctl.values.moneda}
        />
      )}

      <FacturaProveedorFormFields
        values={ctl.values}
        onChange={ctl.handleChange}
        onProveedor={ctl.handleProveedor}
        categorias={categorias}
        total={ctl.total}
        errors={ctl.errors}
        tcOrigen={ctl.tcOrigen}
        tcFechaAplicada={ctl.tcFechaAplicada}
        onObtenerDof={ctl.obtenerDofManual}
        dofLoading={ctl.dofLoading}
        categoriaCogs={categoriaCogs}
      />
    </div>
  );
}
