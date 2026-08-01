/** TEMPORAL — harness de auditoría visual de date pickers. */
import { useState } from "react";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { DateTimePickerMx } from "@/components/ui/date-time-picker-mx";
import { MonthPickerMx } from "@/components/ui/month-picker-mx";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function DatePickerAudit() {
  const [a, setA] = useState("2026-08-01");
  const [b, setB] = useState("");
  const [c, setC] = useState("2026-08-01T09:30");
  const [d, setD] = useState("2026-08");
  const [nat, setNat] = useState("2026-08-01");
  return (
    <div className="p-8 grid grid-cols-3 gap-8 max-w-6xl">
      <div className="space-y-2"><Label>DatePickerMx con valor</Label><DatePickerMx value={a} onChange={setA} className="w-full" /></div>
      <div className="space-y-2"><Label>DatePickerMx vacío</Label><DatePickerMx value={b} onChange={setB} className="w-full" /></div>
      <div className="space-y-2"><Label>DatePickerMx deshabilitado</Label><DatePickerMx value={a} onChange={setA} disabled className="w-full" /></div>
      <div className="space-y-2"><Label>DatePickerMx con error</Label><DatePickerMx value={a} onChange={setA} errorText="Fecha requerida" className="w-full" /></div>
      <div className="space-y-2"><Label>DateTimePickerMx</Label><DateTimePickerMx value={c} onChange={setC} className="w-full" /></div>
      <div className="space-y-2"><Label>MonthPickerMx</Label><MonthPickerMx value={d} onChange={setD} className="w-full" /></div>
      <div className="space-y-2"><Label>Input nativo type=date</Label><Input type="date" value={nat} onChange={(e) => setNat(e.target.value)} /></div>
      <div className="space-y-2" id="calendario-abierto"><Label>Calendario abierto</Label><DatePickerMx value={a} onChange={setA} className="w-full" /></div>
    </div>
  );
}
