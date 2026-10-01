import { Separator } from "@/components/ui/separator";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { TabDemoras } from "../TabDemoras";
import { TabGarantias } from "../TabGarantias";
import { SeccionDemorasAuto } from "../financiero/SeccionDemorasAuto";

interface Props {
  embarqueId: string;
  esMaritimo: boolean;
  mostrar: boolean;
  canEdit: boolean;
  fechaLlegada: string | null;
}

export function GarantiasDemorasContenido({ embarqueId, esMaritimo, mostrar, canEdit, fechaLlegada }: Props) {
  const puedeEditar = canEdit && esMaritimo;
  return <>
    {!esMaritimo && <p role="status" className="rounded-md border bg-muted/30 p-4 text-body">
      Las demoras y depósitos de contenedores aplican al transporte marítimo.
      Registra almacenajes u otros cargos de este embarque en Costos.
      {mostrar && " Los registros históricos se conservan abajo en sólo consulta."}
    </p>}
    {mostrar && <>
      <section aria-labelledby="seccion-demoras" className="space-y-3">
        <SectionHeading id="seccion-demoras">Demoras</SectionHeading>
        {esMaritimo && <SeccionDemorasAuto embarqueId={embarqueId} canEdit={canEdit} />}
        <TabDemoras embarqueId={embarqueId} canEdit={puedeEditar} soloConsulta={!esMaritimo} />
      </section>
      <Separator />
      <section aria-labelledby="seccion-garantias" className="space-y-3">
        <SectionHeading id="seccion-garantias">Garantías</SectionHeading>
        <TabGarantias embarqueId={embarqueId} canEdit={puedeEditar} soloConsulta={!esMaritimo} fechaLlegadaReal={fechaLlegada} />
      </section>
    </>}
  </>;
}
