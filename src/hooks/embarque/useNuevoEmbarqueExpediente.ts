import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { ExpedienteCliente } from "@/hooks/embarque/useEmbarques";

type ModoExpediente = "nuevo" | "existente";

interface Params {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  methods: UseFormReturn<any>;
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
