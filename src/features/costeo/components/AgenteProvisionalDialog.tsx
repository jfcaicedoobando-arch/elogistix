/**
 * Alta provisional de un agente desde Nueva tarifa. Crea el proveedor en estado
 * provisional + el agente ligado; Contabilidad lo aprueba después.
 */
import { useState } from "react";
import { UserPlus, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { crearAgenteProvisional } from "@/features/proveedor/services/altaProvisional";

interface Props { onCreado: (agenteId: string) => void }

const VACIO = { nombre: "", pais: "CN", contacto: "", email: "" };

export function AgenteProvisionalDialog({ onCreado }: Props) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(VACIO);
  const qc = useQueryClient();
  const crear = useMutation({
    mutationFn: () => crearAgenteProvisional(f),
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: queryKeys.costeo.agentes.all });
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
  const puede = f.nombre.trim().length >= 2 && !crear.isPending;
  const campo = (k: keyof typeof VACIO, label: string, ph?: string) => (
    <div>
      <Label htmlFor={`ag-prov-${k}`}>{label}</Label>
      <Input id={`ag-prov-${k}`} value={f[k]} placeholder={ph}
        onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  );

  return (
    <>
      <Button type="button" variant="ghost" size="sm"
        className="mt-1 h-7 px-1 text-label text-muted-foreground" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-3 w-3" /> Agente provisional
      </Button>
      <FormDialogShell
        open={open}
        onOpenChange={setOpen}
        icon={UserPlus}
        title="Agente provisional"
        description="Úsalo para capturar la tarifa ahora. Contabilidad completará sus datos y lo aprobará como proveedor."
        size="sm"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" disabled={!puede} onClick={() => crear.mutate()}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-3">
          {campo("nombre", "Nombre *", "Ej. Shenzhen Logistics Co.")}
          {campo("pais", "País (código)", "CN")}
          {campo("contacto", "Contacto")}
          {campo("email", "Correo")}
        </div>
      </FormDialogShell>
    </>
  );
}
