import { Upload, FileText } from "lucide-react";
import { useFormContext, Controller } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EmbarqueFormValues } from "@/hooks/useEmbarqueForm";
import type { ModoTransporte, TipoOperacion, Incoterm } from "@/data/types";

const MODOS: ModoTransporte[] = ['Marítimo', 'Aéreo', 'Terrestre', 'Multimodal'];
const TIPOS: TipoOperacion[] = ['Importación', 'Exportación', 'Nacional'];
const INCOTERMS: Incoterm[] = ['EXW', 'FOB', 'CIF', 'DAP', 'DDP', 'FCA', 'CFR', 'CPT', 'CIP', 'DAT'];

interface Contacto {
  id: string;
  nombre: string;
  tipo: string;
  pais: string;
}

interface Cliente {
  id: string;
  nombre: string;
}

export interface EmbarqueValidationErrors {
  modo?: string;
  tipo?: string;
  clienteId?: string;
  descripcionMercancia?: string;
}

interface Props {
  clientes: Cliente[];
  clienteNombre: string;
  contactos: Contacto[];
  onMsdsUpload: (file: File) => void;
  errors?: EmbarqueValidationErrors;
}

export function StepDatosGenerales({ clientes, clienteNombre, contactos, onMsdsUpload, errors = {} }: Props) {
  const { register, watch, setValue } = useFormContext<EmbarqueFormValues>();

  const modo = watch('modo');
  const shipper = watch('shipper');
  const consignatario = watch('consignatario');
  const tipoCarga = watch('tipoCarga');
  const msdsArchivo = watch('msdsArchivo');
  const subiendoMsds = watch('subiendoMsds');

  const msdsNombreArchivo = msdsArchivo ? msdsArchivo.split('/').pop() : null;

  return (
    <Card>
      <CardHeader><CardTitle>Datos Generales</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Modo de Transporte *</Label>
            <Controller name="modo" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className={errors.modo ? 'border-destructive' : ''}><SelectValue placeholder="Seleccionar modo" /></SelectTrigger>
                <SelectContent>{MODOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            )} />
            {errors.modo && <p className="text-xs text-destructive">{errors.modo}</p>}
          </div>
          <div className="space-y-2">
            <Label>Tipo de Operación *</Label>
            <Controller name="tipo" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className={errors.tipo ? 'border-destructive' : ''}><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            )} />
            {errors.tipo && <p className="text-xs text-destructive">{errors.tipo}</p>}
          </div>
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Controller name="clienteId" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className={errors.clienteId ? 'border-destructive' : ''}><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
              </Select>
            )} />
            {errors.clienteId && <p className="text-xs text-destructive">{errors.clienteId}</p>}
          </div>
          <div className="space-y-2">
            <Label>Incoterm *</Label>
            <Controller name="incoterm" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{INCOTERMS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Shipper (Exportador) *</Label>
            <Controller name="shipper" render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => { field.onChange(v); if (v !== '__otro__') setValue('shipperManual', ''); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar shipper" /></SelectTrigger>
                <SelectContent>
                  {contactos.map(ct => <SelectItem key={ct.id} value={ct.id}>{ct.nombre} — {ct.tipo} ({ct.pais})</SelectItem>)}
                  <SelectItem value="__otro__">Otro (escribir manualmente)</SelectItem>
                </SelectContent>
              </Select>
            )} />
            {shipper === '__otro__' && <Input placeholder="Nombre del exportador" {...register('shipperManual')} className="mt-2" />}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Consignatario *</Label>
            <Controller name="consignatario" render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => { field.onChange(v); if (v !== '__otro__') setValue('consignatarioManual', ''); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar consignatario" /></SelectTrigger>
                <SelectContent>
                  {clienteNombre && <SelectItem value="__cliente__">Mismo cliente ({clienteNombre})</SelectItem>}
                  {contactos.map(ct => <SelectItem key={ct.id} value={ct.id}>{ct.nombre} — {ct.tipo} ({ct.pais})</SelectItem>)}
                  <SelectItem value="__otro__">Otro (escribir manualmente)</SelectItem>
                </SelectContent>
              </Select>
            )} />
            {consignatario === '__otro__' && <Input placeholder="Nombre del consignatario" {...register('consignatarioManual')} className="mt-2" />}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Descripción de la Mercancía *</Label>
            <Input className={errors.descripcionMercancia ? 'border-destructive' : ''} placeholder="Descripción detallada" {...register('descripcionMercancia')} />
            {errors.descripcionMercancia && <p className="text-xs text-destructive">{errors.descripcionMercancia}</p>}
          </div>
          <div className="space-y-2">
            <Label>Tipo de Carga *</Label>
            <Controller name="tipoCarga" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo de carga" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Carga General">Carga General</SelectItem>
                  <SelectItem value="Mercancía Peligrosa">Mercancía Peligrosa</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>
          {tipoCarga === 'Mercancía Peligrosa' && (
            <div className="space-y-2">
              <Label>Hoja de Seguridad (MSDS)</Label>
              {msdsNombreArchivo ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="truncate">{msdsNombreArchivo}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('msds-file-input')?.click()}>Cambiar</Button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="w-full" disabled={subiendoMsds} onClick={() => document.getElementById('msds-file-input')?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  {subiendoMsds ? 'Subiendo...' : 'Adjuntar MSDS'}
                </Button>
              )}
              <input id="msds-file-input" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden"
                onChange={(e) => { const archivo = e.target.files?.[0]; if (archivo) onMsdsUpload(archivo); e.target.value = ''; }} />
            </div>
          )}
          <div className="space-y-2">
            <Label>Peso (kg) *</Label>
            <Input type="number" placeholder="0" {...register('pesoKg')} />
          </div>
          <div className="space-y-2">
            <Label>Volumen (m³) *</Label>
            <Input type="number" placeholder="0" {...register('volumenM3')} />
          </div>
          <div className="space-y-2">
            <Label>Piezas *</Label>
            <Input type="number" placeholder="0" {...register('piezas')} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
