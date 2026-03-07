import { useFormContext } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CotizacionFormValues } from "@/hooks/useCotizacionWizardForm";

interface ClienteOption {
  id: string;
  nombre: string;
}

interface Props {
  clientes: ClienteOption[];
}

export default function SeccionDestinatario({ clientes }: Props) {
  const { watch, setValue } = useFormContext<CotizacionFormValues>();
  const esProspecto = watch("esProspecto");
  const clienteId = watch("clienteId");

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Destinatario</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="tipo-destinatario" checked={!esProspecto} onChange={() => setValue("esProspecto", false)} className="accent-primary" />
            <span className="text-sm font-medium">Cliente existente</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="tipo-destinatario" checked={esProspecto} onChange={() => setValue("esProspecto", true)} className="accent-primary" />
            <span className="text-sm font-medium">Prospecto</span>
          </label>
        </div>
        {!esProspecto ? (
          <div>
            <Label>Cliente *</Label>
            <Select value={clienteId} onValueChange={v => setValue("clienteId", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
              <SelectContent>
                {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Nombre de Empresa *</Label><Input value={watch("prospectoEmpresa")} onChange={e => setValue("prospectoEmpresa", e.target.value)} placeholder="Ej. Importaciones ABC" /></div>
            <div><Label>Nombre de Contacto *</Label><Input value={watch("prospectoContacto")} onChange={e => setValue("prospectoContacto", e.target.value)} placeholder="Ej. Juan Pérez" /></div>
            <div><Label>Email</Label><Input type="email" value={watch("prospectoEmail")} onChange={e => setValue("prospectoEmail", e.target.value)} placeholder="contacto@empresa.com" /></div>
            <div><Label>Teléfono</Label><Input value={watch("prospectoTelefono")} onChange={e => setValue("prospectoTelefono", e.target.value)} placeholder="+52 55 1234 5678" /></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
