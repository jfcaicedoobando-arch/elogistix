/**
 * Contenido del tab "Asignar contraseña" del diálogo Invitar Agente al Portal.
 * Extraído para mantener `InvitarAgentePortalDialog.tsx` ≤ 200 líneas.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { Eye, EyeOff, RefreshCw } from "lucide-react";

/** Genera una contraseña legible de 12 chars (letras + dígitos + símbolo seguro). */
export function generarPasswordSegura(): string {
  const letras = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digitos = "23456789";
  const simbolos = "!@#$%*-_";
  const todo = letras + digitos + simbolos;
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < 12; i++) out += todo[arr[i] % todo.length];
  return out
    .replace(/^(.)(.)/, (_m, a) => `${a}${digitos[arr[0] % digitos.length]}${simbolos[arr[1] % simbolos.length]}`)
    .slice(0, 12);
}

interface Props {
  email: string;
  password: string;
  showPassword: boolean;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onToggleShow: () => void;
  onGenerate: () => void;
}

export function InvitarAgentePasswordTab({
  email,
  password,
  showPassword,
  onEmailChange,
  onPasswordChange,
  onToggleShow,
  onGenerate,
}: Props) {
  return (
    <TabsContent value="password" className="space-y-3 pt-4">
      <div className="space-y-2">
        <Label>Email del agente</Label>
        <Input
          type="email"
          placeholder="contacto@agente.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Contraseña (mínimo 8 caracteres)</Label>
        <div className="flex gap-2">
          <Input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className="font-mono"
            placeholder="••••••••"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onToggleShow}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onGenerate}
            aria-label="Generar contraseña segura"
            title="Generar contraseña segura"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Útil cuando el correo no llega (agentes en China, filtros corporativos). La cuenta queda
        activa al toque y tú compartes las credenciales por WeChat, WhatsApp o el canal que prefieras.
        {" "}Si el agente ya tiene cuenta, esta acción <strong>reasigna</strong> su contraseña.
      </p>
    </TabsContent>
  );
}
