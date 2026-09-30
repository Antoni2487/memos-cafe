from rest_framework.permissions import BasePermission


class EsAdmin(BasePermission):
    """Solo usuarios del grupo 'admin'."""

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.groups.filter(name="admin").exists()
        )


class EsCajero(BasePermission):
    """Solo usuarios del grupo 'cajero'."""

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.groups.filter(name="cajero").exists()
        )


class EsMesero(BasePermission):
    """Solo usuarios del grupo 'mesero'."""

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.groups.filter(name="mesero").exists()
        )


class EsCocina(BasePermission):
    """Solo usuarios del grupo 'cocina'."""

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.groups.filter(name="cocina").exists()
        )


class EsAdminOCajero(BasePermission):
    """Admin o cajero."""

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.groups.filter(name__in=["admin", "cajero"]).exists()
        )


class EsAdminOMesero(BasePermission):
    """Admin o mesero."""

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.groups.filter(name__in=["admin", "mesero"]).exists()
        )


class EsAdminOCocina(BasePermission):
    """Admin o cocina."""

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.groups.filter(name__in=["admin", "cocina"]).exists()
        )


class TodosAutenticados(BasePermission):
    """Cualquier usuario autenticado (los 3 roles)."""

    def has_permission(self, request, view):
        return request.user.is_authenticated


class ModuloHabilitado(BasePermission):
    """Bloquea el acceso si PermisoRol dice que el rol del usuario no tiene
    el modulo habilitado. Admin siempre pasa (evita que un admin se
    bloquee a si mismo con sus propios toggles).

    Se usa JUNTO a (no en reemplazo de) las clases de permiso por grupo:
    solo puede restringir mas, nunca otorgar acceso que el grupo no
    tendria de por si. No instanciar directo — usar modulo_requerido().
    """

    modulo = None

    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated:
            return False
        if user.groups.filter(name="admin").exists():
            return True

        # apps.get_model en vez de "from memos_cafe.roles.models import
        # PermisoRol": utils/ es una hoja compartida por todas las apps y
        # no debe tener una dependencia de import en tiempo de compilacion
        # hacia una app de negocio especifica (ver .importlinter). El
        # registro de apps de Django resuelve el modelo en runtime sin
        # crear ese acoplamiento estatico.
        from django.apps import apps  # noqa: PLC0415 -- ver comentario de arriba

        PermisoRol = apps.get_model("roles", "PermisoRol")

        rol = user.groups.values_list("name", flat=True).first()
        if not rol:
            return False
        return PermisoRol.objects.filter(
            rol=rol,
            modulo=self.modulo,
            puede_acceder=True,
        ).exists()


def modulo_requerido(modulo):
    """Crea una subclase de ModuloHabilitado atada a un modulo fijo,
    instanciable sin argumentos (compatible con permission_classes=[...]
    y con get_permissions() -> [Clase(), ...])."""
    return type(f"ModuloHabilitado_{modulo}", (ModuloHabilitado,), {"modulo": modulo})
