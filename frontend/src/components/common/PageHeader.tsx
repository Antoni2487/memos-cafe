import type { ReactNode } from "react";

interface PageHeaderProps {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}

/**
 * Encabezado de cada sección. En el celular el título ya está en la barra
 * superior, así que aquí solo queda la descripción y la acción principal
 * (que ocupa todo el ancho, fácil de tocar).
 */
export default function PageHeader({ titulo, descripcion, accion }: PageHeaderProps) {
  return (
    <div className="mb-5 md:mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="hidden md:block font-display text-[26px] font-semibold leading-tight text-espresso">
          {titulo}
        </h2>
        {descripcion && <p className="text-sm text-suave md:mt-1">{descripcion}</p>}
      </div>
      {accion && <div className="shrink-0 [&>button]:w-full sm:[&>button]:w-auto">{accion}</div>}
    </div>
  );
}
