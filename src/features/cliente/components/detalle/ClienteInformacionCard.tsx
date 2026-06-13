import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toTitleCase, formatPhoneMx, correctSpanishPlace } from "@/lib/formatters";

interface Props {
  direccion: string;
  ciudad: string;
  estado: string;
  cp: string;
  contacto: string;
  email: string;
  telefono: string;
}

export function ClienteInformacionCard({ direccion, ciudad, estado, cp, contacto, email, telefono }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4" />Información General
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-1">
        <p>{direccion}</p>
        <p>{correctSpanishPlace(ciudad)}, {correctSpanishPlace(estado)} {cp}</p>
        <div className="pt-2 border-t mt-2 space-y-1">
          <p><span className="text-muted-foreground">Contacto:</span> {toTitleCase(contacto)}</p>
          <p><span className="text-muted-foreground">Email:</span> {email}</p>
          <p><span className="text-muted-foreground">Tel:</span> {formatPhoneMx(telefono)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
