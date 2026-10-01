/**
 * Fase 4 CRM: al quedar en "Cerrado ganado" sin cliente ligado, sugiere dar de
 * alta la empresa como cliente. Nunca crea nada solo: el usuario confirma.
 */
import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  etapaTipo?: string | null;
  clienteId?: string | null;
}

export function SugerirClienteCard({ etapaTipo, clienteId }: Props) {
  if (etapaTipo !== "ganada" || clienteId) return null;
  return (
    <Card className="border-success/40 bg-success/5">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-2 text-sm">
          <Trophy className="h-4 w-4 text-success" />
          <span>Oportunidad ganada. Da de alta la empresa como cliente para empezar a operar.</span>
        </div>
        <Button asChild size="sm">
          <Link to="/clientes?nuevo=1">Crear cliente</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
