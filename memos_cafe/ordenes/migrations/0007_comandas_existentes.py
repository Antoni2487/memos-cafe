"""Agrupa los items que ya existen en comandas: una por cada (orden, ronda).

El estado de cada comanda sale del de sus items. Las ordenes ya cerradas o
anuladas quedan como entregadas. Los tiempos de inicio, lista y entrega
quedan vacios: no se registraban antes, y los reportes de tiempos los
ignoran.
"""

from django.db import migrations


def _estado(estados_items, orden_abierta):
    if not orden_abierta or all(e == "entregado" for e in estados_items):
        return "entregada"
    if all(e in ("listo", "entregado") for e in estados_items):
        return "lista"
    if any(e != "pendiente" for e in estados_items):
        return "en_preparacion"
    return "pendiente"


def crear_comandas(apps, schema_editor):
    detalle_model = apps.get_model("ordenes", "DetalleOrden")
    comanda_model = apps.get_model("ordenes", "Comanda")

    # Un solo recorrido de los items, ordenados por (orden, ronda): cada
    # cambio de par cierra una comanda.
    filas = (
        detalle_model.objects.filter(comanda__isnull=True)
        .order_by("orden_id", "ronda")
        .values_list("orden_id", "ronda", "estado_preparacion", "orden__estado")
    )
    por_crear = []
    actual = None
    estados = []
    abierta = False

    def cerrar():
        if actual is not None:
            por_crear.append(
                comanda_model(
                    orden_id=actual[0],
                    numero=actual[1],
                    estado=_estado(estados, abierta),
                ),
            )

    for orden_id, ronda, estado_item, estado_orden in filas.iterator(chunk_size=5000):
        if (orden_id, ronda) != actual:
            cerrar()
            actual, estados, abierta = (orden_id, ronda), [], estado_orden == "abierta"
            if len(por_crear) >= 5000:  # noqa: PLR2004
                comanda_model.objects.bulk_create(por_crear)
                por_crear = []
        estados.append(estado_item)
    cerrar()
    comanda_model.objects.bulk_create(por_crear)

    # creada_en: la hora del primer item de la comanda (bulk_create la dejo
    # con la hora de la migracion por auto_now_add).
    schema_editor.execute(
        """
        UPDATE comanda c SET creada_en = d.desde
        FROM (
            SELECT orden_id, ronda, MIN(fecha_creacion) AS desde
            FROM detalle_orden GROUP BY orden_id, ronda
        ) d
        WHERE c.orden_id = d.orden_id AND c.numero = d.ronda
        """,
    )
    schema_editor.execute(
        """
        UPDATE detalle_orden d SET comanda_id = c.id
        FROM comanda c
        WHERE d.comanda_id IS NULL AND c.orden_id = d.orden_id AND c.numero = d.ronda
        """,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("ordenes", "0006_comanda"),
    ]

    operations = [
        migrations.RunPython(crear_comandas, migrations.RunPython.noop),
    ]
