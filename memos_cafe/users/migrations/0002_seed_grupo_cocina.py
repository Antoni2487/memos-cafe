from django.db import migrations


# No existe un mecanismo de seed de Group en produccion (admin/cajero/mesero
# se crearon a mano). Para "cocina" si lo automatizamos via migracion de
# datos, mismo patron RunPython que roles/migrations/0002_seed_permisos.py.
def crear_grupo_cocina(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Group.objects.get_or_create(name="cocina")


def eliminar_grupo_cocina(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Group.objects.filter(name="cocina").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0001_initial"),
        ("auth", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(crear_grupo_cocina, eliminar_grupo_cocina),
    ]
