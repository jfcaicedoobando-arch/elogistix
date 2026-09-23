/**
 * R-01 — Regresión: capturar Cant=2, Costo=15000, Venta=20000 debe persistir
 * exactamente esos valores (antes se contaminaban entre campos y la cantidad
 * se reescribía a 9,999 por el clamp `CANTIDAD_MAX`).
 *
 * Paso 7 — cobertura de la fila tras el split en useFilaCostoLocalRow +
 * AvisosFilaCosto: selección SAT, concepto libre, notas, eliminar y avisos.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilaCostoLocalRow } from "@/features/cotizacion/components/costosLocal/FilaCostoLocalRow";
import type { FilaCostoLocal } from "@/features/cotizacion/types";

const PRODUCTO_PRUEBA = {
  id: "p1",
  nombre: "Flete marítimo",
  clave_sat: "78101800",
  tipo_iva: "gravado_16",
  clave_unidad_sat: "E48",
};

let ultimoOnSelect: ((p: typeof PRODUCTO_PRUEBA) => void) | undefined;
let ultimoOnConceptoLibre: ((texto: string) => void) | undefined;

vi.mock("@/features/cotizacion/components/conceptos/ProductoServicioSelect", () => ({
  ProductoServicioSelect: (props: {
    onSelect: (p: typeof PRODUCTO_PRUEBA) => void;
    onConceptoLibre?: (texto: string) => void;
  }) => {
    ultimoOnSelect = props.onSelect;
    ultimoOnConceptoLibre = props.onConceptoLibre;
    return <div data-testid="producto-select" />;
  },
}));
vi.mock("@/features/cotizacion/components/conceptos/UnidadMedidaSelect", () => ({
  UnidadMedidaSelect: () => <div data-testid="unidad-select" />,
}));

const filaBase = {
  concepto: "Flete",
  clave_sat: "78101800",
  concepto_libre: false,
  proveedor: "",
  unidad_medida: "E48",
  cantidad: 1,
  costo_unitario: 0,
  precio_venta: 0,
  moneda: "MXN",
  aplica_iva: true,
  tasa_iva_aplicada: 0.16,
  notas: "",
} as unknown as FilaCostoLocal;

function renderFila(fila: FilaCostoLocal = filaBase, gi = 0) {
  const onUpdate = vi.fn();
  const onRemove = vi.fn();
  render(<FilaCostoLocalRow fila={fila} gi={gi} moneda="MXN" onUpdate={onUpdate} onRemove={onRemove} />);
  return { onUpdate, onRemove };
}

function teclear(label: string, texto: string) {
  const input = screen.getByLabelText(label);
  fireEvent.focus(input);
  // tecleo secuencial: cada carácter dispara un change como en el navegador
  let acumulado = "";
  for (const ch of texto) {
    acumulado += ch;
    fireEvent.change(input, { target: { value: acumulado } });
  }
  fireEvent.blur(input);
}

describe("FilaCostoLocalRow · captura numérica (R-01)", () => {
  it("persiste cantidad, costo y venta tal cual se teclean", () => {
    const onUpdate = vi.fn();
    render(
      <FilaCostoLocalRow fila={filaBase} gi={0} moneda="MXN" onUpdate={onUpdate} onRemove={vi.fn()} />,
    );

    teclear("Cantidad", "2");
    teclear("Costo unitario", "15000");
    teclear("Precio de venta", "20000");

    // Sólo se propaga en blur: una llamada por campo, con el valor exacto.
    expect(onUpdate.mock.calls).toEqual([
      [0, "cantidad", 2],
      [0, "costo_unitario", 15000],
      [0, "precio_venta", 20000],
    ]);
  });

  it("no reescribe cantidades altas (sin clamp a 9,999)", () => {
    const onUpdate = vi.fn();
    render(
      <FilaCostoLocalRow fila={filaBase} gi={3} moneda="MXN" onUpdate={onUpdate} onRemove={vi.fn()} />,
    );

    teclear("Cantidad", "15000");

    expect(onUpdate).toHaveBeenCalledWith(3, "cantidad", 15000);
  });

  it("calcula los totales de la partida con los valores capturados", () => {
    const fila = { ...filaBase, cantidad: 2, costo_unitario: 15000, precio_venta: 20000 } as FilaCostoLocal;
    render(
      <FilaCostoLocalRow fila={fila} gi={0} moneda="MXN" onUpdate={vi.fn()} onRemove={vi.fn()} />,
    );

    expect(screen.getByText("Costo total").closest("span")).toHaveTextContent("30,000.00");
    expect(screen.getByText("Venta total").closest("span")).toHaveTextContent("40,000.00");
  });
});

describe("FilaCostoLocalRow · selección de producto SAT", () => {
  it("emite las actualizaciones fiscales exactas y no pisa la unidad existente", () => {
    const { onUpdate } = renderFila(); // filaBase ya trae unidad_medida "E48"
    ultimoOnSelect?.({ ...PRODUCTO_PRUEBA, clave_unidad_sat: "XUN" });

    expect(onUpdate.mock.calls).toEqual([
      [0, "concepto", "Flete marítimo"],
      [0, "clave_sat", "78101800"],
      [0, "concepto_libre", false],
      [0, "tipo_iva", "gravado_16"],
      [0, "aplica_iva", true],
      [0, "tasa_iva_aplicada", 0.16],
    ]);
  });

  it("prellena la unidad cuando la fila no tiene una elegida", () => {
    const sinUnidad = { ...filaBase, unidad_medida: "" } as FilaCostoLocal;
    const { onUpdate } = renderFila(sinUnidad);
    ultimoOnSelect?.(PRODUCTO_PRUEBA);

    expect(onUpdate).toHaveBeenCalledWith(0, "unidad_medida", "E48");
  });

  it("marca aplica_iva=false cuando el producto es No objeto", () => {
    const sinUnidad = { ...filaBase, unidad_medida: "E48" } as FilaCostoLocal;
    const { onUpdate } = renderFila(sinUnidad);
    ultimoOnSelect?.({ ...PRODUCTO_PRUEBA, tipo_iva: "no_objeto" as never });

    expect(onUpdate).toHaveBeenCalledWith(0, "aplica_iva", false);
    expect(onUpdate).toHaveBeenCalledWith(0, "tasa_iva_aplicada", 0);
  });
});

describe("FilaCostoLocalRow · concepto libre, notas y acciones", () => {
  it("concepto libre limpia la clave SAT sin mutaciones fiscales extra", () => {
    const { onUpdate } = renderFila();
    ultimoOnConceptoLibre?.("Maniobra especial");

    expect(onUpdate.mock.calls).toEqual([
      [0, "concepto", "Maniobra especial"],
      [0, "clave_sat", ""],
      [0, "concepto_libre", true],
    ]);
  });

  it("notas cerradas por defecto; el toggle abre, marca aria-expanded y edita", () => {
    const { onUpdate } = renderFila({ ...filaBase, notas: "ya traía nota" } as FilaCostoLocal);

    const toggle = screen.getByRole("button", { name: "Agregar notas" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Notas del concepto")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    const textarea = screen.getByLabelText("Notas del concepto");
    expect(screen.getByRole("button", { name: "Ocultar notas" })).toHaveAttribute("aria-expanded", "true");

    fireEvent.change(textarea, { target: { value: "revisar póliza" } });
    expect(onUpdate).toHaveBeenCalledWith(0, "notas", "revisar póliza");
  });

  it("eliminar llama onRemove con el índice global", () => {
    const { onRemove } = renderFila(filaBase, 5);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar concepto" }));
    expect(onRemove).toHaveBeenCalledWith(5);
  });
});

describe("FilaCostoLocalRow · avisos", () => {
  it("muestra el aviso de concepto libre y oculta el de faltante", () => {
    renderFila({ ...filaBase, concepto_libre: true, clave_sat: "" } as FilaCostoLocal, 2);
    expect(screen.getByTestId("concepto-libre-aviso-2")).toBeInTheDocument();
    expect(screen.queryByTestId("concepto-faltante-aviso-2")).not.toBeInTheDocument();
  });

  it("marca concepto faltante cuando hay importes sin concepto", () => {
    renderFila({ ...filaBase, concepto: "", costo_unitario: 100 } as FilaCostoLocal, 1);
    expect(screen.getByTestId("concepto-faltante-aviso-1")).toBeInTheDocument();
  });

  it("marca proveedor faltante con importes y concepto capturado", () => {
    renderFila({ ...filaBase, costo_unitario: 100 } as FilaCostoLocal, 4);
    expect(screen.getByTestId("proveedor-faltante-aviso-4")).toBeInTheDocument();
  });

  it("no muestra avisos en una fila sana", () => {
    renderFila({ ...filaBase, proveedor: "Naviera SA" } as FilaCostoLocal, 7);
    expect(screen.queryByTestId("concepto-libre-aviso-7")).not.toBeInTheDocument();
    expect(screen.queryByTestId("concepto-faltante-aviso-7")).not.toBeInTheDocument();
    expect(screen.queryByTestId("proveedor-faltante-aviso-7")).not.toBeInTheDocument();
  });
});
