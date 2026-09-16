import { useState, useEffect, type CSSProperties } from "react";
import InputField from "../common/InputField";
import { TIPO_ORDEN, PLATAFORMA_DELIVERY } from "../../utils/constants";
import type { Mesa, Producto, Promocion, TipoOrden } from "../../types";
import type { CrearOrdenPayload, DetalleOrdenPayload } from "../../services/ordenesService";

const TIPO_OPCIONES = [
  { value: TIPO_ORDEN.MESA,    label: "Mesa" },
  { value: TIPO_ORDEN.LLEVAR,  label: "Para llevar" },
  { value: TIPO_ORDEN.DELIVERY, label: "Delivery" },
];

const PLATAFORMA_OPCIONES = [
  { value: PLATAFORMA_DELIVERY.RAPPI,      label: "Rappi" },
  { value: PLATAFORMA_DELIVERY.PEDIDOS_YA, label: "PedidosYa" },
  { value: PLATAFORMA_DELIVERY.DIDI,       label: "DiDi Food" },
  { value: PLATAFORMA_DELIVERY.OTRO,       label: "Otro" },
];

interface DetalleLocal {
  id: number;
  producto_id: string;
  promocion_id: string;
  cantidad: number;
  nota: string;
}

interface OrdenFormProps {
  onSubmit: (payload: CrearOrdenPayload) => Promise<void>;
  onSetSubmit?: (submit: () => Promise<void>) => void;
  cargando?: boolean;
  mesas?: Mesa[];
  productos?: Producto[];
  promociones?: Promocion[];
}

