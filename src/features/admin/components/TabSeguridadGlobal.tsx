import { useEffect, useState } from "react";
import { z } from "zod";
import { notifyError } from "@/lib/ui/appFeedback";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Save } from "lucide-react";
import { useConfigGlobalCategoria, useUpdateConfiguracionGlobal } from "@/features/configuracion";
import {
  parseConfigSafe,
  plataformaConfigSchema,
  seguridadConfigSchema,
} from "@/features/configuracion";

/**
 * v13.56.1 — Inicialización movida a `useEffect` para evitar mutar estado
 * en el cuerpo del render (anti-patrón React que dispara re-renders extra).
 */
// EC-20: Number("") === 0 y los min/max HTML no bloquean tecleo manual;
// sin esta validación se persistían políticas absurdas (0 intentos = bloqueo
// total, longitud de contraseña 0, etc.).
const seguridadPoliticasSchema = z.object({
  longitudPassword: z.number().int().min(6).max(32),
  expiracionSesion: z.number().int().min(1).max(720),
  maxIntentos: z.number().int().min(3).max(20),
});

export default function TabSeguridadGlobal() {
  const config = useConfigGlobalCategoria("seguridad");
  const updateConfig = useUpdateConfiguracionGlobal();
  const configPlataforma = useConfigGlobalCategoria("plataforma");

  const [autoConfirmar, setAutoConfirmar] = useState(false);
  const [longitudPassword, setLongitudPassword] = useState(8);
  const [expiracionSesion, setExpiracionSesion] = useState(24);
  const [maxIntentos, setMaxIntentos] = useState(5);
  const [registroPublico, setRegistroPublico] = useState(false);
  const [emailSoporte, setEmailSoporte] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    if (Object.keys(config).length === 0) return;
    const seg = parseConfigSafe(seguridadConfigSchema, config);
    const plat = parseConfigSafe(plataformaConfigSchema, configPlataforma);
    setAutoConfirmar(seg.auto_confirmar_email);
    setLongitudPassword(seg.longitud_minima_password);
    setExpiracionSesion(seg.expiracion_sesion_horas);
    setMaxIntentos(seg.max_intentos_login);
    setRegistroPublico(seg.permitir_registro_publico);
    setEmailSoporte(plat.email_soporte);
    setInitialized(true);
  }, [config, configPlataforma, initialized]);

  const handleGuardar = () => {
    const parsed = seguridadPoliticasSchema.safeParse({
      longitudPassword: Number(longitudPassword),
      expiracionSesion: Number(expiracionSesion),
      maxIntentos: Number(maxIntentos),
    });
    if (!parsed.success) {
      notifyError(undefined, {
        title: "Políticas de seguridad inválidas",
        description:
          "Revisa los valores: longitud de contraseña entre 6 y 32, expiración de sesión entre 1 y 720 horas e intentos de login entre 3 y 20.",
        method: "FEATURES_ADMIN_COMPONENTS_TABSEGURIDADGLOBAL_SAVE",
      });
      return;
    }
    updateConfig.mutate([
      { categoria: "seguridad", clave: "auto_confirmar_email", valor: autoConfirmar },
      { categoria: "seguridad", clave: "longitud_minima_password", valor: longitudPassword },
      { categoria: "seguridad", clave: "expiracion_sesion_horas", valor: expiracionSesion },
      { categoria: "seguridad", clave: "max_intentos_login", valor: maxIntentos },
      { categoria: "seguridad", clave: "permitir_registro_publico", valor: registroPublico },
      { categoria: "plataforma", clave: "email_soporte", valor: emailSoporte },
    ]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seguridad Global</CardTitle>
        <CardDescription>Políticas de seguridad que aplican a toda la plataforma</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="text-sm font-medium">Auto-confirmar emails</Label>
              <p className="text-xs text-muted-foreground mt-1">Los usuarios nuevos no necesitan verificar su email</p>
            </div>
            <Switch checked={autoConfirmar} onCheckedChange={setAutoConfirmar} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="text-sm font-medium">Registro público</Label>
              <p className="text-xs text-muted-foreground mt-1">Permitir que cualquiera se registre en la plataforma</p>
            </div>
            <Switch checked={registroPublico} onCheckedChange={setRegistroPublico} />
          </div>

          <div className="p-3 rounded-lg border">
            <FormField label="Longitud mínima de contraseña">
              <Input
                type="number"
                min={6}
                max={32}
                value={longitudPassword}
                onChange={(e) => setLongitudPassword(Number(e.target.value))}
                className="w-24"
              />
            </FormField>
          </div>

          <div className="p-3 rounded-lg border">
            <FormField label="Expiración de sesión (horas)">
              <Input
                type="number"
                min={1}
                max={720}
                value={expiracionSesion}
                onChange={(e) => setExpiracionSesion(Number(e.target.value))}
                className="w-24"
              />
            </FormField>
          </div>

          <div className="p-3 rounded-lg border">
            <FormField label="Intentos máximos de login" hint="Antes de bloquear temporalmente la cuenta">
              <Input
                type="number"
                min={3}
                max={20}
                value={maxIntentos}
                onChange={(e) => setMaxIntentos(Number(e.target.value))}
                className="w-24"
              />
            </FormField>
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-medium mb-2">Contacto de soporte</h3>
          <div className="p-3 rounded-lg border max-w-md">
            <FormField label="Email de soporte" hint="Dirección de contacto para soporte técnico de la plataforma">
              <Input value={emailSoporte} onChange={(e) => setEmailSoporte(e.target.value)} placeholder="soporte@librecarga.com" type="email" />
            </FormField>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleGuardar} disabled={updateConfig.isPending}>
            <Save className="h-4 w-4 mr-2" /> Guardar políticas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
