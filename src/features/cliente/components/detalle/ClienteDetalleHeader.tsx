import { Pencil, FileText, Users, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DetailSkeleton } from "@/components/shared/skeletons";
import { useVolver } from "@/hooks/shared/useVolver";
import { DetailNotFound } from "@/components/shared/DetailNotFound";
import { toTitleCase, formatCurrency } from "@/lib/formatters";
import { leerFlagAutorizacion } from "@/features/cliente/domain/autorizacionCliente";
import { BadgeClienteDeCasa } from "@/features/cliente/components/BadgeClienteDeCasa";

interface Cliente {
  id: string;
  nombre: string;
  rfc: string;
  direccion: string;
  ciudad: string;
  estado: string;
  regimen_fiscal?: string | null;
  dias_credito?: number | null;
  limite_credito_mxn?: number | null;
  requiere_autorizacion_cotizacion?: boolean | null;
  requiere_autorizacion_proforma?: boolean | null;
}

interface Props {
  cliente: Cliente;
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
}

/**
 * Encabezado del detalle de cliente. v13.571.0 — homologado con proveedor:
 * acción primaria sólida (Editar) + menú "Más acciones", y badges de identidad
 * fiscal/crediticia junto al título.
 * v13.624.1 — muestra el estatus de autorización (cliente de casa) para que el
 * usuario confirme el cambio sin volver a abrir el modal de edición.
 */
export function ClienteDetalleHeader({ cliente, canEdit, onEdit }: Props) {
  const navigate = useNavigate();
  const volver = useVolver("/clientes");
  const badges: string[] = [];
  if (cliente.regimen_fiscal) badges.push(`Régimen ${cliente.regimen_fiscal}`);
  if (typeof cliente.dias_credito === "number") badges.push(`${cliente.dias_credito} días de crédito`);
  if (typeof cliente.limite_credito_mxn === "number" && cliente.limite_credito_mxn > 0) {
    badges.push(`Límite ${formatCurrency(cliente.limite_credito_mxn, "MXN")}`);
  }
  const requiereCotizacion = leerFlagAutorizacion(cliente, "requiere_autorizacion_cotizacion");
  const requiereProforma = leerFlagAutorizacion(cliente, "requiere_autorizacion_proforma");
  const clienteDeCasa = !requiereCotizacion && !requiereProforma;
  if (!clienteDeCasa && !requiereCotizacion) badges.push("Cotizaciones sin autorización del cliente");
  if (!clienteDeCasa && !requiereProforma) badges.push("Proformas sin autorización del cliente");


  return (
    <DetailHeader
      backTo={volver}
      backLabel="Volver a Clientes"
      icon={<Users className="h-6 w-6 text-accent shrink-0" />}
      title={toTitleCase(cliente.nombre)}
      subtitle={
        cliente.rfc ? (
          <span className="font-mono text-xs tracking-wide">RFC / Tax ID · {cliente.rfc}</span>
        ) : undefined
      }
      badge={
        badges.length > 0 || clienteDeCasa ? (
          <div className="flex flex-wrap items-center gap-2">
            {clienteDeCasa && <BadgeClienteDeCasa tipo="cotizacion" />}
            {badges.map((b, i) => (
              <Badge key={b} variant={i === 0 ? "secondary" : "outline"} className="font-normal">
                {b}
              </Badge>
            ))}
          </div>
        ) : undefined
      }
      trailing={
        <>
          {canEdit && (
            <Button size="sm" onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Más acciones del cliente ${toTitleCase(cliente.nombre)}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() => navigate(`/clientes/${cliente.id}/estado-de-cuenta`)}
              >
                <FileText className="mr-2 h-4 w-4" /> Estado de cuenta completo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    />
  );
}


export function ClienteLoadingState() {
  return (
    <PageContainer>
      <DetailSkeleton />
    </PageContainer>
  );
}

export function ClienteNotFoundState() {
  return (
    <DetailNotFound
      icon={Users}
      title="Cliente no encontrado"
      description="El cliente no existe, fue eliminado o no tienes permiso para verlo."
      backTo="/clientes"
      backLabel="Volver a Clientes"
      withContainer={false}
    />
  );
}
