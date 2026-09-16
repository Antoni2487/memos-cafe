import { useState, useMemo, type CSSProperties, type ReactNode } from "react";
import {
    DollarSign, Plus, X, CreditCard, Banknote, Smartphone,
    FileText, Ban, ChevronDown, ChevronUp, Receipt,
    type LucideIcon,
} from "lucide-react";
import useCaja from "../../hooks/useCaja";
import cajaService from "../../services/cajaService";
import { PageHeader } from "../../components/common";
import { esSoloAlfanumerico, validarDocumentoComprobante, LIMITES, MENSAJES } from "../../utils/validators";
import { getErrorMessage } from "../../utils/errors";
import type { Orden, Pago, TipoComprobante, TipoMovimiento } from "../../types";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number | string | undefined | null) => `S/ ${Number(n ?? 0).toFixed(2)}`;

const C = {
    verde: "#2C5545",
    verdeOsc: "#1E4A37",
    verdePal: "rgba(44,85,69,0.08)",
    rojo: "#c62828",
    rojoPal: "rgba(198,40,40,0.08)",
    gris: "#6b7280",
    amarillo: "#f59e0b",
    bg: "rgba(44,85,69,0.06)",
    borde: "rgba(44,85,69,0.2)",
};

const METODOS: { value: string; label: string; Icon: LucideIcon }[] = [
    { value: "efectivo", label: "Efectivo", Icon: Banknote },
    { value: "yape", label: "Yape", Icon: Smartphone },
    { value: "plin", label: "Plin", Icon: Smartphone },
    { value: "tarjeta", label: "Tarjeta", Icon: CreditCard },
];

const TIPO_LABEL: Record<string, string> = { mesa: "Mesa", llevar: "Para llevar", delivery: "Delivery" };

// ── Componentes base ──────────────────────────────────────────────────────────
interface BtnProps {
  onClick?: () => void;
  color?: string;
  outline?: boolean;
  children: ReactNode;
  disabled?: boolean;
  full?: boolean;
  size?: "sm" | "md";
}

function Btn({ onClick, color, outline, children, disabled, full, size = "md" }: BtnProps) {
    const pad = size === "sm" ? "7px 14px" : "9px 18px";
    const fz = size === "sm" ? 12 : 13;
    return (
        <button onClick={onClick} disabled={disabled} style={{
            background: outline ? "white" : (color ?? C.verde),
            color: outline ? (color ?? C.verde) : "white",
            border: `1.5px solid ${color ?? C.verde}`,
            borderRadius: 8, padding: pad, fontWeight: 600, fontSize: fz,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            width: full ? "100%" : "auto",
        }}>{children}</button>
    );
}

interface CampoProps {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  hint?: string;
  maxLength?: number;
  error?: string;
}

function Campo({ label, type = "text", value, onChange, onBlur, placeholder, readOnly, hint, maxLength, error }: CampoProps) {
    return (
        <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.verde, marginBottom: 4 }}>
                {label}
            </label>
            <input
                type={type} value={value}
                onChange={readOnly ? undefined : (e) => onChange(e.target.value)}
                onBlur={readOnly ? undefined : (e) => onBlur?.(e.target.value)}
                readOnly={readOnly} placeholder={placeholder} maxLength={maxLength}
                style={{
                    width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 13,
                    border: `1px solid ${error ? "#c62828" : C.borde}`, outline: "none", boxSizing: "border-box",
                    background: readOnly ? C.bg : "white",
                }}
            />
            {error
                ? <p style={{ margin: "3px 0 0", fontSize: 11, color: "#c62828" }}>{error}</p>
                : hint && <p style={{ margin: "3px 0 0", fontSize: 11, color: "#888" }}>{hint}</p>}
        </div>
    );
}

interface ModalProps {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: number;
}

function Modal({ titulo, onCerrar, children, ancho = 520 }: ModalProps) {
    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
            padding: 16,
        }}>
            <div style={{
                background: "white", borderRadius: 16, width: "100%", maxWidth: ancho,
                maxHeight: "90vh", overflowY: "auto",
                boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
            }}>
                <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "20px 24px 0",
                }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.verde }}>{titulo}</h3>
                    <button onClick={onCerrar} style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }}>
                        <X size={18} />
                    </button>
                </div>
                <div style={{ padding: "16px 24px 24px" }}>{children}</div>
            </div>
        </div>
    );
}

function ErrMsg({ msg }: { msg?: string }) {
    if (!msg) return null;
    return <p style={{ color: C.rojo, fontSize: 12, margin: "0 0 12px", fontWeight: 500 }}>{msg}</p>;
}

interface MetricaProps {
  label: string;
  valor: ReactNode;
  color?: string;
  sub?: string;
}

function Metrica({ label, valor, color, sub }: MetricaProps) {
    return (
        <div style={{
            background: "white", borderRadius: 12, padding: "14px 18px",
            border: `1px solid ${C.borde}`, flex: 1, minWidth: 130,
        }}>
            <p style={{
                margin: 0, fontSize: 11, fontWeight: 700, color: "rgba(44,85,69,0.5)",
                textTransform: "uppercase", letterSpacing: "0.06em"
            }}>{label}</p>
            <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 700, color: color ?? C.verde }}>{valor}</p>
            {sub && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#999" }}>{sub}</p>}
        </div>
    );
}

