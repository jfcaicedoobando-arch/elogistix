import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, ArrowLeft, ArrowRight, Loader2, Upload, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/SearchInput";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useClientesPaginados, useCreateCliente } from "@/hooks/useClientes";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import DocumentChecklist, { type DocumentoChecklist } from "@/components/DocumentChecklist";
import PaginationControls from "@/components/PaginationControls";
import { useDebounce } from "@/hooks/useDebounce";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_PAGE_SIZE = 20;

const emptyCliente = {
  nombre: "", rfc: "", direccion: "", ciudad: "", estado: "", cp: "", contacto: "", email: "", telefono: "",
};

const DOCS_OBLIGATORIOS = [
  'Constancia de Situación Fiscal (CSF)', 'CIF', 'Opinión fiscal', 'Acta constitutiva',
  'INE RL', 'Poder notarial', 'Comprobante de domicilio', 'Datos bancarios',
  'Opinión de cumplimiento IMSS/Infonavit', 'Contrato de servicios con Elogistix',
  'Estados financieros último corte',
];

type ClienteRow = { id: string; nombre: string; rfc: string; ciudad: string; estado: string; contacto: string; telefono: string };

const columns: DataTableColumn<ClienteRow>[] = [
  { key: "nombre", header: "Nombre", className: "font-medium max-w-[200px] truncate", render: (c) => c.nombre },
  { key: "rfc", header: "RFC", className: "text-xs font-mono", render: (c) => c.rfc },
  { key: "ciudad", header: "Ciudad", className: "text-xs", render: (c) => `${c.ciudad}, ${c.estado}` },
  { key: "contacto", header: "Contacto", className: "text-xs", render: (c) => c.contacto },
  { key: "telefono", header: "Teléfono", className: "text-xs", render: (c) => c.telefono },
];

type ModoAlta = "manual" | "csf";

export default function Clientes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createCliente = useCreateCliente();
  const { canEdit } = usePermissions();
  const registrarActividad = useRegistrarActividad();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyCliente);
  const [step, setStep] = useState<1 | 2>(1);
  const [documentos, setDocumentos] = useState<DocumentoChecklist[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [modoAlta, setModoAlta] = useState<ModoAlta>("manual");
  const [parsingCsf, setParsingCsf] = useState(false);
  const [csfFile, setCsfFile] = useState<File | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data: resultado, isLoading } = useClientesPaginados({
    search: debouncedSearch,
    page,
    pageSize,
  });

  const clientes = resultado?.data ?? [];
  const totalCount = resultado?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleChange = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));
  const isStep1Valid = () => form.nombre.trim() && form.rfc.trim() && form.cp.trim();

  const handleNext = () => {
    if (!isStep1Valid()) return;
    setDocumentos(DOCS_OBLIGATORIOS.map(nombre => {
      if (nombre === 'Constancia de Situación Fiscal (CSF)' && csfFile) {
        return { nombre, adjuntado: true, archivo: csfFile.name };
      }
      return { nombre, adjuntado: false };
    }));
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
      const clienteCreado = await createCliente.mutateAsync(form);
      registrarActividad.mutate({
        accion: 'crear', modulo: 'clientes',
        entidad_id: clienteCreado.id, entidad_nombre: clienteCreado.nombre,
      });
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
    setModoAlta("manual");
    setCsfFile(null);
    setDialogOpen(false);
  };

  const handleCsfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({ title: "Archivo inválido", description: "Solo se aceptan archivos PDF.", variant: "destructive" });
      return;
    }

    setParsingCsf(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-csf`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error al procesar el documento" }));
        throw new Error(err.error || "Error al procesar el documento");
      }

      const datos = await res.json();
      setForm(prev => ({
        ...prev,
        nombre: datos.nombre || prev.nombre,
        rfc: datos.rfc || prev.rfc,
        cp: datos.cp || prev.cp,
        direccion: datos.direccion || prev.direccion,
        ciudad: datos.ciudad || prev.ciudad,
        estado: datos.estado || prev.estado,
      }));

      setCsfFile(file);
      toast({ title: "Datos extraídos", description: "Revisa la información antes de continuar." });
    } catch (error: any) {
      toast({ title: "Error al leer CSF", description: error.message, variant: "destructive" });
    } finally {
      setParsingCsf(false);
      // Reset file input so user can re-upload
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-accent" />
            <h1 className="text-2xl font-bold">Clientes</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{totalCount} clientes registrados</p>
        </div>
        {canEdit && <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Nuevo Cliente</Button>}
      </div>

      <Card>
        <CardContent className="p-4">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Buscar por nombre o RFC..." />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={clientes as ClienteRow[]}
            isLoading={isLoading}
            emptyMessage={search ? "No se encontraron clientes" : "No hay clientes registrados"}
            onRowClick={(c) => navigate(`/clientes/${c.id}`)}
            rowKey={(c) => c.id}
          />
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
          />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(abierto) => { if (!abierto) resetAndClose(); else setDialogOpen(abierto); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Cliente — Paso {step} de 2</DialogTitle>
            <DialogDescription>
              {step === 1 ? 'Ingresa los datos del nuevo cliente o sube su Constancia de Situación Fiscal (CSF).' : 'Adjunta todos los documentos obligatorios para crear el cliente.'}
            </DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-4">
              {/* Toggle Manual / CSF */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={modoAlta === "manual" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setModoAlta("manual")}
                >
                  <FileText className="h-4 w-4 mr-1" /> Manual
                </Button>
                <Button
                  type="button"
                  variant={modoAlta === "csf" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setModoAlta("csf")}
                >
                  <Upload className="h-4 w-4 mr-1" /> Subir CSF
                </Button>
              </div>

              {/* CSF upload area */}
              {modoAlta === "csf" && (
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center space-y-2">
                  {parsingCsf ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Extrayendo datos del CSF…</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Sube la Constancia de Situación Fiscal (PDF) para pre-llenar los datos</p>
                      <label className="cursor-pointer">
                        <Button type="button" variant="outline" size="sm" asChild>
                          <span>Seleccionar PDF</span>
                        </Button>
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={handleCsfUpload}
                        />
                      </label>
                    </>
                  )}
                </div>
              )}

              {/* Form fields */}
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
            </div>
          )}

          {step === 2 && (
            <DocumentChecklist
              documentos={documentos}
              onFileChange={handleFileChange}
              descripcion="Todos los documentos deben estar adjuntados para poder crear el cliente."
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
