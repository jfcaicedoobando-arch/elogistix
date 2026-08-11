/**
 * Campos del formulario de captura de factura de proveedor.
 * Inputs numéricos sin spinners (NumericInput), secciones con iconos
 * y agrupación moneda+importes. El total vive en el header del dialog.
 */
import type {
  FacturaFormValues,
  CategoriaPresupuestoLite,
  TcOrigen,
} from "@/features/cxp/types";
import type { CategoriaCogsBuzon } from "@/features/cxp/hooks/useCategoriaCogsBuzon";
import { CategoriaContableSection } from "./FacturaProveedorFormFields.categoria";
import { ProveedorYFolioSection, NotasSection } from "./FacturaProveedorFormFields.sections";
import { FechasEImportesBlock } from "./FacturaProveedorFechasImportes";



interface Props {
  values: FacturaFormValues;
  onChange: <K extends keyof FacturaFormValues>(k: K, v: FacturaFormValues[K]) => void;
  onProveedor: (id: string, nombre: string, diasCredito?: number) => void;
  categorias: CategoriaPresupuestoLite[];
  total: number;
  errors?: Partial<Record<keyof FacturaFormValues, string>>;
  /** Modo edición: oculta el combobox y muestra el proveedor como read-only. */
  proveedorReadOnly?: boolean;
  proveedorNombre?: string;
  /** Origen actual del valor `tc` — controla el hint debajo del input. */
  tcOrigen?: TcOrigen;
  /** Fecha (YYYY-MM-DD) del FIX efectivamente aplicado por Banxico. */
  tcFechaAplicada?: string;
  /** Handler del botón "Obtener DOF". Si se omite, no se renderiza el botón. */
  onObtenerDof?: () => void;
  /** Estado de carga del auto-fetch/click del botón "Obtener DOF". */
  dofLoading?: boolean;
  /**
   * v13.423.0 — Omite "Fechas y crédito" + "Moneda e importes" porque el modal
   * de captura los coloca en la otra columna (ver `FechasEImportesBlock`).
   */
  sinFechasEImportes?: boolean;
  /** v13.510.0 — Categoría fijada en COGS cuando el documento viene del buzón. */
  categoriaCogs?: CategoriaCogsBuzon | null;
}


export function FacturaProveedorFormFields({
  values, onChange, onProveedor, categorias, errors = {},
  proveedorReadOnly = false, proveedorNombre, sinFechasEImportes = false,
  categoriaCogs,
  tcOrigen = "vacio", tcFechaAplicada, onObtenerDof, dofLoading = false,
}: Props) {
  

  return (
    <div className="space-y-5">
      <ProveedorYFolioSection
        values={values}
        onChange={onChange}
        onProveedor={onProveedor}
        errors={errors}
        proveedorReadOnly={proveedorReadOnly}
        proveedorNombre={proveedorNombre}
      />

      {!sinFechasEImportes && (
        <FechasEImportesBlock
          values={values}
          onChange={onChange}
          errors={errors}
          tcOrigen={tcOrigen}
          tcFechaAplicada={tcFechaAplicada}
          onObtenerDof={onObtenerDof}
          dofLoading={dofLoading}
        />
      )}


      <CategoriaContableSection
        value={values.categoriaId}
        onChange={(v) => onChange("categoriaId", v)}
        categorias={categorias}
        error={errors.categoriaId}
        bloqueada={categoriaCogs?.bloqueada}
        motivo={categoriaCogs?.motivo}
        onDesbloquear={categoriaCogs?.desbloquear}
        avisoSinCogs={categoriaCogs?.avisoSinCogs}
      />


      <NotasSection value={values.notas} onChange={(v) => onChange("notas", v)} />
    </div>
  );
}


