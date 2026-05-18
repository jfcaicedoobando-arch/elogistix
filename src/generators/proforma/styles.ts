export function buildProformaPdfStyles(): string {
  return `<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; padding: 32px; font-size: 13px; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f4c81; padding-bottom: 16px; margin-bottom: 20px; }
  .header h1 { font-size: 32px; color: #0f4c81; letter-spacing: 2px; font-weight: 800; }
  .header .numero { font-size: 16px; color: #333; margin-top: 4px; font-weight: 600; }
  .header .meta { text-align: right; font-size: 12px; color: #555; }
  .header .meta .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 700; background: #fef3c7; color: #92400e; letter-spacing: 0.5px; }
  .header .meta .badge-blue { background: #dbeafe; color: #1e3a8a; }
  section { margin-bottom: 18px; }
  h3 { font-size: 14px; color: #0f4c81; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  h4 { font-size: 13px; color: #333; margin: 14px 0 6px; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 16px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 16px; }
  .cell { display: flex; flex-direction: column; }
  .label { font-size: 11px; color: #777; }
  .value { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; font-size: 12px; }
  th { background: #f0f4f8; font-weight: 600; color: #333; }
  .right { text-align: right; }
  .subtotal-block { margin-top: 8px; text-align: right; font-size: 13px; }
  .subtotal-block p { margin: 2px 0; }
  .subtotal-block .total-line { font-size: 15px; color: #0f4c81; border-top: 2px solid #0f4c81; padding-top: 4px; margin-top: 6px; display: inline-block; padding-left: 20px; }
  .container-block { background: #f0f4f8; padding: 6px 10px; margin-top: 14px; border-left: 4px solid #0f4c81; font-weight: 700; color: #0f4c81; font-size: 13px; }
  .container-subtotal { text-align: right; font-size: 12px; color: #555; padding: 4px 10px; background: #fafbfc; }
  .footer-aviso { margin-top: 32px; padding: 12px; border: 2px dashed #d97706; background: #fef3c7; border-radius: 6px; text-align: center; font-size: 12px; color: #92400e; font-weight: 600; }
  .footer { margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 11px; color: #999; text-align: center; }
  @media print { body { padding: 16px; } }
</style>`;
}

export function openPdfWindow(html: string): void {
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  }
}

export function formatearDescripcionConcepto(descripcion: string): string {
  if (descripcion.toLowerCase() === 'flete terrestre') {
    return 'Servicios de Logística (Flete Terrestre)';
  }
  return descripcion;
}
