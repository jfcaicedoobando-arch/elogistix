import { useEffect, useState } from "react";
import { ExtraerCorreoDialog } from "@/features/costeo/tarifario/ExtraerCorreoDialog";
import { CORREO_IDS, correoAudit, resetCorreo, setCorreoOrganization, useCorreoRevision, useOrganization, type CorreoScenario } from "./correo-backend";

const scenarios: { value: CorreoScenario; label: string }[] = [
  { value: "ready", label: "Preparación sin escrituras" },
  { value: "conflict-late", label: "Conflicto después de 1000 registros" },
  { value: "error-conflicts", label: "Error segunda página de conflictos" },
  { value: "error-catalog", label: "Error segunda página de catálogo" },
  { value: "inactive-global", label: "Catálogo global inactivo" },
  { value: "inactive-org", label: "Catálogo oculto por organización" },
];

export function CorreoFixture() {
  const [scenario, setScenario] = useState<CorreoScenario>("ready");
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(0);
  const { organizationId } = useOrganization();
  useCorreoRevision();
  useEffect(() => {
    const changeOrganization = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        setCorreoOrganization(organizationId === CORREO_IDS.orgA ? CORREO_IDS.orgB : CORREO_IDS.orgA);
      }
    };
    window.addEventListener("keydown", changeOrganization);
    return () => window.removeEventListener("keydown", changeOrganization);
  }, [organizationId]);
  return (
    <main style={{ padding: 16, maxWidth: 820, margin: "0 auto" }}>
      <h1>Correo PR372 · laboratorio aislado</h1>
      <p>Correo inventado, parser y diálogo reales. Lecturas y escrituras sólo en memoria.</p>
      <p>Alt+O cambia la organización simulada incluso con el diálogo abierto.</p>
      <label htmlFor="correo-scenario">Escenario de correo</label>{" "}
      <select id="correo-scenario" value={scenario} onChange={event => {
        const value = event.target.value as CorreoScenario;
        setScenario(value); resetCorreo(value); setDone(0);
      }} style={{ padding: 8 }}>
        {scenarios.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <p data-testid="correo-organization">Organización: {organizationId}</p>
      <button onClick={() => setOpen(true)} style={{ padding: 12, border: "1px solid gray" }}>Abrir extracción ficticia</button>
      <p data-testid="correo-done">Finalizaciones: {done}</p>
      <details><summary>Auditoría del stub en memoria</summary><pre data-testid="correo-audit" style={{ whiteSpace: "pre-wrap", fontSize: 11 }}>{JSON.stringify(correoAudit(), null, 2)}</pre></details>
      <ExtraerCorreoDialog open={open} onOpenChange={setOpen} onDone={() => setDone(value => value + 1)} />
    </main>
  );
}
