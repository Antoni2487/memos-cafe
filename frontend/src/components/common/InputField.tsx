import { useId } from "react";
import type { SelectOption } from "../../types";

interface InputFieldProps {
  label?: string;
  type?: string;
  value: string | number;
  onChange?: (value: string) => void;
  onBlur?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string | null;
  disabled?: boolean;
  options?: SelectOption<string | number>[];
  rows?: number;
  min?: string | number;
  max?: string | number;
  maxLength?: number;
}

// 16px en el celular: con menos, el iPhone hace zoom al tocar el campo.
const base =
  "w-full rounded-xl border bg-marfil px-3.5 text-base sm:text-sm text-espresso placeholder:text-tenue outline-none transition-[border-color,box-shadow] focus:border-salvia focus:ring-3 focus:ring-salvia/15 disabled:cursor-not-allowed disabled:bg-arena disabled:text-suave";

export default function InputField({
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  placeholder,
  required = false,
  error,
  disabled = false,
  options,
  rows,
  min,
  max,
  maxLength,
}: InputFieldProps) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const borde = error ? "border-peligro focus:border-peligro focus:ring-peligro/15" : "border-linea-fuerte";
  const comunes = {
    id,
    disabled,
    required,
    "aria-invalid": Boolean(error) || undefined,
    "aria-describedby": error || maxLength ? idAyuda : undefined,
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-espresso">
          {label}
          {required && <span className="ml-0.5 text-peligro" aria-hidden>*</span>}
        </label>
      )}

      {options ? (
        <select
          {...comunes}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={`${base} ${borde} h-11 cursor-pointer`}
        >
          <option value="">Selecciona…</option>
          {options.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      ) : rows ? (
        <textarea
          {...comunes}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={(e) => onBlur?.(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          className={`${base} ${borde} py-2.5 leading-relaxed resize-y`}
        />
      ) : (
        <input
          {...comunes}
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={(e) => onBlur?.(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          maxLength={maxLength}
          inputMode={type === "number" ? "decimal" : undefined}
          className={`${base} ${borde} h-11`}
        />
      )}

      {error ? (
        <p id={idAyuda} className="text-xs text-peligro">{error}</p>
      ) : (
        maxLength && typeof value === "string" && (
          <p id={idAyuda} className="text-right text-[11px] text-tenue tabular-nums">
            {value.length}/{maxLength}
          </p>
        )
      )}
    </div>
  );
}
