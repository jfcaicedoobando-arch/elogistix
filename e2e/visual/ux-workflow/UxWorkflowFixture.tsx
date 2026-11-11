import { useEffect, useState } from "react";
import { MemoryRouter } from "react-router";
import Facturacion from "@/features/facturacion/routes/Facturacion";
import { PageContainer } from "@/components/shared/PageContainer";
import { EmbarquesSortIndicator } from "@/features/embarques/components/EmbarquesSortIndicator";
import { EmbarquesAlertasPanel } from "@/features/embarques/components/EmbarquesAlertasPanel";
import type { EmbarqueAlertaFiltro } from "@/features/embarques/hooks/useEmbarquesFilters";

export function UxWorkflowFixture() {
  const [action, setAction] = useState("Sin acciones simuladas.");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "eta", dir: "asc" });
  const [alerta, setAlerta] = useState<EmbarqueAlertaFiltro>("todos");
  useEffect(() => {
    const listener = (event: Event) => setAction((event as CustomEvent<string>).detail);
    window.addEventListener("fixture-action", listener);
    return () => window.removeEventListener("fixture-action", listener);
  }, []);
  return (
    <MemoryRouter initialEntries={["/facturacion?bandeja=emitidas"]}>
      <main>
        <aside className="border-b bg-muted/30 px-4 py-2 text-body-sm text-muted-foreground">Prueba visual aislada · datos ficticios · sin conexión al ERP</aside>
        <Facturacion />
        <PageContainer width="wide" aria-label="Controles de embarques de prueba">
          <h2 className="text-xl font-semibold">Embarques</h2>
          <EmbarquesAlertasPanel resumen={{ total: 7, demora: 2, garantia: 1, cierre_operativo: 3, admin_pendiente: 1 }} activeAlerta={alerta} onSelect={setAlerta} />
          <div className="overflow-hidden rounded-md border">
            <EmbarquesSortIndicator sortKey={sort.key} sortDir={sort.dir} onSortChange={(key, dir) => setSort({ key, dir })} onClear={() => setSort({ key: "expediente", dir: "desc" })} />
            <div className="p-4 text-body-sm">Orden local: {sort.key} / {sort.dir}. Filtro local: {alerta}.</div>
          </div>
          <p role="status" className="text-body-sm text-muted-foreground">{action}</p>
        </PageContainer>
      </main>
    </MemoryRouter>
  );
}
