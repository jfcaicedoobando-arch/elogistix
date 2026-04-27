import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { dialogSize, scrollableDialog } from "@/lib/ui/dialogTokens";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { TablesInsert } from "@/integrations/supabase/types";
import {
  TIPOS_PROVEEDOR as TIPOS,
  MONEDAS_PROVEEDOR as MONEDAS,
  PAISES_PROVEEDOR as PAISES,
} from "@/constants/proveedorConstants";
import DocumentChecklist from "@/components/shared/DocumentChecklist";
import { useNuevoProveedorController } from "@/hooks/proveedor/useNuevoProveedorController";
import type { Enums } from "@/integrations/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: TablesInsert<"proveedores">) => void;
}

export default function NuevoProveedorDialog({ open, onOpenChange, onSave }: Props) {
  const c = useNuevoProveedorController(onSave, () => onOpenChange(false));

  return (
    <Dialog open={open} onOpenChange={(abierto) => { if (!abierto) c.resetAndClose(); else onOpenChange(abierto); }}>
      <DialogContent className={cn(dialogSize.md, scrollableDialog)}>
        <DialogHeader>
          <DialogTitle>Nuevo Proveedor — Paso {c.step} de 2</DialogTitle>
        </DialogHeader>

        {c.step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Origen *</Label>
              <Select value={c.form.origen_proveedor || ""} onValueChange={(v) => c.setField("origen_proveedor", v as "Nacional" | "Extranjero")}>
                <SelectTrigger><SelectValue placeholder="Selecciona origen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Nacional">Nacional</SelectItem>
                  <SelectItem value="Extranjero">Extranjero</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={c.form.nombre} onChange={(e) => c.setField("nombre", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={c.form.tipo} onValueChange={c.handleTipoChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {c.isAgenteCarga && (
              <div className="space-y-2">
                <Label>País *</Label>
                <Select value={c.form.pais || ""} onValueChange={(v) => { c.setField("pais", v); c.setField("rfc", ""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un país" /></SelectTrigger>
                  <SelectContent>
                    {PAISES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(!c.isAgenteCarga || c.form.pais) && (
              <div className="space-y-2">
                <Label>{c.rfcLabel} *</Label>
                <Input
                  value={c.form.rfc}
                  onChange={(e) => c.setField("rfc", e.target.value)}
                  placeholder={c.form.origen_proveedor === "Extranjero" ? "Ingresa el Tax ID" : "Ingresa el RFC"}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Contacto</Label>
              <Input value={c.form.contacto} onChange={(e) => c.setField("contacto", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={c.form.email} onChange={(e) => c.setField("email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={c.form.telefono} onChange={(e) => c.setField("telefono", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Moneda Preferida</Label>
              <Select value={c.form.moneda_preferida} onValueChange={(v) => c.setField("moneda_preferida", v as Enums<"moneda">)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONEDAS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {c.step === 2 && (
          <DocumentChecklist
            documentos={c.documentos}
            onFileChange={c.handleFileChange}
            descripcion={`Documentos requeridos para proveedor ${c.form.origen_proveedor}. Puedes adjuntarlos ahora o después.`}
          />
        )}

        <DialogFooter>
          {c.step === 1 && (
            <>
              <Button variant="outline" onClick={c.resetAndClose}>Cancelar</Button>
              <Button onClick={c.handleNext} disabled={!c.isStep1Valid}>
                Siguiente <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
          {c.step === 2 && (
            <>
              <Button variant="outline" onClick={() => c.setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
              </Button>
              <Button onClick={c.handleSave}>Crear</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
