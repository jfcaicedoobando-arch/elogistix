import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Enums, TablesInsert } from "@/integrations/supabase/types";
type TipoProveedor = Enums<'tipo_proveedor'>;
type Moneda = Enums<'moneda'>;
import { TIPOS_PROVEEDOR as TIPOS, MONEDAS_PROVEEDOR as MONEDAS, PAISES_PROVEEDOR as PAISES } from "@/data/proveedorConstants";
import DocumentChecklist, { type DocumentoChecklist } from "@/components/DocumentChecklist";

const DOCS_NACIONAL = [
  'CIF', 'Opinión fiscal', 'Acta constitutiva', 'INE RL',
  'Poder notarial', 'Comprobante de domicilio', 'Datos bancarios',
];

const DOCS_EXTRANJERO = [
  'Certificado de ID', 'Comprobante de domicilio',
  'Documento que acredite su legalidad', 'Identificación del RL',
  'Datos bancarios', 'Poder notarial del RL',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: TablesInsert<"proveedores">) => void;
}

const emptyForm = {
  nombre: '',
  tipo: 'Naviera' as TipoProveedor,
  pais: '',
  rfc: '',
  contacto: '',
  email: '',
  telefono: '',
  moneda_preferida: 'MXN' as Moneda,
  origen_proveedor: null as 'Nacional' | 'Extranjero' | null,
};

export default function NuevoProveedorDialog({ open, onOpenChange, onSave }: Props) {
  const [form, setForm] = useState({ ...emptyForm });
  const [step, setStep] = useState<1 | 2>(1);
  const [documentos, setDocumentos] = useState<DocumentoChecklist[]>([]);

  const isAgenteCarga = form.tipo === 'Agente de Carga';
  const rfcLabel = form.origen_proveedor === 'Extranjero' ? 'Tax ID' : 'RFC';

  const isStep1Valid = () => {
    if (!form.nombre.trim()) return false;
    if (!form.origen_proveedor) return false;
    if (isAgenteCarga) {
      if (!form.pais) return false;
      if (!form.rfc.trim()) return false;
    } else {
      if (!form.rfc.trim()) return false;
    }
    return true;
  };

  const handleNext = () => {
    if (!isStep1Valid()) return;
    const docNames = form.origen_proveedor === 'Nacional' ? DOCS_NACIONAL : DOCS_EXTRANJERO;
    setDocumentos(docNames.map(nombre => ({ nombre, adjuntado: false })));
    setStep(2);
  };

  const handleFileChange = (docNombre: string, file: File | undefined) => {
    setDocumentos(prev =>
      prev.map(d => d.nombre === docNombre ? { ...d, archivo: file?.name, adjuntado: !!file } : d)
    );
  };

  const handleSave = () => {
    onSave(form);
    resetAndClose();
  };

  const resetAndClose = () => {
    setForm({ ...emptyForm });
    setStep(1);
    setDocumentos([]);
    onOpenChange(false);
  };

  const handleTipoChange = (valorSeleccionado: string) => {
    setForm(prev => ({
      ...prev,
      tipo: valorSeleccionado as TipoProveedor,
      pais: valorSeleccionado === 'Agente de Carga' ? prev.pais : '',
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(abierto) => { if (!abierto) resetAndClose(); else onOpenChange(abierto); }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Proveedor — Paso {step} de 2</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Origen *</Label>
              <Select value={form.origen_proveedor || ''} onValueChange={v => setForm(prev => ({ ...prev, origen_proveedor: v as 'Nacional' | 'Extranjero' }))}>
                <SelectTrigger><SelectValue placeholder="Selecciona origen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Nacional">Nacional</SelectItem>
                  <SelectItem value="Extranjero">Extranjero</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={e => setForm(prev => ({ ...prev, nombre: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={handleTipoChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isAgenteCarga && (
              <div className="space-y-2">
                <Label>País *</Label>
                <Select value={form.pais || ''} onValueChange={v => setForm(prev => ({ ...prev, pais: v, rfc: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un país" /></SelectTrigger>
                  <SelectContent>
                    {PAISES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(!isAgenteCarga || form.pais) && (
              <div className="space-y-2">
                <Label>{rfcLabel} *</Label>
                <Input
                  value={form.rfc}
                  onChange={e => setForm(prev => ({ ...prev, rfc: e.target.value }))}
                  placeholder={form.origen_proveedor === 'Extranjero' ? 'Ingresa el Tax ID' : 'Ingresa el RFC'}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Contacto</Label>
              <Input value={form.contacto} onChange={e => setForm(prev => ({ ...prev, contacto: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={e => setForm(prev => ({ ...prev, telefono: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Moneda Preferida</Label>
              <Select value={form.moneda_preferida} onValueChange={v => setForm(prev => ({ ...prev, moneda_preferida: v as Moneda }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONEDAS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <DocumentChecklist
            documentos={documentos}
            onFileChange={handleFileChange}
            descripcion={`Documentos requeridos para proveedor ${form.origen_proveedor}. Puedes adjuntarlos ahora o después.`}
          />
        )}

        <DialogFooter>
          {step === 1 && (
            <>
              <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
              <Button onClick={handleNext} disabled={!isStep1Valid()}>
                Siguiente <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
              </Button>
              <Button onClick={handleSave}>Crear</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
