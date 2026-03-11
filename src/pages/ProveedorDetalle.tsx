import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Truck, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useProveedor, useProveedorMutations } from "@/hooks/useProveedores";
import { formatCurrency } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/helpers";
import EditarProveedorDialog from "@/components/EditarProveedorDialog";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function ProveedorDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: proveedor, isLoading } = useProveedor(id);
  const { updateProveedor } = useProveedorMutations();
  const [editOpen, setEditOpen] = useState(false);
  const { canEdit } = usePermissions();

  // Fetch operaciones (conceptos_costo) for this provider with embarque info
  const { data: operaciones = [] } = useQuery({
    queryKey: ["proveedor-operaciones", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conceptos_costo")
        .select("*, embarques!conceptos_costo_embarque_id_fkey(expediente, id, cliente_nombre)")
        .eq("proveedor_id", id!);
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        concepto: row.concepto,
        monto: Number(row.monto),
        moneda: row.moneda,
        estadoLiquidacion: row.estado_liquidacion,
        fechaVencimiento: row.fecha_vencimiento,
        expediente: row.embarques?.expediente ?? '',
        embarqueId: row.embarques?.id ?? '',
        clienteNombre: row.embarques?.cliente_nombre ?? '',
      }));
    },
  });

  if (isLoading) {
    return <div className="space-y-4 p-8">{[1,2,3].map(indice => <Skeleton key={indice} className="h-24 w-full" />)}</div>;
  }

  if (!proveedor) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-muted-foreground">Proveedor no encontrado</p>
        <Button variant="outline" onClick={() => navigate("/proveedores")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Proveedores
        </Button>
      </div>
    );
  }

  const totalFacturado = operaciones.reduce((sum, operacion) => sum + operacion.monto, 0);
  const totalPagado = operaciones.filter(operacion => operacion.estadoLiquidacion === 'Pagado').reduce((sum, operacion) => sum + operacion.monto, 0);
  const totalPendiente = totalFacturado - totalPagado;

  const handleUpdate = async (id: string, data: any) => {
    try {
      await updateProveedor(id, data);
      toast.success("Proveedor actualizado");
    } catch {
      toast.error("Error al actualizar");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/proveedores")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Truck className="h-6 w-6 text-accent" />
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{proveedor.nombre}</h1>
            <Badge variant="secondary">{proveedor.tipo}</Badge>
          </div>
        </div>
        {canEdit && (
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Datos Generales</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">RFC:</span> {proveedor.rfc}</p>
            <p><span className="text-muted-foreground">Contacto:</span> {proveedor.contacto}</p>
            <p><span className="text-muted-foreground">Email:</span> {proveedor.email}</p>
            <p><span className="text-muted-foreground">Teléfono:</span> {proveedor.telefono}</p>
            <p><span className="text-muted-foreground">Moneda preferida:</span> {proveedor.moneda_preferida}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Facturado</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalFacturado, proveedor.moneda_preferida)}</p>
            <p className="text-xs text-muted-foreground">{operaciones.length} operaciones</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-green-600">Pagado</CardTitle></CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{formatCurrency(totalPagado, proveedor.moneda_preferida)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-orange-600">Pendiente</CardTitle></CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{formatCurrency(totalPendiente, proveedor.moneda_preferida)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Historial de Operaciones</CardTitle></CardHeader>
        <CardContent className="p-0">
          {operaciones.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expediente</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Vencimiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operaciones.map((operacion, indice) => (
                  <TableRow key={indice}>
                    <TableCell>
                      <Link to={`/embarques/${operacion.embarqueId}`} className="text-primary hover:underline font-medium text-xs">
                        {operacion.expediente}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">{operacion.clienteNombre}</TableCell>
                    <TableCell className="text-xs">{operacion.concepto}</TableCell>
                    <TableCell className="text-xs font-medium">{formatCurrency(operacion.monto, operacion.moneda)}</TableCell>
                    <TableCell><Badge className={`text-xs ${getEstadoColor(operacion.estadoLiquidacion)}`}>{operacion.estadoLiquidacion}</Badge></TableCell>
                    <TableCell className="text-xs">{operacion.fechaVencimiento || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="p-8 text-sm text-muted-foreground text-center">Sin operaciones registradas</p>
          )}
        </CardContent>
      </Card>

      <EditarProveedorDialog
        proveedor={proveedor}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleUpdate}
      />
    </div>
  );
}
