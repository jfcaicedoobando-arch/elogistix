/**
 * Diálogo para crear un nuevo Lead (CRM Fase 2).
 * Formulario simple — los campos avanzados se editan en LeadDetalle.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { crmToast } from "@/features/crm/lib/crmToast";
import { useAuth } from "@/contexts/AuthContext";
import { useCrearLead } from "@/features/crm/hooks";
import { useCrearActividad } from "@/features/crm/hooks";
import { NuevoLeadForm, type LeadFormState } from "./nuevoLead/NuevoLeadForm";

import { ERROR_CODES } from "@/lib/domain/errorCatalog";
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

const EMPTY: LeadFormState = {
  empresa: "",
  contacto: "",
  email: "",
  telefono: "",
  ciudad: "",
  pais: "México",
  fuente: "Otro",
  estado: "Nuevo",
  interes_modo: "",
  notas: "",
  vendedor_id: null,
  vendedor_email: "",
};

export default function NuevoLeadDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState<LeadFormState>(() => ({
    ...EMPTY, vendedor_id: user?.id ?? null, vendedor_email: user?.email ?? "",
  }));
  const [autoActividad, setAutoActividad] = useState(true);
  const crear = useCrearLead();
  const crearActividad = useCrearActividad();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!form.empresa.trim()) {
      notifyError(toast, { title: "Empresa es obligatoria", method: "HANDLE_SUBMIT", errorCode: ERROR_CODES.VALIDATION_FAILED });
      return;
    }
    try {
      const r = await crear.mutateAsync(form);
      if (autoActividad) {
        const manana = new Date();
        manana.setDate(manana.getDate() + 1);
        manana.setHours(9, 0, 0, 0);
        await crearActividad.mutateAsync({
          tipo: "llamada",
          asunto: `Primer contacto: ${form.empresa}`,
          descripcion: "Actividad creada automáticamente al alta del lead.",
          entidad_tipo: "lead",
          entidad_id: r.id,
          fecha_programada: manana.toISOString(),
        }).catch(() => undefined);
      }
      crmToast.success("Lead creado");
      setForm(EMPTY);
      onOpenChange(false);
      onCreated?.(r.id);
    } catch (e) {
      notifyError(toast, {
        title: "No se pudo crear el lead",
        description: e instanceof Error ? e.message : undefined,
        error: e,
        method: "HANDLE_SUBMIT",
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setForm(EMPTY);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Nuevo Lead</DialogTitle>
          <DialogDescription>
            Captura los datos básicos del prospecto. Podrás convertirlo a cliente y oportunidad desde su ficha.
          </DialogDescription>
        </DialogHeader>

        <NuevoLeadForm
          form={form}
          setForm={setForm}
          autoActividad={autoActividad}
          setAutoActividad={setAutoActividad}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={crear.isPending}>
            {crear.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Crear lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
