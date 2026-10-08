import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { crearAgenteProvisional } from "@/features/proveedor/services/altaProvisional";

const VACIO = { nombre: "", pais: "CN", contacto: "", email: "" };

export function useAgenteProvisionalDialog(onCreado: (agenteId: string) => void) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(VACIO);
  const qc = useQueryClient();
  const crear = useMutation({
    mutationFn: () => crearAgenteProvisional(f),
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: queryKeys.costeo.agentes.all });
      qc.invalidateQueries({ queryKey: queryKeys.proveedores.all });
      notifySuccess(undefined, { title: "Agente provisional creado — Contabilidad debe aprobarlo." });
      onCreado(id);
      setF(VACIO);
      setOpen(false);
    },
    onError: (e: unknown) => notifyError(undefined, {
      title: "No se pudo crear el agente",
      description: e instanceof Error ? e.message : undefined,
      error: e,
      method: "FEATURES_COSTEO_AGENTE_PROVISIONAL_1",
    }),
  });

  return { open, setOpen, f, setF, crear, puede: f.nombre.trim().length >= 2 && !crear.isPending };
}
