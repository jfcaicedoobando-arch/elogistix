import type { ReactNode } from "react";
import { BrandHeader, type EmisorInfo } from "./BrandHeader";
import { ReportContext } from "./ReportContext";

interface Props {
  title: string;
  emisor?: EmisorInfo;
  organizacionNombre?: string;
  meta?: Array<{ label: string; value: string }>;
  children?: ReactNode;
}
export function ReportHeader({ title, emisor, organizacionNombre, meta, children }: Props) {
  return <>
    <BrandHeader tipoDocumento={title} emisor={emisor} organizacionNombre={organizacionNombre} meta={meta} variant="report" compactIdentity />
    {children ? <ReportContext>{children}</ReportContext> : null}
  </>;
}