// ── Card orden por cobrar ─────────────────────────────────────────────────────
function OrdenCard({ orden, onCobrar }: { orden: Orden; onCobrar: (orden: Orden) => void }) {
    const [abierto, setAbierto] = useState(false);
    const tipo = TIPO_LABEL[orden.tipo_orden] ?? orden.tipo_orden;

    // Calcular pendiente (en caso de pagos parciales ya registrados)
    const pagado = (orden.pagos_resumen ?? [])
        .filter(p => p.estado === "completado")
        .reduce((s, p) => s + Number(p.monto), 0);
    const pendiente = Number(orden.total) - pagado;

    return (
        <div style={{
            background: "white", border: `1px solid ${C.borde}`,
            borderRadius: 12, overflow: "hidden",
        }}>
            <div style={{
                padding: "14px 16px", display: "flex",
                justifyContent: "space-between", alignItems: "center",
            }}>
                <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: C.verde }}>
                        Orden #{orden.id}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 12, color: "#777" }}>
                        {tipo}{orden.mesa_numero ? ` · Mesa ${orden.mesa_numero}` : ""}
                        {orden.cliente_nombre ? ` · ${orden.cliente_nombre}` : ""}
                    </p>
                    <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.verde }}>
                            Total: {fmt(orden.total)}
                        </p>
                        {pagado > 0 && (
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.amarillo }}>
                                Pendiente: {fmt(pendiente)}
                            </p>
                        )}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                        onClick={() => setAbierto(!abierto)}
                        style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: C.gris, display: "flex", alignItems: "center"
                        }}
                    >
                        {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <Btn onClick={() => onCobrar(orden)}>
                        {pagado > 0 ? "Pago parcial" : "Cobrar"}
                    </Btn>
                </div>
            </div>

            {/* Detalles expandibles */}
            {abierto && (
                <div style={{
                    borderTop: `1px solid ${C.borde}`, padding: "10px 16px 14px",
                    background: "rgba(44,85,69,0.02)"
                }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                            <tr style={{
                                color: "rgba(44,85,69,0.55)", fontWeight: 700,
                                textTransform: "uppercase", letterSpacing: "0.05em"
                            }}>
                                <th style={{ textAlign: "left", paddingBottom: 6 }}>Ítem</th>
                                <th style={{ textAlign: "center", paddingBottom: 6 }}>Cant.</th>
                                <th style={{ textAlign: "right", paddingBottom: 6 }}>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(orden.detalles ?? []).map((d) => {
                                const nombre = d.producto?.nombre ?? d.promocion?.nombre ?? `Ítem #${d.id}`;
                                return (
                                    <tr key={d.id} style={{ borderTop: `1px solid ${C.borde}` }}>
                                        <td style={{ padding: "6px 0", color: "#444" }}>{nombre}</td>
                                        <td style={{ textAlign: "center", color: "#666" }}>{d.cantidad}</td>
                                        <td style={{ textAlign: "right", fontWeight: 600, color: C.verde }}>
                                            {fmt(d.subtotal)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={2} style={{
                                    paddingTop: 8, fontWeight: 700,
                                    color: "rgba(44,85,69,0.6)", fontSize: 11,
                                    textTransform: "uppercase", letterSpacing: "0.06em"
                                }}>
                                    Total
                                </td>
                                <td style={{
                                    paddingTop: 8, textAlign: "right",
                                    fontWeight: 700, fontSize: 15, color: C.verde
                                }}>
                                    {fmt(orden.total)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}

// ── Modal de cobro ────────────────────────────────────────────────────────────
function ModalCobrar({ orden, onCerrar, onPagado }: { orden: Orden; onCerrar: () => void; onPagado: () => void }) {
    // La API expone "pagos_resumen" (ver OrdenReadSerializer), nunca "pagos"
    // -- con el campo equivocado esto siempre daba 0, así que en un pago
    // parcial el modal mostraba el total completo como pendiente en vez
    // del saldo real, dejando pasar montos que el backend rechazaba.
    const pagadoPrevio = (orden.pagos_resumen ?? [])
        .filter(p => p.estado === "completado")
        .reduce((s, p) => s + Number(p.monto), 0);
    const pendiente = Number(orden.total) - pagadoPrevio;

    const [metodo, setMetodo] = useState("efectivo");
    const [monto, setMonto] = useState(String(pendiente.toFixed(2)));
    const [montoRecibido, setMontoRecibido] = useState("");
    const [numOp, setNumOp] = useState("");
    const [guardando, setGuardando] = useState(false);
    const [err, setErr] = useState("");

    const montoNum = Number(monto) || 0;
    const recibidoNum = Number(montoRecibido) || 0;
    const esEfectivo = metodo === "efectivo";
    const esTarjeta = metodo === "tarjeta";

    // Vuelto: solo efectivo, solo si monto recibido > monto a pagar
    const vuelto = esEfectivo && montoRecibido
        ? Math.max(0, recibidoNum - montoNum)
        : 0;

    const handleConfirmar = async () => {
        setErr("");
        if (montoNum <= 0) return setErr("Ingresa un monto válido.");
        if (montoNum > pendiente + 0.001)
            return setErr(`El monto no puede superar el pendiente (${fmt(pendiente)}).`);
        if (esEfectivo && montoRecibido && recibidoNum < montoNum)
            return setErr("El monto recibido no puede ser menor al monto a cobrar.");
        if (esTarjeta && !numOp.trim())
            return setErr("Ingresa el número de operación.");
        if (esTarjeta && numOp.trim() && !esSoloAlfanumerico(numOp))
            return setErr(MENSAJES.SOLO_ALFANUMERICO);

        setGuardando(true);
        try {
            await cajaService.procesarPago({
                orden: orden.id,
                metodo_pago: metodo,
                monto: montoNum,
                monto_recibido: esEfectivo && montoRecibido ? recibidoNum : undefined,
                numero_operacion: esTarjeta ? numOp.trim() : undefined,
            });
            onPagado();
            onCerrar();
        } catch (e) {
            setErr(getErrorMessage(e, "Error al procesar el pago."));
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Modal titulo={`Cobrar Orden #${orden.id}`} onCerrar={onCerrar}>

            {/* Resumen de la orden */}
            <div style={{ background: C.bg, borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
                    {TIPO_LABEL[orden.tipo_orden] ?? orden.tipo_orden}
                    {orden.mesa_numero ? ` · Mesa ${orden.mesa_numero}` : ""}
                    {orden.cliente_nombre ? ` · ${orden.cliente_nombre}` : ""}
                </p>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 10 }}>
                    <tbody>
                        {(orden.detalles ?? []).map((d) => {
                            const nombre = d.producto?.nombre ?? d.promocion?.nombre ?? `Ítem #${d.id}`;
                            return (
                                <tr key={d.id}>
                                    <td style={{ padding: "3px 0", color: "#444" }}>
                                        {d.cantidad}× {nombre}
                                    </td>
                                    <td style={{ textAlign: "right", fontWeight: 600, color: C.verde }}>
                                        {fmt(d.subtotal)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <div style={{
                    borderTop: `1px solid ${C.borde}`, marginTop: 8, paddingTop: 8,
                    display: "flex", justifyContent: "space-between"
                }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(44,85,69,0.6)" }}>
                        Total orden
                    </span>
                    <span style={{ fontSize: 17, fontWeight: 700, color: C.verde }}>
                        {fmt(orden.total)}
                    </span>
                </div>
                {pagadoPrevio > 0 && (
                    <>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                            <span style={{ fontSize: 12, color: "#888" }}>Ya pagado</span>
                            <span style={{ fontSize: 12, color: C.amarillo, fontWeight: 600 }}>
                                − {fmt(pagadoPrevio)}
                            </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.rojo }}>Pendiente</span>
                            <span style={{ fontSize: 16, fontWeight: 700, color: C.rojo }}>{fmt(pendiente)}</span>
                        </div>
                    </>
                )}
            </div>

            {/* Método de pago */}
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.verde, marginBottom: 8 }}>
                Método de pago
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                {METODOS.map(({ value, label, Icon }) => (
                    <button key={value} onClick={() => { setMetodo(value); setErr(""); }}
                        style={{
                            padding: "10px 8px", borderRadius: 8, cursor: "pointer",
                            border: `2px solid ${metodo === value ? C.verde : C.borde}`,
                            background: metodo === value ? C.bg : "white",
                            display: "flex", alignItems: "center", gap: 8,
                            fontWeight: 600, fontSize: 13,
                            color: metodo === value ? C.verde : "#555",
                        }}>
                        <Icon size={15} /> {label}
                    </button>
                ))}
            </div>

            {/* Monto a cobrar en este pago */}
            <Campo
                label={pendiente < Number(orden.total)
                    ? `Monto de este pago (S/) — pendiente: ${fmt(pendiente)}`
                    : "Monto a cobrar (S/)"}
                type="number"
                value={monto}
                onChange={setMonto}
                placeholder={String(pendiente.toFixed(2))}
                hint={montoNum < pendiente ? `Quedará un pendiente de ${fmt(pendiente - montoNum)}` : undefined}
            />

            {/* Monto recibido — solo efectivo */}
            {esEfectivo && (
                <Campo
                    label="Monto recibido del cliente (S/)"
                    type="number"
                    value={montoRecibido}
                    onChange={setMontoRecibido}
                    placeholder={String(montoNum.toFixed(2))}
                    hint="Cuánto te entrega físicamente el cliente"
                />
            )}

            {/* Vuelto — solo efectivo */}
            {esEfectivo && montoRecibido && (
                <div style={{
                    background: vuelto >= 0 ? C.bg : C.rojoPal,
                    borderRadius: 8, padding: "8px 12px", marginBottom: 14,
                }}>
                    <p style={{
                        margin: 0, fontSize: 13, fontWeight: 600,
                        color: vuelto >= 0 ? C.verde : C.rojo
                    }}>
                        Vuelto: {fmt(vuelto)}
                    </p>
                </div>
            )}

            {/* Número de operación — solo tarjeta */}
            {esTarjeta && (
                <Campo
                    label="Número de operación (POS) *"
                    value={numOp}
                    onChange={setNumOp}
                    maxLength={LIMITES.NUM_OPERACION}
                    placeholder="Ej: 123456"
                />
            )}

            <ErrMsg msg={err} />

            <Btn onClick={handleConfirmar} disabled={guardando} full>
                {guardando ? "Procesando..." : montoNum < pendiente
                    ? `Registrar pago parcial (${fmt(montoNum)})`
                    : `Confirmar pago (${fmt(montoNum)})`}
            </Btn>
        </Modal>
    );
}

// ── Modal emitir comprobante ──────────────────────────────────────────────────
function ModalComprobante({ pago, onCerrar, onEmitido }: { pago: Pago; onCerrar: () => void; onEmitido: () => void }) {
    const [tipo, setTipo] = useState<TipoComprobante>("boleta");
    const [serie, setSerie] = useState("B001");
    const [numero, setNumero] = useState("");
    const [nombre, setNombre] = useState("");
    const [rucDni, setRucDni] = useState("");
    const [direccion, setDireccion] = useState("");
    const [guardando, setGuardando] = useState(false);
    const [err, setErr] = useState("");

    const esFactura = tipo === "factura";

    // Prefijo de serie según tipo
    const handleTipo = (t: TipoComprobante) => {
        setTipo(t);
        setSerie(t === "factura" ? "F001" : "B001");
    };

    const handleEmitir = async () => {
        setErr("");
        if (!numero) return setErr("Ingresa el número de comprobante.");
        if (esFactura && !nombre.trim())
            return setErr("Para factura se requiere razón social.");
        const errDoc = validarDocumentoComprobante(tipo, rucDni);
        if (errDoc) return setErr(errDoc);

        setGuardando(true);
        try {
            await cajaService.emitirComprobante({
                pago: pago.id,
                tipo,
                serie,
                numero: Number(numero),
                cliente_nombre: nombre,
                cliente_ruc_dni: rucDni,
                cliente_direccion: direccion,
            });
            onEmitido();
            onCerrar();
        } catch (e) {
            setErr(getErrorMessage(e, "Error al emitir comprobante."));
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Modal titulo={`Emitir comprobante — Pago #${pago.id}`} onCerrar={onCerrar} ancho={420}>

            {/* Resumen del pago */}
            <div style={{
                background: C.bg, borderRadius: 8, padding: "10px 12px", marginBottom: 16,
                fontSize: 12, color: "#555"
            }}>
                <p style={{ margin: 0 }}>
                    Orden #{pago.orden?.id} · {pago.metodo_pago_display} · <strong>{fmt(pago.monto)}</strong>
                </p>
            </div>

            {/* Tipo */}
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.verde, marginBottom: 8 }}>
                Tipo de comprobante
            </label>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {(["boleta", "factura"] as const).map((t) => (
                    <button key={t} onClick={() => handleTipo(t)} style={{
                        flex: 1, padding: "9px 0", borderRadius: 8, cursor: "pointer",
                        border: `2px solid ${tipo === t ? C.verde : C.borde}`,
                        background: tipo === t ? C.bg : "white",
                        fontWeight: 600, fontSize: 13,
                        color: tipo === t ? C.verde : "#777",
                        textTransform: "capitalize",
                    }}>{t}</button>
                ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: "0 0 100px" }}>
                    <Campo label="Serie" value={serie} onChange={setSerie}
                        maxLength={LIMITES.SERIE} placeholder="B001" />
                </div>
                <div style={{ flex: 1 }}>
                    <Campo label="Número" type="number" value={numero}
                        onChange={setNumero} placeholder="1" />
                </div>
            </div>

            <Campo label={esFactura ? "Razón social *" : "Nombre del cliente (opcional)"}
                value={nombre} onChange={setNombre}
                maxLength={LIMITES.NOMBRE_PERSONA}
                placeholder={esFactura ? "Empresa S.A.C." : "Nombre"} />

            <Campo label={esFactura ? "RUC *" : "DNI (opcional)"}
                value={rucDni} onChange={setRucDni}
                onBlur={(v) => setErr(validarDocumentoComprobante(tipo, v) || "")}
                maxLength={LIMITES.RUC_DNI}
                placeholder={esFactura ? "20xxxxxxxxx" : "12345678"} />

            {esFactura && (
                <Campo label="Dirección fiscal (opcional)"
                    value={direccion} onChange={setDireccion} placeholder="Av. ..." />
            )}

            <ErrMsg msg={err} />

            <Btn onClick={handleEmitir} disabled={guardando} full>
                {guardando ? "Emitiendo..." : `Emitir ${tipo}`}
            </Btn>
        </Modal>
    );
}

// ── Fila de la tabla de pagos ─────────────────────────────────────────────────
interface FilaPagoProps {
  pago: Pago;
  esAdmin: boolean;
  onAnular: (pago: Pago) => void;
  onEmitirComprobante: (pago: Pago) => void;
}

function FilaPago({ pago, esAdmin, onAnular, onEmitirComprobante }: FilaPagoProps) {
    const [expandido, setExpandido] = useState(false);
    const anulado = pago.estado === "anulado";
    const tieneComp = !!pago.comprobante;

    return (
        <>
            <tr style={{
                background: anulado ? "rgba(198,40,40,0.03)" : "white",
                borderBottom: `1px solid ${C.borde}`,
                opacity: anulado ? 0.7 : 1,
            }}>
                <td style={td}>
                    <button onClick={() => setExpandido(!expandido)}
                        style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: C.gris, display: "flex", alignItems: "center"
                        }}>
                        {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </td>
                <td style={td}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: C.verde }}>#{pago.id}</span>
                </td>
                <td style={td}>
                    <span style={{ fontSize: 12, color: "#555" }}>
                        Orden #{pago.orden?.id ?? "—"}
                    </span>
                </td>
                <td style={td}>
                    <span style={{ fontSize: 12, color: "#555", textTransform: "capitalize" }}>
                        {pago.metodo_pago_display ?? pago.metodo_pago}
                        {pago.numero_operacion ? ` · Op. ${pago.numero_operacion}` : ""}
                    </span>
                </td>
                <td style={td}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: C.verde }}>{fmt(pago.monto)}</span>
                </td>
                <td style={td}>
                    {pago.metodo_pago === "efectivo" && Number(pago.vuelto) > 0
                        ? <span style={{ fontSize: 12, color: C.amarillo, fontWeight: 600 }}>
                            {fmt(pago.vuelto)}
                        </span>
                        : <span style={{ fontSize: 12, color: "#ccc" }}>—</span>
                    }
                </td>
                <td style={td}>
                    <span style={{
                        padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                        background: anulado ? C.rojoPal : C.verdePal,
                        color: anulado ? C.rojo : C.verde,
                    }}>
                        {anulado ? "Anulado" : "Completado"}
                    </span>
                </td>
                <td style={td}>
                    <span style={{ fontSize: 11, color: "#888" }}>
                        {new Date(pago.fecha).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                </td>
                <td style={td}>
                    <div style={{ display: "flex", gap: 6 }}>
                        {!anulado && !tieneComp && (
                            <button
                                onClick={() => onEmitirComprobante(pago)}
                                title="Emitir comprobante"
                                style={btnAccion(C.verde, C.bg)}>
                                <Receipt size={13} />
                            </button>
                        )}
                        {tieneComp && pago.comprobante && (
                            <span style={{
                                fontSize: 11, color: C.verde, fontWeight: 600,
                                padding: "2px 8px", background: C.bg, borderRadius: 6
                            }}>
                                {pago.comprobante.tipo === "factura" ? "F" : "B"}
                                {pago.comprobante.serie}-{String(pago.comprobante.numero).padStart(8, "0")}
                            </span>
                        )}
                        {!anulado && esAdmin && (
                            <button
                                onClick={() => onAnular(pago)}
                                title="Anular pago"
                                style={btnAccion(C.rojo, C.rojoPal)}>
                                <Ban size={13} />
                            </button>
                        )}
                    </div>
                </td>
            </tr>

            {/* Fila expandida con detalles de la orden */}
            {expandido && (
                <tr style={{ background: "rgba(44,85,69,0.02)", borderBottom: `1px solid ${C.borde}` }}>
                    <td colSpan={9} style={{ padding: "10px 16px" }}>
                        <p style={{
                            margin: "0 0 6px", fontSize: 11, fontWeight: 700,
                            color: "rgba(44,85,69,0.55)", textTransform: "uppercase",
                            letterSpacing: "0.06em"
                        }}>
                            Detalle de la orden #{pago.orden?.id}
                        </p>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <tbody>
                                {(pago.orden?.detalles ?? []).map((d) => {
                                    const nombre = d.producto?.nombre ?? d.promocion?.nombre ?? `Ítem #${d.id}`;
                                    return (
                                        <tr key={d.id}>
                                            <td style={{ padding: "3px 0", color: "#444" }}>
                                                {d.cantidad}× {nombre}
                                                {d.nota ? <span style={{ color: "#999" }}> · {d.nota}</span> : ""}
                                            </td>
                                            <td style={{ textAlign: "right", fontWeight: 600, color: C.verde }}>
                                                {fmt(d.subtotal)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td style={{
                                        paddingTop: 6, fontWeight: 700, fontSize: 12,
                                        color: "rgba(44,85,69,0.6)"
                                    }}>Total orden</td>
                                    <td style={{
                                        paddingTop: 6, textAlign: "right",
                                        fontWeight: 700, fontSize: 14, color: C.verde
                                    }}>
                                        {fmt(pago.orden?.total)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </td>
                </tr>
            )}
        </>
    );
}

const td: CSSProperties = { padding: "10px 12px", verticalAlign: "middle" };
const btnAccion = (color: string, bg: string): CSSProperties => ({
    width: 30, height: 30, borderRadius: 7, border: "none", cursor: "pointer",
    background: bg, color, display: "flex", alignItems: "center", justifyContent: "center",
});

const MOTIVOS_ANULACION = [
    { value: "devolucion", label: "Devolución de dinero" },
    { value: "error_cobro", label: "Error de cobro" },
    { value: "reclamo", label: "Producto no conforme / reclamo" },
    { value: "otro", label: "Otro" },
];

// ══════════════════════════════════════════════════════════════════════════════
export default function CajaPage() {
    const { caja, movimientos, pagos, ordenesAbiertas, cargando, recargar, esAdmin } = useCaja();

    // Modales
    const [modalAbrir, setModalAbrir] = useState(false);
    const [modalCerrar, setModalCerrar] = useState(false);
    const [modalMovimiento, setModalMovimiento] = useState(false);
    const [ordenCobrar, setOrdenCobrar] = useState<Orden | null>(null);
    const [pagoComprobante, setPagoComprobante] = useState<Pago | null>(null);
    const [pagoAnular, setPagoAnular] = useState<Pago | null>(null);

    // Forms simples
    const [montoInicial, setMontoInicial] = useState("");
    const [montoFinal, setMontoFinal] = useState("");
    const [obsCierre, setObsCierre] = useState("");
    const [tipoMov, setTipoMov] = useState<TipoMovimiento>("entrada");
    const [montoMov, setMontoMov] = useState("");
    const [motivoMov, setMotivoMov] = useState("");
    const [guardando, setGuardando] = useState(false);
    const [errMsg, setErrMsg] = useState("");
    const [anulando, setAnulando] = useState(false);
    const [motivoAnular, setMotivoAnular] = useState("devolucion");
    const [detalleAnular, setDetalleAnular] = useState("");

    const limpiar = () => {
        setMontoInicial(""); setMontoFinal(""); setObsCierre("");
        setTipoMov("entrada"); setMontoMov(""); setMotivoMov("");
        setErrMsg("");
    };

    // ── Acciones ────────────────────────────────────────────────────────────────
    const handleAbrir = async () => {
        if (!montoInicial) return setErrMsg("Ingresa el monto inicial.");
        try {
            setGuardando(true); setErrMsg("");
            await cajaService.abrirSesion({ monto_inicial: montoInicial });
            setModalAbrir(false); limpiar(); recargar();
        } catch (e) {
            setErrMsg(getErrorMessage(e, "Error al abrir caja."));
        } finally { setGuardando(false); }
    };

    const handleCerrar = async () => {
        if (!montoFinal) return setErrMsg("Ingresa el monto final.");
        try {
            setGuardando(true); setErrMsg("");
            await cajaService.cerrarSesion({ monto_final: montoFinal, observaciones: obsCierre });
            setModalCerrar(false); limpiar(); recargar();
        } catch (e) {
            setErrMsg(getErrorMessage(e, "Error al cerrar caja."));
        } finally { setGuardando(false); }
    };

    const handleMovimiento = async () => {
        if (!montoMov || !motivoMov) return setErrMsg("Completa todos los campos.");
        if (!esSoloAlfanumerico(motivoMov)) return setErrMsg(MENSAJES.SOLO_ALFANUMERICO);
        try {
            setGuardando(true); setErrMsg("");
            await cajaService.registrarMovimiento({ tipo: tipoMov, monto: montoMov, motivo: motivoMov });
            setModalMovimiento(false); limpiar(); recargar();
        } catch (e) {
            setErrMsg(getErrorMessage(e, "Error al registrar movimiento."));
        } finally { setGuardando(false); }
    };

    const handleAnularPago = async () => {
        if (!pagoAnular) return;
        if (motivoAnular === "otro" && !detalleAnular.trim()) {
            alert("Para el motivo 'Otro' debes especificar un detalle.");
            return;
        }
        if (detalleAnular.trim() && !esSoloAlfanumerico(detalleAnular)) {
            alert(MENSAJES.SOLO_ALFANUMERICO);
            return;
        }
        setAnulando(true);
        try {
            await cajaService.anularPago(pagoAnular.id, {
                motivo: motivoAnular,
                detalle: detalleAnular.trim(),
            });
            setPagoAnular(null);
            setMotivoAnular("devolucion");
            setDetalleAnular("");
            recargar();
        } catch (e) {
            alert(getErrorMessage(e, "Error al anular el pago."));
        } finally { setAnulando(false); }
    };

    // ── Métricas ────────────────────────────────────────────────────────────────
    const desglose = useMemo(() => {
        const acc: Record<string, number> = {};
        (pagos ?? [])
            .filter(p => p.estado === "completado")
            .forEach(p => {
                const k = p.metodo_pago;
                acc[k] = (acc[k] ?? 0) + Number(p.monto);
            });
        return acc;
    }, [pagos]);

    if (cargando) return (
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
            <p style={{ color: C.verde }}>Cargando...</p>
        </div>
    );

    // ── Sin caja abierta ────────────────────────────────────────────────────────
    if (!caja) return (
        <>
            <PageHeader titulo="Caja" descripcion="No hay ningún turno abierto." />
            {ordenesAbiertas.length > 0 && (
                <div style={{
                    background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)",
                    borderRadius: 12, padding: 16, marginBottom: 24
                }}>
                    <p style={{ margin: 0, fontWeight: 700, color: C.amarillo, fontSize: 13 }}>
                        ⚠ Hay {ordenesAbiertas.length} orden(es) abiertas — abre un turno para cobrar.
                    </p>
                </div>
            )}
            <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
                <div style={{ textAlign: "center" }}>
                    <DollarSign size={52} color={C.verde} style={{ opacity: 0.35 }} />
                    <p style={{ color: "#777", margin: "12px 0 24px", fontSize: 14 }}>
                        Abre un turno para empezar a registrar ventas.
                    </p>
                    <Btn onClick={() => setModalAbrir(true)}>Abrir turno</Btn>
                </div>
            </div>
            {modalAbrir && (
                <Modal titulo="Abrir turno" onCerrar={() => { setModalAbrir(false); limpiar(); }}>
                    <Campo label="Monto inicial en caja (S/)" type="number"
                        value={montoInicial} onChange={setMontoInicial} placeholder="0.00" />
                    <ErrMsg msg={errMsg} />
                    <Btn onClick={handleAbrir} disabled={guardando} full>
                        {guardando ? "Abriendo..." : "Confirmar apertura"}
                    </Btn>
                </Modal>
            )}
        </>
    );

    // ── Con caja abierta ────────────────────────────────────────────────────────
    const diferencia = Number(caja.diferencia ?? 0);
    const totalVentas = Number(caja.total_ventas ?? 0);

    return (
        <>
            <PageHeader
                titulo="Caja"
                descripcion={`Turno abierto por ${caja.usuario_nombre}`}
                accion={
                    <div style={{ display: "flex", gap: 8 }}>
                        <Btn color={C.gris} outline onClick={() => setModalMovimiento(true)}>
                            <Plus size={14} /> Movimiento
                        </Btn>
                        <Btn color={C.rojo} onClick={() => setModalCerrar(true)}>
                            Cerrar turno
                        </Btn>
                    </div>
                }
            />

            {/* Métricas */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
                <Metrica label="Monto inicial" valor={fmt(caja.monto_inicial)} />
                <Metrica label="Total ventas" valor={fmt(totalVentas)}
                    sub={Object.entries(desglose).map(([k, v]) => `${k}: ${fmt(v)}`).join(" · ")} />
                <Metrica label="Pagos completados"
                    valor={pagos.filter(p => p.estado === "completado").length} />
                <Metrica
                    label="Diferencia"
                    valor={fmt(diferencia)}
                    color={diferencia < 0 ? C.rojo : diferencia > 0 ? C.amarillo : C.verde}
                />
            </div>

            {/* Layout 2 columnas */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>

                {/* Órdenes por cobrar */}
                <div style={{
                    background: "white", borderRadius: 12,
                    border: `1px solid ${C.borde}`, padding: 20
                }}>
                    <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: C.verde }}>
                        Órdenes por cobrar ({ordenesAbiertas.length})
                    </h3>
                    {ordenesAbiertas.length === 0 ? (
                        <p style={{ color: "#999", fontSize: 13 }}>No hay órdenes abiertas.</p>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {ordenesAbiertas.map((o) => (
                                <OrdenCard key={o.id} orden={o} onCobrar={setOrdenCobrar} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Movimientos */}
                <div style={{
                    background: "white", borderRadius: 12,
                    border: `1px solid ${C.borde}`, padding: 20
                }}>
                    <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: C.verde }}>
                        Movimientos
                    </h3>
                    {movimientos.length === 0 ? (
                        <p style={{ color: "#999", fontSize: 13 }}>Sin movimientos.</p>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {movimientos.map((m) => (
                                <div key={m.id} style={{
                                    display: "flex", justifyContent: "space-between",
                                    alignItems: "center", padding: "8px 0",
                                    borderBottom: `1px solid ${C.bg}`
                                }}>
                                    <div>
                                        <span style={{
                                            background: m.tipo === "entrada" ? "rgba(44,85,69,0.1)" : C.rojoPal,
                                            color: m.tipo === "entrada" ? C.verde : C.rojo,
                                            padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                                        }}>
                                            {m.tipo === "entrada" ? "↑" : "↓"} {m.tipo}
                                        </span>
                                        <p style={{ margin: "3px 0 0", fontSize: 12, color: "#666" }}>{m.motivo}</p>
                                    </div>
                                    <span style={{
                                        fontWeight: 700, fontSize: 13,
                                        color: m.tipo === "entrada" ? C.verde : C.rojo
                                    }}>
                                        {fmt(m.monto)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Tabla de pagos */}
            <div style={{
                background: "white", borderRadius: 12,
                border: `1px solid ${C.borde}`, overflow: "hidden"
            }}>
                <div style={{
                    padding: "14px 20px", borderBottom: `1px solid ${C.borde}`,
                    display: "flex", alignItems: "center", gap: 8
                }}>
                    <FileText size={16} color={C.verde} />
                    <span style={{
                        fontFamily: "'Playfair Display',Georgia,serif",
                        fontSize: 15, fontWeight: 600, color: C.verde
                    }}>
                        Pagos del turno
                    </span>
                </div>

                {pagos.length === 0 ? (
                    <div style={{
                        padding: 40, textAlign: "center",
                        fontFamily: "'Lato',sans-serif", fontSize: 13, color: "#999"
                    }}>
                        Sin pagos registrados aún
                    </div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ background: "rgba(44,85,69,0.04)" }}>
                                {["", "#", "Orden", "Método", "Monto", "Vuelto", "Estado", "Hora", "Acciones"]
                                    .map(h => (
                                        <th key={h} style={{
                                            padding: "10px 12px", textAlign: "left",
                                            fontSize: 11, fontWeight: 700, color: "rgba(44,85,69,0.6)",
                                            textTransform: "uppercase", letterSpacing: "0.07em",
                                            borderBottom: `1px solid ${C.borde}`
                                        }}>
                                            {h}
                                        </th>
                                    ))}
                            </tr>
                        </thead>
                        <tbody>
                            {pagos.map((p) => (
                                <FilaPago
                                    key={p.id}
                                    pago={p}
                                    esAdmin={esAdmin}
                                    onAnular={setPagoAnular}
                                    onEmitirComprobante={setPagoComprobante}
                                />
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── Modales ── */}
            {ordenCobrar && (
                <ModalCobrar
                    orden={ordenCobrar}
                    onCerrar={() => setOrdenCobrar(null)}
                    onPagado={recargar}
                />
            )}

            {pagoComprobante && (
                <ModalComprobante
                    pago={pagoComprobante}
                    onCerrar={() => setPagoComprobante(null)}
                    onEmitido={recargar}
                />
            )}

            {/* Confirm anular pago */}
            {pagoAnular && (
                <Modal titulo="¿Anular pago?" onCerrar={() => setPagoAnular(null)} ancho={380}>
                    <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>
                        Se anulará el pago <strong>#{pagoAnular.id}</strong> de{" "}
                        <strong>{fmt(pagoAnular.monto)}</strong> (Orden #{pagoAnular.orden?.id}).
                        Se registrará automáticamente una salida de caja por devolución.
                    </p>

                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.verde, marginBottom: 6 }}>
                        Motivo de anulación
                    </label>
                    <select
                        value={motivoAnular}
                        onChange={(e) => setMotivoAnular(e.target.value)}
                        style={{
                            width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 13,
                            border: `1px solid ${C.borde}`, marginBottom: 14, boxSizing: "border-box",
                        }}
                    >
                        {MOTIVOS_ANULACION.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>

                    {motivoAnular === "otro" && (
                        <Campo
                            label="Detalle (obligatorio) *"
                            value={detalleAnular}
                            onChange={setDetalleAnular}
                            maxLength={LIMITES.OBSERVACIONES}
                            placeholder="Especifica el motivo..."
                        />
                    )}

                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                        <Btn outline color={C.gris} onClick={() => setPagoAnular(null)} full>
                            Cancelar
                        </Btn>
                        <Btn color={C.rojo} onClick={handleAnularPago} disabled={anulando} full>
                            {anulando ? "Anulando..." : "Confirmar anulación"}
                        </Btn>
                    </div>
                </Modal>
            )}

            {/* Modal movimiento */}
            {modalMovimiento && (
                <Modal titulo="Registrar movimiento"
                    onCerrar={() => { setModalMovimiento(false); limpiar(); }}>
                    <label style={{
                        display: "block", fontSize: 12, fontWeight: 600,
                        color: C.verde, marginBottom: 8
                    }}>Tipo</label>
                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                        {(["entrada", "salida"] as const).map((t) => (
                            <button key={t} onClick={() => setTipoMov(t)} style={{
                                flex: 1, padding: "9px 0", borderRadius: 8, cursor: "pointer",
                                border: `2px solid ${tipoMov === t
                                    ? (t === "entrada" ? C.verde : C.rojo) : C.borde}`,
                                background: tipoMov === t
                                    ? (t === "entrada" ? C.bg : C.rojoPal) : "white",
                                fontWeight: 600, fontSize: 13,
                                color: tipoMov === t
                                    ? (t === "entrada" ? C.verde : C.rojo) : "#777",
                            }}>
                                {t === "entrada" ? "↑ Entrada" : "↓ Salida"}
                            </button>
                        ))}
                    </div>
                    <Campo label="Monto (S/)" type="number" value={montoMov}
                        onChange={setMontoMov} placeholder="0.00" />
                    <Campo label="Motivo" value={motivoMov} onChange={setMotivoMov}
                        maxLength={LIMITES.MOTIVO}
                        placeholder="Ej: Compra de insumos" />
                    <ErrMsg msg={errMsg} />
                    <Btn onClick={handleMovimiento} disabled={guardando} full>
                        {guardando ? "Guardando..." : "Registrar"}
                    </Btn>
                </Modal>
            )}

            {/* Modal cerrar turno */}
            {modalCerrar && (
                <Modal titulo="Cerrar turno"
                    onCerrar={() => { setModalCerrar(false); limpiar(); }}>
                    <div style={{ background: C.bg, borderRadius: 8, padding: 12, marginBottom: 16 }}>
                        <p style={{ margin: 0, fontSize: 12, color: "#555" }}>
                            Monto inicial: <strong>{fmt(caja.monto_inicial)}</strong>
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#555" }}>
                            Total ventas: <strong>{fmt(totalVentas)}</strong>
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 700, color: C.verde }}>
                            Esperado en caja: <strong>
                                {fmt(Number(caja.monto_inicial) + totalVentas)}
                            </strong>
                        </p>
                    </div>
                    <Campo label="Monto final contado (S/)" type="number"
                        value={montoFinal} onChange={setMontoFinal} placeholder="0.00" />
                    <Campo label="Observaciones (opcional)" value={obsCierre}
                        onChange={setObsCierre} maxLength={LIMITES.DESCRIPCION}
                        placeholder="Ej: Faltaron S/5 en efectivo" />
                    {montoFinal && (() => {
                        const diff = Number(montoFinal) - (Number(caja.monto_inicial) + totalVentas);
                        return (
                            <div style={{
                                background: diff < 0 ? C.rojoPal : C.bg,
                                borderRadius: 8, padding: 10, marginBottom: 12,
                            }}>
                                <p style={{
                                    margin: 0, fontSize: 13, fontWeight: 600,
                                    color: diff < 0 ? C.rojo : C.verde
                                }}>
                                    Diferencia: {fmt(diff)}
                                    {diff < 0 ? " (faltante)" : diff > 0 ? " (sobrante)" : " (cuadre exacto ✓)"}
                                </p>
                            </div>
                        );
                    })()}
                    <ErrMsg msg={errMsg} />
                    <Btn color={C.rojo} onClick={handleCerrar} disabled={guardando} full>
                        {guardando ? "Cerrando..." : "Confirmar cierre"}
                    </Btn>
                </Modal>
            )}
        </>
    );
}
