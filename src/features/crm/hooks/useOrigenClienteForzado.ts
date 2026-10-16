/**
 * Si la empresa asociada ya es cliente, el origen de la oportunidad queda fijo
 * en «Cliente»: un cliente nunca vuelve a ser prospecto de origen.
 */
import { useEffect } from "react";
import { useOrigenEmpresaConsulta } from "./useOrigenEmpresaConsulta";
import type { OportunidadFormState } from "@/features/crm/domain/oportunidadFormState";

export function useOrigenClienteForzado(
  form: OportunidadFormState,
  activo: boolean,
  setForm: React.Dispatch<React.SetStateAction<OportunidadFormState>>,
) {
  const consulta = useOrigenEmpresaConsulta(form.empresa_id, activo);
  const empresaId = form.empresa_id;
  const origen = consulta.origen;
  const clienteId = origen?.tipo === "cliente" ? origen.id : null;
  const clienteNombre = origen?.tipo === "cliente" ? origen.nombre : "";
  useEffect(() => {
    if (!activo || !clienteId) return;
    setForm((f) => (f.empresa_id !== empresaId || (
      f.origen_tipo === "cliente" && f.cliente_id === clienteId &&
      f.cliente_nombre === clienteNombre && !f.lead_id && !f.lead_nombre
    ) ? f : {
      ...f, origen_tipo: "cliente", lead_id: null, lead_nombre: "",
      cliente_id: clienteId, cliente_nombre: clienteNombre,
    }));
  }, [activo, empresaId, clienteId, clienteNombre, setForm]);
  // Sin cliente, se conserva la selección manual calificada del selector.
  const listo = consulta.listo && !consulta.clienteNoDisponible && (!clienteId || (
    form.origen_tipo === "cliente" && form.cliente_id === clienteId && !form.lead_id
  ));
  const puedeEnviar = () => {
    const datos = consulta.datosListos();
    if (!datos || (!datos.ok && datos.clienteId)) return false;
    const cliente = datos.ok && datos.origen.tipo === "cliente" ? datos.origen : null;
    return !cliente || (form.origen_tipo === "cliente" &&
      form.cliente_id === cliente.id && !form.lead_id);
  };
  return {
    ...consulta, listo, puedeEnviar,
    mensaje: consulta.clienteNoDisponible ? consulta.motivo : consulta.mensaje,
    clienteForzado: !!clienteId || consulta.clienteNoDisponible,
  };
}

export type OrigenClienteForzado = ReturnType<typeof useOrigenClienteForzado>;
