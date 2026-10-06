"""Reporte de tiempos: dónde se va el tiempo de un pedido.

Cada comanda (una ronda) guarda cuándo llegó a Cocina, cuándo se empezó,
cuándo quedó lista y cuándo se sirvió. Con eso se miden tres etapas, y
la cuenta agrega una cuarta (desde que la mesa la pide hasta que paga):

    llegó ──espera──▶ empezó ──preparación──▶ lista ──llevar──▶ servida
    pidió la cuenta ──cobro──▶ pagó

Se usan la mediana (el caso típico, no la arrastran unos pocos pedidos
eternos) y el percentil 90 ("9 de cada 10 tardan menos que esto").
Todo en segundos; el frontend los pasa a minutos.
"""

from collections import defaultdict
from dataclasses import dataclass
from dataclasses import field
from statistics import median
from statistics import quantiles

from django.utils import timezone

# Lo que se considera "a tiempo" del pedido a la mesa (llegó → servida).
OBJETIVO_MIN = 15
DEMORAS_MAX = 10  # cuántas comandas más lentas se listan

ETAPAS = [
    ("espera", "Espera en cocina", "Desde que llega el pedido hasta que se empieza"),
    ("preparacion", "Preparación", "Desde que se empieza hasta que está listo"),
    ("servir", "Llevar a la mesa", "Desde que está listo hasta que el mesero lo sirve"),
    ("cobro", "Cobro", "Desde que la mesa pide la cuenta hasta que paga"),
]


def _seg(desde, hasta) -> int | None:
    if not (desde and hasta) or hasta < desde:
        return None
    return int((hasta - desde).total_seconds())


def _p90(valores: list[int]) -> int:
    if len(valores) == 1:
        return valores[0]
    return int(quantiles(valores, n=10, method="inclusive")[-1])


def _resumen(valores: list[int]) -> dict:
    if not valores:
        return {"mediana": None, "p90": None, "n": 0}
    return {"mediana": int(median(valores)), "p90": _p90(valores), "n": len(valores)}


def _destino(orden) -> str:
    if orden.tipo_orden == "mesa" and orden.mesa_id:
        return f"Mesa {orden.mesa.numero}"
    if orden.tipo_orden == "delivery":
        return "Delivery"
    return "Para llevar"


NOMBRE_ETAPA = {clave: nombre for clave, nombre, _ in ETAPAS}


@dataclass
class _Acumulado:
    etapas: dict[str, list[int]] = field(default_factory=lambda: defaultdict(list))
    totales: list[int] = field(default_factory=list)
    por_hora: dict[int, list[int]] = field(default_factory=lambda: defaultdict(list))
    por_producto: dict[str, list[int]] = field(
        default_factory=lambda: defaultdict(list),
    )
    por_mesero: dict[str, list[int]] = field(default_factory=lambda: defaultdict(list))
    demoras: list[dict] = field(default_factory=list)

    def agregar(self, c) -> None:
        partes = {
            "espera": _seg(c.creada_en, c.iniciada_en),
            "preparacion": _seg(c.iniciada_en, c.lista_en),
            "servir": _seg(c.lista_en, c.entregada_en),
        }
        for clave, valor in partes.items():
            if valor is not None:
                self.etapas[clave].append(valor)

        if partes["preparacion"] is not None:
            # El tiempo es de la comanda: cada producto distinto que trae lo
            # comparte (no se mide por plato, sino "cuánto tardan las rondas
            # que lo incluyen").
            nombres = {
                (d.producto or d.promocion).nombre
                for d in c.detalles.all()
                if d.producto or d.promocion
            }
            for nombre in nombres:
                self.por_producto[nombre].append(partes["preparacion"])

        usuario = c.orden.usuario
        if partes["servir"] is not None and usuario:
            self.por_mesero[usuario.name or usuario.email].append(partes["servir"])

        total = _seg(c.creada_en, c.entregada_en)
        if total is None:
            return
        self.totales.append(total)
        self.por_hora[timezone.localtime(c.creada_en).hour].append(total)
        medidas = {k: v for k, v in partes.items() if v is not None}
        mas_larga = max(medidas, key=medidas.get, default=None)
        self.demoras.append(
            {
                "comanda_id": c.id,
                "fecha": c.creada_en,
                "destino": _destino(c.orden),
                "ronda": c.numero,
                "total": total,
                "etapa_mas_larga": NOMBRE_ETAPA.get(mas_larga),
            },
        )


def calcular(comandas, solicitudes_cobro) -> dict:
    """comandas: iterable de Comanda con orden, orden.mesa, orden.usuario y
    detalles (con producto/promoción) precargados. solicitudes_cobro:
    SolicitudCobro ya atendidas."""
    acc = _Acumulado()
    for c in comandas:
        acc.agregar(c)
    etapas, totales, demoras = acc.etapas, acc.totales, acc.demoras
    por_hora, por_producto, por_mesero = acc.por_hora, acc.por_producto, acc.por_mesero

    for s in solicitudes_cobro:
        cobro = _seg(s.solicitado_en, s.atendido_en)
        if cobro is not None:
            etapas["cobro"].append(cobro)

    objetivo_seg = OBJETIVO_MIN * 60
    a_tiempo = sum(1 for t in totales if t <= objetivo_seg)

    def ordenar_lentos(
        grupo: dict[str, list[int]],
        clave: str,
        cuenta: str,
    ) -> list[dict]:
        filas = [
            {"nombre": nombre, cuenta: len(v), clave: int(median(v))}
            for nombre, v in grupo.items()
        ]
        return sorted(filas, key=lambda f: f[clave], reverse=True)

    return {
        "objetivo_min": OBJETIVO_MIN,
        "total": {
            **_resumen(totales),
            "a_tiempo_pct": round(100 * a_tiempo / len(totales)) if totales else None,
        },
        "etapas": [
            {
                "clave": clave,
                "nombre": nombre,
                "descripcion": desc,
                **_resumen(etapas[clave]),
            }
            for clave, nombre, desc in ETAPAS
        ],
        "por_hora": [
            {"hora": h, "comandas": len(v), "mediana": int(median(v))}
            for h, v in sorted(por_hora.items())
        ],
        "por_producto": ordenar_lentos(por_producto, "mediana_preparacion", "rondas"),
        "por_mesero": ordenar_lentos(por_mesero, "mediana_servir", "rondas"),
        "demoras": sorted(demoras, key=lambda d: d["total"], reverse=True)[
            :DEMORAS_MAX
        ],
    }
