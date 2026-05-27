import { useCallback, useState } from "react";
import { useToast } from "@/hooks/shared";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  useJsonCargoBolLookup,
  type BolLookupResponse,
} from "@/hooks/embarque/useJsonCargoBolLookup";
import { useSyncJsonCargo, PrefixMismatchError } from "@/hooks/embarque/useJsonCargoTracking";
import { useActualizarContenedorEmbarque } from "@/hooks/embarque/mutations/useActualizarContenedorEmbarque";

import { ERROR_CODES } from "@/lib/domain/errorCatalog";
interface Args {
  embarqueId: string;
  naviera: string | null;
  contenedorActual: string | null;
  onClose: () => void;
}

export function useDialogBolContainers({ embarqueId, naviera, contenedorActual, onClose }: Args) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const lookup = useJsonCargoBolLookup();
  const sync = useSyncJsonCargo();
  const actualizarContenedor = useActualizarContenedorEmbarque();
  const [result, setResult] = useState<BolLookupResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(contenedorActual ?? null);
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    setResult(null);
    setSelected(contenedorActual ?? null);
  }, [contenedorActual]);

  const handleBuscar = async () => {
    try {
      const res = await lookup.mutateAsync(embarqueId);
      setResult(res);
      if (!res.ok) {
        notifyError(toast, {
          title: "No se pudo consultar BL",
          description: res.error ?? "Error desconocido",
          method: "HANDLE_BUSCAR",
          errorCode: ERROR_CODES.VALIDATION_FAILED,
        });
        return;
      }
      if (contenedorActual && res.associated_container_numbers?.includes(contenedorActual)) {
        setSelected(contenedorActual);
      } else if ((res.associated_container_numbers?.length ?? 0) === 1) {
        setSelected(res.associated_container_numbers![0]);
      }
    } catch (err) {
      notifyError(toast, {
        title: "Error en consulta BL",
        description: err instanceof Error ? err.message : "Error desconocido",
        error: err,
        method: "HANDLE_BUSCAR",
      });
    }
  };

  const handleGuardar = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await actualizarContenedor.mutateAsync({ embarqueId, contenedor: selected });

      try {
        const syncRes = await sync.mutateAsync({
          embarqueId,
          contenedor: selected,
          naviera,
        });
        if (syncRes.ok) {
          notifySuccess(toast, {
            title: "Contenedor guardado y sincronizado",
            description: syncRes.eventos_creados
              ? `${syncRes.eventos_creados} evento(s) nuevo(s).`
              : "Tracking actualizado.",
          });
        } else {
          notifySuccess(toast, {
            title: "Contenedor guardado",
            description: syncRes.error ?? "Sincronización pendiente.",
          });
        }
      } catch (syncErr) {
        if (syncErr instanceof PrefixMismatchError) {
          notifyError(toast, {
            title: "Contenedor guardado, pero prefix no coincide",
            description: `Prefix ${syncErr.prefix} no corresponde a ${naviera ?? "—"}.`,
          });
        } else {
          notifyError(toast, {
            title: "Contenedor guardado, error al sincronizar",
            description: syncErr instanceof Error ? syncErr.message : "Error",
            method: "HANDLE_GUARDAR",
            errorCode: ERROR_CODES.VALIDATION_FAILED,
          });
        }
      }

      qc.invalidateQueries({ queryKey: queryKeys.embarques.detail(embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.jsonCargo.byEmbarque(embarqueId) });
      onClose();
    } catch (err) {
      notifyError(toast, {
        title: "No se pudo guardar el contenedor",
        description: err instanceof Error ? err.message : "Error",
        error: err,
        method: "HANDLE_GUARDAR",
      });
    } finally {
      setSaving(false);
    }
  };

  return {
    result,
    selected,
    setSelected,
    saving,
    lookupPending: lookup.isPending,
    handleBuscar,
    handleGuardar,
    reset,
  };
}
