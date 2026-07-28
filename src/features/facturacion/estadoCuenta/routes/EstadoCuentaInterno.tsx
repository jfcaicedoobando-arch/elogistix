import { useParams } from "react-router-dom";
import { PageContainer } from "@/components/shared/PageContainer";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { Wallet } from "lucide-react";
import { EstadoCuentaModule } from "../components/EstadoCuentaModule";

export default function EstadoCuentaInterno() {
  const { clienteId = "" } = useParams<{ clienteId: string }>();

  return (
    <PageContainer width="wide">
      <DetailHeader
        backTo={`/clientes/${clienteId}`}
        backLabel="Volver a Cliente"
        icon={<Wallet className="h-6 w-6 text-accent shrink-0" />}
        title="Estado de cuenta"
        subtitle="Movimientos, saldos y anticipos del cliente."
      />


      <EstadoCuentaModule
        clienteIds={clienteId ? [clienteId] : []}
        facturaHrefBase="/facturacion"
      />
    </PageContainer>
  );
}
