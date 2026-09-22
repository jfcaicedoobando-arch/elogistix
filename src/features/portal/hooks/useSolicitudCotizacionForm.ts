/**
 * Estado del formulario de "Solicitar cotización" del portal.
 * v13.821.7 — extraído del diálogo para bajar complejidad y tamaño (Power of 10).
 */
import { useMemo, useState } from "react";
import type { ModoTransporte, TipoOperacion } from "@/constants/wizardConstants";
import { leerSolicitudPreferencias } from "@/features/portal/domain/solicitudPreferencias";
import { esModoMaritimoSolicitud } from "@/features/portal/domain/solicitudRuta";

export function useSolicitudCotizacionForm(clienteId?: string) {
  // Se recuerda la última elección del cliente.
  const prefsIniciales = useMemo(() => leerSolicitudPreferencias(), []);
  const [modo, setModoRaw] = useState<ModoTransporte>(prefsIniciales.modo as ModoTransporte);
  const [tipo, setTipo] = useState<TipoOperacion>(prefsIniciales.tipo as TipoOperacion);
  const [tipoEmbarque, setTipoEmbarque] = useState<string>(prefsIniciales.tipoEmbarque);
  const [origen, setOrigenRaw] = useState("");
  const [destino, setDestinoRaw] = useState("");
  // Etapa 5: identidad de puerto opcional (sólo Marítimo, texto libre → null).
  const [puertoOrigenId, setPuertoOrigenId] = useState<string | null>(null);
  const [puertoDestinoId, setPuertoDestinoId] = useState<string | null>(null);
  const [mercancia, setMercancia] = useState("");
  const [notas, setNotas] = useState("");
  const [intentoEnvio, setIntentoEnvio] = useState(false);

  /** Al salir de Marítimo se conserva el texto y se limpian los IDs. */
  const setModo = (nuevo: ModoTransporte) => {
    setModoRaw(nuevo);
    if (!esModoMaritimoSolicitud(nuevo)) {
      setPuertoOrigenId(null);
      setPuertoDestinoId(null);
    }
  };

  const setOrigen = (texto: string, puertoId: string | null = null) => {
    setOrigenRaw(texto);
    setPuertoOrigenId(puertoId);
    if (puertoId && puertoId === puertoDestinoId) setPuertoDestinoId(null);
  };
  const setDestino = (texto: string, puertoId: string | null = null) => {
    setDestinoRaw(texto);
    setPuertoDestinoId(puertoId);
    if (puertoId && puertoId === puertoOrigenId) setPuertoOrigenId(null);
  };

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
    setModoRaw(prefs.modo as ModoTransporte);
    setTipo(prefs.tipo as TipoOperacion);
    setTipoEmbarque(prefs.tipoEmbarque);
    setOrigenRaw("");
    setDestinoRaw("");
    setPuertoOrigenId(null);
    setPuertoDestinoId(null);
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
    puertoOrigenId, puertoDestinoId,
    mercancia, setMercancia,
    notas, setNotas,
    intentoEnvio, setIntentoEnvio,
    origenVacio, destinoVacio,
    puedeEnviar, isDirty, faltantes, reset,
  };
}

