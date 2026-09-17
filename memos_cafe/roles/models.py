from django.db import models


MODULOS = [
    ("dashboard", "Dashboard"),
    ("mesas",     "Mesas"),
    ("ordenes",   "Órdenes"),
    ("caja",      "Caja"),
    ("productos", "Productos"),
    ("insumos",   "Insumos"),
    ("reportes",  "Reportes"),
    ("usuarios",  "Usuarios"),
    ("ordenes_cocina", "Cocina — Pedidos"),
]

ROLES = [
    ("admin",   "Admin"),
    ("cajero",  "Cajero"),
    ("mesero",  "Mesero"),
    ("cocina",  "Cocina"),
]


class PermisoRol(models.Model):
    modulo        = models.CharField(max_length=50, choices=MODULOS)
    rol           = models.CharField(max_length=50, choices=ROLES)
    puede_acceder = models.BooleanField(default=False)

    class Meta:
        unique_together = ("modulo", "rol")
        ordering        = ["modulo", "rol"]
        verbose_name    = "Permiso de Rol"
        verbose_name_plural = "Permisos de Roles"

    def __str__(self):
        return f"{self.rol} — {self.modulo}: {'✅' if self.puede_acceder else '❌'}"
