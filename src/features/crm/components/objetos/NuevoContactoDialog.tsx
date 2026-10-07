/**
 * Alta de Contacto del CRM: nombre, correo, teléfono, empresa obligatoria
 * y, opcionalmente, el resto de las propiedades del contacto.
 */
import { useState, type FormEvent } from "react";
import { ChevronDown, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { useCrearContactoCrm } from "@/features/crm/hooks/useObjetosCrm";
import { usePropiedadesCrm } from "@/features/crm/hooks/usePropiedadesCrm";
import type { PropiedadCrm } from "@/features/crm/services/propiedadesCrm";
import type { RefRow } from "@/features/crm/services/objetosCrm";
import { filaValor, type ValorEntrada } from "@/features/crm/services/valoresCrm";
import { OportunidadEmpresaField } from "@/features/crm/components/nuevaOportunidad/OportunidadEmpresaField";
import { CampoPropiedad } from "./CampoPropiedad";

const FORM_ID = "nuevo-contacto-crm";
const vacio = (v: ValorEntrada | undefined) => v == null || v === "" || (Array.isArray(v) && v.length === 0);

interface Props { open: boolean; onOpenChange: (open: boolean) => void }

export function NuevoContactoDialog({ open, onOpenChange }: Props) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [empresa, setEmpresa] = useState<RefRow | null>(null);
  const [valores, setValores] = useState<Record<string, ValorEntrada>>({});
  const [verMas, setVerMas] = useState(false);
  const [version, setVersion] = useState(0);
  const crear = useCrearContactoCrm();
  const props = (usePropiedadesCrm("contacto").data ?? []).filter((p) => !p.archivada);
  const listo = !!nombre.trim() && !!empresa && !crear.isPending;

  const cerrar = () => {
    setNombre(""); setEmail(""); setTelefono(""); setEmpresa(null); setValores({});
    setVerMas(false); setVersion((v) => v + 1); onOpenChange(false);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!listo || !empresa) return;
    const lista = props.filter((p) => !vacio(valores[p.id]))
      .map((p) => ({ propiedadId: p.id, tipo: p.tipo, valor: valores[p.id] ?? null }));
    crear.mutate({ nombre, email, telefono, empresaId: empresa.id, valores: lista }, { onSuccess: cerrar });
  };

  const campo = (p: PropiedadCrm) => {
    const v = valores[p.id];
    let valor;
    try { valor = vacio(v) ? undefined : { propiedad_id: p.id, ...filaValor(p.tipo, v ?? null) }; } catch { valor = undefined; }
    return (
      <div key={`${p.id}-${version}`} className="space-y-1.5">
        <Label htmlFor={`prop-${p.id}`}>{p.etiqueta}</Label>
        <CampoPropiedad prop={p} valor={valor} disabled={crear.isPending}
          onGuardar={(nv) => setValores((s) => ({ ...s, [p.id]: nv }))} />
      </div>
    );
  };

  const faltan = [!nombre.trim() && "Nombre", !empresa && "Empresa"].filter(Boolean).join(", ");

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : cerrar())}
      icon={UserRound}
      title="Nuevo contacto"
      size="lg"
      formId={FORM_ID}
      onSubmit={onSubmit}
      isDirty={!!(nombre || email || telefono || empresa) && !crear.isPending}
      busy={crear.isPending}
      footer={
        <>
          {faltan && (nombre || empresa) && <span className="mr-auto text-caption text-muted-foreground">Falta: {faltan}</span>}
          <Button type="button" variant="outline" onClick={cerrar} disabled={crear.isPending}>Cancelar</Button>
          <Button type="submit" form={FORM_ID} disabled={!listo}>{crear.isPending ? "Guardando…" : "Guardar"}</Button>
        </>
      }
    >
      <FormDialogSection>
        <div className="space-y-1.5">
          <Label htmlFor="obj-nombre">Nombre *</Label>
          <Input id="obj-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} />
        </div>
        <OportunidadEmpresaField empresa={empresa} onChange={setEmpresa} disabled={crear.isPending} />
        <div className="space-y-1.5">
          <Label htmlFor="obj-email">Correo</Label>
          <Input id="obj-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="obj-tel">Teléfono</Label>
          <Input id="obj-tel" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={30} />
        </div>
      </FormDialogSection>
      {props.length > 0 && (
        <FormDialogSection cols={1} flat>
          <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setVerMas((v) => !v)} aria-expanded={verMas}>
            <ChevronDown className={`h-4 w-4 transition-transform ${verMas ? "rotate-180" : ""}`} />
            {verMas ? "Ocultar campos adicionales" : `Más campos (${props.length})`}
          </Button>
        </FormDialogSection>
      )}
      {verMas && <FormDialogSection>{props.map(campo)}</FormDialogSection>}
    </FormDialogShell>
  );
}
