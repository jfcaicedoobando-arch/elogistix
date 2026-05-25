/**
 * Importar leads desde un CSV (cliente).
 * Parser simple soportando comillas dobles y comas escapadas.
 */
import { useState, useMemo, useCallback } from "react";
import { Upload, FileText, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import {
  LEAD_ESTADOS, LEAD_FUENTES, useCrearLeadsBulk,
  type CrmLeadEstado, type CrmLeadFuente,
} from "@/hooks/crm/useLeads";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow {
  empresa: string;
  contacto: string;
  email: string;
  telefono: string;
  ciudad: string;
  pais: string;
  fuente: CrmLeadFuente;
  estado: CrmLeadEstado;
  score: number;
  notas: string;
  __error?: string;
}

const HEADER_ALIASES: Record<string, keyof ParsedRow> = {
  empresa: "empresa", company: "empresa", razon_social: "empresa",
  contacto: "contacto", nombre: "contacto", contact: "contacto",
  email: "email", correo: "email", "e-mail": "email",
  telefono: "telefono", phone: "telefono", "teléfono": "telefono", tel: "telefono",
  ciudad: "ciudad", city: "ciudad",
  pais: "pais", "país": "pais", country: "pais",
  fuente: "fuente", source: "fuente",
  estado: "estado", status: "estado",
  score: "score",
  notas: "notas", notes: "notas",
};

/** Parser CSV sencillo (RFC4180 subset): comillas dobles, escape "". */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cell += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c === "\r") { /* skip */ }
      else { cell += c; }
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

function mapRows(matrix: string[][]): ParsedRow[] {
  if (matrix.length === 0) return [];
  const headers = matrix[0].map((h) => h.trim().toLowerCase());
  const colMap = headers.map((h) => HEADER_ALIASES[h] ?? null);
  return matrix.slice(1).map((cols) => {
    const r: ParsedRow = {
      empresa: "", contacto: "", email: "", telefono: "",
      ciudad: "", pais: "", fuente: "Otro", estado: "Nuevo", score: 3, notas: "",
    };
    colMap.forEach((field, i) => {
      if (!field) return;
      const val = (cols[i] ?? "").trim();
      if (field === "score") {
        const n = Number(val);
        r.score = Number.isFinite(n) && n >= 1 && n <= 5 ? n : 3;
      } else if (field === "fuente") {
        r.fuente = (LEAD_FUENTES as string[]).includes(val) ? (val as CrmLeadFuente) : "Otro";
      } else if (field === "estado") {
        r.estado = (LEAD_ESTADOS as string[]).includes(val) ? (val as CrmLeadEstado) : "Nuevo";
      } else {
        (r as unknown as Record<string, string>)[field] = val;
      }
    });
    if (!r.empresa) r.__error = "Empresa requerida";
    return r;
  });
}

export default function ImportarLeadsCsvDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const crearBulk = useCrearLeadsBulk();

  const reset = useCallback(() => { setRows([]); setFileName(""); }, []);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const matrix = parseCSV(text);
    setRows(mapRows(matrix));
  };

  const validRows = useMemo(() => rows.filter((r) => !r.__error), [rows]);
  const errorCount = rows.length - validRows.length;

  const handleImport = async () => {
    try {
      const { inserted } = await crearBulk.mutateAsync(validRows);
      notifySuccess(toast, {
        title: `${inserted} leads importados`,
        description: errorCount > 0 ? `${errorCount} filas omitidas por errores` : undefined,
      });
      reset();
      onOpenChange(false);
    } catch (e) {
      notifyError(toast, { title: "Error al importar", description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar leads desde CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Columnas reconocidas: <code>empresa, contacto, email, telefono, ciudad, pais, fuente, estado, score, notas</code>.
            La fila 1 debe contener los encabezados. Empresa es obligatoria.
          </p>

          <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-md p-6 cursor-pointer hover:bg-muted/30">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{fileName || "Selecciona un archivo .csv"}</span>
            <input
              type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </label>

          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                <span>{rows.length} filas leídas</span>
                <Badge variant="default">{validRows.length} válidas</Badge>
                {errorCount > 0 && <Badge variant="destructive">{errorCount} con errores</Badge>}
              </div>
              <div className="border rounded max-h-64 overflow-auto text-xs">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0">
                    <tr><th className="p-2 text-left">Empresa</th><th className="p-2 text-left">Contacto</th><th className="p-2 text-left">Email</th><th className="p-2 text-left">Estado</th><th className="p-2 text-left">Fuente</th><th className="p-2 text-left">Error</th></tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className={r.__error ? "bg-destructive/10" : ""}>
                        <td className="p-2">{r.empresa || "—"}</td>
                        <td className="p-2">{r.contacto || "—"}</td>
                        <td className="p-2">{r.email || "—"}</td>
                        <td className="p-2">{r.estado}</td>
                        <td className="p-2">{r.fuente}</td>
                        <td className="p-2 text-destructive">{r.__error ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 50 && <p className="text-center p-2 text-muted-foreground">… {rows.length - 50} filas más</p>}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleImport} disabled={validRows.length === 0 || crearBulk.isPending}>
            {crearBulk.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Importar {validRows.length} leads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
