import { Building } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  nombre: string; setNombre: (v: string) => void;
  subtitulo: string; setSubtitulo: (v: string) => void;
  rfc: string; setRfc: (v: string) => void;
  direccion: string; setDireccion: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  telefono: string; setTelefono: (v: string) => void;
}

export default function TabEmpresa({ nombre, setNombre, subtitulo, setSubtitulo, rfc, setRfc, direccion, setDireccion, email, setEmail, telefono, setTelefono }: Props) {
  return (
    <Card>
      <CardHeader>
        {/* VB-22: mismo patrón de encabezado que "Organización" (icono + título). */}
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" /> Datos de la Empresa
        </CardTitle>
        <CardDescription>Información que aparece en el sistema y futuros documentos PDF</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Nombre comercial">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </FormField>
        <FormField label="Subtítulo / Giro">
          <Input value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} />
        </FormField>
        <FormField label="RFC">
          <Input value={rfc} onChange={(e) => setRfc(e.target.value)} placeholder="XAXX010101000" />
        </FormField>
        <FormField label="Email de contacto">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Teléfono">
          <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </FormField>
        <div className="space-y-2 md:col-span-2">
          <Label>Dirección fiscal</Label>
          <Textarea value={direccion} onChange={(e) => setDireccion(e.target.value)} rows={2} />
        </div>
      </CardContent>
    </Card>
  );
}
