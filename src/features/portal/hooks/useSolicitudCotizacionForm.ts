/**
 * Estado del formulario de "Solicitar cotización" del portal.
 * v13.821.7 — extraído del diálogo para bajar complejidad y tamaño (Power of 10).
 */
import { useMemo, useState } from "react";
import type { ModoTransporte, TipoOperacion } from "@/constants/wizardConstants";
import { leerSolicitudPreferencias } from "@/features/portal/domain/solicitudPreferencias";

export function useSolicitudCotizacionForm(clienteId?: string) {
  // Se recuerda la última elección del cliente.
  const prefsIniciales = useMemo(() => leerSolicitudPreferencias(), []);
  const [modo, setModo] = useState<ModoTransporte>(prefsIniciales.modo as ModoTransporte);
  const [tipo, setTipo] = useState<TipoOperacion>(prefsIniciales.tipo as TipoOperacion);
  const [tipoEmbarque, setTipoEmbarque] = useState<string>(prefsIniciales.tipoEmbarque);
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [mercancia, setMercancia] = useState("");
  const [notas, setNotas] = useState("");
  const [intentoEnvio, setIntentoEnvio] = useState(false);

  const origenVacio = origen.trim() === "";
  const destinoVacio = destino.trim() === "";
  const puedeEnviar = Boolean(clienteId) && !origenVacio && !destinoVacio;

  const isDirty =
    !origenVacio ||
    !destinoVacio ||
    mercancia.trim() !== "" ||
    notas.trim() !== "" ||
    modo !== prefsIniciales.modo ||
    tipo !== prefsIniciales.tipo ||
    tipoEmbarque !== prefsIniciales.tipoEmbarque;

  const faltantes = useMemo(() => {
    const items: string[] = [];
    if (origenVacio) items.push("Origen");
    if (destinoVacio) items.push("Destino");
    if (!clienteId) items.push("Cuenta vinculada");
    return items;
  }, [origenVacio, destinoVacio, clienteId]);

  const reset = () => {
    const prefs = leerSolicitudPreferencias();
    setModo(prefs.modo as ModoTransporte);
    setTipo(prefs.tipo as TipoOperacion);
    setTipoEmbarque(prefs.tipoEmbarque);
    setOrigen("");
    setDestino("");
    setMercancia("");
    setNotas("");
    setIntentoEnvio(false);
  };

  return {
    modo, setModo,
    tipo, setTipo,
    tipoEmbarque, setTipoEmbarque,
    origen, setOrigen,
    destino, setDestino,
    mercancia, setMercancia,
    notas, setNotas,
    intentoEnvio, setIntentoEnvio,
    origenVacio, destinoVacio,
    puedeEnviar, isDirty, faltantes, reset,
  };
}
