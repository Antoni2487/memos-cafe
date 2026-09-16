import { useState, useMemo, type CSSProperties, type ReactNode } from "react";
import useInsumos from "../../hooks/useInsumos";
import useRegistrosInsumo from "../../hooks/useRegistrosInsumo";
import insumoService from "../../services/insumoService";
import registroInsumoService from "../../services/registroInsumoService";

import DataTable from "../../components/common/DataTable";
import { SearchBar, StatCard } from "../../components/common/SearchBar-StatCard";
import { FormModal, ConfirmDialog } from "../../components/common/Modals";
import { esSoloAlfanumerico, LIMITES, MENSAJES } from "../../utils/validators";
import { getErrorMessage } from "../../utils/errors";
import type { Columna, Insumo } from "../../types";
import type { RegistrarInsumoPayload } from "../../services/registroInsumoService";
import type { InsumoFormData } from "../../services/insumoService";

const inputStyle: CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "8px",
    border: "1px solid rgba(44,85,69,0.2)",
    fontFamily: "'Lato', sans-serif",
    fontSize: "13.5px",
    color: "#333",
    outline: "none",
};
const labelStyle: CSSProperties = {
    fontFamily: "'Lato', sans-serif",
    fontSize: "12px",
    fontWeight: 600,
    color: "rgba(44,85,69,0.7)",
    marginBottom: "4px",
    display: "block",
};

interface TabBtnProps {
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
}

function TabBtn({ activo, onClick, children }: TabBtnProps) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: "10px 18px",
                border: "none",
                borderBottom: activo ? "2px solid #2C5545" : "2px solid transparent",
                backgroundColor: "transparent",
                fontFamily: "'Lato', sans-serif",
                fontSize: "13.5px",
                fontWeight: activo ? 700 : 500,
                color: activo ? "#2C5545" : "rgba(44,85,69,0.55)",
                cursor: "pointer",
            }}
        >
            {children}
        </button>
    );
}

interface InsumoAccion {
  insumo: Insumo;
  tipo: "activar" | "desactivar";
}

