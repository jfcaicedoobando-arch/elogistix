import { Badge } from "@/components/ui/badge";
import {
  getHallazgoDetalleParts,
  normalizeDocName,
  type HallazgoDetalle,
} from "./HallazgoDetalleCell.utils";

export function HallazgoDetalleCell({ hallazgo }: { hallazgo: HallazgoDetalle }) {
  const { detalle, documentos } = getHallazgoDetalleParts(hallazgo);

  return (
    <>
      <div>{detalle}</div>
      {documentos.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {documentos.map((doc) => (
            <Badge key={normalizeDocName(doc)} variant="secondary" className="text-2xs font-normal">
              {doc}
            </Badge>
          ))}
        </div>
      )}
    </>
  );
}
