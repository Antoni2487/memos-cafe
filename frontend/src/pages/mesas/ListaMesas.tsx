import { useState } from "react";
import { Pencil, Trash2, Plus, QrCode, ScanLine, XCircle, Copy, Check } from "lucide-react";
import useMesas from "../../hooks/useMesas";
import MesaForm from "../../components/mesas/MesaForm";
import MesaQRCodigo from "../../components/mesas/MesaQRCodigo";
import mesasService from "../../services/mesasService";
import authService from "../../services/authService";
import { urlPedidoQR } from "../../services/pedidoQRService";
import { getErrorMessage } from "../../utils/errors";
import {
  DataTable,
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
  const [abriendoQR, setAbriendoQR]   = useState<number | null>(null);
  const [linkQR, setLinkQR]           = useState<{ mesaNumero: number; url: string } | null>(null);
  const [copiado, setCopiado]         = useState(false);
  const [errorQR, setErrorQR]         = useState<string | null>(null);
  const [mesaCancelarQR, setMesaCancelarQR] = useState<Mesa | null>(null);
  const [cancelandoQR, setCancelandoQR]     = useState(false);
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

  const handleAbrirQR = async (mesa: Mesa) => {
    try {
      setAbriendoQR(mesa.id);
      setErrorQR(null);
      await mesasService.abrirSesionQR(mesa.id);
      setLinkQR({ mesaNumero: mesa.numero, url: urlPedidoQR(mesa.codigo_qr ?? "") });
      await recargar();
    } catch (err) {
      setErrorQR(getErrorMessage(err, "No se pudo abrir la mesa para pedido por QR"));
    } finally {
      setAbriendoQR(null);
    }
  };

  const handleCancelarQR = async () => {
    if (!mesaCancelarQR) return;
    try {
      setCancelandoQR(true);
      setErrorQR(null);
      await mesasService.cerrarSesionQR(mesaCancelarQR.id);
      setMesaCancelarQR(null);
      await recargar();
    } catch (err) {
      setErrorQR(getErrorMessage(err, "No se pudo cancelar la sesión de QR"));
      setMesaCancelarQR(null);
    } finally {
      setCancelandoQR(false);
    }
  };

  const handleCopiarLink = async () => {
    if (!linkQR) return;
    try {
      await navigator.clipboard.writeText(linkQR.url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard puede fallar sin HTTPS/permiso — el link igual se ve y se puede copiar a mano
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
          {m.estado === "libre" && (
            <button onClick={() => handleAbrirQR(m)} title="Abrir para pedido por QR"
              disabled={abriendoQR === m.id}
              style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid rgba(140,108,58,0.4)",
                backgroundColor: "var(--marfil)", cursor: abriendoQR === m.id ? "wait" : "pointer", display: "flex",
                alignItems: "center", justifyContent: "center", color: "var(--champan)" }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(140,108,58,0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}>
              <QrCode size={13} strokeWidth={2} />
            </button>
          )}
          {m.estado === "ocupada" && (
            <button onClick={() => setMesaCancelarQR(m)} title="Cancelar sesión de QR (si no hay pedido en curso)"
              style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid rgba(140,108,58,0.4)",
                backgroundColor: "var(--marfil)", cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center", color: "var(--champan)" }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(140,108,58,0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}>
              <XCircle size={13} strokeWidth={2} />
            </button>
          )}
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
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => { setMesaEditar(null); setShowForm(true); }}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-salvia px-4 text-sm font-semibold text-marfil hover:bg-salvia-osc sm:w-auto"
        >
          <Plus size={16} strokeWidth={2.5} /> Nueva mesa
        </button>
      </div>

      {errorQR && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-2.5 font-body text-sm text-destructive">
          {errorQR}
        </div>
      )}

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

      <ConfirmDialog
        abierto={!!mesaCancelarQR}
        titulo="¿Cancelar la sesión de QR?"
        descripcion={`Solo funciona si la Mesa ${mesaCancelarQR?.numero} todavía no tiene ningún pedido — la deja libre de nuevo. Si ya hay un pedido en curso, esta acción se va a rechazar (hay que anularlo o cerrarlo desde Órdenes).`}
        textoOk="Sí, cancelar y liberar"
        variante="warning"
        cargando={cancelandoQR}
        onConfirmar={handleCancelarQR}
        onCancelar={() => setMesaCancelarQR(null)}
      />

      <DetailModal
        abierto={!!linkQR}
        titulo={`Mesa ${linkQR?.mesaNumero} lista para pedir por QR`}
        onCerrar={() => setLinkQR(null)}
      >
        <p className="font-body text-sm text-[var(--suave)]">
          El QR físico de esta mesa ya funciona. Para probarlo sin escanear, usá este link:
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-brand/20 bg-cream px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate font-body text-xs text-brand">{linkQR?.url}</span>
          <button
            onClick={handleCopiarLink}
            className="flex shrink-0 items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 font-body text-xs font-semibold text-white hover:bg-brand-dark"
          >
            {copiado ? <Check size={13} /> : <Copy size={13} />}
            {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>
      </DetailModal>

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
