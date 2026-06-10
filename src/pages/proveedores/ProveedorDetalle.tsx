import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowLeft, Truck, Pencil, Trash2, PackageX, MoreHorizontal,
  Upload, Loader2, Eye, EyeOff, Landmark,
} from "lucide-react";
import { toast } from "sonner";
import { useRegisterBreadcrumbLabel } from "@/contexts/BreadcrumbContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, toTitleCase, formatPhoneMx } from "@/lib/formatters";
import EditarProveedorDialog from "@/components/proveedor/EditarProveedorDialog";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import EmptyState from "@/components/empty/EmptyState";
import { useProveedorDetalleController } from "@/hooks/proveedor";
import { parseCsf, type CsfParsedData } from "@/services/csf";
import { ProveedorOperacionesTable } from "./ProveedorOperacionesTable";

function maskClabe(clabe: string | null | undefined, reveal: boolean): string {
  if (!clabe) return "No capturado";
  if (reveal) return clabe;
  const last4 = clabe.slice(-4);
  return `${"•".repeat(Math.max(0, clabe.length - 4))}${last4}`;
}

export default function ProveedorDetalle() {
  const { id } = useParams<{ id: string }>();
  const {
    proveedor, isLoading, isDeleting, operaciones,
    totalFacturado, totalPagado, totalPendiente,
    canEdit, isAdmin, editOpen, setEditOpen,
    deleteOpen, setDeleteOpen, handleUpdate, handleDelete, navigate,
  } = useProveedorDetalleController();
  useRegisterBreadcrumbLabel(id, proveedor?.nombre);

  const csfInputRef = useRef<HTMLInputElement>(null);
  const [csfLoading, setCsfLoading] = useState(false);
  const [revealClabe, setRevealClabe] = useState(false);

  const handleCsfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !proveedor) return;

    setCsfLoading(true);
    let data: CsfParsedData;
    try {
      data = await parseCsf(file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo procesar la CSF";
      toast.error(msg);
      setCsfLoading(false);
      return;
    }

    const rfcCsf = (data.rfc ?? "").trim().toUpperCase();
    const rfcProv = (proveedor.rfc ?? "").trim().toUpperCase();
    if (!rfcCsf) {
      toast.error("No se pudo extraer el RFC de la CSF. Verifica que el PDF sea legible.");
      setCsfLoading(false);
      return;
    }
    if (rfcCsf !== rfcProv) {
      toast.error("La CSF no corresponde a este proveedor", {
        description: `La constancia pertenece a ${data.nombre ?? "otra empresa"} (RFC ${rfcCsf}). El proveedor tiene RFC ${rfcProv || "—"}. No se actualizó nada.`,
        duration: 8000,
      });
      setCsfLoading(false);
      return;
    }

    // RFC match → aplicar solo campos presentes.
    const patch: Record<string, string> = {};
    if (data.nombre?.trim()) patch.nombre = data.nombre.trim();
    if (data.cp?.trim()) patch.cp = data.cp.trim();
    if (data.direccion?.trim()) patch.direccion = data.direccion.trim();
    if (data.ciudad?.trim()) patch.ciudad = data.ciudad.trim();
    if (data.estado?.trim()) patch.estado = data.estado.trim();
    if (data.regimen_fiscal?.trim()) patch.regimen_fiscal = data.regimen_fiscal.trim();

    if (Object.keys(patch).length === 0) {
      toast.warning("La CSF se validó correctamente pero no contenía datos nuevos para actualizar.");
      setCsfLoading(false);
      return;
    }

    try {
      await handleUpdate(proveedor.id, patch);
      toast.success("Datos fiscales actualizados desde la CSF");
    } finally {
      setCsfLoading(false);
    }
  };

  if (isLoading) {
    return <div className="space-y-4 p-8">{[1, 2, 3].map((indice) => <Skeleton key={indice} className="h-24 w-full" />)}</div>;
  }

  if (!proveedor) {
    return (
      <div className="py-12">
        <EmptyState
          icon={PackageX}
          title="Proveedor no encontrado"
          description="El proveedor que buscas no existe o fue eliminado."
          primaryAction={{
            label: "Volver a Proveedores",
            onClick: () => navigate("/proveedores"),
            variant: "outline",
          }}
        />
      </div>
    );
  }

  const nombreFmt = toTitleCase(proveedor.nombre);
  const rfcFmt = (proveedor.rfc || "").toUpperCase();
  const contactoFmt = toTitleCase(proveedor.contacto);
  const telFmt = formatPhoneMx(proveedor.telefono);
  const opsLabel = operaciones.length === 1 ? "operación" : "operaciones";
  const esNacional = proveedor.origen_proveedor === "Nacional";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/proveedores")} aria-label="Volver a proveedores">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Truck className="h-6 w-6 text-accent" />
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" title={proveedor.nombre}>{nombreFmt}</h1>
            <Badge variant="secondary">
              {proveedor.categoria === "GastoOperativo" ? (proveedor.subtipo_gasto ?? "Gasto operativo") : (proveedor.tipo ?? "—")}
            </Badge>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2 items-center">
            <Button size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
            {esNacional && (
              <>
                <input
                  ref={csfInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleCsfFile}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={csfLoading}
                  onClick={() => csfInputRef.current?.click()}
                  title="Actualizar datos fiscales desde la Constancia de Situación Fiscal"
                >
                  {csfLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando…</>
                  ) : (
                    <><Upload className="mr-2 h-4 w-4" /> Actualizar con CSF</>
                  )}
                </Button>
              </>
            )}
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" aria-label={`Más acciones del proveedor ${nombreFmt}`}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => setDeleteOpen(true)}
                    disabled={isDeleting}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Datos Generales</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">RFC:</span> <span className="font-mono">{rfcFmt}</span></p>
            <p><span className="text-muted-foreground">Contacto:</span> {contactoFmt}</p>
            <p><span className="text-muted-foreground">Email:</span> {proveedor.email}</p>
            <p><span className="text-muted-foreground">Teléfono:</span> {telFmt}</p>
            <p><span className="text-muted-foreground">Moneda preferida:</span> {proveedor.moneda_preferida}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Facturado</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalFacturado, proveedor.moneda_preferida)}</p>
            <p className="text-xs text-muted-foreground">{operaciones.length} {opsLabel}</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-success">Pagado</CardTitle></CardHeader>
            <CardContent>
              <p className="text-lg font-bold tabular-nums">{formatCurrency(totalPagado, proveedor.moneda_preferida)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-warning">Pendiente</CardTitle></CardHeader>
            <CardContent>
              <p className="text-lg font-bold tabular-nums">{formatCurrency(totalPendiente, proveedor.moneda_preferida)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            Datos bancarios
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Banco</p>
            <p className={proveedor.banco ? "font-medium" : "text-muted-foreground italic"}>
              {proveedor.banco || "No capturado"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">CLABE interbancaria</p>
            {proveedor.clabe ? (
              <div className="flex items-center gap-2">
                <span className="font-mono tabular-nums tracking-wider">{maskClabe(proveedor.clabe, revealClabe)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setRevealClabe((v) => !v)}
                  aria-label={revealClabe ? "Ocultar CLABE" : "Mostrar CLABE"}
                >
                  {revealClabe ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground italic">No capturado</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Historial de Operaciones</CardTitle></CardHeader>
        <CardContent className="p-0">
          <ProveedorOperacionesTable operaciones={operaciones} />
        </CardContent>
      </Card>

      <EditarProveedorDialog
        proveedor={proveedor}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleUpdate}
      />

      <DoubleConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entityName="proveedor"
        description={`Estás a punto de eliminar a ${nombreFmt}. Esta acción no se puede deshacer.`}
        finalDescription={`¿Realmente deseas eliminar permanentemente a ${nombreFmt}?`}
        onConfirm={handleDelete}
        isPending={isDeleting}
      />
    </div>
  );
}
