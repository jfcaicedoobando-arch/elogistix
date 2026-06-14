import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { useMemo, useState } from "react";
import { useToast } from "@/hooks/shared";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { useAdminOrganizations, useCreateOrganization } from "@/features/admin/hooks/useAdminData";
import { uniqueSorted } from "@/lib/utils/uniqueSorted";

export function useAdminOrganizacionesController() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [rfc, setRfc] = useState("");
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("todos");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const { toast } = useToast();

  const { data: orgs = [], isLoading } = useAdminOrganizations();
  const createOrg = useCreateOrganization();

  const planes = useMemo(() => uniqueSorted(orgs, (o) => o.plan), [orgs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orgs.filter((o) => {
      if (planFilter !== "todos" && o.plan !== planFilter) return false;
      if (estadoFilter === "activas" && !o.activo) return false;
      if (estadoFilter === "inactivas" && o.activo) return false;
      if (q && !o.nombre.toLowerCase().includes(q) && !o.rfc?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [orgs, search, planFilter, estadoFilter]);

  const handleCreate = () => {
    createOrg.mutate({ nombre, rfc }, {
      onSuccess: () => {
        notifySuccess(toast, { title: "Organización creada" });
        setDialogOpen(false);
        setNombre("");
        setRfc("");
      },
      onError: (err: Error) => {
        notifyError(toast, { title: "Error", description: err.message, method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED });
      },
    });
  };

  return {
    state: { dialogOpen, nombre, rfc, search, planFilter, estadoFilter },
    setters: {
      setDialogOpen,
      setNombre,
      setRfc,
      setSearch,
      setPlanFilter,
      setEstadoFilter,
    },
    data: { orgs, filtered, planes, isLoading },
    createOrg: { mutate: handleCreate, isPending: createOrg.isPending },
  };
}
