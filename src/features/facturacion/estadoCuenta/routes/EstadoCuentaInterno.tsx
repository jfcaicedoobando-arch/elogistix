import { useParams } from "react-router-dom";
import { PageContainer } from "@/components/shared/PageContainer";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { Wallet } from "lucide-react";
import { EstadoCuentaModule } from "../components/EstadoCuentaModule";
import { EstadoCuentaHeaderCard } from "../components/EstadoCuentaHeaderCard";
import { useClienteFichaEstadoCuenta } from "../hooks/useClienteFichaEstadoCuenta";
import { useEstadoCuentaDateRange } from "../hooks/useEstadoCuentaDateRange";

export default function EstadoCuentaInterno() {
  const { clienteId = "" } = useParams<{ clienteId: string }>();
  const { data: ficha, isLoading } = useClienteFichaEstadoCuenta(clienteId || undefined);
  const { desde, hasta } = useEstadoCuentaDateRange("30d");

  return (
    <PageContainer width="wide">
      <DetailHeader
        backTo={`/clientes/${clienteId}`}
        backLabel="Volver a Cliente"
        icon={<Wallet className="h-6 w-6 shrink-0 text-accent" />}
        title="Estado de cuenta"
        subtitle="Movimientos, saldos y anticipos del cliente."
      />

      <EstadoCuentaModule
        clienteIds={clienteId ? [clienteId] : []}
        facturaHrefBase="/facturacion"
        identidad={
          <EstadoCuentaHeaderCard
            nombre={ficha?.nombre}
            rfc={ficha?.rfc}
            diasCredito={ficha?.dias_credito}
            limiteCreditoMxn={ficha?.limite_credito_mxn}
            desde={desde}
            hasta={hasta}
            loading={isLoading}
          />
        }
      />
    </PageContainer>
  );
}
