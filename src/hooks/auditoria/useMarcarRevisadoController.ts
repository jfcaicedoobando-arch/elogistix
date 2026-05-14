/**
 * Controlador del diálogo "Marcar revisado / atender hallazgo".
 * Concentra estado local de los tres tabs (acción, comentarios, snooze) y handlers.
 */
import { useEffect, useMemo, useState } from "react";
import {
  useDesmarcarRevisado,
  useMarcarRevisado,
} from "@/hooks/auditoria/useAuditoriaRevisiones";
import {
  useAuditoriaComentarios,
  useAgregarComentarioAuditoria,
} from "@/hooks/auditoria/useAuditoriaComentarios";
import {
  useQuitarSnooze,
  useSnoozeHallazgo,
} from "@/hooks/auditoria/useSnoozeHallazgo";
import {
  isSnoozeActivo,
  minSnoozeDate as computeMinSnoozeDate,
} from "@/lib/domain/auditoria";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/types/auditoria";

interface Args {
  hallazgo: HallazgoAuditoria | null;
  revisionExistente: AuditoriaRevision | null;
  open: boolean;
  onClose: () => void;
}

export function useMarcarRevisadoController({
  hallazgo,
  revisionExistente,
  open,
  onClose,
}: Args) {
  const [accion, setAccion] = useState("");
  const [comentario, setComentario] = useState("");
  const [snoozeHasta, setSnoozeHasta] = useState("");
  const [snoozeMotivo, setSnoozeMotivo] = useState("");

  const marcar = useMarcarRevisado();
  const desmarcar = useDesmarcarRevisado();
  const snooze = useSnoozeHallazgo();
  const quitarSnooze = useQuitarSnooze();
  const agregarComentario = useAgregarComentarioAuditoria();

  const { data: comentarios, isLoading: loadingComentarios } =
    useAuditoriaComentarios(revisionExistente?.id);

  useEffect(() => {
    if (!open) return;
    setAccion(revisionExistente?.accion_tomada ?? "");
    setComentario("");
    setSnoozeHasta(revisionExistente?.snoozed_until ?? "");
    setSnoozeMotivo(revisionExistente?.snooze_motivo ?? "");
  }, [open, revisionExistente]);

  const minSnoozeDateValue = useMemo(() => minSnoozeDate(), []);

  const yaRevisado =
    !!revisionExistente && revisionExistente.estado_revision === "revisado";
  const cargando =
    marcar.isPending ||
    desmarcar.isPending ||
    snooze.isPending ||
    quitarSnooze.isPending;
  const snoozeActivo = isSnoozeActivo(revisionExistente?.snoozed_until);

  const handleGuardar = async () => {
    if (!hallazgo) return;
    const trimmed = accion.trim();
    if (!trimmed) return;
    await marcar.mutateAsync({ hallazgo, accionTomada: trimmed });
    onClose();
  };

  const handleEliminar = async () => {
    if (!revisionExistente) return;
    await desmarcar.mutateAsync(revisionExistente.id);
    onClose();
  };

  const handleAgregarComentario = async () => {
    if (!revisionExistente?.id || !comentario.trim()) return;
    await agregarComentario.mutateAsync({
      revisionId: revisionExistente.id,
      contenido: comentario.trim(),
    });
    setComentario("");
  };

  const handleSnooze = async () => {
    if (!hallazgo || !snoozeHasta || !snoozeMotivo.trim()) return;
    await snooze.mutateAsync({
      hallazgo,
      snoozedUntil: snoozeHasta,
      motivo: snoozeMotivo.trim(),
    });
    onClose();
  };

  const handleQuitarSnooze = async () => {
    if (!revisionExistente?.id) return;
    await quitarSnooze.mutateAsync(revisionExistente.id);
    onClose();
  };

  return {
    // estado
    accion,
    setAccion,
    comentario,
    setComentario,
    snoozeHasta,
    setSnoozeHasta,
    snoozeMotivo,
    setSnoozeMotivo,
    minSnoozeDate,
    // datos
    comentarios,
    loadingComentarios,
    // flags
    yaRevisado,
    cargando,
    snoozeActivo,
    // pendings individuales (para spinners locales)
    marcando: marcar.isPending,
    desmarcando: desmarcar.isPending,
    snoozeando: snooze.isPending,
    agregandoComentario: agregarComentario.isPending,
    // handlers
    handleGuardar,
    handleEliminar,
    handleAgregarComentario,
    handleSnooze,
    handleQuitarSnooze,
  };
}
