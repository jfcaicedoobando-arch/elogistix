import { Calendar, ArrowRight, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ModoIcon } from "@/components/shared/ModoIcon";
import { formatDate } from "@/lib/formatters";

interface ArriboItem {
  id: string;
  expediente: string;
  modo: string;
  eta?: string | null;
  puerto_destino?: string | null;
  aeropuerto_destino?: string | null;
  ciudad_destino?: string | null;
}

interface Props {
  items: ArriboItem[];
}

export function PortalProximosArribosCard({ items }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-accent" />
            Próximos Arribos
          </CardTitle>
          <Link to="/portal/embarques">
            <Button variant="ghost" size="sm" className="text-xs h-7">
              Ver todos <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No hay arribos próximos.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((e) => (
              <Link
                key={e.id}
                to={`/portal/embarques/${e.id}`}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ModoIcon modo={e.modo} size={16} circle className="flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{e.expediente}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {e.puerto_destino || e.aeropuerto_destino || e.ciudad_destino || "—"}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-xs font-medium text-accent">
                    {e.eta ? formatDate(e.eta, "dd MMM") : "—"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
