import { useFormContext, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EmbarqueFormValues } from "@/features/embarques/hooks";
import { MODOS, TIPOS, INCOTERMS } from "@/constants/wizardConstants";
import type { EmbarqueValidationErrors } from "@/features/embarques/types/embarque";
import { LabelHeredable } from "./LabelHeredable";

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
  clientes: Cliente[];
  clienteNombre: string;
  contactos: Contacto[];
  errors: EmbarqueValidationErrors;
}

export function BloqueClienteContactos({ clientes, clienteNombre, contactos, errors }: Props) {
  const { register, watch, setValue } = useFormContext<EmbarqueFormValues>();
  const shipper = watch('shipper');
  const consignatario = watch('consignatario');

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <LabelHeredable field="modo" getter={(c) => c.modo}>Modo de Transporte *</LabelHeredable>
          <Controller name="modo" render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className={errors.modo ? 'border-destructive' : ''}><SelectValue placeholder="Seleccionar modo" /></SelectTrigger>
              <SelectContent>{MODOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          )} />
          {errors.modo && <p className="text-xs text-destructive">{errors.modo}</p>}
        </div>
        <div className="space-y-2">
          <LabelHeredable field="tipo" getter={(c) => c.tipo}>Tipo de Operación *</LabelHeredable>
          <Controller name="tipo" render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className={errors.tipo ? 'border-destructive' : ''}><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
              <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          )} />
          {errors.tipo && <p className="text-xs text-destructive">{errors.tipo}</p>}
        </div>
        <div className="space-y-2">
          <LabelHeredable field="clienteId" getter={(c) => c.cliente_id}>Cliente *</LabelHeredable>
          <Controller name="clienteId" render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className={errors.clienteId ? 'border-destructive' : ''}><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
              <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
            </Select>
          )} />
          {errors.clienteId && <p className="text-xs text-destructive">{errors.clienteId}</p>}
        </div>
        <div className="space-y-2">
          <LabelHeredable field="incoterm" getter={(c) => c.incoterm}>Incoterm *</LabelHeredable>
          <Controller name="incoterm" render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{INCOTERMS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
            </Select>
          )} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="emb-shipper">Shipper (Exportador) *</Label>
        <Controller name="shipper" render={({ field }) => (
          <Select value={field.value} onValueChange={(v) => { field.onChange(v); if (v !== '__otro__') setValue('shipperManual', ''); }}>
            <SelectTrigger id="emb-shipper"><SelectValue placeholder="Seleccionar shipper" /></SelectTrigger>
            <SelectContent>
              {contactos.map(ct => <SelectItem key={ct.id} value={ct.id}>{ct.nombre} — {ct.tipo} ({ct.pais})</SelectItem>)}
              <SelectItem value="__otro__">Otro (escribir manualmente)</SelectItem>
            </SelectContent>
          </Select>
        )} />
        {shipper === '__otro__' && <Input aria-label="Nombre del exportador" placeholder="Nombre del exportador" {...register('shipperManual')} className="mt-2" />}
      </div>
      <div className="space-y-2">
        <Label htmlFor="emb-consignatario">Consignatario *</Label>
        <Controller name="consignatario" render={({ field }) => (
          <Select value={field.value} onValueChange={(v) => { field.onChange(v); if (v !== '__otro__') setValue('consignatarioManual', ''); }}>
            <SelectTrigger id="emb-consignatario"><SelectValue placeholder="Seleccionar consignatario" /></SelectTrigger>
            <SelectContent>
              {clienteNombre && <SelectItem value="__cliente__">Mismo cliente ({clienteNombre})</SelectItem>}
              {contactos.map(ct => <SelectItem key={ct.id} value={ct.id}>{ct.nombre} — {ct.tipo} ({ct.pais})</SelectItem>)}
              <SelectItem value="__otro__">Otro (escribir manualmente)</SelectItem>
            </SelectContent>
          </Select>
        )} />
        {consignatario === '__otro__' && <Input aria-label="Nombre del consignatario" placeholder="Nombre del consignatario" {...register('consignatarioManual')} className="mt-2" />}
      </div>
    </>
  );
}
