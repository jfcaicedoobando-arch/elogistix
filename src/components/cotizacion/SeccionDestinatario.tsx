import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ClienteOption {
  id: string;
  nombre: string;
}

interface Props {
  esProspecto: boolean;
  setEsProspecto: (v: boolean) => void;
  clienteId: string;
  setClienteId: (v: string) => void;
  clientes: ClienteOption[];
  prospectoEmpresa: string;
  setProspectoEmpresa: (v: string) => void;
  prospectoContacto: string;
  setProspectoContacto: (v: string) => void;
  prospectoEmail: string;
  setProspectoEmail: (v: string) => void;
  prospectoTelefono: string;
  setProspectoTelefono: (v: string) => void;
}

export default function SeccionDestinatario({
  esProspecto, setEsProspecto,
  clienteId, setClienteId, clientes,
  prospectoEmpresa, setProspectoEmpresa,
  prospectoContacto, setProspectoContacto,
  prospectoEmail, setProspectoEmail,
  prospectoTelefono, setProspectoTelefono,
}: Props) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Destinatario</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="tipo-destinatario" checked={!esProspecto} onChange={() => setEsProspecto(false)} className="accent-primary" />
            <span className="text-sm font-medium">Cliente existente</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="tipo-destinatario" checked={esProspecto} onChange={() => setEsProspecto(true)} className="accent-primary" />
            <span className="text-sm font-medium">Prospecto</span>
          </label>
        </div>
        {!esProspecto ? (
          <div>
            <Label>Cliente *</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
              <SelectContent>
                {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Nombre de Empresa *</Label><Input value={prospectoEmpresa} onChange={e => setProspectoEmpresa(e.target.value)} placeholder="Ej. Importaciones ABC" /></div>
            <div><Label>Nombre de Contacto *</Label><Input value={prospectoContacto} onChange={e => setProspectoContacto(e.target.value)} placeholder="Ej. Juan Pérez" /></div>
            <div><Label>Email</Label><Input type="email" value={prospectoEmail} onChange={e => setProspectoEmail(e.target.value)} placeholder="contacto@empresa.com" /></div>
            <div><Label>Teléfono</Label><Input value={prospectoTelefono} onChange={e => setProspectoTelefono(e.target.value)} placeholder="+52 55 1234 5678" /></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
