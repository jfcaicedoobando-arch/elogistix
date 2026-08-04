import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
 */
export function NuevoProveedorStep1({ c }: { c: Controller }) {
  const mostrarCsf = c.isGasto || (c.isLogistico && c.form.origen_proveedor === "Nacional");
  const mostrarRfc = !c.isAgenteCarga || !!c.form.pais;

  return (
    <div className="space-y-4">
      {!c.isGasto && <OrigenSelect c={c} />}
      {mostrarCsf && <CsfUploader c={c} />}

      <div className="space-y-2">
        <Label>Nombre *</Label>
        <Input value={c.form.nombre} onChange={(e) => c.setField("nombre", e.target.value.toLocaleUpperCase("es-MX"))} />
      </div>

      {c.isLogistico && <TipoLogisticoSelect c={c} />}
      {c.isGasto && <SubtipoGastoSelect c={c} />}
      {c.isAgenteCarga && <PaisAgenteSelect c={c} />}
      {mostrarRfc && <RfcField c={c} />}
      {c.isGasto && <DireccionFiscalGastoFields c={c} />}
      <ContactoFields c={c} />
    </div>
  );
}
