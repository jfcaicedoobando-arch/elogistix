/**
 * Controlador del diálogo de asignación de responsable a un hallazgo.
 * Encapsula estado local, resolución de email y submit (asignar / tomar / quitar).
 */
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAsignarResponsable,
  useOrgMembersAsignables,
} from "@/hooks/auditoria";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/types/auditoria";

export const SIN_RESPONSABLE = "__sin__";

interface Args {
  hallazgo: HallazgoAuditoria | null;
  revisionExistente: AuditoriaRevision | null;
  open: boolean;
  onClose: () => void;
}

export function useAsignarResponsableController({
  hallazgo,
  revisionExistente,
  open,
  onClose,
}: Args) {
  const { user } = useAuth();
  const { data: asignables = [], isLoading: loadingUsers } = useOrgMembersAsignables();
  const asignar = useAsignarResponsable();

  const [responsableId, setResponsableId] = useState<string>(SIN_RESPONSABLE);
  const [fechaLimite, setFechaLimite] = useState<Date | undefined>();

  useEffect(() => {
    if (!open) return;
    setResponsableId(revisionExistente?.responsable_id ?? SIN_RESPONSABLE);
    setFechaLimite(
      revisionExistente?.fecha_limite
        ? new Date(`${revisionExistente.fecha_limite}T00:00:00`)
        : undefined,
    );
  }, [open, revisionExistente]);

  const optEmail = (id: string) =>
    asignables.find((a) => a.id === id)?.email ?? "";

  const submit = async (tomar = false) => {
    if (!hallazgo) return;
    const id = tomar
      ? user?.id ?? null
      : responsableId === SIN_RESPONSABLE
        ? null
        : responsableId;
    const email = tomar
      ? user?.email ?? ""
      : id
        ? optEmail(id) || revisionExistente?.responsable_email || ""
        : "";
    await asignar.mutateAsync({
      hallazgo,
      responsableId: id,
      responsableEmail: email,
      fechaLimite: fechaLimite ? format(fechaLimite, "yyyy-MM-dd") : null,
      tomar,
    });
    onClose();
  };

  return {
    user,
    asignables,
    loadingUsers,
    responsableId,
    setResponsableId,
    fechaLimite,
    setFechaLimite,
    submit,
    cargando: asignar.isPending,
    yaAsignado: !!revisionExistente?.responsable_id,
    yoSoyResponsable: revisionExistente?.responsable_id === user?.id,
  };
}
