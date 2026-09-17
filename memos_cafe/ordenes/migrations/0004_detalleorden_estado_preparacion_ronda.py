import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ordenes', '0003_detalleorden_impreso'),
    ]

    operations = [
        migrations.AddField(
            model_name='detalleorden',
            name='estado_preparacion',
            field=models.CharField(
                choices=[
                    ('pendiente', 'Pendiente'),
                    ('en_preparacion', 'En preparación'),
                    ('listo', 'Listo'),
                    ('entregado', 'Entregado'),
                ],
                default='pendiente',
                max_length=15,
            ),
        ),
        migrations.AddField(
            model_name='detalleorden',
            name='ronda',
            field=models.PositiveSmallIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='detalleorden',
            name='fecha_creacion',
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
    ]
