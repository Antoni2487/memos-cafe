import { useState } from "react";
import { Tag, Plus, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { useCategorias } from "../../hooks/useCategorias";
import {
  PageHeader, DataTable, StatusBadge,
  StatCard, SearchBar, ConfirmDialog, FormModal, InputField,
} from "../../components/common";
import { CategoryModal } from "../../components/categorias/Categoriamodal";
import { esSoloAlfanumerico, LIMITES, MENSAJES } from "../../utils/validators";
import { getErrorMessage } from "../../utils/errors";
import type { Categoria, Columna } from "../../types";

export default function CategoriasPage() {
  const {
    categorias, filtered, loading, error,
    search, setSearch,
    showModal, setShowModal,
    confirmTarget, deactivating, deactivateError,
    handleCreated, pedirConfirmacion,
    confirmarDesactivar, cancelarConfirm, activar,
    editTarget, pedirEdicion, cancelarEdicion, confirmarEdicion,
  } = useCategorias();

  const [editNombre, setEditNombre]   = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError]     = useState("");

  const abrirEditar = (cat: Categoria) => {
    setEditNombre(cat.nombre);
    setEditError("");
    pedirEdicion(cat);
  };

  const validarEditNombre = (valor: string): string | null => {
    const trimmed = valor.trim();
    if (!trimmed) return "El nombre es obligatorio.";
    if (trimmed.length < 2) return "Mínimo 2 caracteres.";
    if (!esSoloAlfanumerico(trimmed)) return MENSAJES.SOLO_ALFANUMERICO;
    return null;
  };

  const handleBlurEditNombre = (valor: string) => {
    setEditError(validarEditNombre(valor) || "");
  };

  const handleGuardarEdicion = async () => {
    const msg = validarEditNombre(editNombre);
    if (msg) { setEditError(msg); return; }
    setEditLoading(true);
    setEditError("");
    try {
      await confirmarEdicion(editNombre.trim());
    } catch (err) {
      setEditError(getErrorMessage(err, "Error al editar"));
    } finally {
      setEditLoading(false);
    }
  };

  const columnas: Columna<Categoria>[] = [
    {
      key: "nombre",
      label: "Nombre",
      render: (cat) => (
        <div className="flex items-center gap-3">
          <div style={{
            backgroundColor: cat.activo ? "rgba(201,168,76,0.15)" : "rgba(0,0,0,0.06)",
            borderRadius: 7, width: 34, height: 34,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Tag size={15} style={{ color: cat.activo ? "#C9A84C" : "rgba(44,85,69,0.3)" }} />
          </div>
          <span style={{
            fontFamily: "'Lato', sans-serif",
            color: cat.activo ? "#2C5545" : "rgba(44,85,69,0.4)",
            fontSize: 15, fontWeight: 500,
            textDecoration: cat.activo ? "none" : "line-through",
          }}>
            {cat.nombre}
          </span>
        </div>
      ),
    },
    {
      key: "activo",
      label: "Estado",
      width: "110px",
      render: (cat) => <StatusBadge estado={cat.activo ? "activo" : "inactivo"} />,
    },
    {
      key: "acciones",
      label: "Acciones",
      width: "140px",
      render: (cat) => (
        <div className="flex items-center gap-2">
          {/* Editar */}
          <button
            onClick={() => abrirEditar(cat)}
            title="Editar nombre"
            style={{
              width: 32, height: 32, borderRadius: 7, border: "none", cursor: "pointer",
              backgroundColor: "rgba(44,85,69,0.08)", color: "#2C5545",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background-color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(44,85,69,0.16)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(44,85,69,0.08)")}
          >
            <Pencil size={14} />
          </button>

          {/* Activar / Desactivar */}
          {cat.activo ? (
            <button
              onClick={() => pedirConfirmacion(cat)}
              title="Desactivar"
              style={{
                width: 32, height: 32, borderRadius: 7, border: "none", cursor: "pointer",
                backgroundColor: "rgba(212,24,61,0.08)", color: "#d4183d",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background-color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(212,24,61,0.16)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(212,24,61,0.08)")}
            >
              <ToggleRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => activar(cat)}
              title="Activar"
              style={{
                width: 32, height: 32, borderRadius: 7, border: "none", cursor: "pointer",
                backgroundColor: "rgba(46,125,50,0.08)", color: "#2e7d32",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background-color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(46,125,50,0.16)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(46,125,50,0.08)")}
            >
              <ToggleLeft size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const activeCount   = categorias.filter((c) => c.activo).length;
  const inactiveCount = categorias.filter((c) => !c.activo).length;

  const hasProductError = deactivateError?.toLowerCase().includes("productos disponibles");
  const confirmDesc = hasProductError
    ? `"${confirmTarget?.nombre}" tiene productos disponibles. Desactivalos primero.`
    : deactivateError || `"${confirmTarget?.nombre}" quedara inactiva. Esta seguro?`;

  return (
    <>
      <PageHeader
        titulo="Categorias"
        descripcion="Organiza el menu agrupando los productos por categoria"
        accion={
          <button
            onClick={() => setShowModal(true)}
            style={{
              fontFamily: "'Lato', sans-serif", backgroundColor: "#2C5545",
              color: "#F8F4EE", borderRadius: 8, padding: "9px 20px",
              fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#234438")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2C5545")}
          >
            <Plus size={16} />
            Nueva categoria
          </button>
        }
      />

      <div className="flex gap-4 mb-6">
        <StatCard titulo="Total" valor={categorias.length} />
        <StatCard titulo="Activas" valor={activeCount} />
        <StatCard titulo="Inactivas" valor={inactiveCount} />
      </div>

      <div style={{ backgroundColor: "#fff", borderRadius: 10,
        boxShadow: "0 2px 10px rgba(44,85,69,0.08)", padding: "14px 18px", marginBottom: 20 }}>
        <SearchBar placeholder="Buscar por nombre..." onBuscar={setSearch} />
      </div>

      <DataTable
        columnas={columnas}
        datos={filtered}
        cargando={loading}
        textoVacio={error ? `Error: ${error}` : search ? `Sin resultados para "${search}"` : "Sin categorias registradas"}
      />

      {filtered.length > 0 && !loading && (
        <p style={{ fontFamily: "'Lato', sans-serif", color: "rgba(44,85,69,0.45)",
          fontSize: 13, marginTop: 14, paddingLeft: 4 }}>
          Mostrando {filtered.length} de {categorias.length} categorias
          {search && ` para "${search}"`}
        </p>
      )}

      {showModal && (
        <CategoryModal onClose={() => setShowModal(false)} onSave={handleCreated} />
      )}

      <FormModal
        abierto={!!editTarget}
        titulo="Editar categoria"
        onCerrar={cancelarEdicion}
        onGuardar={handleGuardarEdicion}
        cargando={editLoading}
        textoGuardar="Guardar cambios"
      >
        <InputField
          label="Nombre"
          value={editNombre}
          onChange={setEditNombre}
          onBlur={handleBlurEditNombre}
          maxLength={LIMITES.NOMBRE_CATEGORIA}
          placeholder="Nombre de la categoria"
          required
          error={editError}
        />
      </FormModal>

      <ConfirmDialog
        abierto={!!confirmTarget}
        titulo={hasProductError ? "No se puede desactivar" : "Desactivar categoria?"}
        descripcion={confirmDesc}
        textoOk={hasProductError || !!deactivateError ? undefined : "Desactivar"}
        textoCancelar={hasProductError || deactivateError ? "Entendido" : "Cancelar"}
        variante="danger"
        cargando={deactivating}
        onConfirmar={hasProductError || deactivateError ? cancelarConfirm : confirmarDesactivar}
        onCancelar={cancelarConfirm}
      />
    </>
  );
}
