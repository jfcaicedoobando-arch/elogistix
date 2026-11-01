/** Estado del formulario de "Solicitar cotización" del portal. */
import { useMemo, useState, type SetStateAction } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MODOS, TIPOS, type ModoTransporte, type TipoOperacion } from "@/constants/wizardConstants";
import { leerSolicitudPreferencias } from "@/features/portal/domain/solicitudPreferencias";
import { esModoMaritimoSolicitud } from "@/features/portal/domain/solicitudRuta";

const solicitudSchema = z.object({
  modo: z.enum(MODOS),
  tipo: z.enum(TIPOS),
  tipoEmbarque: z.string(),
  origen: z.string().refine((texto) => texto.trim() !== "", "Origen"),
  destino: z.string().refine((texto) => texto.trim() !== "", "Destino"),
  puertoOrigenId: z.string().nullable(),
  puertoDestinoId: z.string().nullable(),
  mercancia: z.string(),
  notas: z.string(),
});
type SolicitudInput = z.input<typeof solicitudSchema>;
type SolicitudOutput = z.output<typeof solicitudSchema>;

function valoresIniciales(): SolicitudInput {
  const prefs = leerSolicitudPreferencias();
  return {
    modo: solicitudSchema.shape.modo.catch("Marítimo").parse(prefs.modo),
    tipo: solicitudSchema.shape.tipo.catch("Importación").parse(prefs.tipo),
    tipoEmbarque: prefs.tipoEmbarque,
    origen: "", destino: "", puertoOrigenId: null, puertoDestinoId: null,
    mercancia: "", notas: "",
  };
}

export function useSolicitudCotizacionForm(clienteId?: string) {
  const [defaultValues] = useState(valoresIniciales);
  const { control, setValue, getValues, handleSubmit: submit, reset: resetForm, formState: { dirtyFields } } =
    useForm<SolicitudInput, undefined, SolicitudOutput>({
      defaultValues,
      resolver: zodResolver(solicitudSchema),
      mode: "onBlur",
    });
  const [modo, tipo, tipoEmbarque, origen, destino, puertoOrigenId, puertoDestinoId, mercancia, notas] =
    useWatch({ control, name: ["modo", "tipo", "tipoEmbarque", "origen", "destino", "puertoOrigenId", "puertoDestinoId", "mercancia", "notas"] });
  const [intentoEnvio, setIntentoEnvio] = useState(false);

  /** Al salir de Marítimo se conserva el texto y se limpian los IDs. */
  const setModo = (nuevo: ModoTransporte) => {
    setValue("modo", nuevo, { shouldDirty: true });
    if (!esModoMaritimoSolicitud(nuevo)) {
      setValue("puertoOrigenId", null);
      setValue("puertoDestinoId", null);
    }
  };
  const setTipo = (nuevo: SetStateAction<TipoOperacion>) =>
    setValue("tipo", typeof nuevo === "function" ? nuevo(getValues("tipo")) : nuevo, { shouldDirty: true });
  const setTipoEmbarque = (nuevo: SetStateAction<string>) =>
    setValue("tipoEmbarque", typeof nuevo === "function" ? nuevo(getValues("tipoEmbarque")) : nuevo, { shouldDirty: true });
  const setMercancia = (nuevo: SetStateAction<string>) =>
    setValue("mercancia", typeof nuevo === "function" ? nuevo(getValues("mercancia")) : nuevo, { shouldDirty: true });
  const setNotas = (nuevo: SetStateAction<string>) =>
    setValue("notas", typeof nuevo === "function" ? nuevo(getValues("notas")) : nuevo, { shouldDirty: true });

  const setOrigen = (texto: string, puertoId: string | null = null) => {
    setValue("origen", texto, { shouldDirty: true });
    setValue("puertoOrigenId", puertoId);
    if (puertoId && puertoId === getValues("puertoDestinoId")) setValue("puertoDestinoId", null);
  };
  const setDestino = (texto: string, puertoId: string | null = null) => {
    setValue("destino", texto, { shouldDirty: true });
    setValue("puertoDestinoId", puertoId);
    if (puertoId && puertoId === getValues("puertoOrigenId")) setValue("puertoOrigenId", null);
  };

  // La UI conserva su validación síncrona al enviar; el mismo esquema sirve
  // al resolver sin modificar el texto que recibe la mutación existente.
  const origenVacio = !solicitudSchema.shape.origen.safeParse(origen).success;
  const destinoVacio = !solicitudSchema.shape.destino.safeParse(destino).success;
  const puedeEnviar = Boolean(clienteId) && !origenVacio && !destinoVacio;
  // Texto sólo en blanco y los IDs auxiliares no activaban la confirmación.
  // RHF mantiene el baseline y revierte dirty al volver al valor inicial.
  const isDirty = Boolean(
    dirtyFields.modo || dirtyFields.tipo || dirtyFields.tipoEmbarque ||
    (dirtyFields.origen && origen.trim()) || (dirtyFields.destino && destino.trim()) ||
    (dirtyFields.mercancia && mercancia.trim()) || (dirtyFields.notas && notas.trim()),
  );
  const faltantes = useMemo(() => {
    const items: string[] = [];
    if (origenVacio) items.push("Origen");
    if (destinoVacio) items.push("Destino");
    if (!clienteId) items.push("Cuenta vinculada");
    return items;
  }, [origenVacio, destinoVacio, clienteId]);

  const reset = () => {
    // Se actualizan juntos los valores y el baseline a las preferencias vigentes.
    resetForm(valoresIniciales());
    setIntentoEnvio(false);
  };

  return {
    modo, setModo, tipo, setTipo, tipoEmbarque, setTipoEmbarque,
    origen, setOrigen, destino, setDestino, puertoOrigenId, puertoDestinoId,
    mercancia, setMercancia, notas, setNotas, intentoEnvio, setIntentoEnvio,
    origenVacio, destinoVacio, puedeEnviar, isDirty, faltantes, reset, submit,
  };
}
