import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Truck, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { embarques, formatCurrency, getEstadoColor } from "@/data/mockData";
import { useProveedores } from "@/hooks/useProveedores";
import EditarProveedorDialog from "@/components/EditarProveedorDialog";

export default function ProveedorDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { proveedores, updateProveedor } = useProveedores();
  const [editOpen, setEditOpen] = useState(false);

  const prov = proveedores.find(p => p.id === id);

  if (!prov) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-muted-foreground">Proveedor no encontrado</p>
        <Button variant="outline" onClick={() => navigate("/proveedores")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Proveedores
        </Button>
      </div>
    );
  }

  const operaciones = embarques.flatMap(e =>
    e.conceptosCosto
      .filter(c => c.proveedorId === id)
      .map(c => ({ ...c, expediente: e.expediente, embarqueId: e.id, clienteNombre: e.clienteNombre }))
  );

  const totalFacturado = operaciones.reduce((sum, o) => sum + o.monto, 0);
  const totalPagado = operaciones.filter(o => o.estadoLiquidacion === 'Pagado').reduce((sum, o) => sum + o.monto, 0);
  const totalPendiente = totalFacturado - totalPagado;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/proveedores")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Truck className="h-6 w-6 text-accent" />
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{prov.nombre}</h1>
            <Badge variant="secondary">{prov.tipo}</Badge>
          </div>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" /> Editar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Datos Generales</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">RFC:</span> {prov.rfc}</p>
            <p><span className="text-muted-foreground">Contacto:</span> {prov.contacto}</p>
            <p><span className="text-muted-foreground">Email:</span> {prov.email}</p>
            <p><span className="text-muted-foreground">Teléfono:</span> {prov.telefono}</p>
            <p><span className="text-muted-foreground">Moneda preferida:</span> {prov.monedaPreferida}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Facturado</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalFacturado, prov.monedaPreferida)}</p>
            <p className="text-xs text-muted-foreground">{operaciones.length} operaciones</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-green-600">Pagado</CardTitle></CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{formatCurrency(totalPagado, prov.monedaPreferida)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-orange-600">Pendiente</CardTitle></CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{formatCurrency(totalPendiente, prov.monedaPreferida)}</p>
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
                {operaciones.map((o, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Link to={`/embarques/${o.embarqueId}`} className="text-primary hover:underline font-medium text-xs">
                        {o.expediente}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">{o.clienteNombre}</TableCell>
                    <TableCell className="text-xs">{o.concepto}</TableCell>
                    <TableCell className="text-xs font-medium">{formatCurrency(o.monto, o.moneda)}</TableCell>
                    <TableCell><Badge className={`text-xs ${getEstadoColor(o.estadoLiquidacion)}`}>{o.estadoLiquidacion}</Badge></TableCell>
                    <TableCell className="text-xs">{o.fechaVencimiento || '—'}</TableCell>
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
        proveedor={prov}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={updateProveedor}
      />
    </div>
  );
}
