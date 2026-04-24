import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useMarcarProformaFacturada, type ProformaRow } from "@/hooks/embarque/useProformas";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proforma: ProformaRow | null;
}

export function DialogMarcarFacturada({ open, onOpenChange, proforma }: Props) {
  const [folio, setFolio] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const marcar = useMarcarProformaFacturada();

  useEffect(() => {
    if (open) {
      setFolio("");
      setFecha(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!proforma || !folio.trim()) return;
    try {
      await marcar.mutateAsync({
        proformaId: proforma.id,
        embarqueId: proforma.embarque_id,
        folioFacturaExterna: folio.trim(),
        fechaFacturacion: fecha,
      });
      onOpenChange(false);
    } catch {
      // toast en hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar proforma como facturada</DialogTitle>
          <DialogDescription>
            Proforma <strong>{proforma?.numero}</strong> — Cliente: {proforma?.cliente_nombre}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="folio">Folio de factura *</Label>
            <Input
              id="folio"
              value={folio}
              onChange={(e) => setFolio(e.target.value)}
              placeholder="Ej. A-12345"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha de facturación</Label>
            <Input
              id="fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={marcar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!folio.trim() || marcar.isPending}>
            {marcar.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</>
            ) : (
              'Confirmar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
