/** TEMPORAL — harness de auditoría visual de pickers MX. */
import { useState } from "react";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { DateTimePickerMx } from "@/components/ui/date-time-picker-mx";
import { MonthPickerMx } from "@/components/ui/month-picker-mx";
import { Label } from "@/components/ui/label";

function Row({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{titulo}</Label>
      {children}
    </div>
  );
}

export default function PickersAudit() {
  const [d, setD] = useState("2026-08-01");
  const [dt, setDt] = useState("2026-08-01T09:30");
  const [m, setM] = useState("2026-08");
  const [vacio1, setVacio1] = useState("");
  const [vacio2, setVacio2] = useState("");
  const [vacio3, setVacio3] = useState("");
  return (
    <div className="p-8 grid grid-cols-3 gap-6 max-w-5xl">
      <Row titulo="Fecha · con valor"><DatePickerMx value={d} onChange={setD} className="w-full" /></Row>
      <Row titulo="Fecha+hora · con valor"><DateTimePickerMx value={dt} onChange={setDt} className="w-full" /></Row>
      <Row titulo="Periodo · con valor"><MonthPickerMx value={m} onChange={setM} className="w-full" /></Row>

      <Row titulo="Fecha · vacío"><DatePickerMx value={vacio1} onChange={setVacio1} className="w-full" /></Row>
      <Row titulo="Fecha+hora · vacío"><DateTimePickerMx value={vacio2} onChange={setVacio2} className="w-full" /></Row>
      <Row titulo="Periodo · vacío"><MonthPickerMx value={vacio3} onChange={setVacio3} className="w-full" /></Row>

      <Row titulo="Fecha · deshabilitado"><DatePickerMx value={d} onChange={setD} disabled className="w-full" /></Row>
      <Row titulo="Fecha+hora · deshabilitado"><DateTimePickerMx value={dt} onChange={setDt} disabled className="w-full" /></Row>
      <Row titulo="Periodo · deshabilitado"><MonthPickerMx value={m} onChange={setM} disabled className="w-full" /></Row>

      <Row titulo="Fecha · error"><DatePickerMx value={d} onChange={setD} errorText="La fecha es requerida" className="w-full" /></Row>
      <Row titulo="Fecha+hora · error"><DateTimePickerMx value={dt} onChange={setDt} errorText="La fecha es requerida" className="w-full" /></Row>
      <Row titulo="Periodo · error"><MonthPickerMx value={m} onChange={setM} errorText="La fecha es requerida" className="w-full" /></Row>
    </div>
  );
}
