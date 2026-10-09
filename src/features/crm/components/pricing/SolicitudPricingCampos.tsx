/**
 * Campos que llena el solicitante (formato de Sheets de Pricing).
 */
import { useMemo } from "react";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { usePuertos, useTiposContenedor } from "@/features/catalogos/hooks";
import type { PuertoOption } from "@/features/catalogos";
import { useUsuariosOrgCrm } from "@/features/crm/hooks/usePricingCrm";
import { paisesDePuertos, puertoTrasCambioPais } from "@/features/crm/services/pricing/puertosPorPais";
import { CampoPuerto } from "./CampoPuerto";
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
  const { data: catalogo = [] } = usePuertos();
  const { data: tiposContenedor = [] } = useTiposContenedor();
  const opcionesContenedor = useMemo(
    () => tiposContenedor.map((t) => ({ value: t.name, label: t.name })),
    [tiposContenedor],
  );
  const puertos = catalogo as PuertoOption[];
  const paises = useMemo(() => paisesDePuertos(puertos), [puertos]);
  const txt = (campo: keyof DatosSolicitud) => (v: string) => set(campo, (v || null) as never);
  const d = { disabled };
  /** Cambio de país: limpia el puerto de ese extremo si ya no pertenece al país. */
  const cambiarPais = (campoPais: "origen" | "destino", campoPuerto: "pol" | "pod") => (v: string | null) => {
    set(campoPais, v);
    const puerto = puertoTrasCambioPais(puertos, v, datos[campoPuerto]);
    if (puerto !== datos[campoPuerto]) set(campoPuerto, puerto);
  };
  return (
    <>
      <FormDialogSection title="Datos generales">
        <CampoLista id="pr-solicitante" label="Solicitante" required {...d} value={datos.solicitante_id}
          opciones={usuarios.map((u) => ({ value: u.user_id, label: u.nombre }))}
          onChange={(v) => v && set("solicitante_id", v)} />
        <CampoTexto id="pr-fecha" label="Fecha" type="date" {...d} value={datos.fecha} onChange={txt("fecha")} />
        <CampoTexto id="pr-cliente" label="Cliente" {...d} value={datos.cliente} onChange={txt("cliente")} />
        <CampoLista id="pr-servicio" label="Modo de transporte" required {...d} value={datos.servicio}
          opciones={SERVICIOS_PRICING} onChange={(v) => set("servicio", v)} />
        <CampoLista id="pr-complejidad" label="Complejidad" {...d} value={datos.complejidad ?? "media"}
          opciones={COMPLEJIDADES} onChange={(v) => v && set("complejidad", v)} />
        <CampoLista id="pr-incoterm" label="Incoterm" {...d} value={datos.incoterm}
          opciones={INCOTERMS_PRICING} onChange={(v) => set("incoterm", v)} />
      </FormDialogSection>
      <FormDialogSection title="Carga">
        <CampoSiNo id="pr-imo" label="IMO" {...d} value={datos.imo} onChange={(v) => set("imo", v)} />
        <CampoTexto id="pr-commodity" label="Commodity" {...d} value={datos.commodity} onChange={txt("commodity")} />
        <CampoLista id="pr-type" label="Tipo de contenedor" {...d} value={datos.tipo_carga}
          opciones={opcionesContenedor} onChange={(v) => set("tipo_carga", v)} />
        <CampoTexto id="pr-qty" label="Quantity" type="number" {...d} value={datos.cantidad}
          onChange={(v) => { const n = aNumero(v); set("cantidad", n != null && n > 0 ? Math.trunc(n) : null); }} />
        <CampoSiNo id="pr-estibable" label="Estibable" {...d} value={datos.estibable} onChange={(v) => set("estibable", v)} />
        <CampoTexto id="pr-peso" label="Weight" {...d} value={datos.peso} onChange={txt("peso")} />
        <CampoLista id="pr-unidad-medida" label="Units of measurement" {...d} value={datos.unidad_medida}
          opciones={UNIDADES_MEDIDA_PRICING} onChange={(v) => set("unidad_medida", v)} />
        <CampoTexto id="pr-dim" label="Dimensions" {...d} value={datos.dimensiones} onChange={txt("dimensiones")} />
      </FormDialogSection>
      <FormDialogSection title="Ruta">
        <CampoLista id="pr-origen" label="País de Origen" required {...d} value={datos.origen}
          opciones={paises} onChange={cambiarPais("origen", "pol")} />
        <CampoPuerto id="pr-pol" label="Puerto origen" {...d} pais={datos.origen} value={datos.pol}
          puertos={puertos} excluirEtiqueta={datos.pod} onChange={(v) => set("pol", v)} />
        <CampoLista id="pr-destino" label="País de Destino" required {...d} value={datos.destino}
          opciones={paises} onChange={cambiarPais("destino", "pod")} />
        <CampoPuerto id="pr-pod" label="Puerto destino" {...d} pais={datos.destino} value={datos.pod}
          puertos={puertos} excluirEtiqueta={datos.pol} onChange={(v) => set("pod", v)} />
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
