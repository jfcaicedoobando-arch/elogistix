import { useState } from "react";
import { Upload, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface Props {
  modo: string;
  setModo: (v: string) => void;
  tipo: string;
  setTipo: (v: string) => void;
  clienteId: string;
  setClienteId: (v: string) => void;
  clientes: Cliente[];
  incoterm: string;
  setIncoterm: (v: string) => void;
  shipper: string;
  setShipper: (v: string) => void;
  shipperManual: string;
  setShipperManual: (v: string) => void;
  consignatario: string;
  setConsignatario: (v: string) => void;
  consignatarioManual: string;
  setConsignatarioManual: (v: string) => void;
  contactos: Contacto[];
  descripcionMercancia: string;
  setDescripcionMercancia: (v: string) => void;
  pesoKg: string;
  setPesoKg: (v: string) => void;
  volumenM3: string;
  setVolumenM3: (v: string) => void;
  piezas: string;
  setPiezas: (v: string) => void;
  tipoCarga: string;
  setTipoCarga: (v: string) => void;
  msdsArchivo: string | null;
  subiendoMsds: boolean;
  onMsdsUpload: (file: File) => void;
}

export function StepDatosGenerales(props: Props) {
  const {
    modo, setModo, tipo, setTipo, clienteId, setClienteId, clientes,
    incoterm, setIncoterm, shipper, setShipper, shipperManual, setShipperManual,
    consignatario, setConsignatario, consignatarioManual, setConsignatarioManual,
    contactos, descripcionMercancia, setDescripcionMercancia,
    pesoKg, setPesoKg, volumenM3, setVolumenM3, piezas, setPiezas,
    tipoCarga, setTipoCarga, msdsArchivo, subiendoMsds, onMsdsUpload,
  } = props;

  const msdsNombreArchivo = msdsArchivo ? msdsArchivo.split('/').pop() : null;

  return (
    <Card>
      <CardHeader><CardTitle>Datos Generales</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Modo de Transporte *</Label>
            <Select value={modo} onValueChange={setModo}>
              <SelectTrigger><SelectValue placeholder="Seleccionar modo" /></SelectTrigger>
              <SelectContent>{MODOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo de Operación *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
              <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
              <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Incoterm *</Label>
            <Select value={incoterm} onValueChange={setIncoterm}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{INCOTERMS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Shipper (Exportador) *</Label>
            <Select value={shipper} onValueChange={(v) => { setShipper(v); if (v !== '__otro__') setShipperManual(''); }}>
              <SelectTrigger><SelectValue placeholder="Seleccionar shipper" /></SelectTrigger>
              <SelectContent>
                {contactos.map(ct => <SelectItem key={ct.id} value={ct.id}>{ct.nombre} — {ct.tipo} ({ct.pais})</SelectItem>)}
                <SelectItem value="__otro__">Otro (escribir manualmente)</SelectItem>
              </SelectContent>
            </Select>
            {shipper === '__otro__' && <Input placeholder="Nombre del exportador" value={shipperManual} onChange={e => setShipperManual(e.target.value)} className="mt-2" />}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Consignatario *</Label>
            <Select value={consignatario} onValueChange={(v) => { setConsignatario(v); if (v !== '__otro__') setConsignatarioManual(''); }}>
              <SelectTrigger><SelectValue placeholder="Seleccionar consignatario" /></SelectTrigger>
              <SelectContent>
                {contactos.map(ct => <SelectItem key={ct.id} value={ct.id}>{ct.nombre} — {ct.tipo} ({ct.pais})</SelectItem>)}
                <SelectItem value="__otro__">Otro (escribir manualmente)</SelectItem>
              </SelectContent>
            </Select>
            {consignatario === '__otro__' && <Input placeholder="Nombre del consignatario" value={consignatarioManual} onChange={e => setConsignatarioManual(e.target.value)} className="mt-2" />}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Descripción de la Mercancía *</Label>
            <Input placeholder="Descripción detallada" value={descripcionMercancia} onChange={e => setDescripcionMercancia(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tipo de Carga *</Label>
            <Select value={tipoCarga} onValueChange={(valor) => { setTipoCarga(valor); }}>
              <SelectTrigger><SelectValue placeholder="Seleccionar tipo de carga" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Carga General">Carga General</SelectItem>
                <SelectItem value="Mercancía Peligrosa">Mercancía Peligrosa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tipoCarga === 'Mercancía Peligrosa' && (
            <div className="space-y-2">
              <Label>Hoja de Seguridad (MSDS)</Label>
              {msdsNombreArchivo ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="truncate">{msdsNombreArchivo}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('msds-file-input')?.click()}
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={subiendoMsds}
                  onClick={() => document.getElementById('msds-file-input')?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {subiendoMsds ? 'Subiendo...' : 'Adjuntar MSDS'}
                </Button>
              )}
              <input
                id="msds-file-input"
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => {
                  const archivo = e.target.files?.[0];
                  if (archivo) onMsdsUpload(archivo);
                  e.target.value = '';
                }}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Peso (kg) *</Label>
            <Input type="number" placeholder="0" value={pesoKg} onChange={e => setPesoKg(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Volumen (m³) *</Label>
            <Input type="number" placeholder="0" value={volumenM3} onChange={e => setVolumenM3(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Piezas *</Label>
            <Input type="number" placeholder="0" value={piezas} onChange={e => setPiezas(e.target.value)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