export default function OrdenForm({ onSubmit, onSetSubmit, cargando = false, mesas = [], productos = [], promociones = [] }: OrdenFormProps) {
  const [tipoOrden, setTipoOrden]   = useState<TipoOrden>(TIPO_ORDEN.MESA);
  const [mesaId, setMesaId]         = useState("");
  const [detalles, setDetalles]     = useState<DetalleLocal[]>([]);
  const [nuevoDetalle, setNuevoDetalle] = useState({ producto_id: "", promocion_id: "", cantidad: 1, nota: "" });
  const [clienteNombre, setClienteNombre]       = useState("");
  const [clienteTelefono, setClienteTelefono]   = useState("");
  const [direccionEntrega, setDireccionEntrega] = useState("");
  const [plataforma, setPlataforma]             = useState("");
  const [plataformaOtra, setPlataformaOtra]     = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});

  const total = detalles.reduce((sum, item) => {
    const prod  = productos.find((p) => p.id === parseInt(item.producto_id));
    const promo = promociones.find((p) => p.id === parseInt(item.promocion_id));
    return sum + (parseFloat(String(prod?.precio_venta ?? prod?.precio ?? 0)) + parseFloat(String(promo?.precio ?? 0))) * item.cantidad;
  }, 0);

  const agregarDetalle = () => {
    const err: Record<string, string> = {};
    if (!nuevoDetalle.producto_id && !nuevoDetalle.promocion_id)
      err.item = "Seleccioná al menos un producto o promoción";
    if (nuevoDetalle.cantidad <= 0)
      err.cantidad = "La cantidad debe ser mayor a 0";
    if (Object.keys(err).length) { setErrores(err); return; }
    setErrores({});
    setDetalles([...detalles, { ...nuevoDetalle, id: Date.now() }]);
    setNuevoDetalle({ producto_id: "", promocion_id: "", cantidad: 1, nota: "" });
  };

  const quitarDetalle = (id: number) => setDetalles(detalles.filter((d) => d.id !== id));

  const validar = (): Record<string, string> => {
    const err: Record<string, string> = {};
    if (tipoOrden === TIPO_ORDEN.MESA && !mesaId)
      err.mesa = "Seleccioná una mesa";
    if (tipoOrden === TIPO_ORDEN.DELIVERY) {
      if (!plataforma) err.plataforma = "Seleccioná la plataforma";
      if (plataforma === PLATAFORMA_DELIVERY.OTRO && !plataformaOtra.trim())
        err.plataformaOtra = "Escribí el nombre de la plataforma";
    }
    if (detalles.length === 0)
      err.detalles = "La orden debe tener al menos un ítem";
    return err;
  };

  const ejecutarSubmit = async () => {
    const err = validar();
    if (Object.keys(err).length) { setErrores(err); return; }
    setErrores({});

    const detallesPayload: DetalleOrdenPayload[] = detalles.map((d) => ({
      producto:  d.producto_id  ? parseInt(d.producto_id)  : null,
      promocion: d.promocion_id ? parseInt(d.promocion_id) : null,
      cantidad: d.cantidad,
      nota: d.nota || "",
    }));

    const payload: CrearOrdenPayload = {
      tipo_orden: tipoOrden,
      mesa: tipoOrden === TIPO_ORDEN.MESA ? parseInt(mesaId) : null,
      detalles: detallesPayload,
    };

    if (tipoOrden === TIPO_ORDEN.DELIVERY) {
      payload.cliente_nombre    = clienteNombre;
      payload.cliente_telefono  = clienteTelefono;
      payload.direccion_entrega = direccionEntrega;
      payload.plataforma_delivery = plataforma;
      if (plataforma === PLATAFORMA_DELIVERY.OTRO)
        payload.plataforma_otra = plataformaOtra;
    }

    await onSubmit(payload);
  };

  useEffect(() => {
    if (onSetSubmit) onSetSubmit(ejecutarSubmit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoOrden, mesaId, detalles, clienteNombre, clienteTelefono, direccionEntrega, plataforma, plataformaOtra]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Tipo de orden */}
      <div>
        <label style={estilos.label}>Tipo de Orden *</label>
        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
          {TIPO_OPCIONES.map((op) => (
            <label key={op.value} style={estilos.radioLabel}>
              <input
                type="radio"
                value={op.value}
                checked={tipoOrden === op.value}
                onChange={(e) => { setTipoOrden(e.target.value as TipoOrden); setErrores({}); }}
                style={{ cursor: "pointer" }}
              />
              {op.label}
            </label>
          ))}
        </div>
      </div>

      {/* Mesa */}
      {tipoOrden === TIPO_ORDEN.MESA && (
        <InputField
          label="Mesa *"
          type="select"
          options={mesas.map((m) => ({ value: m.id, label: `Mesa ${m.numero}` }))}
          value={mesaId}
          onChange={setMesaId}
          error={errores.mesa}
          required
        />
      )}

      {/* Campos delivery */}
      {tipoOrden === TIPO_ORDEN.DELIVERY && (
        <>
          <InputField label="Plataforma *"   type="select" options={PLATAFORMA_OPCIONES}
            value={plataforma} onChange={setPlataforma} error={errores.plataforma} required />
          {plataforma === PLATAFORMA_DELIVERY.OTRO && (
            <InputField label="Nombre de plataforma *" type="text"
              value={plataformaOtra} onChange={setPlataformaOtra} error={errores.plataformaOtra} required />
          )}
          <InputField label="Nombre del cliente"   type="text" value={clienteNombre}    onChange={setClienteNombre} />
          <InputField label="Teléfono"              type="text" value={clienteTelefono}  onChange={setClienteTelefono} />
          <InputField label="Dirección de entrega"  type="text" value={direccionEntrega} onChange={setDireccionEntrega} />
        </>
      )}

      {/* Agregar ítems */}
      <div style={estilos.seccion}>
        <h4 style={estilos.seccionTitulo}>Agregar Ítems</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <InputField label="Producto"  type="select"
            options={productos.map((p) => ({ value: p.id, label: p.nombre }))}
            value={nuevoDetalle.producto_id}
            onChange={(v) => setNuevoDetalle({ ...nuevoDetalle, producto_id: v, promocion_id: "" })} />
          <InputField label="Promoción" type="select"
            options={promociones.map((p) => ({ value: p.id, label: p.nombre }))}
            value={nuevoDetalle.promocion_id}
            onChange={(v) => setNuevoDetalle({ ...nuevoDetalle, promocion_id: v, producto_id: "" })} />
          {errores.item && <p style={estilos.errorTexto}>{errores.item}</p>}
          <InputField label="Cantidad" type="number"
            value={nuevoDetalle.cantidad}
            onChange={(v) => setNuevoDetalle({ ...nuevoDetalle, cantidad: parseInt(v) || 1 })}
            error={errores.cantidad} />
          <InputField label="Nota (opcional)" type="text" placeholder="Ej: sin cebolla..."
            value={nuevoDetalle.nota}
            onChange={(v) => setNuevoDetalle({ ...nuevoDetalle, nota: v })} />
          <button onClick={agregarDetalle} disabled={cargando} style={estilos.botonAgregar}>
            + Agregar Ítem
          </button>
        </div>
      </div>

      {/* Lista de ítems */}
      {detalles.length > 0 && (
        <div style={estilos.seccionLista}>
          <h4 style={estilos.seccionTitulo}>Ítems ({detalles.length})</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {detalles.map((d) => {
              const prod  = productos.find((p) => p.id === parseInt(d.producto_id));
              const promo = promociones.find((p) => p.id === parseInt(d.promocion_id));
              const precio   = (parseFloat(String(prod?.precio_venta ?? prod?.precio ?? 0)) + parseFloat(String(promo?.precio ?? 0)));
              const subtotal = (precio * d.cantidad).toFixed(2);
              return (
                <div key={d.id} style={estilos.itemFila}>
                  <div style={{ flex: 1 }}>
                    <p style={estilos.itemNombre}>{d.cantidad}× {prod?.nombre || promo?.nombre || "Ítem"}</p>
                    {d.nota && <p style={estilos.itemNota}>📝 {d.nota}</p>}
                    <p style={estilos.itemPrecio}>${precio.toFixed(2)} × {d.cantidad} = <strong>${subtotal}</strong></p>
                  </div>
                  <button onClick={() => quitarDetalle(d.id)} style={estilos.botonQuitar}>Quitar</button>
                </div>
              );
            })}
          </div>
          {errores.detalles && <p style={estilos.errorTexto}>{errores.detalles}</p>}
        </div>
      )}

      {/* Total */}
      <div style={estilos.totalBox}>
        <p style={estilos.totalLabel}>Total</p>
        <p style={estilos.totalValor}>${total.toFixed(2)}</p>
      </div>

    </div>
  );
}

