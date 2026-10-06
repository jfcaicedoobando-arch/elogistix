/**
 * Campos que llena el solicitante (formato de Sheets de Pricing).
 */
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { useUsuariosOrgCrm } from "@/features/crm/hooks/usePricingCrm";
import {
  ETIQUETA_COMPLEJIDAD, INCOTERMS_PRICING, SERVICIOS_PRICING, type SolicitudPricingInsert,
  aNumero, UNIDADES_MEDIDA_PRICING,
} from "@/features/crm/services/pricing/tiposPricing";
import { CampoLista, CampoSiNo, CampoTexto } from "./CamposPricing";

export type DatosSolicitud = Omit<SolicitudPricingInsert, "folio" | "organization_id" | "oportunidad_id">;

interface Props {
  datos: DatosSolicitud;
  set: <K extends keyof DatosSolicitud>(campo: K, valor: DatosSolicitud[K]) => void;
  disabled?: boolean;
}

const COMPLEJIDADES = (Object.keys(ETIQUETA_COMPLEJIDAD) as Array<keyof typeof ETIQUETA_COMPLEJIDAD>)
  .map((k) => ({ value: k, label: ETIQUETA_COMPLEJIDAD[k] }));

export function SolicitudPricingCampos({ datos, set, disabled }: Props) {
  const { data: usuarios = [] } = useUsuariosOrgCrm();
  const txt = (campo: keyof DatosSolicitud) => (v: string) => set(campo, (v || null) as never);
  const d = { disabled };
  return (
    <>
      <FormDialogSection title="Datos generales">
        <CampoLista id="pr-solicitante" label="Solicitante" required {...d} value={datos.solicitante_id}
          opciones={usuarios.map((u) => ({ value: u.user_id, label: u.nombre }))}
          onChange={(v) => v && set("solicitante_id", v)} />
        <CampoTexto id="pr-fecha" label="Fecha" type="date" {...d} value={datos.fecha} onChange={txt("fecha")} />
        <CampoTexto id="pr-cliente" label="Cliente" {...d} value={datos.cliente} onChange={txt("cliente")} />
        <CampoLista id="pr-servicio" label="Service" required {...d} value={datos.servicio}
          opciones={SERVICIOS_PRICING} onChange={(v) => set("servicio", v)} />
        <CampoLista id="pr-complejidad" label="Complejidad" {...d} value={datos.complejidad ?? "media"}
          opciones={COMPLEJIDADES} onChange={(v) => v && set("complejidad", v)} />
        <CampoLista id="pr-incoterm" label="Incoterm" {...d} value={datos.incoterm}
          opciones={INCOTERMS_PRICING} onChange={(v) => set("incoterm", v)} />
      </FormDialogSection>
      <FormDialogSection title="Carga">
        <CampoSiNo id="pr-imo" label="IMO" {...d} value={datos.imo} onChange={(v) => set("imo", v)} />
        <CampoTexto id="pr-commodity" label="Commodity" {...d} value={datos.commodity} onChange={txt("commodity")} />
        <CampoTexto id="pr-size" label="Container Size" {...d} value={datos.container_size} onChange={txt("container_size")} />
        <CampoTexto id="pr-type" label="Type" {...d} value={datos.tipo_carga} onChange={txt("tipo_carga")} />
        <CampoTexto id="pr-qty" label="Quantity" type="number" {...d} value={datos.cantidad}
          onChange={(v) => { const n = aNumero(v); set("cantidad", n != null && n > 0 ? Math.trunc(n) : null); }} />
        <CampoSiNo id="pr-estibable" label="Estibable" {...d} value={datos.estibable} onChange={(v) => set("estibable", v)} />
        <CampoTexto id="pr-peso" label="Weight" {...d} value={datos.peso} onChange={txt("peso")} />
        <CampoLista id="pr-unidad-medida" label="Units of measurement" {...d} value={datos.unidad_medida}
          opciones={UNIDADES_MEDIDA_PRICING} onChange={(v) => set("unidad_medida", v)} />
        <CampoTexto id="pr-dim" label="Dimensions" {...d} value={datos.dimensiones} onChange={txt("dimensiones")} />
      </FormDialogSection>
      <FormDialogSection title="Ruta">
        <CampoTexto id="pr-pol" label="AOL/POL" {...d} value={datos.pol} onChange={txt("pol")} />
        <CampoTexto id="pr-pod" label="AOD/POD" {...d} value={datos.pod} onChange={txt("pod")} />
        <CampoTexto id="pr-origen" label="Origen" required {...d} value={datos.origen} onChange={txt("origen")} />
        <CampoTexto id="pr-destino" label="Destino" required {...d} value={datos.destino} onChange={txt("destino")} />
        <CampoTexto id="pr-carga" label="Fecha tentativa de carga" type="date" {...d} value={datos.fecha_tentativa_carga}
          onChange={txt("fecha_tentativa_carga")} />
        <CampoTexto id="pr-delivery" label="Delivery" {...d} value={datos.delivery} onChange={txt("delivery")} />
      </FormDialogSection>
      <FormDialogSection cols={1}>
        <CampoTexto id="pr-notas" label="Notas importantes" {...d} value={datos.notas} onChange={txt("notas")} />
      </FormDialogSection>
    </>
  );
}
