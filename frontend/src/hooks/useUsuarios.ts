import { useState, useEffect, useCallback } from "react";
import usuarioService, { type UsuarioFormData } from "../services/usuarioService";
import { getErrorMessage } from "../utils/errors";
import type { Usuario } from "../types";

const POR_PAGINA = 10;

export default function useUsuarios() {
  const [usuarios, setUsuarios]             = useState<Usuario[]>([]);
  const [filtrados, setFiltrados]           = useState<Usuario[]>([]);
  const [cargando, setCargando]             = useState(true);
  const [guardando, setGuardando]           = useState(false);
  const [eliminando, setEliminando]         = useState(false);
  const [togglando, setTogglando]           = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [pagina, setPagina]                 = useState(1);
  const [showForm, setShowForm]             = useState(false);
  const [usuarioEditar, setUsuarioEditar]   = useState<Usuario | null>(null);
  const [usuarioEliminar, setUsuarioEliminar] = useState<Usuario | null>(null);
  const [usuarioToggle, setUsuarioToggle]   = useState<Usuario | null>(null);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const { data } = await usuarioService.getAll();
      const lista = "results" in data ? data.results : data;
      setUsuarios(lista);
      setFiltrados(lista);
      setPagina(1);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleBuscar = useCallback((texto: string) => {
    const t = texto.toLowerCase();
    setFiltrados(
      usuarios.filter((u) =>
        u.email.toLowerCase().includes(t) ||
        (u.name || "").toLowerCase().includes(t)
      )
    );
    setPagina(1);
  }, [usuarios]);

  const handleGuardar = async (datos: UsuarioFormData) => {
    try {
      setGuardando(true);
      setError(null);
      if (usuarioEditar) {
        await usuarioService.update(usuarioEditar.id, datos);
      } else {
        await usuarioService.create(datos);
      }
      setShowForm(false);
      setUsuarioEditar(null);
      await cargar();
    } catch (e) {
      setError(getErrorMessage(e, "Error al guardar el usuario."));
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async () => {
    if (!usuarioEliminar) return;
    try {
      setEliminando(true);
      setError(null);
      await usuarioService.delete(usuarioEliminar.id);
      setUsuarioEliminar(null);
      await cargar();
    } catch (e) {
      setUsuarioEliminar(null);
      setError(getErrorMessage(e, "Error al eliminar el usuario."));
    } finally {
      setEliminando(false);
    }
  };

  const handleToggleActivo = async () => {
    if (!usuarioToggle) return;
    try {
      setTogglando(true);
      setError(null);
      await usuarioService.toggleActivo(usuarioToggle.id);
      setUsuarioToggle(null);
      await cargar();
    } catch (e) {
      setUsuarioToggle(null);
      setError(getErrorMessage(e, "Error al cambiar el estado del usuario."));
    } finally {
      setTogglando(false);
    }
  };

  const abrirEditar = (u: Usuario) => { setUsuarioEditar(u); setShowForm(true); };
  const abrirNuevo  = ()  => { setUsuarioEditar(null); setShowForm(true); };

  const paginados = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return {
    paginados, filtrados, cargando, guardando, eliminando, togglando,
    error, setError,
    pagina, setPagina, POR_PAGINA,
    showForm, usuarioEditar, usuarioEliminar, usuarioToggle,
    setUsuarioEliminar, setUsuarioToggle,
    handleBuscar, handleGuardar, handleEliminar, handleToggleActivo,
    abrirEditar, abrirNuevo,
    cerrarForm: () => { setShowForm(false); setUsuarioEditar(null); },
  };
}
