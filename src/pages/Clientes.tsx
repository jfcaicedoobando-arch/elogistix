import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, Plus, Check, Upload, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useClientes, useCreateCliente } from "@/hooks/useClientes";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";

const emptyCliente = {
  nombre: "", rfc: "", direccion: "", ciudad: "", estado: "", cp: "", contacto: "", email: "", telefono: "",
};

const DOCS_OBLIGATORIOS = [
  'CIF', 'Opinión fiscal', 'Acta constitutiva', 'INE RL', 'Poder notarial',
  'Comprobante de domicilio', 'Datos bancarios', 'Opinión de cumplimiento IMSS/Infonavit',
  'Contrato de servicios con Elogistix', 'Estados financieros último corte',
];

interface DocCliente {
  nombre: string;
  archivo?: string;
  adjuntado: boolean;
}

export default function Clientes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: clientesList = [], isLoading } = useClientes();
  const createCliente = useCreateCliente();
  const { canEdit } = usePermissions();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyCliente);
  const [step, setStep] = useState<1 | 2>(1);
  const [documentos, setDocumentos] = useState<DocCliente[]>([]);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const filtered = clientesList.filter(c =>
    !search || c.nombre.toLowerCase().includes(search.toLowerCase()) || c.rfc.toLowerCase().includes(search.toLowerCase())
  );

  const handleChange = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));
  const isStep1Valid = () => form.nombre.trim() && form.rfc.trim() && form.cp.trim();

  const handleNext = () => {
    if (!isStep1Valid()) return;
    setDocumentos(DOCS_OBLIGATORIOS.map(nombre => ({ nombre, adjuntado: false })));
    setStep(2);
  };

  const handleFileChange = (docNombre: string, file: File | undefined) => {
    setDocumentos(prev =>
      prev.map(d => d.nombre === docNombre ? { ...d, archivo: file?.name, adjuntado: !!file } : d)
    );
  };

  const allDocsAdjuntados = documentos.length > 0 && documentos.every(d => d.adjuntado);

  const handleSave = async () => {
    if (!allDocsAdjuntados) return;
    try {
      await createCliente.mutateAsync(form);
      toast({ title: "Cliente creado exitosamente" });
      resetAndClose();
    } catch (error: any) {
      toast({ title: "Error al crear cliente", description: error.message, variant: "destructive" });
    }
  };

  const resetAndClose = () => {
    setForm(emptyCliente);
    setStep(1);
    setDocumentos([]);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-accent" />
          <h1 className="text-2xl font-bold">Clientes</h1>
        </div>
        {canEdit && <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Nuevo Cliente</Button>}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nombre o RFC..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {search ? "No se encontraron clientes" : "No hay clientes registrados"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>RFC</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Teléfono</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/clientes/${c.id}`)}>
                    <TableCell className="font-medium max-w-[200px] truncate">{c.nombre}</TableCell>
                    <TableCell className="text-xs font-mono">{c.rfc}</TableCell>
                    <TableCell className="text-xs">{c.ciudad}, {c.estado}</TableCell>
                    <TableCell className="text-xs">{c.contacto}</TableCell>
                    <TableCell className="text-xs">{c.telefono}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetAndClose(); else setDialogOpen(o); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Cliente — Paso {step} de 2</DialogTitle>
            <DialogDescription>
              {step === 1 ? 'Ingresa los datos del nuevo cliente.' : 'Adjunta todos los documentos obligatorios para crear el cliente.'}
            </DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Nombre / Razón Social", field: "nombre", full: true, required: true },
                { label: "RFC", field: "rfc", required: true },
                { label: "Código Postal", field: "cp", required: true },
                { label: "Dirección", field: "direccion", full: true },
                { label: "Ciudad", field: "ciudad" },
                { label: "Estado", field: "estado" },
                { label: "Contacto", field: "contacto" },
                { label: "Email", field: "email" },
                { label: "Teléfono", field: "telefono" },
              ].map(({ label, field, full, required }) => (
                <div key={field} className={full ? "col-span-2" : ""}>
                  <Label className="text-xs">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
                  <Input
                    value={(form as any)[field]}
                    onChange={(e) => handleChange(field, e.target.value)}
                    className="mt-1"
                  />
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Todos los documentos deben estar adjuntados para poder crear el cliente.
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
                      {doc.archivo && <p className="text-xs text-muted-foreground truncate">{doc.archivo}</p>}
                    </div>
                  </div>
                  <Button type="button" variant={doc.adjuntado ? "secondary" : "outline"} size="sm"
                    onClick={() => fileInputRefs.current[doc.nombre]?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    {doc.adjuntado ? 'Cambiar' : 'Adjuntar'}
                  </Button>
                  <input ref={el => { fileInputRefs.current[doc.nombre] = el; }} type="file" className="hidden"
                    onChange={e => handleFileChange(doc.nombre, e.target.files?.[0])} />
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
                <Button onClick={handleSave} disabled={!allDocsAdjuntados || createCliente.isPending}>
                  {createCliente.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Crear
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
