import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import pedidoQRService from "../../services/pedidoQRService";
import productoService from "../../services/productoService";
import promocionService from "../../services/promocionService";
import { getErrorMessage } from "../../utils/errors";
import type { OrdenQR, PedidoPorConfirmarQR, Producto, Promocion } from "../../types";

export interface ItemCarrito {
  key: string;
  tipo: "producto" | "promocion";
  id: number;
  nombre: string;
  precio: number;
  imagen?: string | null;
  cantidad: number;
  nota: string;
}

export type EntradaCarrito = Omit<ItemCarrito, "key">;

export const precioNum = (p: number | string): number => (typeof p === "number" ? p : parseFloat(p));
export const soles = (n: number | string): string => `S/ ${precioNum(n).toFixed(2)}`;

const POLL_MS = 8000;
const POLL_ESPERANDO_MS = 4000; // mientras el mesero confirma, se consulta más seguido

// El carrito vive en este celular (localStorage), por mesa: si se recarga la
// página o se cierra el navegador no se pierde lo que se estaba eligiendo.
// Lo ya enviado vive en el servidor: volver a escanear lo muestra todo.
const claveCarrito = (codigo: string) => `carrito_mesa_${codigo}`;
const claveUltimaOrden = (codigo: string) => `ultima_orden_mesa_${codigo}`;

function leer<T>(clave: string, porDefecto: T): T {
  try {
    const v = localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function guardar(clave: string, valor: unknown) {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // navegación privada: se pierde al recargar, nada más
  }
}

export function usePedidoMesa(codigo: string) {
  const [cargando, setCargando] = useState(true);
  const [mesaInexistente, setMesaInexistente] = useState(false);
  const [sinConexion, setSinConexion] = useState(false);
  const [mesaNumero, setMesaNumero] = useState<number | null>(null);
  const [orden, setOrden] = useState<OrdenQR | null>(null);
  const [porConfirmar, setPorConfirmar] = useState<PedidoPorConfirmarQR | null>(null);
  // La visita terminó (se cobró la orden) mientras el cliente la tenía abierta
  // o desde la última vez que escaneó en este celular.
  const [visitaTerminada, setVisitaTerminada] = useState(false);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [cargandoCarta, setCargandoCarta] = useState(true);

  const [carrito, setCarrito] = useState<ItemCarrito[]>(() => leer(claveCarrito(codigo), []));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => guardar(claveCarrito(codigo), carrito.length ? carrito : null), [codigo, carrito]);

  // ── Carta: una sola vez ────────────────────────────────────────────────
  useEffect(() => {
    let vivo = true;
    Promise.all([productoService.listarPublico(), promocionService.listarPublico()])
      .then(([p, promos]) => {
        if (!vivo) return;
        setProductos(p);
        setPromociones(promos);
      })
      .catch(() => { /* la carta vacía muestra su propio aviso */ })
      .finally(() => vivo && setCargandoCarta(false));
    return () => { vivo = false; };
  }, []);

  // ── Estado de la mesa ──────────────────────────────────────────────────
  const cargarEstado = useCallback(
    () =>
      pedidoQRService
        .estado(codigo)
        .then(({ data }) => {
          setMesaNumero(data.mesa_numero);
          setOrden(data.orden);
          setPorConfirmar(data.pedido_por_confirmar);
          setMesaInexistente(false);
          setSinConexion(false);
          const anterior = leer<number | null>(claveUltimaOrden(codigo), null);
          if (data.orden) {
            guardar(claveUltimaOrden(codigo), data.orden.id);
            setVisitaTerminada(false);
          } else if (anterior !== null) {
            guardar(claveUltimaOrden(codigo), null);
            setVisitaTerminada(true);
          }
        })
        .catch((err) => {
          if (axios.isAxiosError(err) && err.response?.status === 404) setMesaInexistente(true);
          else setSinConexion(true);
        })
        .finally(() => setCargando(false)),
    [codigo]
  );

  const esperando = porConfirmar?.estado === "pendiente";
  const intervalo = esperando ? POLL_ESPERANDO_MS : POLL_MS;
  const cargarRef = useRef(cargarEstado);
  useEffect(() => { cargarRef.current = cargarEstado; }, [cargarEstado]);

  useEffect(() => {
    cargarRef.current();
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") cargarRef.current();
    }, intervalo);
    // Al volver a la pestaña (tras bloquear el celular) se actualiza al toque.
    const alVolver = () => document.visibilityState === "visible" && cargarRef.current();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [intervalo]);

  // ── Carrito ────────────────────────────────────────────────────────────
  const agregar = useCallback((entrada: EntradaCarrito) => {
    const nota = entrada.nota.trim();
    // Mismo producto con otra nota = otra línea ("uno sin azúcar, otro normal").
    const key = `${entrada.tipo}-${entrada.id}-${nota.toLowerCase()}`;
    setCarrito((prev) => {
      const existe = prev.find((i) => i.key === key);
      if (existe) {
        return prev.map((i) => (i.key === key ? { ...i, cantidad: i.cantidad + entrada.cantidad } : i));
      }
      return [...prev, { ...entrada, nota, key }];
    });
  }, []);

  const cambiarCantidad = useCallback((key: string, delta: number) => {
    setCarrito((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, cantidad: Math.min(20, i.cantidad + delta) } : i))
        .filter((i) => i.cantidad > 0)
    );
  }, []);

  const quitar = useCallback((key: string) => setCarrito((prev) => prev.filter((i) => i.key !== key)), []);

  const enviar = useCallback(async (): Promise<"orden" | "por_confirmar" | null> => {
    if (carrito.length === 0) return null;
    setEnviando(true);
    setError(null);
    try {
      const r = await pedidoQRService.pedir(
        codigo,
        carrito.map((i) => ({
          producto: i.tipo === "producto" ? i.id : null,
          promocion: i.tipo === "promocion" ? i.id : null,
          cantidad: i.cantidad,
          nota: i.nota,
        }))
      );
      setCarrito([]);
      setVisitaTerminada(false);
      if (r.tipo === "orden") {
        setOrden(r.orden);
        guardar(claveUltimaOrden(codigo), r.orden.id);
      } else {
        setPorConfirmar(r.pedido);
      }
      return r.tipo;
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos enviar tu pedido. Revisa tu conexión e inténtalo de nuevo."));
      return null;
    } finally {
      setEnviando(false);
    }
  }, [carrito, codigo]);

  const pedirCuenta = useCallback(async (metodo: string): Promise<boolean> => {
    setError(null);
    try {
      await pedidoQRService.solicitarCobro(codigo, metodo);
      setOrden((o) => (o ? { ...o, cuenta_solicitada: true } : o));
      return true;
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos avisar a tu mesero. Inténtalo de nuevo."));
      return false;
    }
  }, [codigo]);

  const cantidadCarrito = carrito.reduce((s, i) => s + i.cantidad, 0);
  const totalCarrito = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);

  return {
    cargando, mesaInexistente, sinConexion, mesaNumero, orden, porConfirmar, visitaTerminada,
    productos, promociones, cargandoCarta,
    carrito, cantidadCarrito, totalCarrito, agregar, cambiarCantidad, quitar,
    enviar, enviando, pedirCuenta, error, limpiarError: () => setError(null),
    actualizar: cargarEstado,
  };
}

export type PedidoMesa = ReturnType<typeof usePedidoMesa>;
