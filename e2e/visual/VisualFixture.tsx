import { useState } from "react";
import { ClipboardList, FileText, Ship, Wallet } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sidebar, SidebarProvider, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";

type Row = { id: string; folio: string; cliente: string; ruta: string; moneda: string; total: string; estado: string };
const data: Row[] = Array.from({ length: 6 }, (_, i) => ({
  id: "qa-" + i, folio: "COT-QA-2026-" + String(i + 1).padStart(3, "0"),
  cliente: i % 2 ? "Maquinados del Norte" : "Refacciones Industriales Regiomontanas",
  ruta: i % 2 ? "Shanghai → Lázaro Cárdenas" : "Ningbo → Manzanillo",
  moneda: i % 2 ? "MXN" : "USD", total: i % 2 ? "$34,800.00" : "$1,800.00",
  estado: i % 2 ? "Aceptada" : "Cotizada",
}));
const columns = defineColumns<Row>([
  { accessorKey: "folio", header: "Folio", size: 170 },
  { accessorKey: "cliente", header: "Cliente", size: 270 },
  { accessorKey: "ruta", header: "Ruta", size: 210 },
  { accessorKey: "moneda", header: "Moneda", size: 80 },
  { accessorKey: "total", header: "Total", size: 110, cell: ({ row }) => <span className="tabular-nums">{row.original.total}</span> },
  { accessorKey: "estado", header: "Estado", size: 100, cell: ({ row }) => <Badge variant="secondary">{row.original.estado}</Badge> },
]);
const nav = [{ label: "Cotizaciones", icon: FileText }, { label: "Embarques", icon: Ship }, { label: "Tesorería", icon: Wallet }];

/** Only real shared UI components; fixtures are local constants, never saved. */
export function VisualFixture() {
  const [open, setOpen] = useState(false);
  const state = new URLSearchParams(location.search).get("state");
  return <SidebarProvider>
    <Sidebar collapsible="icon">
      <SidebarHeader><strong>LibreCarga QA</strong></SidebarHeader>
      <SidebarContent><SidebarMenu>{nav.map(({ label, icon: Icon }, i) => <SidebarMenuItem key={label}>
        <SidebarMenuButton isActive={i === 0} tooltip={label}><Icon /><span>{label}</span></SidebarMenuButton>
      </SidebarMenuItem>)}</SidebarMenu></SidebarContent>
    </Sidebar>
    <SidebarInset className="min-w-0">
      <header className="flex h-14 items-center gap-3 border-b px-4"><SidebarTrigger /><span>Empresa de prueba · Monterrey</span></header>
      <PageContainer>
        <PageHeader title="Cotizaciones" description="Control comercial de servicios logísticos internacionales."
          actions={<Button onClick={() => setOpen(true)}>Nueva cotización</Button>} subHeader={<Badge variant="outline">6 cotizaciones · datos QA</Badge>} />
        <Input aria-label="Buscar cotizaciones" placeholder="Buscar por folio, cliente o ruta…" />
        <DataTable columns={columns} data={state === "empty" ? [] : data} rowKey={r => r.id}
          isLoading={state === "loading"} isError={state === "error"} onRetry={() => undefined}
          emptyMessage="Sin cotizaciones" emptyHint="Crea la primera cotización para iniciar tu operación." />
      </PageContainer>
    </SidebarInset>
    <FormDialogShell open={open} onOpenChange={setOpen} icon={ClipboardList} title="Nueva cotización"
      description="Datos de la operación · Ningbo a Manzanillo" stepper={{ step: 1, totalSteps: 3, labels: ["Cliente", "Ruta", "Conceptos"] }}
      autoFocusFirstField={false} footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled>Continuar</Button></>}>
      <div className="space-y-2"><Label htmlFor="qa-cliente">Cliente</Label><Input id="qa-cliente" readOnly value="Refacciones Industriales Regiomontanas" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label htmlFor="qa-origen">Origen</Label><Input id="qa-origen" readOnly value="Ningbo, China" /></div>
        <div className="space-y-2"><Label htmlFor="qa-destino">Destino</Label><Input id="qa-destino" readOnly value="Manzanillo, México" /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="qa-mercancia">Mercancía</Label><Input id="qa-mercancia" readOnly value="Refacciones industriales · 1 contenedor 40HC" /></div>
      <p className="text-sm text-muted-foreground">Captura de prueba sin guardar registros ni llamar al backend.</p>
    </FormDialogShell>
  </SidebarProvider>;
}
