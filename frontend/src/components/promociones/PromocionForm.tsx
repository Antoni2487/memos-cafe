import { useState, useEffect } from "react";
import { FormModal, InputField, ImageUpload } from "../common";
import { esSoloAlfanumerico, LIMITES, MENSAJES } from "../../utils/validators";
import type { Promocion } from "../../types";
import type { PromocionFormData } from "../../services/promocionService";

interface PromocionFormProps {
  abierto: boolean;
  promocion: Promocion | null;
  onGuardar: (data: PromocionFormData) => void;
  onCerrar: () => void;
  cargando?: boolean;
}

interface FormState {
  nombre: string;
  descripcion: string;
  precio: string;
  fecha_inicio: string;
  fecha_fin: string;
}

export default function PromocionForm({ abierto, promocion, onGuardar, onCerrar, cargando }: PromocionFormProps) {
  const hoy = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<FormState>({
    nombre: "", descripcion: "", precio: "",
    fecha_inicio: hoy, fecha_fin: "",
  });
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [errores, setErrores] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (promocion) {
      setForm({
        nombre:       promocion.nombre       || "",
        descripcion:  promocion.descripcion  || "",
        precio:       String(promocion.precio ?? ""),
        fecha_inicio: promocion.fecha_inicio || hoy,
        fecha_fin:    promocion.fecha_fin    || "",
      });
    } else {
      setForm({ nombre: "", descripcion: "", precio: "", fecha_inicio: hoy, fecha_fin: "" });
    }
    setImagenFile(null);
    setErrores({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promocion, abierto]);

  const set = (campo: keyof FormState) => (val: string) => setForm((f) => ({ ...f, [campo]: val }));

  const minFechaInicio = hoy;

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
    if (errNombre)                   e.nombre      = errNombre;
    if (!form.precio)               e.precio      = "El precio es obligatorio";
    if (Number(form.precio) <= 0)   e.precio      = "El precio debe ser mayor a 0";

    if (!form.fecha_inicio) {
      e.fecha_inicio = "La fecha de inicio es obligatoria";
    } else if (form.fecha_inicio < hoy) {
      const esFechaOriginalSinTocar =
        promocion && form.fecha_inicio === promocion.fecha_inicio;
      if (!esFechaOriginalSinTocar) {
        e.fecha_inicio = "No se pueden poner fechas anteriores a hoy";
      }
    }

    if (!form.fecha_fin)            e.fecha_fin    = "La fecha de fin es obligatoria";
    if (form.fecha_inicio && form.fecha_fin && form.fecha_fin < form.fecha_inicio)
      e.fecha_fin = "La fecha de fin no puede ser anterior a la de inicio";

    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleGuardar = () => {
    if (!validar()) return;
    onGuardar({ ...form, precio: Number(form.precio), imagen: imagenFile });
  };

  return (
    <FormModal
      abierto={abierto}
      titulo={promocion ? "Editar Promoción" : "Nueva Promoción"}
      onCerrar={onCerrar}
      onGuardar={handleGuardar}
      cargando={cargando}
      textoGuardar={promocion ? "Guardar cambios" : "Crear promoción"}
      maxWidth="520px"
    >
      <InputField label="Nombre" value={form.nombre} onChange={set("nombre")}
        onBlur={handleBlurNombre} maxLength={LIMITES.NOMBRE}
        placeholder="Ej: Combo del día" required error={errores.nombre} />
      <InputField label="Descripción" value={form.descripcion} onChange={set("descripcion")}
        maxLength={LIMITES.DESCRIPCION}
        placeholder="Descripción opcional" rows={3} />
      <InputField label="Precio (S/)" type="number" value={form.precio} onChange={set("precio")}
        placeholder="0.00" required error={errores.precio} />

      <ImageUpload
        label="Imagen"
        value={promocion?.imagen}
        onChange={setImagenFile}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <InputField label="Fecha inicio" type="date" value={form.fecha_inicio}
          onChange={set("fecha_inicio")} required error={errores.fecha_inicio}
          min={minFechaInicio} />
        <InputField label="Fecha fin" type="date" value={form.fecha_fin}
          onChange={set("fecha_fin")} required error={errores.fecha_fin}
          min={form.fecha_inicio || hoy} />
      </div>
    </FormModal>
  );
}
