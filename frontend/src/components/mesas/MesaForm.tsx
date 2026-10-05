import { useState } from "react";
import { FormModal, InputField } from "../common";
import type { Mesa } from "../../types";
import { RANGOS, errorDeRango } from "../../utils/validators";
import type { MesaFormData } from "../../services/mesasService";

interface MesaFormProps {
  abierto: boolean;
  mesa: Mesa | null;
  onGuardar: (data: MesaFormData) => void;
  onCerrar: () => void;
  cargando?: boolean;
}

interface FormState {
  numero: string;
  capacidad: string;
}

function formInicial(mesa: MesaFormProps["mesa"]): FormState {
  return mesa
    ? { numero: String(mesa.numero || ""), capacidad: String(mesa.capacidad || "") }
    : { numero: "", capacidad: "" };
}

export default function MesaForm({ abierto, mesa, onGuardar, onCerrar, cargando }: MesaFormProps) {
  const [form, setForm] = useState<FormState>(() => formInicial(mesa));
  const [errores, setErrores] = useState<Partial<Record<keyof FormState, string>>>({});

  // Reinicia el formulario al abrirlo o al cambiar de mesa. Se hace durante
  // el render (y no en un useEffect) para evitar un render extra:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prev, setPrev] = useState({ mesa, abierto });
  if (prev.mesa !== mesa || prev.abierto !== abierto) {
    setPrev({ mesa, abierto });
    setForm(formInicial(mesa));
    setErrores({});
  }

  const set = (campo: keyof FormState) => (val: string) => setForm((f) => ({ ...f, [campo]: val }));

  const validar = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    const numero = form.numero ? errorDeRango(form.numero, RANGOS.MESA_NUMERO, "El número") : "El número es obligatorio";
    const capacidad = form.capacidad ? errorDeRango(form.capacidad, RANGOS.CAPACIDAD, "La capacidad") : "La capacidad es obligatoria";
    if (numero) e.numero = numero;
    if (capacidad) e.capacidad = capacidad;
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleGuardar = () => {
    if (!validar()) return;
    onGuardar({
      numero: Number(form.numero),
      capacidad: Number(form.capacidad),
    });
  };

  return (
    <FormModal
      abierto={abierto}
      titulo={mesa ? "Editar Mesa" : "Nueva Mesa"}
      onCerrar={onCerrar}
      onGuardar={handleGuardar}
      cargando={cargando}
      textoGuardar={mesa ? "Guardar cambios" : "Crear mesa"}
      maxWidth="420px"
    >
      <InputField
        label="Número de mesa"
        type="number"
        value={form.numero}
        onChange={set("numero")}
        placeholder="Ej: 5"
        rango={RANGOS.MESA_NUMERO}
        required
        error={errores.numero}
      />
      <InputField
        label="Capacidad (personas)"
        type="number"
        value={form.capacidad}
        onChange={set("capacidad")}
        placeholder="Ej: 4"
        rango={RANGOS.CAPACIDAD}
        required
        error={errores.capacidad}
      />
    </FormModal>
  );
}
