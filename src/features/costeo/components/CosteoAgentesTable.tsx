/**
 * Tabla de Agentes de costeo — extraída de CosteoAgentes.tsx para respetar Power of 10 (≤200 líneas).
 */
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Trash2, Pencil, UserPlus } from "lucide-react";

export interface AgenteRow {
  id: string;
  nombre: string;
  proveedor_id: string | null;
  pais: string | null;
  dias_credito: number | null;
  contacto_tarifario: string | null;
  email: string | null;
  activo: boolean | null;
}

interface Props {
  agentes: AgenteRow[];
  isLoading: boolean;
  onEditar: (a: AgenteRow) => void;
  onEliminar: (a: { id: string; nombre: string }) => void;
  onInvitarPortal: (a: AgenteRow) => void;
}

export function CosteoAgentesTable({ agentes, isLoading, onEditar, onEliminar, onInvitarPortal }: Props) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>País</TableHead>
            <TableHead className="text-right">Días crédito</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Activo</TableHead>
            <TableHead className="w-24 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">Cargando…</TableCell>
            </TableRow>
          )}
          {!isLoading && agentes.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">Sin agentes registrados.</TableCell>
            </TableRow>
          )}
          {agentes.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{a.nombre}</TableCell>
              <TableCell>{a.pais}</TableCell>
              <TableCell className="text-right">{a.dias_credito}</TableCell>
              <TableCell>{a.contacto_tarifario ?? "—"}</TableCell>
              <TableCell>{a.email ?? "—"}</TableCell>
              <TableCell>
                <Badge
                  variant={a.activo ? "default" : "secondary"}
                  className={a.activo ? "bg-success/15 text-success border-success/30" : ""}
                >
                  {a.activo ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onInvitarPortal(a)}
                    aria-label={`Invitar al portal del agente ${a.nombre}`}
                    title="Invitar al portal del agente"
                  >
                    <UserPlus className="size-4 text-accent" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onEditar(a)}
                    aria-label={`Editar agente ${a.nombre}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onEliminar({ id: a.id, nombre: a.nombre })}
                    aria-label={`Eliminar agente ${a.nombre}`}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
