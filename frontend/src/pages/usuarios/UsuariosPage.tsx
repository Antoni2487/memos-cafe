import type { CSSProperties } from "react";
import { Pencil, Trash2, PowerOff } from "lucide-react";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  SearchBar,
  ConfirmDialog,
} from "../../components/common";
import UsuarioForm from "../../components/usuarios/UsuarioForm";
import useUsuarios from "../../hooks/useUsuarios";
import { ROLES } from "../../utils/constants";
import type { Columna, Usuario } from "../../types";

const ROL_COLORES: Record<string, { bg: string; color: string }> = {
  [ROLES.ADMIN]: { bg: "rgba(44,85,69,0.12)", color: "#2C5545" },
  [ROLES.CAJERO]: { bg: "rgba(201,168,76,0.15)", color: "#9a7a1a" },
  [ROLES.MESERO]: { bg: "rgba(33,150,243,0.12)", color: "#1565c0" },
};

const BTN_BASE: CSSProperties = {
  width: 30, height: 30, borderRadius: "6px",
  backgroundColor: "white", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  transition: "all 0.15s",
};

export default function UsuariosPage() {
  const {
    paginados, filtrados, cargando, guardando, eliminando, togglando,
    pagina, setPagina, POR_PAGINA,
    showForm, usuarioEditar, usuarioEliminar, usuarioToggle,
    setUsuarioEliminar, setUsuarioToggle,
    error, setError,
    handleBuscar, handleGuardar, handleEliminar, handleToggleActivo,
    abrirEditar, abrirNuevo, cerrarForm,
  } = useUsuarios();

  const columnas: Columna<Usuario>[] = [
    {
      label: "Usuario",
      key: "name",
      render: (u) => (
        <div className="flex items-center gap-2.5">
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            backgroundColor: "rgba(44,85,69,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Lato', sans-serif", fontSize: 11,
            fontWeight: 700, color: "#2C5545", flexShrink: 0,
          }}>
            {(u.name || u.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <p style={{ margin: 0, fontFamily: "'Lato', sans-serif", fontSize: 13.5, fontWeight: 500, color: "#2C5545" }}>
              {u.name || "—"}
            </p>
            <p style={{ margin: 0, fontFamily: "'Lato', sans-serif", fontSize: 11.5, color: "rgba(44,85,69,0.55)" }}>
              {u.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      label: "Rol",
      key: "groups",
      width: "120px",
      render: (u) => {
        const rol = u.groups?.[0]?.name ?? "Sin rol";
        const c = ROL_COLORES[rol] ?? { bg: "rgba(120,120,120,0.1)", color: "#666" };
        return (
          <span style={{
            display: "inline-flex", alignItems: "center",
            backgroundColor: c.bg, color: c.color,
            borderRadius: "999px", fontFamily: "'Lato', sans-serif",
            fontSize: "11px", fontWeight: 700,
            padding: "3px 10px", letterSpacing: "0.04em",
            textTransform: "capitalize",
          }}>
            {rol}
          </span>
        );
      },
    },
    {
      label: "Estado",
      key: "is_active",
      width: "100px",
      render: (u) => <StatusBadge estado={u.is_active ? "activo" : "inactivo"} />,
    },
    {
      label: "Registro",
      key: "date_joined",
      width: "120px",
      render: (u) => u.date_joined
        ? new Date(u.date_joined).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })
        : "—",
    },
    {
      label: "Acciones",
      width: "110px",
      render: (u) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => abrirEditar(u)}
            title="Editar"
            style={{ ...BTN_BASE, border: "1px solid rgba(44,85,69,0.2)", color: "#2C5545" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(44,85,69,0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
          >
            <Pencil size={13} strokeWidth={2} />
          </button>
          <button
            onClick={() => setUsuarioToggle(u)}
            title={u.is_active ? "Desactivar" : "Activar"}
            style={{ ...BTN_BASE, border: "1px solid rgba(245,127,23,0.3)", color: "#f57f17" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(245,127,23,0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
          >
            <PowerOff size={13} strokeWidth={2} />
          </button>
          <button
            onClick={() => setUsuarioEliminar(u)}
            title="Eliminar"
            style={{ ...BTN_BASE, border: "1px solid rgba(198,40,40,0.2)", color: "#c62828" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(198,40,40,0.06)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
          >
            <Trash2 size={13} strokeWidth={2} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Gestión de Usuarios"
        descripcion="Administra los accesos y roles del sistema"
        accion={
          <button
            onClick={abrirNuevo}
            style={{
              backgroundColor: "#2C5545", color: "white",
              border: "none", borderRadius: "8px",
              padding: "9px 16px", fontFamily: "'Lato', sans-serif",
              fontSize: "13px", fontWeight: 600, cursor: "pointer",
            }}
          >
            + Nuevo Usuario
          </button>
        }
      />

      {error && (
        <div
          onClick={() => setError(null)}
          style={{
            backgroundColor: "rgba(198,40,40,0.08)",
            border: "1px solid rgba(198,40,40,0.25)",
            borderRadius: "8px", padding: "10px 14px",
            marginBottom: 16, cursor: "pointer",
            fontFamily: "'Lato', sans-serif",
            fontSize: "13px", color: "#c62828",
          }}
        >
          ⚠ {error} — <span style={{textDecoration:"underline"}}>Cerrar</span>
        </div>
      )}
      <div className="mb-4">
        <SearchBar placeholder="Buscar por nombre o email..." onBuscar={handleBuscar} />
      </div>

      <DataTable
        columnas={columnas}
        datos={paginados}
        total={filtrados.length}
        pagina={pagina}
        onPagina={setPagina}
        porPagina={POR_PAGINA}
        cargando={cargando}
        textoVacio="No hay usuarios registrados"
      />

      <UsuarioForm
        abierto={showForm}
        usuario={usuarioEditar}
        onGuardar={handleGuardar}
        onCerrar={cerrarForm}
        cargando={guardando}
      />

      <ConfirmDialog
        abierto={!!usuarioToggle}
        titulo={usuarioToggle?.is_active ? "¿Desactivar usuario?" : "¿Activar usuario?"}
        descripcion={`${usuarioToggle?.is_active ? "Se desactivará" : "Se activará"} la cuenta de ${usuarioToggle?.email}.`}
        textoOk={usuarioToggle?.is_active ? "Sí, desactivar" : "Sí, activar"}
        variante={usuarioToggle?.is_active ? "warning" : "primary"}
        cargando={togglando}
        onConfirmar={handleToggleActivo}
        onCancelar={() => setUsuarioToggle(null)}
      />

      <ConfirmDialog
        abierto={!!usuarioEliminar}
        titulo="¿Eliminar usuario?"
        descripcion={`Estás a punto de eliminar a ${usuarioEliminar?.email}.\nEsta acción no se puede deshacer.`}
        textoOk="Sí, eliminar"
        variante="danger"
        cargando={eliminando}
        onConfirmar={handleEliminar}
        onCancelar={() => setUsuarioEliminar(null)}
      />
    </>
  );
}
