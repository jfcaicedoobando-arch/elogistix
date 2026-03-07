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
        <CardTitle>Datos de la Empresa</CardTitle>
        <CardDescription>Información que aparece en el sistema y futuros documentos PDF</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nombre comercial</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Subtítulo / Giro</Label>
          <Input value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>RFC</Label>
          <Input value={rfc} onChange={(e) => setRfc(e.target.value)} placeholder="XAXX010101000" />
        </div>
        <div className="space-y-2">
          <Label>Email de contacto</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Teléfono</Label>
          <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Dirección fiscal</Label>
          <Textarea value={direccion} onChange={(e) => setDireccion(e.target.value)} rows={2} />
        </div>
      </CardContent>
    </Card>
  );
}
