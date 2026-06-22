import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { dialogSize, scrollableDialog } from "@/components/shared/utils/dialogTokens";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { REGIMENES_FISCALES_SAT } from "@/constants/regimenFiscalSAT";
import { USOS_CFDI_SAT } from "@/constants/catalogosSAT";

interface ClienteData {
  nombre: string;
  rfc: string;
  direccion: string;
  ciudad: string;
  estado: string;
  cp: string;
  contacto: string;
  email: string;
  telefono: string;
  regimen_fiscal: string;
  uso_cfdi_default: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: ClienteData;
  onSave: (data: ClienteData) => Promise<void>;
  isSaving: boolean;
}

export default function DialogEditarCliente({ open, onOpenChange, cliente, onSave, isSaving }: Props) {
  const [form, setForm] = useState<ClienteData>(cliente);

  useEffect(() => {
    if (open) setForm(cliente);
  }, [open, cliente]);

  const handleSubmit = async () => {
    if (!form.nombre.trim() || !form.regimen_fiscal.trim()) return;
    await onSave(form);
  };

  const faltanDatosCfdi = !form.regimen_fiscal.trim() || !form.uso_cfdi_default.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogSize.lg, scrollableDialog)}>
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>Modifica los datos generales y fiscales del cliente.</DialogDescription>
        </DialogHeader>

        {faltanDatosCfdi && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Faltan datos fiscales para CFDI 4.0 (régimen fiscal y/o uso CFDI). Sin estos datos no se podrá timbrar facturas a este cliente.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label className="text-xs">Nombre / Razón Social<span className="text-destructive ml-0.5">*</span></Label>
            <Input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} className="mt-1" />
          </div>
          <div><Label className="text-xs">RFC</Label><Input value={form.rfc} onChange={e => setForm(p => ({ ...p, rfc: e.target.value }))} className="mt-1" /></div>
          <div><Label className="text-xs">Código Postal</Label><Input value={form.cp} onChange={e => setForm(p => ({ ...p, cp: e.target.value }))} className="mt-1" /></div>
          <div className="col-span-2"><Label className="text-xs">Dirección</Label><Input value={form.direccion} onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))} className="mt-1" /></div>
          <div><Label className="text-xs">Ciudad</Label><Input value={form.ciudad} onChange={e => setForm(p => ({ ...p, ciudad: e.target.value }))} className="mt-1" /></div>
          <div><Label className="text-xs">Estado</Label><Input value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} className="mt-1" /></div>

          <div>
            <Label className="text-xs">Régimen Fiscal SAT<span className="text-destructive ml-0.5">*</span></Label>
            <Select value={form.regimen_fiscal || undefined} onValueChange={(v) => setForm(p => ({ ...p, regimen_fiscal: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona régimen" /></SelectTrigger>
              <SelectContent>
                {REGIMENES_FISCALES_SAT.map((r) => (
                  <SelectItem key={r.clave} value={r.clave}>{r.clave} — {r.descripcion}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Uso CFDI por defecto</Label>
            <Select value={form.uso_cfdi_default || undefined} onValueChange={(v) => setForm(p => ({ ...p, uso_cfdi_default: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona uso CFDI" /></SelectTrigger>
              <SelectContent>
                {USOS_CFDI_SAT.map((u) => (
                  <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div><Label className="text-xs">Contacto</Label><Input value={form.contacto} onChange={e => setForm(p => ({ ...p, contacto: e.target.value }))} className="mt-1" /></div>
          <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="mt-1" /></div>
          <div><Label className="text-xs">Teléfono</Label><Input value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.nombre.trim() || !form.regimen_fiscal.trim() || isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
