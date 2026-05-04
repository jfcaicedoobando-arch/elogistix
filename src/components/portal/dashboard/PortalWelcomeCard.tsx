interface Props {
  clienteName?: string | null;
  orgName?: string | null;
}

export function PortalWelcomeCard({ clienteName }: Props) {
  return (
    <div className="bg-gradient-to-r from-accent/5 via-accent/3 to-transparent rounded-xl px-5 py-4 border">
      <h1 className="text-xl font-bold tracking-tight">
        {clienteName ? `¡Hola, ${clienteName}!` : "Bienvenido"}
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        Consulta el estado de tus embarques, cotizaciones y facturas en un solo lugar.
      </p>
    </div>
  );
}
