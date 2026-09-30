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

function formInicial(producto: Producto | null): FormState {
  return producto
    ? {
        nombre:      producto.nombre      || "",
        descripcion: producto.descripcion || "",
        precio:      String(producto.precio ?? ""),
        categoria:   String(producto.categoria ?? ""),
      }
    : { nombre: "", descripcion: "", precio: "", categoria: "" };
}

export default function ProductoForm({ abierto, producto, onGuardar, onCerrar, cargando }: ProductoFormProps) {
  const [form, setForm] = useState<FormState>(() => formInicial(producto));
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [errores, setErrores] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    categoriaService.listar().then((todas) => {
      const lista = todas.filter((c) => c.activo);
      setCategorias(lista);
    });
  }, []);

  // Reinicia el formulario al abrirlo o al cambiar de producto. Se hace durante
  // el render (y no en un useEffect) para evitar un render extra:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prev, setPrev] = useState({ producto, abierto });
  if (prev.producto !== producto || prev.abierto !== abierto) {
    setPrev({ producto, abierto });
    setForm(formInicial(producto));
    setImagenFile(null);
    setErrores({});
  }

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
