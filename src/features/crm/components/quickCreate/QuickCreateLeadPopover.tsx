/**
 * QuickCreateLeadPopover — alta express de lead (empresa + email/teléfono).
 * Para campos completos usar "Más campos" que abre el dialog clásico.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useCrearLead } from "@/features/crm/hooks";

import { notifyError } from "@/lib/ui/appFeedback";
import { SectionHeading } from "@/components/shared/SectionHeading";
interface Props {
  onCreated: (id: string) => void;
  onMore: () => void;
  onClose: () => void;
}

export default function QuickCreateLeadPopover({ onCreated, onMore, onClose }: Props) {
  const { user } = useAuth();
  const crear = useCrearLead();
  const [empresa, setEmpresa] = useState("");
  const [contacto, setContacto] = useState("");

  const submit = async () => {
    const emp = empresa.trim();
    if (!emp) return notifyError(undefined, { title: "Empresa requerida", method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATELEADPOPOVER_1" });
    try {
      const r = await crear.mutateAsync({
        empresa: emp,
        contacto: "",
        email: contacto.includes("@") ? contacto : "",
        telefono: contacto.includes("@") ? "" : contacto,
        fuente: "Otro",
        estado: "Nuevo",
        vendedor_id: user?.id ?? null,
        vendedor_email: user?.email ?? "",
      });
      notifySuccess(undefined, { title: "Lead creado", duration: 2000 });
      setEmpresa(""); setContacto("");
      onClose();
      onCreated(r.id);
    } catch (e) {
      notifyError(undefined, { title: e instanceof Error ? e.message : "Error al crear", error: e, method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATELEADPOPOVER_2" });
    }
  };

  return (
    <div className="space-y-3 w-72">
      <SectionHeading as="h3">Nuevo lead</SectionHeading>
      <div className="space-y-1">
        <Label className="text-xs">Empresa *</Label>
        <Input autoFocus value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Acme Logistics" onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Email o teléfono</Label>
        <Input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="ana@acme.com o 555..." onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
      </div>
      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={onMore} className="text-xs">Más campos →</Button>
        <Button size="sm" onClick={submit} disabled={crear.isPending}>
          {crear.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Crear
        </Button>
      </div>
    </div>
  );
}
