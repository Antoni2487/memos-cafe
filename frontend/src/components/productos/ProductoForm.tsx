import { useState, useEffect } from "react";
import { FormModal, InputField, ImageUpload } from "../common";
import categoriaService from "../../services/categoriaService";
import { esSoloAlfanumerico, LIMITES, MENSAJES } from "../../utils/validators";
import type { Categoria, Producto } from "../../types";
import type { ProductoFormData } from "../../services/productoService";

interface ProductoFormProps {
  abierto: boolean;
  producto: Producto | null;
  onGuardar: (data: ProductoFormData) => void;
  onCerrar: () => void;
  cargando?: boolean;
}

interface FormState {
  nombre: string;
  descripcion: string;
  precio: string;
  categoria: string;
}

export default function ProductoForm({ abierto, producto, onGuardar, onCerrar, cargando }: ProductoFormProps) {
  const [form, setForm] = useState<FormState>({
    nombre: "", descripcion: "", precio: "", categoria: "",
  });
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [errores, setErrores] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    categoriaService.listar().then(({ data }) => {
      const lista = (Array.isArray(data) ? data : data.results).filter((c) => c.activo);
      setCategorias(lista);
    });
  }, []);

  useEffect(() => {
    if (producto) {
      setForm({
        nombre:      producto.nombre      || "",
        descripcion: producto.descripcion || "",
        precio:      String(producto.precio ?? ""),
        categoria:   String(producto.categoria ?? ""),
      });
    } else {
      setForm({ nombre: "", descripcion: "", precio: "", categoria: "" });
    }
    setImagenFile(null);
    setErrores({});
  }, [producto, abierto]);

  const set = (campo: keyof FormState) => (val: string) => setForm((f) => ({ ...f, [campo]: val }));

  const validarNombre = (valor: string): string | null => {
    if (!valor.trim()) return "El nombre es obligatorio";
    if (!esSoloAlfanumerico(valor)) return MENSAJES.SOLO_ALFANUMERICO;
    return null;
  };

  const handleBlurNombre = (valor: string) => {
    setErrores((prev) => ({ ...prev, nombre: validarNombre(valor) || undefined }));
  };

  const validar = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    const errNombre = validarNombre(form.nombre);
    if (errNombre)                 e.nombre    = errNombre;
    if (!form.precio)             e.precio    = "El precio es obligatorio";
    if (Number(form.precio) <= 0) e.precio    = "El precio debe ser mayor a 0";
    if (!form.categoria)          e.categoria = "Selecciona una categoría";
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleGuardar = () => {
    if (!validar()) return;
    onGuardar({ ...form, precio: Number(form.precio), imagen: imagenFile });
  };

  const opcionesCategoria = categorias.map((c) => ({ value: c.id, label: c.nombre }));

  return (
    <FormModal
      abierto={abierto}
      titulo={producto ? "Editar Producto" : "Nuevo Producto"}
      onCerrar={onCerrar}
      onGuardar={handleGuardar}
      cargando={cargando}
      textoGuardar={producto ? "Guardar cambios" : "Crear producto"}
      maxWidth="520px"
    >
      <InputField label="Nombre" value={form.nombre} onChange={set("nombre")}
        onBlur={handleBlurNombre} maxLength={LIMITES.NOMBRE}
        placeholder="Ej: Capuccino" required error={errores.nombre} />
      <InputField label="Descripción" value={form.descripcion} onChange={set("descripcion")}
        maxLength={LIMITES.DESCRIPCION}
        placeholder="Descripción opcional" rows={3} />
      <InputField label="Precio (S/)" type="number" value={form.precio} onChange={set("precio")}
        placeholder="0.00" required error={errores.precio} />
      <InputField label="Categoría" value={form.categoria} onChange={set("categoria")}
        options={opcionesCategoria} required error={errores.categoria} />

      <ImageUpload
        label="Imagen"
        value={producto?.imagen}
        onChange={setImagenFile}
      />
    </FormModal>
  );
}
