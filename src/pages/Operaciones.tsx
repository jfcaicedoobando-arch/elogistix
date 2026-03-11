import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

const Operaciones = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard de Operaciones</h1>
        <p className="text-muted-foreground">Rendimiento del equipo operativo</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <Activity className="h-5 w-5" />
            Próximamente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Este dashboard mostrará métricas operativas, rendimiento por operador y análisis de tiempos de tránsito.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Operaciones;
