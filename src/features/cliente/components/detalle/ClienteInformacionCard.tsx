import { Building2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const DASH = "—";

function CopyValueButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0 text-muted-foreground opacity-60 hover:opacity-100"
      aria-label={`Copiar ${label}`}
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function Campo({
  label,
  children,
  copyValue,
}: {
  label: string;
  children: React.ReactNode;
  copyValue?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center gap-1 min-w-0">
        <div className="text-sm font-medium break-words">{children}</div>
        {copyValue ? <CopyValueButton value={copyValue} label={label} /> : null}
      </div>
    </div>
  );
}

export function ClienteInformacionCard({ direccion, ciudad, estado, cp, contacto, email, telefono }: Props) {
  const ubicacion = [correctSpanishPlace(ciudad), correctSpanishPlace(estado)].filter(Boolean).join(", ");
  const tel = telefono?.trim() ? formatPhoneMx(telefono) : "";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Información general
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <Campo label="Domicilio">{direccion?.trim() || DASH}</Campo>
        <Campo label="Ciudad y estado">
          {ubicacion ? `${ubicacion}${cp ? ` ${cp}` : ""}` : DASH}
        </Campo>
        <Campo label="Contacto principal">{contacto?.trim() ? toTitleCase(contacto) : DASH}</Campo>
        <Campo label="Email" copyValue={email?.trim() || undefined}>
          {email?.trim() ? (
            <a href={`mailto:${email}`} className="text-accent hover:underline">
              {email}
            </a>
          ) : (
            DASH
          )}
        </Campo>
        <Campo label="Teléfono" copyValue={tel || undefined}>
          {tel ? (
            <a href={`tel:${telefono}`} className="text-accent hover:underline">
              {tel}
            </a>
          ) : (
            DASH
          )}
        </Campo>
      </CardContent>
    </Card>
  );
}