export default function InsumosPage() {
    const { insumos, cargando: cargandoInsumos, recargar: recargarInsumos } = useInsumos();
    const {
        registros,
        cargando: cargandoRegistros,
        totalGastado,
        gastadoEsteMes,
        recargar: recargarRegistros,
    } = useRegistrosInsumo();

    const [tab, setTab] = useState<"catalogo" | "historial">("catalogo");

    // ── Búsqueda y paginación (cliente) ──
    const [busquedaCatalogo, setBusquedaCatalogo] = useState("");
    const [busquedaHistorial, setBusquedaHistorial] = useState("");
    const [paginaCatalogo, setPaginaCatalogo] = useState(1);
    const [paginaHistorial, setPaginaHistorial] = useState(1);
    const porPagina = 8;

    // ── Modales ──
    const [modalGasto, setModalGasto] = useState(false);
    const [modalInsumo, setModalInsumo] = useState(false); // crear o editar
    const [insumoEditando, setInsumoEditando] = useState<Insumo | null>(null); // null = crear
    const [insumoAccion, setInsumoAccion] = useState<InsumoAccion | null>(null);

    const [form, setForm] = useState<RegistrarInsumoPayload>({ insumo: "", cantidad: "", costo_unitario: "", proveedor: "", observaciones: "" });
    const [formInsumo, setFormInsumo] = useState<InsumoFormData>({ nombre: "", unidad: "kg", stock_minimo: 0 });
    const [error, setError] = useState<string | null>(null);
    const [erroresGasto, setErroresGasto] = useState<Partial<Record<"proveedor" | "observaciones", string | null>>>({});
    const [erroresInsumo, setErroresInsumo] = useState<Partial<Record<"nombre", string>>>({});
    const [guardando, setGuardando] = useState(false);

    const validarCampoLibre = (valor?: string | null) => (valor && !esSoloAlfanumerico(valor)) ? MENSAJES.SOLO_ALFANUMERICO : null;

    const validarGasto = () => {
        const e: Partial<Record<"proveedor" | "observaciones", string>> = {};
        const errProveedor = validarCampoLibre(form.proveedor);
        if (errProveedor) e.proveedor = errProveedor;
        const errObs = validarCampoLibre(form.observaciones);
        if (errObs) e.observaciones = errObs;
        return e;
    };

    const validarInsumoForm = () => {
        const e: Partial<Record<"nombre", string>> = {};
        if (!formInsumo.nombre.trim()) e.nombre = "El nombre es obligatorio";
        else if (!esSoloAlfanumerico(formInsumo.nombre)) e.nombre = MENSAJES.SOLO_ALFANUMERICO;
        return e;
    };

    const insumosActivos = insumos.filter((i) => i.activo);
    const stockBajoCount = insumos.filter((i) => i.activo && i.stock_bajo).length;

    // ── Filtros ──
    const catalogoFiltrado = useMemo(() => {
        const q = busquedaCatalogo.trim().toLowerCase();
        if (!q) return insumos;
        return insumos.filter((i) => i.nombre.toLowerCase().includes(q));
    }, [insumos, busquedaCatalogo]);

    const historialFiltrado = useMemo(() => {
        const q = busquedaHistorial.trim().toLowerCase();
        if (!q) return registros;
        return registros.filter(
            (r) => r.insumo_nombre?.toLowerCase().includes(q) || r.proveedor?.toLowerCase().includes(q)
        );
    }, [registros, busquedaHistorial]);

    const catalogoPagina = catalogoFiltrado.slice((paginaCatalogo - 1) * porPagina, paginaCatalogo * porPagina);
    const historialPagina = historialFiltrado.slice((paginaHistorial - 1) * porPagina, paginaHistorial * porPagina);

    // ── Acciones: gasto ──
    const handleSubmitGasto = async () => {
        setError(null);
        const e = validarGasto();
        setErroresGasto(e);
        if (Object.keys(e).length) return;
        setGuardando(true);
        try {
            await registroInsumoService.registrar(form);
            setForm({ insumo: "", cantidad: "", costo_unitario: "", proveedor: "", observaciones: "" });
            setErroresGasto({});
            setModalGasto(false);
            await Promise.all([recargarRegistros(), recargarInsumos()]);
        } catch (err) {
            setError(getErrorMessage(err, "Error al registrar la compra"));
        } finally {
            setGuardando(false);
        }
    };

    // ── Acciones: catálogo (crear / editar) ──
    const abrirCrearInsumo = () => {
        setInsumoEditando(null);
        setFormInsumo({ nombre: "", unidad: "kg", stock_minimo: 0 });
        setError(null);
        setErroresInsumo({});
        setModalInsumo(true);
    };

    const abrirEditarInsumo = (insumo: Insumo) => {
        setInsumoEditando(insumo);
        setFormInsumo({ nombre: insumo.nombre, unidad: insumo.unidad, stock_minimo: insumo.stock_minimo });
        setError(null);
        setErroresInsumo({});
        setModalInsumo(true);
    };

    const handleSubmitInsumo = async () => {
        setError(null);
        const e = validarInsumoForm();
        setErroresInsumo(e);
        if (Object.keys(e).length) return;
        setGuardando(true);
        try {
            if (insumoEditando) {
                await insumoService.editar(insumoEditando.id, formInsumo);
            } else {
                await insumoService.crear(formInsumo);
            }
            await recargarInsumos();
            setModalInsumo(false);
        } catch (err) {
            setError(getErrorMessage(err, "Error al guardar el insumo"));
        } finally {
            setGuardando(false);
        }
    };

    const confirmarAccionInsumo = async () => {
        if (!insumoAccion) return;
        const { insumo, tipo } = insumoAccion;
        await (tipo === "activar" ? insumoService.activar(insumo.id) : insumoService.desactivar(insumo.id));
        setInsumoAccion(null);
        recargarInsumos();
    };

    // ── Columnas ──
    const columnasCatalogo: Columna<Insumo>[] = [
        { key: "nombre", label: "Insumo" },
        { key: "unidad_display", label: "Unidad" },
        { key: "stock_actual", label: "Stock actual", render: (i) => `${Number(i.stock_actual).toFixed(2)} ${i.unidad}` },
        { key: "stock_minimo", label: "Stock mínimo", render: (i) => `${Number(i.stock_minimo).toFixed(2)} ${i.unidad}` },
        {
            key: "stock_bajo",
            label: "Estado",
            render: (i) => (
                <span style={{
                    padding: "3px 10px", borderRadius: "999px", fontSize: "11.5px", fontWeight: 700,
                    backgroundColor: i.stock_bajo ? "rgba(198,40,40,0.1)" : "rgba(44,85,69,0.1)",
                    color: i.stock_bajo ? "#c62828" : "#2C5545",
                }}>
                    {i.stock_bajo ? "Stock bajo" : "OK"}
                </span>
            ),
        },
        {
            key: "activo",
            label: "Activo",
            render: (i) => (
                <span style={{ color: i.activo ? "#2e7d32" : "#999", fontWeight: 600, fontSize: "12.5px" }}>
                    {i.activo ? "Sí" : "No"}
                </span>
            ),
        },
        {
            key: "acciones",
            label: "Acciones",
            render: (i) => (
                <div className="flex gap-2">
                    <button
                        onClick={() => abrirEditarInsumo(i)}
                        style={{ border: "none", background: "none", color: "#2C5545", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}
                    >
                        Editar
                    </button>
                    <button
                        onClick={() => setInsumoAccion({ insumo: i, tipo: i.activo ? "desactivar" : "activar" })}
                        style={{ border: "none", background: "none", color: i.activo ? "#c62828" : "#2e7d32", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}
                    >
                        {i.activo ? "Desactivar" : "Activar"}
                    </button>
                </div>
            ),
        },
    ];

    const columnasHistorial: Columna<typeof registros[number]>[] = [
        { key: "fecha", label: "Fecha", render: (r) => new Date(r.fecha).toLocaleDateString("es-PE") },
        { key: "insumo_nombre", label: "Insumo" },
        { key: "cantidad", label: "Cantidad", render: (r) => `${r.cantidad} ${r.insumo_unidad}` },
        { key: "costo_unitario", label: "Costo unit.", render: (r) => `S/ ${Number(r.costo_unitario).toFixed(2)}` },
        { key: "costo_total", label: "Total", render: (r) => `S/ ${Number(r.costo_total).toFixed(2)}` },
        { key: "proveedor", label: "Proveedor", render: (r) => r.proveedor || "—" },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "24px", fontWeight: 600, color: "#2C5545" }}>
                    Gastos e Insumos
                </h1>
                <div className="flex gap-2">
                    <button
                        onClick={abrirCrearInsumo}
                        style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid rgba(44,85,69,0.2)", backgroundColor: "white", fontFamily: "'Lato', sans-serif", fontSize: "13px", fontWeight: 600, color: "#2C5545", cursor: "pointer" }}
                    >
                        + Nuevo insumo
                    </button>
                    <button
                        onClick={() => setModalGasto(true)}
                        style={{ padding: "9px 16px", borderRadius: "8px", border: "none", backgroundColor: "#2C5545", fontFamily: "'Lato', sans-serif", fontSize: "13px", fontWeight: 600, color: "white", cursor: "pointer" }}
                    >
                        + Registrar gasto
                    </button>
                </div>
            </div>

            {/* Badges */}
            <div className="flex gap-4">
                <StatCard titulo="Total gastado" valor={`S/ ${totalGastado.toFixed(2)}`} subtitulo="histórico" />
                <StatCard titulo="Gastado este mes" valor={`S/ ${gastadoEsteMes.toFixed(2)}`} />
                <StatCard
                    titulo="Insumos con stock bajo"
                    valor={stockBajoCount}
                    subtitulo={stockBajoCount > 0 ? "revisar reposición" : "todo en orden"}
                    tendencia={stockBajoCount > 0 ? "down" : undefined}
                />
            </div>

            {/* Tabs */}
            <div style={{ borderBottom: "1px solid rgba(44,85,69,0.1)" }} className="flex gap-1">
                <TabBtn activo={tab === "catalogo"} onClick={() => setTab("catalogo")}>Catálogo</TabBtn>
                <TabBtn activo={tab === "historial"} onClick={() => setTab("historial")}>Historial de gastos</TabBtn>
            </div>

            {/* Tab: Catálogo */}
            {tab === "catalogo" && (
                <>
                    <SearchBar
                        placeholder="Buscar insumo..."
                        onBuscar={(t) => { setBusquedaCatalogo(t); setPaginaCatalogo(1); }}
                    />
                    <DataTable
                        columnas={columnasCatalogo}
                        datos={catalogoPagina}
                        total={catalogoFiltrado.length}
                        pagina={paginaCatalogo}
                        onPagina={setPaginaCatalogo}
                        porPagina={porPagina}
                        cargando={cargandoInsumos}
                        textoVacio="Aún no hay insumos registrados"
                    />
                </>
            )}

            {/* Tab: Historial */}
            {tab === "historial" && (
                <>
                    <SearchBar
                        placeholder="Buscar por insumo o proveedor..."
                        onBuscar={(t) => { setBusquedaHistorial(t); setPaginaHistorial(1); }}
                    />
                    <DataTable
                        columnas={columnasHistorial}
                        datos={historialPagina}
                        total={historialFiltrado.length}
                        pagina={paginaHistorial}
                        onPagina={setPaginaHistorial}
                        porPagina={porPagina}
                        cargando={cargandoRegistros}
                        textoVacio="Aún no hay compras registradas"
                    />
                </>
            )}

            {/* Modal: registrar gasto */}
            <FormModal
                abierto={modalGasto}
                titulo="Registrar compra de insumo"
                onCerrar={() => setModalGasto(false)}
                onGuardar={handleSubmitGasto}
                cargando={guardando}
                textoGuardar="Registrar"
            >
                {error && <p style={{ color: "#c62828", fontSize: "13px", margin: 0 }}>{error}</p>}

                <div>
                    <label style={labelStyle}>Insumo</label>
                    <select
                        value={form.insumo}
                        onChange={(e) => setForm({ ...form, insumo: e.target.value })}
                        required
                        style={inputStyle}
                    >
                        <option value="">Seleccionar...</option>
                        {insumosActivos.map((i) => (
                            <option key={i.id} value={i.id}>{i.nombre} ({i.unidad_display})</option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-3">
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Cantidad</label>
                        <input type="number" step="0.01" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} required style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Costo unitario (S/)</label>
                        <input type="number" step="0.01" value={form.costo_unitario} onChange={(e) => setForm({ ...form, costo_unitario: e.target.value })} required style={inputStyle} />
                    </div>
                </div>

                <div>
                    <label style={labelStyle}>Proveedor (opcional)</label>
                    <input value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
                        onBlur={(e) => setErroresGasto((p) => ({ ...p, proveedor: validarCampoLibre(e.target.value) }))}
                        maxLength={LIMITES.PROVEEDOR} style={inputStyle} />
                    {erroresGasto.proveedor && <p style={{ color: "#c62828", fontSize: "11.5px", margin: "3px 0 0" }}>{erroresGasto.proveedor}</p>}
                </div>

                <div>
                    <label style={labelStyle}>Observaciones (opcional)</label>
                    <input value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                        onBlur={(e) => setErroresGasto((p) => ({ ...p, observaciones: validarCampoLibre(e.target.value) }))}
                        maxLength={LIMITES.OBSERVACIONES} style={inputStyle} />
                    {erroresGasto.observaciones && <p style={{ color: "#c62828", fontSize: "11.5px", margin: "3px 0 0" }}>{erroresGasto.observaciones}</p>}
                </div>
            </FormModal>

            {/* Modal: crear/editar insumo */}
            <FormModal
                abierto={modalInsumo}
                titulo={insumoEditando ? "Editar insumo" : "Nuevo insumo"}
                onCerrar={() => setModalInsumo(false)}
                onGuardar={handleSubmitInsumo}
                cargando={guardando}
                textoGuardar={insumoEditando ? "Guardar cambios" : "Crear"}
                maxWidth="400px"
            >
                {error && <p style={{ color: "#c62828", fontSize: "13px", margin: 0 }}>{error}</p>}
                <div>
                    <label style={labelStyle}>Nombre</label>
                    <input
                        value={formInsumo.nombre}
                        onChange={(e) => setFormInsumo({ ...formInsumo, nombre: e.target.value })}
                        onBlur={() => setErroresInsumo(validarInsumoForm())}
                        placeholder="Ej: Café molido"
                        required
                        maxLength={LIMITES.NOMBRE}
                        style={inputStyle}
                    />
                    {erroresInsumo.nombre && <p style={{ color: "#c62828", fontSize: "11.5px", margin: "3px 0 0" }}>{erroresInsumo.nombre}</p>}
                </div>
                <div>
                    <label style={labelStyle}>Unidad</label>
                    <select
                        value={formInsumo.unidad}
                        onChange={(e) => setFormInsumo({ ...formInsumo, unidad: e.target.value })}
                        style={inputStyle}
                    >
                        <option value="kg">Kilogramo</option>
                        <option value="g">Gramo</option>
                        <option value="l">Litro</option>
                        <option value="ml">Mililitro</option>
                        <option value="und">Unidad</option>
                    </select>
                </div>
                <div>
                    <label style={labelStyle}>Stock mínimo (opcional)</label>
                    <input
                        type="number" step="0.01"
                        value={formInsumo.stock_minimo}
                        onChange={(e) => setFormInsumo({ ...formInsumo, stock_minimo: e.target.value })}
                        style={inputStyle}
                    />
                </div>
            </FormModal>

            {/* Confirmación activar/desactivar */}
            <ConfirmDialog
                abierto={!!insumoAccion}
                titulo={insumoAccion?.tipo === "activar" ? "Activar insumo" : "Desactivar insumo"}
                descripcion={`¿Seguro que deseas ${insumoAccion?.tipo} "${insumoAccion?.insumo?.nombre}"?`}
                variante={insumoAccion?.tipo === "activar" ? "primary" : "warning"}
                onConfirmar={confirmarAccionInsumo}
                onCancelar={() => setInsumoAccion(null)}
            />
        </div>
    );
}
