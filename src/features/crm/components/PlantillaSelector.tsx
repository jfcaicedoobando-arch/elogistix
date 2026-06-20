/**
 * Dropdown que lista plantillas activas y abre mailto:/wa.me con variables renderizadas.
 */
import { MessageSquare, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { usePlantillasMensaje, renderPlantilla, type PlantillaCanal } from "@/features/crm/hooks";
import { insertBitacora } from "@/features/auditoria/services/bitacora";
import { useAuth } from "@/lib/contexts/AuthContext";
import { buildWhatsappUrl } from "@/constants/externalUrls";

interface Props {
  canal: PlantillaCanal;
  destino: string; // email o teléfono
  vars: Record<string, string | number | null | undefined>;
  entidadTipo: "lead" | "oportunidad";
  entidadId: string;
}

function sanitizeTel(t: string): string {
  return t.replace(/[^\d+]/g, "");
}

export default function PlantillaSelector({ canal, destino, vars, entidadTipo, entidadId }: Props) {
  const { data = [] } = usePlantillasMensaje(canal, true);
  const { user } = useAuth();
  const Icon = canal === "email" ? Mail : MessageSquare;

  const handleUsar = (_plantillaId: string, asunto: string, cuerpo: string, nombre: string) => {
    const asuntoR = renderPlantilla(asunto, vars);
    const cuerpoR = renderPlantilla(cuerpo, vars);
    if (canal === "email") {
      window.location.href = `mailto:${encodeURIComponent(destino)}?subject=${encodeURIComponent(asuntoR)}&body=${encodeURIComponent(cuerpoR)}`;
    } else {
      const tel = sanitizeTel(destino);
      if (!tel) return;
      window.open(buildWhatsappUrl(tel, cuerpoR), "_blank", "noopener");
    }
    // Bitácora best-effort
    if (user?.id) {
      insertBitacora({
        usuarioId: user.id,
        usuarioEmail: user.email ?? "",
        accion: "plantilla_enviada",
        modulo: "crm",
        entidadId: entidadId,
        entidadNombre: `${entidadTipo}:${nombre}`,
        detalles: { canal, plantilla: nombre },
      }).catch(() => undefined);
    }
  };

  if (!destino || data.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
          <Icon className="h-3 w-3" /> Plantilla
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">
          Plantillas {canal === "email" ? "de email" : "WhatsApp"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {data.map((p) => (
          <DropdownMenuItem key={p.id} onClick={() => handleUsar(p.id, p.asunto, p.cuerpo, p.nombre)}>
            <span className="truncate">{p.nombre}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
