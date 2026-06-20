import { useMemo, useState } from "react";
import { useAdminOrganizations, useCreateOrganization } from "@/features/admin/hooks/useAdminData";
import { uniqueSorted } from "@/lib/utils/uniqueSorted";

export function useAdminOrganizacionesController() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [rfc, setRfc] = useState("");
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("todos");
  const [estadoFilter, setEstadoFilter] = useState("todos");

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

  // 13.85.10 — Toasts viven en `useCreateOrganization`. Aquí sólo cerramos el dialog y limpiamos inputs.
  const handleCreate = () => {
    createOrg.mutate({ nombre, rfc }, {
      onSuccess: () => {
        setDialogOpen(false);
        setNombre("");
        setRfc("");
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
