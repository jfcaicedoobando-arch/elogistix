import { useRef, useState } from "react";
import { useGuardarValorCrm, type GuardarValorInput } from "./usePropiedadesCrm";
import { ConflictoValorCrm, type ValorCrm } from "../services/valoresCrm";

export type EstadoAutoguardado = "editando" | "guardando" | "guardado" | "error" | "conflicto";

/** Feedback por campo; la persistencia e invalidaciones siguen en el hook existente. */
export function useAutoguardadoPropiedadesCrm(registroId: string) {
  const guardar = useGuardarValorCrm(registroId);
  const [estados, setEstados] = useState<Record<string, EstadoAutoguardado>>({});
  const [confirmados, setConfirmados] = useState<Record<string, ValorCrm>>({});
  const revisiones = useRef(new Map<string, number>());

  const siguienteRevision = (id: string) => {
    const revision = (revisiones.current.get(id) ?? 0) + 1;
    revisiones.current.set(id, revision);
    return revision;
  };

  const editar = (id: string, tieneCambios: boolean) => {
    siguienteRevision(id);
    setEstados((prev) => {
      const siguientes = { ...prev };
      if (tieneCambios) siguientes[id] = "editando";
      else delete siguientes[id];
      return siguientes;
    });
  };

  const guardarCampo = async (input: GuardarValorInput) => {
    const id = input.propiedadId;
    const revision = siguienteRevision(id);
    setEstados((prev) => ({ ...prev, [id]: "guardando" }));
    const terminar = (estado: EstadoAutoguardado, confirmado?: ValorCrm) => {
      // Una respuesta anterior no confirma una captura o petición posterior.
      if (revisiones.current.get(id) === revision) {
        if (confirmado) {
          setConfirmados((prev) => ({ ...prev, [id]: confirmado }));
        }
        setEstados((prev) => ({ ...prev, [id]: estado }));
      }
    };
    try {
      const confirmado = await guardar.mutateAsync(input);
      terminar("guardado", confirmado);
      return true;
    } catch (error) {
      terminar(error instanceof ConflictoValorCrm ? "conflicto" : "error");
      return false;
    }
  };

  return { estados, confirmados, editar, guardarCampo, isPending: guardar.isPending };
}
