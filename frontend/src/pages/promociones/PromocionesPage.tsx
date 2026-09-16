import { useState } from "react";
import { Eye, Pencil, ToggleLeft, ToggleRight, Plus } from "lucide-react";
import usePromociones from "../../hooks/usePromociones";
import PromocionForm from "../../components/promociones/PromocionForm";
import promocionService from "../../services/promocionService";
import {
  PageHeader, DataTable, StatusBadge,
  SearchBar, ConfirmDialog, DetailModal,
} from "../../components/common";
import type { Columna, Promocion } from "../../types";
import type { PromocionFormData } from "../../services/promocionService";

const POR_PAGINA = 10;

const fmtFecha = (f: string) =>
  new Date(f + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });

export default function PromocionesPage() {
  const { promociones, cargando, recargar } = usePromociones();
  const [busqueda, setBusqueda]             = useState("");
  const [pagina, setPagina]                 = useState(1);
  const [showForm, setShowForm]             = useState(false);
  const [promoEditar, setPromoEditar]       = useState<Promocion | null>(null);
  const [promoToggle, setPromoToggle]       = useState<Promocion | null>(null);
  const [promoVer, setPromoVer]             = useState<Promocion | null>(null);
  const [guardando, setGuardando]           = useState(false);
  const [toggling, setToggling]             = useState(false);

  const filtradas = promociones.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );
  const paginadas = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const handleGuardar = async (datos: PromocionFormData) => {
    try {
      setGuardando(true);
      if (promoEditar) {
        await promocionService.editar(promoEditar.id, datos);
      } else {
        await promocionService.crear(datos);
      }
      setShowForm(false);
      setPromoEditar(null);
      await recargar();
    } finally {
      setGuardando(false);
    }
  };

  const handleToggle = async () => {
    if (!promoToggle) return;
    try {
      setToggling(true);
      if (promoToggle.activo) {
        await promocionService.desactivar(promoToggle.id);
      } else {
        await promocionService.activar(promoToggle.id);
      }
      setPromoToggle(null);
      await recargar();
    } finally {
      setToggling(false);
    }
  };

  const columnas: Columna<Promocion>[] = [
    {
      label: "Promoción",
      render: (p) => (
        <div className="flex items-center gap-3">
          {p.imagen ? (
            <img src={p.imagen} alt={p.nombre}
              style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover",
                border: "1px solid rgba(44,85,69,0.15)" }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: 8,
              backgroundColor: "rgba(44,85,69,0.1)", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontFamily: "'Lato', sans-serif", fontSize: 14,
              fontWeight: 700, color: "#2C5545" }}>
              {p.nombre.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p style={{ margin: 0, fontFamily: "'Lato', sans-serif",
              fontSize: 13.5, fontWeight: 500, color: "#2C5545" }}>{p.nombre}</p>
            {p.descripcion && (
              <p style={{ margin: 0, fontFamily: "'Lato', sans-serif",
                fontSize: 11.5, color: "rgba(44,85,69,0.55)",
                maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap" }}>{p.descripcion}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      label: "Precio",
      width: "90px",
      render: (p) => (
        <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 13.5,
          fontWeight: 600, color: "#2C5545" }}>
          S/ {Number(p.precio).toFixed(2)}
        </span>
      ),
    },
    {
      label: "Vigencia",
      width: "180px",
      render: (p) => (
        <div>
          <p style={{ margin: 0, fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#555" }}>
            {fmtFecha(p.fecha_inicio)} — {fmtFecha(p.fecha_fin)}
          </p>
          {p.vigente && (
            <span style={{ fontSize: 10, fontFamily: "'Lato', sans-serif",
              color: "#2e7d32", fontWeight: 700, letterSpacing: "0.04em" }}>
              ● VIGENTE
            </span>
          )}
        </div>
      ),
    },
    {
      label: "Estado",
      width: "100px",
      render: (p) => <StatusBadge estado={p.activo ? "activo" : "inactivo"} />,
    },
    {
      label: "Acciones",
      width: "120px",
      render: (p) => (
        <div className="flex items-center gap-1">
          <button onClick={() => setPromoVer(p)} title="Ver detalle"
            style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid rgba(44,85,69,0.2)",
              backgroundColor: "white", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: "#2C5545" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(44,85,69,0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}>
            <Eye size={13} strokeWidth={2} />
          </button>
          <button onClick={() => { setPromoEditar(p); setShowForm(true); }} title="Editar"
            style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid rgba(44,85,69,0.2)",
              backgroundColor: "white", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: "#2C5545" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(44,85,69,0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}>
            <Pencil size={13} strokeWidth={2} />
          </button>
          <button onClick={() => setPromoToggle(p)}
            title={p.activo ? "Desactivar" : "Activar"}
            style={{ width: 30, height: 30, borderRadius: 6,
              border: `1px solid ${p.activo ? "rgba(198,40,40,0.2)" : "rgba(44,85,69,0.2)"}`,
              backgroundColor: "white", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
              color: p.activo ? "#c62828" : "#2C5545" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = p.activo ? "rgba(198,40,40,0.06)" : "rgba(44,85,69,0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}>
            {p.activo ? <ToggleRight size={14} strokeWidth={2} /> : <ToggleLeft size={14} strokeWidth={2} />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Gestión de Promociones"
        descripcion="Administra las promociones activas del café"
        accion={
          <button onClick={() => { setPromoEditar(null); setShowForm(true); }}
            style={{ backgroundColor: "#2C5545", color: "white", border: "none",
              borderRadius: 8, padding: "9px 16px", fontFamily: "'Lato', sans-serif",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} strokeWidth={2.5} /> Nueva Promoción
          </button>
        }
      />
      <div className="mb-4">
        <SearchBar placeholder="Buscar promoción..." onBuscar={(t) => { setBusqueda(t); setPagina(1); }} />
      </div>
      <DataTable
        columnas={columnas}
        datos={paginadas}
        total={filtradas.length}
        pagina={pagina}
        onPagina={setPagina}
        porPagina={POR_PAGINA}
        cargando={cargando}
        textoVacio="No hay promociones registradas"
      />
      <PromocionForm
        abierto={showForm}
        promocion={promoEditar}
        onGuardar={handleGuardar}
        onCerrar={() => { setShowForm(false); setPromoEditar(null); }}
        cargando={guardando}
      />
      <ConfirmDialog
        abierto={!!promoToggle}
        titulo={promoToggle?.activo ? "¿Desactivar promoción?" : "¿Activar promoción?"}
        descripcion={`${promoToggle?.activo ? "Se desactivará" : "Se activará"} la promoción "${promoToggle?.nombre}".`}
        textoOk={promoToggle?.activo ? "Sí, desactivar" : "Sí, activar"}
        variante={promoToggle?.activo ? "danger" : "primary"}
        cargando={toggling}
        onConfirmar={handleToggle}
        onCancelar={() => setPromoToggle(null)}
      />
      <DetailModal
        abierto={!!promoVer}
        titulo={promoVer?.nombre}
        onCerrar={() => setPromoVer(null)}
      >
        {promoVer && (
          <>
            {promoVer.imagen && (
              <img src={promoVer.imagen} alt={promoVer.nombre}
                style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 8,
                  border: "1px solid rgba(44,85,69,0.15)" }} />
            )}
            {promoVer.descripcion && (
              <p style={{ margin: 0, fontFamily: "'Lato', sans-serif", fontSize: 13.5, color: "#555" }}>
                {promoVer.descripcion}
              </p>
            )}
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, fontWeight: 700,
                color: "rgba(44,85,69,0.6)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Precio
              </span>
              <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 16, fontWeight: 700, color: "#2C5545" }}>
                S/ {Number(promoVer.precio).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, fontWeight: 700,
                color: "rgba(44,85,69,0.6)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Vigencia
              </span>
              <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#333" }}>
                {fmtFecha(promoVer.fecha_inicio)} — {fmtFecha(promoVer.fecha_fin)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, fontWeight: 700,
                color: "rgba(44,85,69,0.6)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Estado
              </span>
              <StatusBadge estado={promoVer.activo ? "activo" : "inactivo"} />
            </div>
            {promoVer.vigente && (
              <span style={{ fontSize: 11, fontFamily: "'Lato', sans-serif",
                color: "#2e7d32", fontWeight: 700, letterSpacing: "0.04em" }}>
                ● ACTUALMENTE VIGENTE
              </span>
            )}
          </>
        )}
      </DetailModal>
    </>
  );
}
