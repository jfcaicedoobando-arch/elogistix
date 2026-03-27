import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Save } from "lucide-react";
import { useConfigGlobalCategoria, useUpdateConfiguracionGlobal } from "@/hooks/useConfiguracionGlobal";

export default function TabSeguridadGlobal() {
  const config = useConfigGlobalCategoria("seguridad");
  const updateConfig = useUpdateConfiguracionGlobal();
  const [initialized, setInitialized] = useState(false);

  const [autoConfirmar, setAutoConfirmar] = useState(false);
  const [longitudPassword, setLongitudPassword] = useState(8);
  const [expiracionSesion, setExpiracionSesion] = useState(24);
  const [maxIntentos, setMaxIntentos] = useState(5);
  const [registroPublico, setRegistroPublico] = useState(false);

  if (Object.keys(config).length > 0 && !initialized) {
    setAutoConfirmar(config.auto_confirmar_email as boolean ?? false);
    setLongitudPassword(config.longitud_minima_password as number ?? 8);
    setExpiracionSesion(config.expiracion_sesion_horas as number ?? 24);
    setMaxIntentos(config.max_intentos_login as number ?? 5);
    setRegistroPublico(config.permitir_registro_publico as boolean ?? false);
    setInitialized(true);
  }

  const handleGuardar = () => {
    updateConfig.mutate([
      { categoria: "seguridad", clave: "auto_confirmar_email", valor: autoConfirmar },
      { categoria: "seguridad", clave: "longitud_minima_password", valor: longitudPassword },
      { categoria: "seguridad", clave: "expiracion_sesion_horas", valor: expiracionSesion },
      { categoria: "seguridad", clave: "max_intentos_login", valor: maxIntentos },
      { categoria: "seguridad", clave: "permitir_registro_publico", valor: registroPublico },
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

          <div className="space-y-2 p-3 rounded-lg border">
            <Label className="text-sm font-medium">Longitud mínima de contraseña</Label>
            <Input
              type="number"
              min={6}
              max={32}
              value={longitudPassword}
              onChange={(e) => setLongitudPassword(Number(e.target.value))}
              className="w-24"
            />
          </div>

          <div className="space-y-2 p-3 rounded-lg border">
            <Label className="text-sm font-medium">Expiración de sesión (horas)</Label>
            <Input
              type="number"
              min={1}
              max={720}
              value={expiracionSesion}
              onChange={(e) => setExpiracionSesion(Number(e.target.value))}
              className="w-24"
            />
          </div>

          <div className="space-y-2 p-3 rounded-lg border">
            <Label className="text-sm font-medium">Intentos máximos de login</Label>
            <p className="text-xs text-muted-foreground">Antes de bloquear temporalmente la cuenta</p>
            <Input
              type="number"
              min={3}
              max={20}
              value={maxIntentos}
              onChange={(e) => setMaxIntentos(Number(e.target.value))}
              className="w-24"
            />
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
