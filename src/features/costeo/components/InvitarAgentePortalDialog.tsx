/**
 * Diálogo para invitar a un agente de carga al Portal del Agente.
 *
 * Dos modos:
 *  - "email": dispara correo de invitación / reset password (default).
 *  - "password": el admin asigna la contraseña directamente y luego la
 *    comparte por el canal que sea (WeChat, WhatsApp). Útil porque a los
 *    agentes en China muchas veces no les llega el correo.
 *
 * Llama a la edge function `user-management` con action `invite-agente`.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Send, Eye, EyeOff, Copy, RefreshCw, Check } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { supabase } from "@/integrations/supabase/client";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import type { AgenteRow } from "./CosteoAgentesTable";

interface Props {
  agente: AgenteRow | null;
  onOpenChange: (open: boolean) => void;
}

type Mode = "email" | "password";

/** Genera una contraseña legible de 12 chars (letras + dígitos + símbolo seguro). */
function generarPasswordSegura(): string {
  const letras = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digitos = "23456789";
  const simbolos = "!@#$%*-_";
  const todo = letras + digitos + simbolos;
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < 12; i++) out += todo[arr[i] % todo.length];
  // Garantiza al menos un dígito y un símbolo.
  return out.replace(/^(.)(.)/, (_m, a) => `${a}${digitos[arr[0] % digitos.length]}${simbolos[arr[1] % simbolos.length]}`).slice(0, 12);
}

export function InvitarAgentePortalDialog({ agente, onOpenChange }: Props) {
  const { organizationId } = useOrganization();
  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [credencialesCreadas, setCredencialesCreadas] = useState<{ email: string; password: string } | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const reset = () => {
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setMode("email");
    setCredencialesCreadas(null);
    setCopiado(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleCopiar = async (texto: string, llave: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(llave);
      setTimeout(() => setCopiado((c) => (c === llave ? null : c)), 1500);
    } catch {
      notifyError(undefined, { title: "No se pudo copiar al portapapeles" });
    }
  };

  const handleInvite = async () => {
    if (!agente || !organizationId) return;
    if (!email.includes("@")) {
      notifyError(undefined, { title: "Email inválido" });
      return;
    }
    if (mode === "password" && password.length < 8) {
      notifyError(undefined, { title: "La contraseña debe tener al menos 8 caracteres" });
      return;
    }
    setPending(true);
    const { data, error } = await supabase.functions.invoke("user-management", {
      body: {
        action: "invite-agente",
        email,
        agente_id: agente.id,
        organization_id: organizationId,
        mode,
        ...(mode === "password" ? { password } : {}),
      },
    });
    setPending(false);
    if (error) {
      notifyError(undefined, { title: `Error al invitar: ${error.message}`, error, method: "INVITE_AGENTE" });
      return;
    }

    if (mode === "password") {
      // Conservamos las credenciales en memoria para que el admin las copie y comparta.
      setCredencialesCreadas({ email, password });
      notifySuccess(undefined, {
        title: "Cuenta creada con contraseña",
        description: "Copia las credenciales antes de cerrar.",
      });
      return;
    }

    const isNew = (data as { is_new?: boolean } | null)?.is_new;
    notifySuccess(undefined, {
      title: isNew ? "Invitación enviada al agente" : "Usuario existente vinculado",
    });
    reset();
    onOpenChange(false);
  };

  // Vista de "credenciales listas" — reemplaza el formulario tras éxito en modo password.
  if (credencialesCreadas) {
    const ambos = `Email: ${credencialesCreadas.email}\nContraseña: ${credencialesCreadas.password}`;
    return (
      <FormDialogShell
        open={!!agente}
        onOpenChange={handleClose}
        icon={Check}
        title="Cuenta creada"
        description="Copia las credenciales y compártelas con el agente por el canal que prefieras (WeChat, WhatsApp, etc.). No volverás a ver la contraseña."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => handleCopiar(ambos, "ambos")}>
              <Copy className="h-4 w-4 mr-1" />
              {copiado === "ambos" ? "Copiado" : "Copiar ambos"}
            </Button>
            <Button onClick={() => handleClose(false)}>Cerrar</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <div className="flex gap-2">
              <Input readOnly value={credencialesCreadas.email} className="font-mono text-sm" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopiar(credencialesCreadas.email, "email")}
                aria-label="Copiar email"
              >
                {copiado === "email" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Contraseña</Label>
            <div className="flex gap-2">
              <Input readOnly value={credencialesCreadas.password} className="font-mono text-sm" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopiar(credencialesCreadas.password, "password")}
                aria-label="Copiar contraseña"
              >
                {copiado === "password" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            El agente debe entrar a <code>/login</code> con estas credenciales. Si las pierde, puedes
            reabrir este modal y asignar otra contraseña.
          </p>
        </div>
      </FormDialogShell>
    );
  }

  return (
    <FormDialogShell
      open={!!agente}
      onOpenChange={handleClose}
      icon={Send}
      title="Invitar agente al Portal"
      description={
        agente
          ? `Da acceso a ${agente.nombre} para subir tarifas y carta garantía desde el Portal del Agente.`
          : ""
      }
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button
            onClick={handleInvite}
            disabled={!email || pending || (mode === "password" && password.length < 8)}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {mode === "password" ? "Crear cuenta" : "Enviar invitación"}
          </Button>
        </>
      }
    >
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email">Enviar por email</TabsTrigger>
          <TabsTrigger value="password">Asignar contraseña</TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-3 pt-4">
          <div className="space-y-2">
            <Label>Email del agente</Label>
            <Input
              type="email"
              placeholder="contacto@agente.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Se enviará un correo para que establezca su contraseña. Si el agente está en China y no
            le llega el email, usa <strong>Asignar contraseña</strong>.
          </p>
        </TabsContent>

        <TabsContent value="password" className="space-y-3 pt-4">
          <div className="space-y-2">
            <Label>Email del agente</Label>
            <Input
              type="email"
              placeholder="contacto@agente.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Contraseña (mínimo 8 caracteres)</Label>
            <div className="flex gap-2">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono"
                placeholder="••••••••"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  setPassword(generarPasswordSegura());
                  setShowPassword(true);
                }}
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
      </Tabs>
    </FormDialogShell>
  );
}