const estilos: Record<string, CSSProperties> = {
  label:        { fontFamily: "'Lato', sans-serif", fontSize: "11px", fontWeight: 700, color: "rgba(44,85,69,0.75)", letterSpacing: "0.07em", textTransform: "uppercase" },
  radioLabel:   { display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontFamily: "'Lato', sans-serif", fontSize: "13px" },
  seccion:      { padding: "16px", backgroundColor: "rgba(44,85,69,0.03)", borderRadius: "8px", border: "1px dashed rgba(44,85,69,0.2)" },
  seccionLista: { padding: "16px", backgroundColor: "rgba(44,85,69,0.02)", borderRadius: "8px", border: "1px solid rgba(44,85,69,0.1)" },
  seccionTitulo:{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "14px", fontWeight: 600, color: "#2C5545", margin: "0 0 12px 0" },
  itemFila:     { padding: "12px", backgroundColor: "white", borderRadius: "6px", border: "1px solid rgba(44,85,69,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" },
  itemNombre:   { fontFamily: "'Lato', sans-serif", fontSize: "13px", fontWeight: 600, color: "#2C5545", margin: "0 0 4px 0" },
  itemNota:     { fontFamily: "'Lato', sans-serif", fontSize: "11px", color: "#999", margin: "0 0 4px 0" },
  itemPrecio:   { fontFamily: "'Lato', sans-serif", fontSize: "11px", color: "#666", margin: 0 },
  botonAgregar: { padding: "10px", borderRadius: "8px", border: "none", backgroundColor: "#2C5545", color: "white", fontFamily: "'Lato', sans-serif", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  botonQuitar:  { padding: "6px 10px", borderRadius: "6px", border: "1px solid #f5bfb7", backgroundColor: "#fdecea", color: "#c62828", fontFamily: "'Lato', sans-serif", fontSize: "12px", fontWeight: 600, cursor: "pointer", marginLeft: "12px" },
  errorTexto:   { fontFamily: "'Lato', sans-serif", fontSize: "11.5px", color: "#c62828", margin: "4px 0 0 0" },
  totalBox:     { padding: "16px", backgroundColor: "rgba(44,85,69,0.05)", borderRadius: "8px", border: "2px solid rgba(44,85,69,0.2)", textAlign: "right" },
  totalLabel:   { fontFamily: "'Lato', sans-serif", fontSize: "11px", fontWeight: 700, color: "rgba(44,85,69,0.7)", margin: "0 0 6px 0", textTransform: "uppercase", letterSpacing: "0.07em" },
  totalValor:   { fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#2C5545", margin: 0 },
};
