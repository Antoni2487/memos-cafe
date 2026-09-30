# Tres pasos porque la tabla ya tiene mesas: un AddField unique con default
# callable calcula el default una sola vez y se lo pone a todas las filas,
# lo que violaria el unique. Se agrega nullable, se completa uno por uno y
# recien ahi se marca unique y no nulo.
from django.db import migrations
from django.db import models

import memos_cafe.mesas.models


def asignar_codigos(apps, schema_editor):
    Mesa = apps.get_model("mesas", "Mesa")
    for mesa in Mesa.objects.filter(codigo_qr__isnull=True):
        mesa.codigo_qr = memos_cafe.mesas.models.generar_codigo_qr()
        mesa.save(update_fields=["codigo_qr"])


class Migration(migrations.Migration):
    dependencies = [
        ("mesas", "0002_sesionmesaqr"),
    ]

    operations = [
        migrations.AddField(
            model_name="mesa",
            name="codigo_qr",
            field=models.CharField(max_length=16, null=True, editable=False),
        ),
        migrations.RunPython(asignar_codigos, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="mesa",
            name="codigo_qr",
            field=models.CharField(
                default=memos_cafe.mesas.models.generar_codigo_qr,
                editable=False,
                max_length=16,
                unique=True,
            ),
        ),
    ]
