/**
 * Cuerpo del wizard "Capturar factura de proveedor": renderiza el paso activo y
 * atiende el atajo Ctrl/Cmd + Enter. Extraído de `DialogNuevaFacturaProveedor`
 * (v13.712.2) para respetar el tope de complejidad de ESLint.
 */
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { PasoDocumento } from "./PasoDocumento";
import { PasoDatos } from "./PasoDatos";
import { PasoVinculacion } from "./PasoVinculacion";
import type { CapturaPasos } from "@/features/cxp/hooks/useCapturaFacturaPasos";
import type { EntranteParaCaptura } from "@/features/cxp/types";
import { verArchivoBuzon } from "./capturaDerivados";

type Ctl = Parameters<typeof PasoDatos>[0]["ctl"];
type Categorias = Parameters<typeof PasoDatos>[0]["categorias"];
type Herencia = Parameters<typeof PasoVinculacion>[0]["herencia"];
type Autocarga = Parameters<typeof PasoDocumento>[0]["autocarga"];

interface Props {
  ctl: Ctl;
  pasos: CapturaPasos;
  categorias: Categorias;
  entrante: EntranteParaCaptura | null;
  autocarga: Autocarga;
  categoriaCogs: Parameters<typeof PasoDatos>[0]["categoriaCogs"];
  herencia: Herencia;
  keyRenglonSospechoso: Parameters<typeof PasoDocumento>[0]["keyRenglonSospechoso"];
  modoBuzon: boolean;
  onCerrar: () => void;
}

export function CapturaFacturaPasosBody({
  ctl, pasos, categorias, entrante, autocarga, categoriaCogs, herencia,
  keyRenglonSospechoso, modoBuzon, onCerrar,
}: Props) {
  const navigate = useNavigate();
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pasos.paso !== 2 || !pasos.solicitudFoco) return;
    const campo = bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    campo?.focus();
    campo?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [pasos.paso, pasos.solicitudFoco]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!(e.metaKey || e.ctrlKey) || e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation();
    if (!pasos.esUltimo) pasos.siguiente();
    else if (ctl.puedeGuardar && pasos.revisarDatos()) void ctl.submit();
  };

  return (
    <div ref={bodyRef} className="space-y-5" onKeyDownCapture={onKeyDown}>
      {pasos.paso === 1 && (
        <PasoDocumento
          ctl={ctl}
          categorias={categorias}
          entrante={entrante}
          autocarga={autocarga}
          keyRenglonSospechoso={keyRenglonSospechoso}
          modoBuzon={modoBuzon}
          onVerArchivoBuzon={(path, nombre) => void verArchivoBuzon(path, nombre)}
          onVerFacturaDuplicada={(id: string) => {
            ctl.reset();
            onCerrar();
            navigate(`/compras/facturas?factura=${id}`);
          }}
        />
      )}

      {pasos.paso === 2 && (
        <PasoDatos
          ctl={ctl}
          categorias={categorias}
          entrante={entrante}
          categoriaCogs={categoriaCogs}
        />
      )}

      {pasos.paso === 3 && (
        <PasoVinculacion
          ctl={ctl}
          entrante={entrante}
          herencia={herencia}
          sinCostoCapturado={entrante?.sinCostoCapturado}
          onIrADatos={() => pasos.irA(2)}
        />
      )}
    </div>
  );
}
