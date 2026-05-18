import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export function TrackingPublicoErrorCard({ message }: { message?: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="flex flex-col items-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-lg font-semibold mb-2">Enlace no disponible</h2>
          <p className="text-sm text-muted-foreground text-center">
            {message || "Este enlace de tracking no existe o ha expirado."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
