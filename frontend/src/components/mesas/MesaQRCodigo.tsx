import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Printer } from "lucide-react";

interface MesaQRCodigoProps {
  mesaNumero: number;
  url: string;
}

// Genera el QR en el navegador (nunca pasa por el backend) — codifica el
// link fijo de la mesa, el mismo que nunca cambia mientras la mesa exista.
export default function MesaQRCodigo({ mesaNumero, url }: MesaQRCodigoProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  const getCanvas = () => canvasRef.current?.querySelector("canvas") ?? null;

  const handleDescargar = () => {
    const canvas = getCanvas();
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-mesa-${mesaNumero}.png`;
    a.click();
  };

  const handleImprimir = () => {
    const canvas = getCanvas();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const ventana = window.open("", "_blank", "width=420,height=560");
    if (!ventana) return;
    ventana.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>QR Mesa ${mesaNumero}</title>
          <meta charset="utf-8" />
        </head>
        <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:Georgia,serif;">
          <h1 style="font-size:30px;margin:0 0 6px;color:#2C5545;">Mesa ${mesaNumero}</h1>
          <p style="font-size:13px;color:#666;margin:0 0 18px;font-family:sans-serif;">Escaneá para pedir — Memo's Café</p>
          <img src="${dataUrl}" width="260" height="260" onload="window.print()" />
        </body>
      </html>
    `);
    ventana.document.close();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div ref={canvasRef} className="rounded-xl border border-brand/15 bg-white p-4 shadow-card">
        <QRCodeCanvas value={url} size={220} level="M" />
      </div>
      <p className="font-display text-lg font-semibold text-brand">Mesa {mesaNumero}</p>
      <div className="flex w-full gap-2">
        <button
          onClick={handleDescargar}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-brand/20 bg-white py-2.5 font-body text-xs font-semibold text-brand hover:bg-brand/5"
        >
          <Download size={14} /> Descargar
        </button>
        <button
          onClick={handleImprimir}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand py-2.5 font-body text-xs font-semibold text-white hover:bg-brand-dark"
        >
          <Printer size={14} /> Imprimir
        </button>
      </div>
    </div>
  );
}
