import { Card, CardContent } from "@/components/ui/card";
import { ESTADOS_EMBARQUE } from "@/constants/embarqueConstants";

interface Props {
  currentStepIndex: number;
}

export function EstadoProgresoCard({ currentStepIndex }: Props) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          {ESTADOS_EMBARQUE.map((estado, i) => (
            <div key={estado} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  i <= currentStepIndex ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                }`}>{i + 1}</div>
                <span className={`text-[10px] mt-1 text-center ${
                  i <= currentStepIndex ? 'text-foreground font-medium' : 'text-muted-foreground'
                }`}>{estado}</span>
              </div>
              {i < ESTADOS_EMBARQUE.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${i < currentStepIndex ? 'bg-accent' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
