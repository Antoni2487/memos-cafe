import { useState } from "react";
import { PencilRuler } from "lucide-react";
import { PageHeader, LoadingSpinner } from "../../components/common";
import authService from "../../services/authService";
import ListaMesas from "./ListaMesas";
import SalonVista from "./salon/SalonVista";
import EditorSalon from "./salon/EditorSalon";
import { useSalon } from "./salon/useSalon";

type Vista = "salon" | "lista" | "editor";

/**
 * Mesas: el croquis del salón en vivo (lo que usa el mesero todo el día),
 * la lista para administrarlas y, para el admin, el editor del croquis.
 */
export default function MesasPage() {
  const [vista, setVista] = useState<Vista>("salon");
  const esAdmin = authService.hasRole("admin");
  const salon = useSalon(vista !== "lista");

  return (
    <>
      <PageHeader
        titulo={vista === "editor" ? "Editar salón" : "Mesas"}
        descripcion={vista === "editor" ? "Acomoda el salón como es en la realidad" : "Toca una mesa para ver su pedido y atenderla"}
        accion={
          esAdmin && vista === "salon" ? (
            <button
              type="button"
              onClick={() => setVista("editor")}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-linea-fuerte bg-marfil px-4 text-sm font-semibold text-espresso hover:bg-arena"
            >
              <PencilRuler className="size-4" /> Editar salón
            </button>
          ) : undefined
        }
      />

      {vista !== "editor" && (
        <div className="mb-4 inline-flex rounded-xl bg-arena p-1" role="tablist" aria-label="Mesas">
          {([["salon", "Salón"], ["lista", "Administrar"]] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={vista === v}
              onClick={() => setVista(v)}
              className={`h-9 rounded-lg px-4 text-sm font-medium ${vista === v ? "bg-marfil text-espresso shadow-suave" : "text-suave"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {vista === "lista" && <ListaMesas />}

      {vista !== "lista" && (
        salon.cargando || !salon.plano ? (
          salon.error ? <p className="rounded-xl bg-peligro-fondo px-4 py-3 text-sm text-peligro">{salon.error}</p> : <LoadingSpinner texto="Cargando salón…" />
        ) : vista === "editor" ? (
          <EditorSalon
            plano={salon.plano}
            onGuardado={(p) => { salon.setPlano(p); setVista("salon"); }}
            onSalir={() => { salon.recargar(); setVista("salon"); }}
          />
        ) : (
          <SalonVista plano={salon.plano} onCambio={salon.recargar} />
        )
      )}
    </>
  );
}
