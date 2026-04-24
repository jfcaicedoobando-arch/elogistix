import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMarcarProformaFacturada } from "@/hooks/useProformas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  proformaId: string;
  proformaNumero: string;
}

export function DialogMarcarFacturada({ open, onOpenChange, proformaId, proformaNumero }: Props) {
  const { toast } = useToast();
  const marcar = useMarcarProformaFacturada();
  const [folio, setFolio] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (open) {
      setFolio("");
      setFecha(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  const handleGuardar = () => {
    if (!folio.trim()) {
      toast({ title: "Captura el folio fiscal externo", variant: "destructive" });
      return;
    }
    marcar.mutate({ id: proformaId, folio: folio.trim(), fecha }, {
      onSuccess: () => {
        toast({ title: "Proforma marcada como facturada" });
        onOpenChange(false);
      },
      onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar Proforma como Facturada</DialogTitle>
          <DialogDescription>
            Proforma <strong>{proformaNumero}</strong>. Captura el folio fiscal generado en tu software de facturación externo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="folio">Folio fiscal externo *</Label>
            <Input id="folio" value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="Ej. FAC-2026-001" autoFocus />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fecha">Fecha de facturación</Label>
            <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGuardar} disabled={marcar.isPending}>
            {marcar.isPending ? "Guardando..." : "Marcar Facturada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
