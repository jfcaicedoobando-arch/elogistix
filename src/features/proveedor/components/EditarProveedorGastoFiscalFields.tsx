import type { useEditarProveedorController } from "@/features/proveedor/hooks";
import { DireccionFiscalFields } from "./DireccionFiscalFields";

type Controller = ReturnType<typeof useEditarProveedorController>;

interface Props {
  c: Controller;
}

export default function EditarProveedorGastoFiscalFields({ c }: Props) {
  return <DireccionFiscalFields form={c.form} setField={c.setField} />;
}
