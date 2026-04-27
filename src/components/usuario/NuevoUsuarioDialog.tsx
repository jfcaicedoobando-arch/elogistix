import { useState } from "react";
import { dialogSize } from "@/lib/ui/dialogTokens";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { useCreateUser } from "@/hooks/usuario/useUsuarioMutations";
import { useOrganizationsList } from "@/hooks/admin/useOrganizationsList";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  showOrgSelector?: boolean;
}

export default function NuevoUsuarioDialog({ open, onOpenChange, onCreated, showOrgSelector = false }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("viewer");
  const [orgId, setOrgId] = useState("");
  const { toast } = useToast();
  const createUser = useCreateUser();

  const { data: orgs = [] } = useOrganizationsList(open && showOrgSelector);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (showOrgSelector && !orgId) {
      notifyError(toast, { title: "Error", description: "Selecciona una organización"});
      return;
    }
    if (password.length < 6) {
      notifyError(toast, { title: "Error", description: "La contraseña debe tener al menos 6 caracteres"});
      return;
    }

    createUser.mutate(
      { email, password, role, orgId: showOrgSelector ? orgId : undefined },
      {
        onSuccess: () => {
          notifySuccess(toast, { title: "Usuario creado", description: `Se registró ${email} como ${role}` });
          setEmail("");
          setPassword("");
          setRole("viewer");
          setOrgId("");
          onOpenChange(false);
          onCreated();
        },
        onError: (err: unknown) => {
          notifyError(toast, { title: "Error", description: getErrorMessage(err)});
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogSize.md}>
        <DialogHeader>
          <DialogTitle>{showOrgSelector ? "Nuevo Usuario Global" : "Nuevo Usuario"}</DialogTitle>
          <DialogDescription>
            {showOrgSelector
              ? "Registra un nuevo usuario y asígnalo a una organización."
              : "Registra un nuevo usuario en el sistema."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nu-email">Email</Label>
            <Input id="nu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="usuario@empresa.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nu-password">Contraseña</Label>
            <Input id="nu-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" />
          </div>
          {showOrgSelector && (
            <div className="space-y-2">
              <Label>Organización</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona organización" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="operador">Operador</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createUser.isPending}>Cancelar</Button>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear usuario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
