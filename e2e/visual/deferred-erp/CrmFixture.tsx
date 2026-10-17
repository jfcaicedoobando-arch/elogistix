import { useState, useSyncExternalStore } from "react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VinculosCard } from "@/features/crm/components/objetos/VinculosCard";
import {
  CRM_OWNERS, getCrmBackendState, getCrmBackendVersion, resetCrmBackend, subscribeCrmBackend,
} from "./crm-backend";

function CrmCards() {
  useSyncExternalStore(subscribeCrmBackend, getCrmBackendVersion);
  const state = getCrmBackendState();
  return <main style={{ padding: 16, maxWidth: 1000, margin: "0 auto" }}>
    <h1>CRM PR373 · vínculos ficticios</h1>
    <p>Tarjeta, hook y servicio reales. Supabase en memoria, sin empresas reales.</p>
    <p><output data-testid="crm-write-count">Escrituras simuladas: {state.writes.length}</output></p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16 }}>
      {(["contacto", "oportunidad"] as const).flatMap(origin => {
        const relation = origin === "contacto" ? "empresas-de-contacto" : "empresas-de-oportunidad";
        const type = origin === "contacto" ? "empresa-contacto" : "oportunidad-empresa";
        return (["editable", "readonly", "noConfig", "hidden"] as const).map(mode => {
          const owner = CRM_OWNERS[origin][mode];
          const title = `${origin === "contacto" ? "Contacto" : "Oportunidad"} · ${
            { editable: "con edición", readonly: "sin permiso de edición", noConfig: "sin configuración de edición", hidden: "embeds ocultos" }[mode]
          }`;
          return <section key={owner} aria-label={title} data-testid={`crm-${origin}-${mode}`} style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{title}</h2>
            <VinculosCard titulo="Empresas" relacion={relation} duenoId={owner} rutaBase="/crm/empresas"
              canEdit={mode === "editable" || mode === "noConfig"}
              edicion={mode === "noConfig" ? undefined : {
                tipo: type, objeto: "empresa",
                par: other => origin === "contacto" ? { aId: other, bId: owner } : { aId: owner, bId: other },
              }} />
          </section>;
        });
      })}
    </div>
    <pre data-testid="crm-backend-state" hidden>{JSON.stringify(state)}</pre>
  </main>;
}

export function CrmFixture() {
  const [client] = useState(() => {
    resetCrmBackend();
    return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: Infinity }, mutations: { retry: false } } });
  });
  return <QueryClientProvider client={client}><MemoryRouter><CrmCards /></MemoryRouter></QueryClientProvider>;
}
