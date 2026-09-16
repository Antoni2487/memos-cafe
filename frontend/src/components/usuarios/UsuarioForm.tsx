import { useState, useEffect } from "react";
import { FormModal, InputField } from "../common";
import { ROLES } from "../../utils/constants";
import { esSoloAlfabetico, esEmailValido, LIMITES, MENSAJES } from "../../utils/validators";
import type { Usuario } from "../../types";
import type { UsuarioFormData } from "../../services/usuarioService";

const ROLES_OPTIONS = [
  { value: ROLES.ADMIN,   label: "Admin" },
  { value: ROLES.CAJERO,  label: "Cajero" },
  { value: ROLES.MESERO,  label: "Mesero" },
];

interface UsuarioFormProps {
  abierto: boolean;
  usuario: Usuario | null;
  onGuardar: (data: UsuarioFormData) => void;
  onCerrar: () => void;
  cargando?: boolean;
}

interface FormState {
  name: string;
  email: string;
  password: string;
  group_name: string;
}

type Campo = keyof FormState;

export default function UsuarioForm({ abierto, usuario, onGuardar, onCerrar, cargando }: UsuarioFormProps) {
  const [form, setForm] = useState<FormState>({ name: "", email: "", password: "", group_name: "" });
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});

  useEffect(() => {
    if (usuario) {
      setForm({
        name: usuario.name || "",
        email: usuario.email,
        password: "",
        group_name: usuario.groups?.[0]?.name ?? "",
      });
    } else {
      setForm({ name: "", email: "", password: "", group_name: "" });
    }
    setErrores({});
  }, [usuario, abierto]);

  const set = (campo: Campo) => (val: string) => setForm((f) => ({ ...f, [campo]: val }));

  const validarCampo = (campo: Campo, valor: string): string | null => {
    switch (campo) {
      case "name":
        if (valor && !esSoloAlfabetico(valor)) return MENSAJES.SOLO_ALFABETICO;
        return null;
      case "email":
        if (!valor) return "El email es obligatorio";
        if (!esEmailValido(valor)) return MENSAJES.EMAIL_INVALIDO;
        return null;
      case "password":
        if (!usuario && !valor) return "La contraseña es obligatoria";
        if (valor && valor.length < 8) return "Mínimo 8 caracteres";
        return null;
      default:
        return null;
    }
  };

  const handleBlur = (campo: Campo) => (valor: string) => {
    setErrores((prev) => ({ ...prev, [campo]: validarCampo(campo, valor) || undefined }));
  };

  const validar = (): boolean => {
    const e: Partial<Record<Campo, string>> = {};
    (["name", "email", "password"] as Campo[]).forEach((campo) => {
      const msg = validarCampo(campo, form[campo]);
      if (msg) e[campo] = msg;
    });
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleGuardar = () => {
    if (!validar()) return;
    const datos: UsuarioFormData = { name: form.name, email: form.email, group_name: form.group_name };
    if (form.password) datos.password = form.password;
    onGuardar(datos);
  };

  return (
    <FormModal
      abierto={abierto}
      titulo={usuario ? "Editar Usuario" : "Nuevo Usuario"}
      onCerrar={onCerrar}
      onGuardar={handleGuardar}
      cargando={cargando}
      textoGuardar={usuario ? "Guardar cambios" : "Crear usuario"}
    >
      <InputField
        label="Nombre"
        value={form.name}
        onChange={set("name")}
        onBlur={handleBlur("name")}
        placeholder="Nombre completo"
        maxLength={LIMITES.NOMBRE_USUARIO}
        error={errores.name}
      />
      <InputField
        label="Email"
        type="email"
        value={form.email}
        onChange={set("email")}
        onBlur={handleBlur("email")}
        placeholder="correo@ejemplo.com"
        required
        maxLength={LIMITES.EMAIL}
        error={errores.email}
      />
      <InputField
        label={usuario ? "Nueva contraseña (opcional)" : "Contraseña"}
        type="password"
        value={form.password}
        onChange={set("password")}
        onBlur={handleBlur("password")}
        placeholder="***********"
        required={!usuario}
        maxLength={LIMITES.PASSWORD}
        error={errores.password}
      />
      <InputField
        label="Rol"
        value={form.group_name}
        onChange={set("group_name")}
        options={ROLES_OPTIONS}
      />
    </FormModal>
  );
}
