import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import {
  type Controller,
  OrigenSelect,
  CsfUploader,
  TipoLogisticoSelect,
  SubtipoGastoSelect,
  ContactoFields,
} from "./NuevoProveedorStep1Fields";
import {
  PaisAgenteSelect,
  RfcField,
  DireccionFiscalGastoFields,
} from "./NuevoProveedorStep1FiscalFields";

/**
 * Paso 1 del wizard de Nuevo Proveedor.
 * La categoría contable se asigna por factura, no a nivel proveedor.
 *
 * v13.436.0 (Armonización visual): se agrupa en `FormDialogSection` con grid de
 * 2 columnas para igualar la estructura del modal de Nuevo Cliente (antes era
 * una sola columna larga que a 720p obligaba a hacer scroll).
 */
export function NuevoProveedorStep1({ c }: { c: Controller }) {
  const mostrarCsf = c.isGasto || (c.isLogistico && c.form.origen_proveedor === "Nacional");

  return (
    <div className="space-y-5">
      {mostrarCsf && (
        <FormDialogSection flat title="Modo de captura">
          <CsfUploader c={c} />
        </FormDialogSection>
      )}

      <FormDialogSection
        title="Identificación"
        description="Datos fiscales con los que emite sus facturas."
      >
        {!c.isGasto && <OrigenSelect c={c} />}
        <div className="space-y-2">
          <Label htmlFor="nuevo-proveedor-nombre">Nombre *</Label>
          <Input
            id="nuevo-proveedor-nombre"
            value={c.form.nombre}
            onChange={(e) => c.setField("nombre", e.target.value.toLocaleUpperCase("es-MX"))}
          />
        </div>
        {c.isLogistico && <TipoLogisticoSelect c={c} />}
        {c.isGasto && <SubtipoGastoSelect c={c} />}
        {c.isAgenteCarga && <PaisAgenteSelect c={c} />}
        {/* RFC/Tax ID siempre visible: ocultarlo al elegir Agente de Carga parecía un borrado. */}
        <RfcField c={c} />
      </FormDialogSection>

      {c.isGasto && (
        <FormDialogSection flat title="Dirección fiscal">
          <DireccionFiscalGastoFields c={c} />
        </FormDialogSection>
      )}

      <FormDialogSection title="Contacto y condiciones">
        <ContactoFields c={c} />
      </FormDialogSection>
    </div>
  );
}
