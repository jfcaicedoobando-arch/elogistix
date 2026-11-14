/** Petición del broker para trabajar un prospecto que ya existe. */
import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { useSolicitarEmpresa } from "../hooks/useBrokerPortal";

interface Props {
  brokerId: string | null;
  empresa: { empresa_id: string; nombre: string } | null;
  onClose: () => void;
}

export default function SolicitudEmpresaDialog({ brokerId, empresa, onClose }: Props) {
  const [rol, setRol] = useState("");
  const [relacion, setRelacion] = useState("");
  const [tiempo, setTiempo] = useState("");
  const m = useSolicitarEmpresa(brokerId);
  const valido = rol.trim() !== "" && relacion.trim() !== "" && tiempo.trim() !== "";

  const cerrar = () => { setRol(""); setRelacion(""); setTiempo(""); onClose(); };
  const enviar = async () => {
    if (!empresa || !valido) return;
    try {
      await m.mutateAsync({ empresaId: empresa.empresa_id, rol_contacto: rol, relacion, tiempo_cierre: tiempo });
      cerrar();
    } catch {
      // el aviso lo muestra el hook
    }
  };

  return (
    <FormDialogShell
      open={!!empresa}
      onOpenChange={(o) => { if (!o) cerrar(); }}
      icon={Send}
      title={`Solicitar trabajar ${empresa?.nombre ?? ""}`}
      description="Administración, gerencia comercial o el KAM de la cuenta revisarán tu petición."
      size="md"
      isDirty={rol !== "" || relacion !== "" || tiempo !== ""}
      busy={m.isPending}
      footer={
        <>
          <Button type="button" variant="outline" onClick={cerrar} disabled={m.isPending}>Cancelar</Button>
          <Button onClick={enviar} disabled={!valido} loading={m.isPending}>Enviar solicitud</Button>
        </>
      }
    >
      <FormDialogSection flat>
        <div className="space-y-1.5">
          <Label htmlFor="sol-rol">¿A quién conoces? (sólo el puesto)</Label>
          <Input id="sol-rol" value={rol} onChange={(e) => setRol(e.target.value)} placeholder="Gerente de compras" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sol-relacion">Relación previa y nivel de confianza</Label>
          <Textarea id="sol-relacion" value={relacion} onChange={(e) => setRelacion(e.target.value)} rows={3} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sol-tiempo">Tiempo estimado de cierre</Label>
          <Input id="sol-tiempo" value={tiempo} onChange={(e) => setTiempo(e.target.value)} placeholder="2 meses" />
        </div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
