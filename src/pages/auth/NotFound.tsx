import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Compass, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404: Ruta inexistente solicitada:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center max-w-md space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Compass className="h-8 w-8" />
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-foreground">404</h1>
        <p className="text-lg font-semibold text-foreground">Página no encontrada</p>
        <p className="text-sm text-muted-foreground">
          La ruta <span className="font-mono text-foreground/80">{location.pathname}</span> no existe o fue movida.
        </p>
        <Button asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver al inicio
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
