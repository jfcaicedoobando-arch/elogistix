import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Field {
  label: string;
  value?: string | null;
  colSpan?: boolean;
}

interface Props {
  fields: Field[];
}

const D = "—";

export function DatosComercialesCard({ fields }: Props) {
  return (
    <Card>
      <CardHeader><CardTitle >Datos comerciales</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        {fields.map((f) => (
          <div key={f.label} className={f.colSpan ? "col-span-2 md:col-span-3" : undefined}>
            <div className="text-muted-foreground text-xs">{f.label}</div>
            {f.value && f.value.length > 0 ? f.value : D}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
