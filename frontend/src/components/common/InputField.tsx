import type { CSSProperties } from "react";
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
  const baseStyle: CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "8px",
    border: `1px solid ${error ? "#c62828" : "rgba(44,85,69,0.2)"}`,
    fontFamily: "'Lato', sans-serif",
    fontSize: "13.5px",
    color: "#333",
    backgroundColor: disabled ? "#f9f9f9" : "white",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      {label && (
        <label
          style={{
            fontFamily: "'Lato', sans-serif",
            fontSize: "11px",
            fontWeight: 700,
            color: "rgba(44,85,69,0.75)",
            letterSpacing: "0.07em",
            textTransform: "uppercase",
          }}
        >
          {label}
          {required && <span style={{ color: "#c62828", marginLeft: 3 }}>*</span>}
        </label>
      )}

      {/* Select */}
      {options ? (
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          required={required}
          style={{ ...baseStyle, cursor: disabled ? "not-allowed" : "pointer" }}
        >
          <option value="">— Selecciona —</option>
          {options.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>

      /* Textarea */
      ) : rows ? (
        <textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={(e) => onBlur?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          rows={rows}
          maxLength={maxLength}
          style={{ ...baseStyle, resize: "vertical", lineHeight: 1.5 }}
        />

      /* Input normal */
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          min={min}
          max={max}
          maxLength={maxLength}
          style={baseStyle}
          onFocus={(e) => { if (!error) e.target.style.borderColor = "#2C5545"; }}
          onBlur={(e) => {
            if (!error) e.target.style.borderColor = "rgba(44,85,69,0.2)";
            onBlur?.(e.target.value);
          }}
        />
      )}

      {/* Ayuda de límite de caracteres */}
      {maxLength && typeof value === "string" && !error && (
        <p
          style={{
            fontFamily: "'Lato', sans-serif",
            fontSize: "10.5px",
            color: "rgba(44,85,69,0.4)",
            margin: 0,
            textAlign: "right",
          }}
        >
          {value.length}/{maxLength}
        </p>
      )}

      {/* Error */}
      {error && (
        <p
          style={{
            fontFamily: "'Lato', sans-serif",
            fontSize: "11.5px",
            color: "#c62828",
            margin: 0,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
