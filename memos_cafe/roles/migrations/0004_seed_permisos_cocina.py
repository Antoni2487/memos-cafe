from django.db import migrations


# Agrega el rol "cocina" a todos los modulos existentes (sin acceso, salvo
# el suyo propio) y siembra el modulo nuevo "ordenes_cocina" para los 4
# roles. Mismo patron get_or_create + RunPython que 0002_seed_permisos.py.
VALORES = {
    "dashboard":      {"cocina": False},
    "mesas":          {"cocina": False},
    "ordenes":        {"cocina": False},
    "caja":           {"cocina": False},
    "productos":      {"cocina": False},
    "insumos":        {"cocina": False},
    "reportes":       {"cocina": False},
    "usuarios":       {"cocina": False},
    "ordenes_cocina": {"admin": True, "cajero": False, "mesero": False, "cocina": True},
}


def sembrar_permisos(apps, schema_editor):
    PermisoRol = apps.get_model("roles", "PermisoRol")
    for modulo, por_rol in VALORES.items():
        for rol, puede_acceder in por_rol.items():
            PermisoRol.objects.get_or_create(
                modulo=modulo, rol=rol,
                defaults={"puede_acceder": puede_acceder},
            )


def eliminar_permisos(apps, schema_editor):
    PermisoRol = apps.get_model("roles", "PermisoRol")
    for modulo, por_rol in VALORES.items():
        PermisoRol.objects.filter(modulo=modulo, rol__in=por_rol.keys()).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("roles", "0003_alter_permisorol_modulo_alter_permisorol_rol"),
    ]

    operations = [
        migrations.RunPython(sembrar_permisos, eliminar_permisos),
    ]
