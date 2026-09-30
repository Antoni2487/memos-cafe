import { useState } from "react";
import { Eye, Pencil, ToggleLeft, ToggleRight, Plus } from "lucide-react";
import useProductos from "../../hooks/useProductos";
import ProductoForm from "../../components/productos/ProductoForm";
import productoService from "../../services/productoService";
import {
  PageHeader, DataTable, StatusBadge,
  SearchBar, ConfirmDialog, DetailModal,
} from "../../components/common";
import type { Columna, Producto } from "../../types";
import type { ProductoFormData } from "../../services/productoService";

const POR_PAGINA = 10;

export default function ProductosPage() {
  const { productos, cargando, recargar } = useProductos();
  const [busqueda, setBusqueda]           = useState("");
  const [pagina, setPagina]               = useState(1);
  const [showForm, setShowForm]           = useState(false);
  const [productoEditar, setProductoEditar] = useState<Producto | null>(null);
  const [productoToggle, setProductoToggle] = useState<Producto | null>(null);
  const [productoVer, setProductoVer]     = useState<Producto | null>(null);
  const [guardando, setGuardando]         = useState(false);
  const [toggling, setToggling]           = useState(false);

  const filtrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );
  const paginados = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const handleGuardar = async (datos: ProductoFormData) => {
    try {
      setGuardando(true);
      if (productoEditar) {
        await productoService.editar(productoEditar.id, datos);
      } else {
        await productoService.crear(datos);
      }
      setShowForm(false);
      setProductoEditar(null);
      await recargar();
    } finally {
      setGuardando(false);
    }
  };

  const handleToggle = async () => {
    if (!productoToggle) return;
    try {
      setToggling(true);
      if (productoToggle.disponible) {
        await productoService.desactivar(productoToggle.id);
      } else {
        await productoService.activar(productoToggle.id);
      }
      setProductoToggle(null);
      await recargar();
    } finally {
      setToggling(false);
    }
  };

  const columnas: Columna<Producto>[] = [
    {
      label: "Producto",
      render: (p) => (
        <div className="flex items-center gap-3">
          {p.imagen ? (
            <img src={p.imagen} alt={p.nombre}
              style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover",
                border: "1px solid var(--linea-fuerte)" }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: 8,
              backgroundColor: "rgba(76,107,101,0.1)", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-texto)", fontSize: 14,
              fontWeight: 700, color: "var(--salvia)" }}>
              {p.nombre.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p style={{ margin: 0, fontFamily: "var(--font-texto)",
              fontSize: 13.5, fontWeight: 500, color: "var(--salvia)" }}>{p.nombre}</p>
            {p.descripcion && (
              <p style={{ margin: 0, fontFamily: "var(--font-texto)",
                fontSize: 11.5, color: "var(--suave)",
                maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap" }}>{p.descripcion}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      label: "Categoría",
      width: "140px",
      render: (p) => (
        <span style={{ fontFamily: "var(--font-texto)", fontSize: 12.5, color: "var(--suave)" }}>
          {p.categoria_nombre || "—"}
        </span>
      ),
    },
    {
      label: "Precio",
      width: "90px",
      render: (p) => (
        <span style={{ fontFamily: "var(--font-texto)", fontSize: 13.5,
          fontWeight: 600, color: "var(--salvia)" }}>
          S/ {Number(p.precio).toFixed(2)}
        </span>
      ),
    },
    {
      label: "Estado",
      width: "100px",
      render: (p) => <StatusBadge estado={p.disponible ? "activo" : "inactivo"} />,
    },
    {
      label: "Acciones",
      width: "120px",
      render: (p) => (
        <div className="flex items-center gap-1">
          <button onClick={() => setProductoVer(p)} title="Ver detalle"
            style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid var(--linea-fuerte)",
              backgroundColor: "var(--marfil)", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: "var(--salvia)" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(76,107,101,0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}>
            <Eye size={13} strokeWidth={2} />
          </button>
          <button onClick={() => { setProductoEditar(p); setShowForm(true); }} title="Editar"
            style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid var(--linea-fuerte)",
              backgroundColor: "var(--marfil)", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: "var(--salvia)" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(76,107,101,0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}>
            <Pencil size={13} strokeWidth={2} />
          </button>
          <button onClick={() => setProductoToggle(p)}
            title={p.disponible ? "Desactivar" : "Activar"}
            style={{ width: 30, height: 30, borderRadius: 6,
              border: `1px solid ${p.disponible ? "rgba(163,58,44,0.2)" : "var(--linea-fuerte)"}`,
              backgroundColor: "var(--marfil)", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
              color: p.disponible ? "var(--peligro)" : "var(--salvia)" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = p.disponible ? "rgba(163,58,44,0.06)" : "rgba(76,107,101,0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}>
            {p.disponible ? <ToggleRight size={14} strokeWidth={2} /> : <ToggleLeft size={14} strokeWidth={2} />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Gestión de Productos"
        descripcion="Administra la carta de productos del café"
        accion={
          <button onClick={() => { setProductoEditar(null); setShowForm(true); }}
            style={{ backgroundColor: "var(--salvia)", color: "white", border: "none",
              borderRadius: 8, padding: "9px 16px", fontFamily: "var(--font-texto)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} strokeWidth={2.5} /> Nuevo Producto
          </button>
        }
      />
      <div className="mb-4">
        <SearchBar placeholder="Buscar producto..." onBuscar={(t) => { setBusqueda(t); setPagina(1); }} />
      </div>
      <DataTable
        columnas={columnas}
        datos={paginados}
        total={filtrados.length}
        pagina={pagina}
        onPagina={setPagina}
        porPagina={POR_PAGINA}
        cargando={cargando}
        textoVacio="No hay productos registrados"
      />
      <ProductoForm
        abierto={showForm}
        producto={productoEditar}
        onGuardar={handleGuardar}
        onCerrar={() => { setShowForm(false); setProductoEditar(null); }}
        cargando={guardando}
      />
      <ConfirmDialog
        abierto={!!productoToggle}
        titulo={productoToggle?.disponible ? "¿Desactivar producto?" : "¿Activar producto?"}
        descripcion={`${productoToggle?.disponible ? "Se desactivará" : "Se activará"} el producto "${productoToggle?.nombre}".`}
        textoOk={productoToggle?.disponible ? "Sí, desactivar" : "Sí, activar"}
        variante={productoToggle?.disponible ? "danger" : "primary"}
        cargando={toggling}
        onConfirmar={handleToggle}
        onCancelar={() => setProductoToggle(null)}
      />
      <DetailModal
        abierto={!!productoVer}
        titulo={productoVer?.nombre}
        onCerrar={() => setProductoVer(null)}
      >
        {productoVer && (
          <>
            {productoVer.imagen && (
              <img src={productoVer.imagen} alt={productoVer.nombre}
                style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 8,
                  border: "1px solid var(--linea-fuerte)" }} />
            )}
            {productoVer.descripcion && (
              <p style={{ margin: 0, fontFamily: "var(--font-texto)", fontSize: 13.5, color: "var(--suave)" }}>
                {productoVer.descripcion}
              </p>
            )}
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: "var(--font-texto)", fontSize: 11, fontWeight: 700,
                color: "var(--suave)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Categoría
              </span>
              <span style={{ fontFamily: "var(--font-texto)", fontSize: 13, color: "var(--espresso)" }}>
                {productoVer.categoria_nombre || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: "var(--font-texto)", fontSize: 11, fontWeight: 700,
                color: "var(--suave)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Precio
              </span>
              <span style={{ fontFamily: "var(--font-texto)", fontSize: 16, fontWeight: 700, color: "var(--salvia)" }}>
                S/ {Number(productoVer.precio).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: "var(--font-texto)", fontSize: 11, fontWeight: 700,
                color: "var(--suave)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Estado
              </span>
              <StatusBadge estado={productoVer.disponible ? "activo" : "inactivo"} />
            </div>
          </>
        )}
      </DetailModal>
    </>
  );
}
