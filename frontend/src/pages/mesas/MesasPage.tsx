import { useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import useMesas from "../../hooks/useMesas";
import MesaForm from "../../components/mesas/MesaForm";
import mesasService from "../../services/mesasService";
import {
  PageHeader, DataTable,
  SearchBar, ConfirmDialog,
} from "../../components/common";
import type { Columna, EstadoMesa, Mesa } from "../../types";
import type { MesaFormData } from "../../services/mesasService";

const POR_PAGINA = 10;

const ESTADO_COLOR: Record<string, { color: string; bg: string; label: string }> = {
  libre:     { color: "#2e7d32", bg: "#e8f5e9", label: "Libre" },
  ocupada:   { color: "#c62828", bg: "#fdecea", label: "Ocupada" },
  reservada: { color: "#f57f17", bg: "#fff8e1", label: "Reservada" },
};

export default function MesasPage() {
  const { mesas, cargando, recargar } = useMesas();
  const [busqueda, setBusqueda]       = useState("");
  const [pagina, setPagina]           = useState(1);
  const [showForm, setShowForm]       = useState(false);
  const [mesaEditar, setMesaEditar]   = useState<Mesa | null>(null);
  const [mesaBaja, setMesaBaja]       = useState<Mesa | null>(null);
  const [guardando, setGuardando]     = useState(false);
  const [dandoBaja, setDandoBaja]     = useState(false);

  const filtradas = mesas.filter((m) =>
    String(m.numero).includes(busqueda)
  );
  const paginadas = filtradas
    .slice()
    .sort((a, b) => a.id - b.id)
    .slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const handleGuardar = async (datos: MesaFormData) => {
    try {
      setGuardando(true);
      if (mesaEditar) {
        await mesasService.editar(mesaEditar.id, datos);
      } else {
        await mesasService.crear(datos);
      }
      setShowForm(false);
      setMesaEditar(null);
      await recargar();
    } finally {
      setGuardando(false);
    }
  };

  const handleDarDeBaja = async () => {
    if (!mesaBaja) return;
    try {
      setDandoBaja(true);
      await mesasService.darDeBaja(mesaBaja.id);
      setMesaBaja(null);
      await recargar();
    } finally {
      setDandoBaja(false);
    }
  };

  const handleCambiarEstado = async (mesa: Mesa, nuevoEstado: EstadoMesa) => {
    try {
      await mesasService.cambiarEstado(mesa.id, nuevoEstado);
      await recargar();
    } catch {
      // El backend valida transiciones inválidas y devuelve error
    }
  };

  const columnas: Columna<Mesa>[] = [
    {
      label: "Mesa",
      width: "100px",
      render: (m) => (
        <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 13.5,
          fontWeight: 600, color: "#2C5545" }}>
          Mesa {m.numero}
        </span>
      ),
    },
    {
      label: "Capacidad",
      width: "110px",
      render: (m) => (
        <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#555" }}>
          {m.capacidad} personas
        </span>
      ),
    },
    {
      label: "Estado",
      width: "160px",
      render: (m) => {
        const cfg = ESTADO_COLOR[m.estado] || ESTADO_COLOR.libre;
        return (
          <select
            value={m.estado}
            onChange={(e) => handleCambiarEstado(m, e.target.value as EstadoMesa)}
            style={{
              backgroundColor: cfg.bg, color: cfg.color,
              border: `1px solid ${cfg.color}33`, borderRadius: 6,
              padding: "5px 10px", fontFamily: "'Lato', sans-serif",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            <option value="libre">Libre</option>
            <option value="reservada">Reservada</option>
          </select>
        );
      },
    },
    {
      label: "Acciones",
      width: "90px",
      render: (m) => (
        <div className="flex items-center gap-1">
          <button onClick={() => { setMesaEditar(m); setShowForm(true); }} title="Editar"
            style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid rgba(44,85,69,0.2)",
              backgroundColor: "white", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: "#2C5545" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(44,85,69,0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}>
            <Pencil size={13} strokeWidth={2} />
          </button>
          <button onClick={() => setMesaBaja(m)} title="Dar de baja"
            style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid rgba(198,40,40,0.2)",
              backgroundColor: "white", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: "#c62828" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(198,40,40,0.06)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}>
            <Trash2 size={13} strokeWidth={2} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Gestión de Mesas"
        descripcion="Administra las mesas del café y su disponibilidad"
        accion={
          <button onClick={() => { setMesaEditar(null); setShowForm(true); }}
            style={{ backgroundColor: "#2C5545", color: "white", border: "none",
              borderRadius: 8, padding: "9px 16px", fontFamily: "'Lato', sans-serif",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} strokeWidth={2.5} /> Nueva Mesa
          </button>
        }
      />

      <div className="mb-4">
        <SearchBar placeholder="Buscar por número de mesa..." onBuscar={(t) => { setBusqueda(t); setPagina(1); }} />
      </div>

      <DataTable
        columnas={columnas}
        datos={paginadas}
        total={filtradas.length}
        pagina={pagina}
        onPagina={setPagina}
        porPagina={POR_PAGINA}
        cargando={cargando}
        textoVacio="No hay mesas registradas"
      />

      <MesaForm
        abierto={showForm}
        mesa={mesaEditar}
        onGuardar={handleGuardar}
        onCerrar={() => { setShowForm(false); setMesaEditar(null); }}
        cargando={guardando}
      />

      <ConfirmDialog
        abierto={!!mesaBaja}
        titulo="¿Dar de baja esta mesa?"
        descripcion={`Se dará de baja la Mesa ${mesaBaja?.numero}. Esta acción no se puede deshacer fácilmente.`}
        textoOk="Sí, dar de baja"
        variante="danger"
        cargando={dandoBaja}
        onConfirmar={handleDarDeBaja}
        onCancelar={() => setMesaBaja(null)}
      />
    </>
  );
}
