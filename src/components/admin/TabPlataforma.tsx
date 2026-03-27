import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { useConfigGlobalCategoria, useUpdateConfiguracionGlobal } from "@/hooks/useConfiguracionGlobal";

export default function TabPlataforma() {
  const config = useConfigGlobalCategoria("plataforma");
  const updateConfig = useUpdateConfiguracionGlobal();

  const [nombreApp, setNombreApp] = useState("");
  const [tagline, setTagline] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [colorPrimario, setColorPrimario] = useState("#1e40af");
  const [emailSoporte, setEmailSoporte] = useState("");
  const [initialized, setInitialized] = useState(false);

  if (Object.keys(config).length > 0 && !initialized) {
    setNombreApp((config.nombre_app as string) || "Elogistix");
    setTagline((config.tagline as string) || "");
    setLogoUrl((config.logo_url as string) || "");
    setColorPrimario((config.color_primario as string) || "#1e40af");
    setEmailSoporte((config.email_soporte as string) || "");
    setInitialized(true);
  }

  const handleGuardar = () => {
    updateConfig.mutate([
      { categoria: "plataforma", clave: "nombre_app", valor: nombreApp },
      { categoria: "plataforma", clave: "tagline", valor: tagline },
      { categoria: "plataforma", clave: "logo_url", valor: logoUrl },
      { categoria: "plataforma", clave: "color_primario", valor: colorPrimario },
      { categoria: "plataforma", clave: "email_soporte", valor: emailSoporte },
    ]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identidad de la Plataforma</CardTitle>
        <CardDescription>Configuración de marca y contacto que aplica a toda la plataforma</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nombre de la plataforma</Label>
            <Input value={nombreApp} onChange={(e) => setNombreApp(e.target.value)} placeholder="Elogistix" />
          </div>
          <div className="space-y-2">
            <Label>Subtítulo / Tagline</Label>
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Sistema de gestión logística" />
          </div>
          <div className="space-y-2">
            <Label>URL del Logo</Label>
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>Color primario</Label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={colorPrimario}
                onChange={(e) => setColorPrimario(e.target.value)}
                className="w-10 h-10 rounded border border-input cursor-pointer"
              />
              <Input value={colorPrimario} onChange={(e) => setColorPrimario(e.target.value)} className="w-32 font-mono" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email de soporte</Label>
            <Input value={emailSoporte} onChange={(e) => setEmailSoporte(e.target.value)} placeholder="soporte@elogistix.com" type="email" />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={handleGuardar} disabled={updateConfig.isPending}>
            <Save className="h-4 w-4 mr-2" /> Guardar cambios
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
