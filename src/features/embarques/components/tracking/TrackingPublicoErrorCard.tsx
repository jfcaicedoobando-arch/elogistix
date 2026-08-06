import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { SectionHeading } from "@/components/shared/SectionHeading";

export function TrackingPublicoErrorCard({ message }: { message?: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="flex flex-col items-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <SectionHeading as="h2" className="mb-2 justify-center">Enlace no disponible</SectionHeading>
          <p className="text-sm text-muted-foreground text-center">
            {message || "Este enlace de tracking no existe o ha expirado."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
