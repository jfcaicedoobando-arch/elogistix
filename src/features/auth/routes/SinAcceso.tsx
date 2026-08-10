/**
 * Pantalla `/sin-acceso` — RG1 (Ola 3).
 *
 * Antes, un usuario autenticado sin rol efectivo era rebotado de `/inicio` a
 * `/` y de `/` otra vez a `/inicio`, produciendo un bucle infinito de
 * redirecciones. Ahora ese caso aterriza aquí: una página estática, sin
 * `Navigate`, que explica la situación y ofrece cerrar sesión.
 */
import { Link } from "react-router-dom";
import { ShieldAlert, LogOut, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/shared/Seo";
import { signOut } from "@/lib/auth/signOut";

export default function SinAcceso() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Seo
        title="Sin acceso · Libre Carga"
        description="Tu cuenta aún no tiene permisos asignados en Libre Carga."
        ogTitle="Sin acceso · Libre Carga"
        ogDescription="Tu cuenta aún no tiene permisos asignados en Libre Carga."
      />
      <div className="max-w-md space-y-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-8 w-8" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Sin acceso</h1>
        <p className="text-sm text-muted-foreground">
          Tu cuenta está activa, pero todavía no tiene un rol ni una organización
          asignada. Pide a un administrador de tu empresa que te dé de alta para
          poder entrar.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" asChild>
            <Link to="/ayuda">
              <LifeBuoy className="mr-2 h-4 w-4" aria-hidden /> Ver ayuda
            </Link>
          </Button>
          <Button onClick={() => void signOut()}>
            <LogOut className="mr-2 h-4 w-4" aria-hidden /> Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
