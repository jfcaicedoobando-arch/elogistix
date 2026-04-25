interface Props {
  clienteName?: string | null;
  orgName?: string | null;
}

export function PortalWelcomeCard({ clienteName, orgName }: Props) {
  return (
    <div className="bg-gradient-to-r from-accent/5 via-accent/3 to-transparent rounded-xl p-6 border">
      <h1 className="text-2xl font-bold">
        {clienteName ? `¡Hola, ${clienteName}!` : "Bienvenido"}
      </h1>
      {orgName && (
        <p className="text-sm text-muted-foreground mt-1">
          Portal de <span className="font-medium text-foreground">{orgName}</span>
        </p>
      )}
      <p className="text-sm text-muted-foreground mt-1">
        Consulta el estado de tus embarques, cotizaciones y facturas en un solo lugar.
      </p>
    </div>
  );
}
