import { useState, useEffect, useCallback, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import ordenesService from "../../services/ordenesService";
import { formatDateTime } from "../../utils/formatters";
import type { Orden } from "../../types";

export default function ComandaPage() {
  const { ordenId } = useParams<{ ordenId: string }>();
  const [orden, setOrden]     = useState<Orden | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [yaImpreso, setYaImpreso]     = useState(false);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await ordenesService.listar();
      const ordenes = Array.isArray(data) ? data : (data.results ?? []);
      const found = ordenes.find((o) => o.id === parseInt(ordenId ?? "", 10));
      if (!found) { setError("Orden no encontrada."); return; }
      setOrden(found);
    } catch {
      setError("Error al cargar la orden.");
    } finally {
      setLoading(false);
    }
  }, [ordenId]);

  useEffect(() => { cargar(); }, [cargar]);

  const itemsPendientes = orden?.detalles?.filter((d) => !d.impreso) ?? [];
  const itemsImpreso    = orden?.detalles?.filter((d) => d.impreso)  ?? [];

  const handleImprimir = async () => {
    if (imprimiendo || yaImpreso || !orden) return;
    setImprimiendo(true);
    try {
      const ids = itemsPendientes.map((d) => d.id);
      if (ids.length > 0) {
        await ordenesService.marcarImpreso(orden.id, ids);
      }
      setYaImpreso(true);
      window.print();
    } catch {
      alert("Error al registrar la impresión. Intentá de nuevo.");
    } finally {
      setImprimiendo(false);
    }
  };

  if (loading) return <div style={estilos.centrado}>Cargando comanda...</div>;
  if (error)   return <div style={estilos.centrado}>{error}</div>;
  if (!orden)  return null;

  const esDelivery = orden.tipo_orden === "delivery";
  const esMesa     = orden.tipo_orden === "mesa";

  const handleCerrar = () => {
    if (window.opener) {
      window.close();
    } else {
      window.location.href = "/ordenes";
    }
  };

  return (
    <div style={estilos.pagina}>

      {/* Botón imprimir — se oculta al imprimir */}
      <div style={estilos.accionesPrint}>
        <button
          onClick={handleImprimir}
          disabled={imprimiendo || itemsPendientes.length === 0}
          style={{
            ...estilos.botonImprimir,
            opacity: (imprimiendo || itemsPendientes.length === 0) ? 0.5 : 1,
            cursor:  (imprimiendo || itemsPendientes.length === 0) ? "not-allowed" : "pointer",
          }}
        >
          {imprimiendo ? "Registrando..." : yaImpreso ? "✓ Impreso" : "🖨 Imprimir comanda"}
        </button>
        <button onClick={handleCerrar} style={estilos.botonVolver}>
          ← Volver a órdenes
        </button>
        {itemsPendientes.length === 0 && (
          <p style={estilos.avisoTodo}>Todos los ítems ya fueron enviados a cocina.</p>
        )}
      </div>

      {/* Comanda */}
      <div style={estilos.comanda}>

        {/* Encabezado */}
        <div style={estilos.encabezado}>
          <h1 style={estilos.titulo}>COMANDA</h1>
          <p style={estilos.subtitulo}>Memos Café</p>
          <div style={estilos.separador} />
          <div style={estilos.infoGrid}>
            <span style={estilos.infoLabel}>Orden</span>
            <span style={estilos.infoValor}>#{orden.id}</span>
            <span style={estilos.infoLabel}>Fecha</span>
            <span style={estilos.infoValor}>{formatDateTime(orden.fecha_creacion)}</span>
            <span style={estilos.infoLabel}>Tipo</span>
            <span style={estilos.infoValor}>{orden.tipo_orden_display || orden.tipo_orden}</span>
            {esMesa && (
              <>
                <span style={estilos.infoLabel}>Mesa</span>
                <span style={estilos.infoValor}>{orden.mesa_numero}</span>
              </>
            )}
            <span style={estilos.infoLabel}>Mesero</span>
            <span style={estilos.infoValor}>{orden.usuario_nombre || "—"}</span>
          </div>

          {esDelivery && (
            <>
              <div style={estilos.separador} />
              <div style={estilos.infoGrid}>
                <span style={estilos.infoLabel}>Plataforma</span>
                <span style={estilos.infoValor}>{orden.plataforma_delivery?.toUpperCase() || "—"}</span>
                {orden.cliente_nombre && (
                  <>
                    <span style={estilos.infoLabel}>Cliente</span>
                    <span style={estilos.infoValor}>{orden.cliente_nombre}</span>
                  </>
                )}
                {orden.cliente_telefono && (
                  <>
                    <span style={estilos.infoLabel}>Teléfono</span>
                    <span style={estilos.infoValor}>{orden.cliente_telefono}</span>
                  </>
                )}
                {orden.direccion_entrega && (
                  <>
                    <span style={estilos.infoLabel}>Dirección</span>
                    <span style={estilos.infoValor}>{orden.direccion_entrega}</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div style={estilos.separador} />

        {/* Ítems pendientes */}
        {itemsPendientes.length > 0 && (
          <div>
            <p style={estilos.seccionLabel}>▶ NUEVOS</p>
            {itemsPendientes.map((d) => (
              <div key={d.id} style={estilos.itemFila}>
                <span style={estilos.itemCantidad}>{d.cantidad}×</span>
                <div style={{ flex: 1 }}>
                  <span style={estilos.itemNombre}>
                    {d.producto?.nombre || d.promocion?.nombre || `Ítem #${d.id}`}
                  </span>
                  {d.nota && <p style={estilos.itemNota}>↳ {d.nota}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Ítems ya enviados */}
        {itemsImpreso.length > 0 && (
          <>
            <div style={estilos.separador} />
            <div>
              <p style={estilos.seccionLabelGris}>✓ YA ENVIADOS</p>
              {itemsImpreso.map((d) => (
                <div key={d.id} style={{ ...estilos.itemFila, opacity: 0.45 }}>
                  <span style={estilos.itemCantidad}>{d.cantidad}×</span>
                  <span style={estilos.itemNombre}>
                    {d.producto?.nombre || d.promocion?.nombre || `Ítem #${d.id}`}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={estilos.separador} />
        <p style={estilos.pie}>— fin de comanda —</p>
      </div>

    </div>
  );
}

const estilos: Record<string, CSSProperties> = {
  pagina:          { maxWidth: "380px", margin: "0 auto", padding: "24px 16px", fontFamily: "'Courier New', Courier, monospace" },
  centrado:        { textAlign: "center", padding: "40px", fontFamily: "'Lato', sans-serif", fontSize: "14px", color: "#666" },
  accionesPrint:   { marginBottom: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" },
  botonImprimir:   { padding: "12px 24px", borderRadius: "8px", border: "none", backgroundColor: "#2C5545", color: "white", fontFamily: "'Lato', sans-serif", fontSize: "14px", fontWeight: 700 },
  botonVolver:     { padding: "8px 18px", borderRadius: "8px", border: "1px solid rgba(44,85,69,0.25)", backgroundColor: "transparent", color: "#2C5545", fontFamily: "'Lato', sans-serif", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  avisoTodo:       { fontFamily: "'Lato', sans-serif", fontSize: "12px", color: "#888", margin: 0 },
  comanda:         { border: "1px dashed #ccc", padding: "20px", borderRadius: "4px" },
  encabezado:      { textAlign: "center" },
  titulo:          { fontSize: "22px", fontWeight: 700, margin: "0 0 4px 0", letterSpacing: "0.1em" },
  subtitulo:       { fontSize: "13px", margin: "0 0 12px 0", color: "#555" },
  separador:       { borderTop: "1px dashed #aaa", margin: "12px 0" },
  infoGrid:        { display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", textAlign: "left", fontSize: "12px" },
  infoLabel:       { fontWeight: 700, whiteSpace: "nowrap" },
  infoValor:       { color: "#333" },
  seccionLabel:    { fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", margin: "0 0 8px 0" },
  seccionLabelGris:{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", margin: "0 0 8px 0", color: "#999" },
  itemFila:        { display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "8px" },
  itemCantidad:    { fontWeight: 700, minWidth: "28px", fontSize: "14px" },
  itemNombre:      { fontSize: "14px", fontWeight: 600 },
  itemNota:        { fontSize: "11px", color: "#666", margin: "2px 0 0 0" },
  pie:             { textAlign: "center", fontSize: "11px", color: "#aaa", margin: 0 },
};
