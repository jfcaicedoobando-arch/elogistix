/**
 * Fase 4 CRM: al quedar en "Cerrado ganado" sin cliente ligado, sugiere dar de
 * alta la empresa como cliente. Nunca crea nada solo: el usuario confirma.
 */
import { Link } from "react-router";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/lib/contexts/AuthContext";

/** Espejo de los roles que acepta `crear_clientes` en la base. */
const ROLES_CREAR_CLIENTE = new Set(["contador", "operador", "admin_org", "admin", "super_admin"]);

interface Props {
  etapaTipo?: string | null;
  clienteId?: string | null;
}

export function SugerirClienteCard({ etapaTipo, clienteId }: Props) {
  const { effectiveRole } = useAuth();
  if (etapaTipo !== "ganada" || clienteId) return null;
  return (
    <Alert variant="success">
      <Trophy className="size-4" />
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-body">
          <span>Oportunidad ganada. Da de alta la empresa como cliente para empezar a operar.</span>
        </div>
        {ROLES_CREAR_CLIENTE.has(effectiveRole ?? "") && (
          <Button asChild size="sm">
            <Link to="/clientes?nuevo=1">Crear cliente</Link>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
