import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Printer, RefreshCw } from "lucide-react";
import { getErrorMessage } from "../../utils/errors";

interface MesaQRCodigoProps {
  mesaNumero: number;
  url: string;
  /** Solo admin: invalida el QR impreso y genera uno nuevo. */
  onRegenerar?: () => Promise<void>;
}

// Genera el QR en el navegador (nunca pasa por el backend). Codifica el
// link con el codigo secreto de la mesa: no cambia salvo que el admin lo
// regenere.
export default function MesaQRCodigo({ mesaNumero, url, onRegenerar }: MesaQRCodigoProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  const [errorRegenerar, setErrorRegenerar] = useState<string | null>(null);

  const handleRegenerar = async () => {
    if (!onRegenerar) return;
    setRegenerando(true);
    setErrorRegenerar(null);
    try {
      await onRegenerar();
      setConfirmando(false);
    } catch (err) {
      setErrorRegenerar(getErrorMessage(err, "No se pudo regenerar el código QR"));
    } finally {
      setRegenerando(false);
    }
  };

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
          <h1 style="font-size:30px;margin:0 0 6px;color:#2E241C;">Mesa ${mesaNumero}</h1>
          <p style="font-size:13px;color:#6B5B4D;margin:0 0 18px;font-family:sans-serif;">Escanea para pedir — Memo's Coffee</p>
          <img src="${dataUrl}" width="260" height="260" onload="window.print()" />
        </body>
      </html>
    `);
    ventana.document.close();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div ref={canvasRef} className="rounded-xl border border-brand/15 bg-marfil p-4 shadow-card">
        <QRCodeCanvas value={url} size={220} level="M" />
      </div>
      <p className="font-display text-lg font-semibold text-brand">Mesa {mesaNumero}</p>
      <div className="flex w-full gap-2">
        <button
          onClick={handleDescargar}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-brand/20 bg-marfil py-2.5 font-body text-xs font-semibold text-brand hover:bg-brand/5"
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
      {onRegenerar && !confirmando && (
        <button
          onClick={() => setConfirmando(true)}
          className="flex items-center gap-1.5 font-body text-xs font-semibold text-brand/60 hover:text-brand"
        >
          <RefreshCw size={13} /> Regenerar código
        </button>
      )}
      {onRegenerar && confirmando && (
        <div className="flex w-full flex-col gap-2 rounded-lg bg-destructive/10 p-3">
          <p className="font-body text-xs text-destructive">
            El QR impreso actual dejará de funcionar y tendrás que imprimir y pegar el nuevo.
            Úsalo si alguien pudo fotografiar el código.
          </p>
          {errorRegenerar && <p className="font-body text-xs font-semibold text-destructive">{errorRegenerar}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmando(false)}
              disabled={regenerando}
              className="flex-1 rounded-lg border border-brand/20 bg-marfil py-2 font-body text-xs font-semibold text-brand"
            >
              Cancelar
            </button>
            <button
              onClick={handleRegenerar}
              disabled={regenerando}
              className="flex-1 rounded-lg bg-destructive py-2 font-body text-xs font-semibold text-white disabled:opacity-60"
            >
              {regenerando ? "Regenerando..." : "Sí, regenerar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
