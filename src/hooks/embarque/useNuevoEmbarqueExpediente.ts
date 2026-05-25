import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import type { ExpedienteCliente } from "@/hooks/embarque/useEmbarques";

type ModoExpediente = "nuevo" | "existente";

/**
 * El wizard usa varios esquemas (`NuevoEmbarqueValues`, `EditarEmbarqueValues`)
 * y este hook sólo necesita escribir `blMaster`. `FieldValues` de RHF es el
 * supertipo correcto para aceptar cualquiera de ellos sin recurrir a `any`.
 */
interface Params {
  methods: UseFormReturn<FieldValues>;
  clienteId: string | undefined | null;
}

/**
 * Estado del expediente del wizard (modo nuevo/existente + selección).
 * Resetea al cambiar de cliente y sincroniza `blMaster` del form.
 */
export function useNuevoEmbarqueExpediente({ methods, clienteId }: Params) {
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

  const handleModoExpedienteChange = useCallback(
    (nuevoModo: ModoExpediente) => {
      setModoExpediente(nuevoModo);
      if (nuevoModo === "nuevo") {
        setExpedienteSeleccionado(null);
        methods.setValue("blMaster", "");
      }
    },
    [methods],
  );

  const handleSeleccionarExpediente = useCallback(
    (exp: ExpedienteCliente) => {
      setExpedienteSeleccionado(exp);
      methods.setValue("blMaster", exp.bl_master || "");
    },
    [methods],
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
