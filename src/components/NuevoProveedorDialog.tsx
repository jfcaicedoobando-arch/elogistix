import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Upload, ArrowLeft, ArrowRight } from "lucide-react";
import type { Proveedor, TipoProveedor, Moneda, DocumentoProveedor } from "@/data/types";

const TIPOS: TipoProveedor[] = ['Naviera', 'Aerolínea', 'Transportista', 'Agente Aduanal', 'Agente de Carga', 'Aseguradora', 'Custodia', 'Almacenes', 'Acondicionamiento de Carga', 'Materiales Peligrosos'];
const MONEDAS: Moneda[] = ['MXN', 'USD', 'EUR'];

const PAISES = [
  'México', 'Estados Unidos', 'Canadá', 'China', 'Alemania', 'España',
  'Francia', 'Italia', 'Japón', 'Corea del Sur', 'Brasil', 'Colombia',
  'Chile', 'Argentina', 'Perú', 'Reino Unido', 'India', 'Otro',
];

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
  onSave: (data: Omit<Proveedor, 'id'>) => void;
}

const emptyForm: Omit<Proveedor, 'id'> = {
  nombre: '',
  tipo: 'Naviera',
  pais: '',
  rfc: '',
  contacto: '',
  email: '',
  telefono: '',
  monedaPreferida: 'MXN',
  origenProveedor: undefined,
};

export default function NuevoProveedorDialog({ open, onOpenChange, onSave }: Props) {
  const [form, setForm] = useState({ ...emptyForm });
  const [step, setStep] = useState<1 | 2>(1);
  const [documentos, setDocumentos] = useState<DocumentoProveedor[]>([]);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const isAgenteCarga = form.tipo === 'Agente de Carga';
  const isMexico = form.pais === 'México';
  const rfcLabel = isAgenteCarga && !isMexico && form.pais ? 'Tax ID' : 'RFC';

  const isStep1Valid = () => {
    if (!form.nombre.trim()) return false;
    if (!form.origenProveedor) return false;
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
    const docNames = form.origenProveedor === 'Nacional' ? DOCS_NACIONAL : DOCS_EXTRANJERO;
    setDocumentos(docNames.map(nombre => ({ nombre, adjuntado: false })));
    setStep(2);
  };

  const handleFileChange = (docNombre: string, file: File | undefined) => {
    setDocumentos(prev =>
      prev.map(d =>
        d.nombre === docNombre
          ? { ...d, archivo: file?.name, adjuntado: !!file }
          : d
      )
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

  const handleTipoChange = (v: string) => {
    setForm(f => ({
      ...f,
      tipo: v as TipoProveedor,
      pais: v === 'Agente de Carga' ? f.pais : '',
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); else onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Nuevo Proveedor — Paso {step} de 2
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Origen *</Label>
              <Select value={form.origenProveedor || ''} onValueChange={v => setForm(f => ({ ...f, origenProveedor: v as 'Nacional' | 'Extranjero' }))}>
                <SelectTrigger><SelectValue placeholder="Selecciona origen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Nacional">Nacional</SelectItem>
                  <SelectItem value="Extranjero">Extranjero</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
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
                <Select value={form.pais || ''} onValueChange={v => setForm(f => ({ ...f, pais: v, rfc: '' }))}>
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
                  onChange={e => setForm(f => ({ ...f, rfc: e.target.value }))}
                  placeholder={isAgenteCarga && !isMexico ? 'Ingresa el Tax ID' : 'Ingresa el RFC'}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Contacto</Label>
              <Input value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Moneda Preferida</Label>
              <Select value={form.monedaPreferida} onValueChange={v => setForm(f => ({ ...f, monedaPreferida: v as Moneda }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONEDAS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Documentos requeridos para proveedor <strong>{form.origenProveedor}</strong>. Puedes adjuntarlos ahora o después.
            </p>
            {documentos.map((doc) => (
              <div key={doc.nombre} className="flex items-center justify-between gap-2 rounded-md border p-3">
                <div className="flex items-center gap-2 min-w-0">
                  {doc.adjuntado ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40" />
                  )}
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{doc.nombre}</span>
                    {doc.archivo && (
                      <p className="text-xs text-muted-foreground truncate">{doc.archivo}</p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant={doc.adjuntado ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => fileInputRefs.current[doc.nombre]?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  {doc.adjuntado ? 'Cambiar' : 'Adjuntar'}
                </Button>
                <input
                  ref={el => { fileInputRefs.current[doc.nombre] = el; }}
                  type="file"
                  className="hidden"
                  onChange={e => handleFileChange(doc.nombre, e.target.files?.[0])}
                />
              </div>
            ))}
          </div>
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
