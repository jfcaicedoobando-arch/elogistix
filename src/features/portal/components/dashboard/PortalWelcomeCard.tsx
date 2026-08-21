interface Props {
  clienteName?: string | null;
  contactoName?: string | null;
  orgName?: string | null;
}

export function PortalWelcomeCard({ clienteName, contactoName, orgName }: Props) {
  // UIB-10: saludar a la persona, no a la razón social fiscal.
  const primerNombre = contactoName?.trim().split(/\s+/)[0];
  let saludo = "Bienvenido";
  if (primerNombre) {
    saludo = `¡Hola, ${primerNombre.charAt(0).toUpperCase()}${primerNombre.slice(1).toLowerCase()}!`;
  } else if (clienteName) {
    saludo = `¡Hola, ${clienteName}!`;
  }
  return (
    <div className="bg-gradient-to-r from-accent/5 via-accent/3 to-transparent rounded-xl px-5 py-4 border">
      <h1 className="text-display">
        {saludo}
      </h1>
      <p className="text-body text-muted-foreground mt-1">
        {orgName ? `${orgName} · ` : ""}Consulta el estado de tus embarques, cotizaciones y facturas en un solo lugar.
      </p>
    </div>
  );
}
