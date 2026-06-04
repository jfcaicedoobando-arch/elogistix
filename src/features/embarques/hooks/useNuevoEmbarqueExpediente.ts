import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import type { ExpedienteCliente } from "@/features/embarques/hooks/useEmbarques";

type ModoExpediente = "nuevo" | "existente";

/**
 * El wizard usa varios esquemas (`NuevoEmbarqueValues`, `EditarEmbarqueValues`)
 * y este hook sólo necesita escribir `blMaster`. `FieldValues` de RHF es el
 * supertipo correcto para aceptar cualquiera de ellos sin recurrir a `any`.
 */
interface Params<TForm extends FieldValues> {
  methods: UseFormReturn<TForm>;
  clienteId: string | undefined | null;
}

/**
 * Estado del expediente del wizard (modo nuevo/existente + selección).
 * Resetea al cambiar de cliente y sincroniza `blMaster` del form.
 *
 * Genérico sobre el schema de RHF para soportar tanto el form de nuevo
 * embarque como el de edición sin recurrir a `any`.
 */
export function useNuevoEmbarqueExpediente<TForm extends FieldValues>({
  methods,
  clienteId,
}: Params<TForm>) {
  const [modoExpediente, setModoExpediente] = useState<ModoExpediente>("nuevo");
  const [expedienteSeleccionado, setExpedienteSeleccionado] =
    useState<ExpedienteCliente | null>(null);

  const prevClienteRef = useRef(clienteId);
  useEffect(() => {
    if (clienteId !== prevClienteRef.current) {
      prevClienteRef.current = clienteId;
      setModoExpediente("nuevo");
      setExpedienteSeleccionado(null);
    }
  }, [clienteId]);

  // setValue espera un path tipado de TForm; `blMaster` no es parte de la
  // unión común a todos los schemas, por lo que escribimos vía cast puntual.
  const setBlMaster = useCallback(
    (value: string) => {
      (methods.setValue as (name: string, value: unknown) => void)(
        "blMaster",
        value,
      );
    },
    [methods],
  );

  const handleModoExpedienteChange = useCallback(
    (nuevoModo: ModoExpediente) => {
      setModoExpediente(nuevoModo);
      if (nuevoModo === "nuevo") {
        setExpedienteSeleccionado(null);
        setBlMaster("");
      }
    },
    [setBlMaster],
  );

  const handleSeleccionarExpediente = useCallback(
    (exp: ExpedienteCliente) => {
      setExpedienteSeleccionado(exp);
      setBlMaster(exp.bl_master || "");
    },
    [setBlMaster],
  );

  const clearExpediente = useCallback(() => {
    setModoExpediente("nuevo");
    setExpedienteSeleccionado(null);
  }, []);

  return {
    modoExpediente,
    expedienteSeleccionado,
    handleModoExpedienteChange,
    handleSeleccionarExpediente,
    clearExpediente,
  };
}
