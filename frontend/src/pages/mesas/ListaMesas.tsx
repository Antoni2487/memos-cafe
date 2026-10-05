import { useState } from "react";
import { Pencil, Trash2, Plus, ScanLine } from "lucide-react";
import useMesas from "../../hooks/useMesas";
import MesaForm from "../../components/mesas/MesaForm";
import MesaQRCodigo from "../../components/mesas/MesaQRCodigo";
import mesasService from "../../services/mesasService";
import authService from "../../services/authService";
import { urlPedidoQR } from "../../services/pedidoQRService";
import {
  DataTable, StatusBadge,
  SearchBar, ConfirmDialog, DetailModal,
} from "../../components/common";
import type { Columna, EstadoMesa, Mesa } from "../../types";
import type { MesaFormData } from "../../services/mesasService";

const POR_PAGINA = 10;

const ESTADO_COLOR: Record<string, { color: string; bg: string; label: string }> = {
  libre:     { color: "var(--exito)", bg: "var(--exito-fondo)", label: "Libre" },
  ocupada:   { color: "var(--peligro)", bg: "var(--peligro-fondo)", label: "Ocupada" },
  reservada: { color: "var(--aviso)", bg: "var(--aviso-fondo)", label: "Reservada" },
};

/** Lista de mesas: alta, edición, QR y estado (pestaña "Lista" de Mesas). */
export default function ListaMesas() {
  const { mesas, cargando, recargar } = useMesas();
  const [busqueda, setBusqueda]       = useState("");
  const [pagina, setPagina]           = useState(1);
  const [showForm, setShowForm]       = useState(false);
  const [mesaEditar, setMesaEditar]   = useState<Mesa | null>(null);
  const [mesaBaja, setMesaBaja]       = useState<Mesa | null>(null);
  const [guardando, setGuardando]     = useState(false);
  const [dandoBaja, setDandoBaja]     = useState(false);
  const [mesaVerQR, setMesaVerQR]           = useState<Mesa | null>(null);

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

  const esAdmin = authService.hasRole("admin");

  // Invalida el QR impreso (por ejemplo, si alguien le saco foto) y muestra
  // el nuevo para reimprimirlo. El QR viejo deja de funcionar al instante.
  const handleRegenerarQR = async () => {
    if (!mesaVerQR) return;
    const { data } = await mesasService.regenerarQR(mesaVerQR.id);
    setMesaVerQR(data);
    await recargar();
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
        <span style={{ fontFamily: "var(--font-texto)", fontSize: 13.5,
          fontWeight: 600, color: "var(--salvia)" }}>
          Mesa {m.numero}
        </span>
      ),
    },
    {
      label: "Capacidad",
      width: "110px",
      render: (m) => (
        <span style={{ fontFamily: "var(--font-texto)", fontSize: 13, color: "var(--suave)" }}>
          {m.capacidad} personas
        </span>
      ),
    },
    {
      label: "Estado",
      width: "160px",
      render: (m) => {
        const cfg = ESTADO_COLOR[m.estado] || ESTADO_COLOR.libre;
        // Ocupada no se elige a mano: la ocupa un pedido y la libera el cobro.
        if (m.estado === "ocupada") {
          return (
            <span title="Se libera sola al cobrar o anular su pedido">
              <StatusBadge estado="ocupada" />
            </span>
          );
        }
        return (
          <select
            value={m.estado}
            onChange={(e) => handleCambiarEstado(m, e.target.value as EstadoMesa)}
            style={{
              backgroundColor: cfg.bg, color: cfg.color,
              border: `1px solid ${cfg.color}33`, borderRadius: 6,
              padding: "5px 10px", fontFamily: "var(--font-texto)",
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
      width: "150px",
      render: (m) => (
        <div className="flex items-center gap-1">
          <button onClick={() => setMesaVerQR(m)} title="Ver / imprimir el código QR de la mesa"
            style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid var(--linea-fuerte)",
              backgroundColor: "var(--marfil)", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: "var(--salvia)" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(76,107,101,0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}>
            <ScanLine size={13} strokeWidth={2} />
          </button>
          {esAdmin && (
            <>
          <button onClick={() => { setMesaEditar(m); setShowForm(true); }} title="Editar"
            style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid var(--linea-fuerte)",
              backgroundColor: "var(--marfil)", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: "var(--salvia)" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(76,107,101,0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}>
            <Pencil size={13} strokeWidth={2} />
          </button>
          <button onClick={() => setMesaBaja(m)} title="Dar de baja"
            style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid rgba(163,58,44,0.2)",
              backgroundColor: "var(--marfil)", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: "var(--peligro)" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(163,58,44,0.06)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}>
            <Trash2 size={13} strokeWidth={2} />
          </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Crear, editar y dar de baja mesas es solo del admin (el servidor lo
          rechaza para los demás): al mesero ni se le muestran. */}
      {esAdmin && <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => { setMesaEditar(null); setShowForm(true); }}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-salvia px-4 text-sm font-semibold text-marfil hover:bg-salvia-osc sm:w-auto"
        >
          <Plus size={16} strokeWidth={2.5} /> Nueva mesa
        </button>
      </div>}

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

      <DetailModal
        abierto={!!mesaVerQR}
        titulo="Código QR de la mesa"
        onCerrar={() => setMesaVerQR(null)}
      >
        {mesaVerQR && (
          <MesaQRCodigo
            mesaNumero={mesaVerQR.numero}
            url={urlPedidoQR(mesaVerQR.codigo_qr ?? "")}
            onRegenerar={esAdmin ? handleRegenerarQR : undefined}
          />
        )}
      </DetailModal>
    </>
  );
}
