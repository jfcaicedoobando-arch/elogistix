/**
 * `<AuthCard />` — marco visual común para las pantallas públicas de
 * autenticación (login, recuperación/restablecimiento de contraseña).
 *
 * Unifica el fondo degradado, la tarjeta centrada y el lockup de marca que
 * antes se repetían por separado en cada pantalla.
 */
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { BRAND } from "@/components/shared/utils/brand";
import { cn } from "@/lib/utils";

export interface AuthCardProps {
  /** Título accesible (h1 visualmente oculto; la marca ya comunica el título). */
  title: string;
  /** `sm` para formularios cortos (restablecer contraseña), `md` por defecto (login). */
  maxWidth?: "sm" | "md";
  children: ReactNode;
  className?: string;
}

export function AuthCard({ title, maxWidth = "md", children, className }: AuthCardProps) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-background via-background to-muted px-4 py-8">
      <Card className={cn("w-full shadow-raised", maxWidth === "sm" ? "max-w-sm" : "max-w-md", className)}>
        <CardHeader className="text-center space-y-4 pb-4">
          <BrandLockup variant="stacked" size="md" subtitle={BRAND.tagline} />
          <h1 className="sr-only">{title}</h1>
        </CardHeader>
        <CardContent className="pt-2">{children}</CardContent>
      </Card>
    </div>
  );
}
