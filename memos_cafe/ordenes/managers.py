from django.apps import apps
from django.db import models
from django.db.models import Prefetch


class OrdenManager(models.Manager):
    def abiertas(self):
        """Órdenes abiertas con detalles prefetcheados — evita N+1."""
        DetalleOrden = apps.get_model("ordenes", "DetalleOrden")
        return (
            self.filter(estado="abierta")
            .select_related("mesa", "usuario")
            .prefetch_related(
                Prefetch(
                    "detalles",
                    queryset=DetalleOrden.objects.select_related(
                        "producto",
                        "producto__categoria",
                        "promocion",
                    ),
                ),
            )
        )

    def abiertas_por_usuario(self, usuario):
        """Órdenes abiertas de un mesero específico."""
        return self.abiertas().filter(usuario=usuario)

    def con_detalles(self):
        """Cualquier orden con sus detalles y pagos completados prefetcheados
        — evita N+1 en OrdenReadSerializer.get_pagos_resumen(), que antes
        hacia un obj.pagos.filter(...) por cada orden listada."""
        DetalleOrden = apps.get_model("ordenes", "DetalleOrden")
        # apps.get_model en vez de import directo de memos_cafe.caja.models:
        # ordenes/managers.py es importado por ordenes/models.py, y
        # caja/models.py ya importa Orden desde ordenes/models.py -- un
        # import estatico aca crearia un ciclo. Mismo patron que
        # memos_cafe.utils.permissions.ModuloHabilitado.
        Pago = apps.get_model("caja", "Pago")
        SolicitudCobro = apps.get_model("caja", "SolicitudCobro")
        return self.select_related("mesa", "usuario").prefetch_related(
            Prefetch(
                "detalles",
                queryset=DetalleOrden.objects.select_related(
                    "producto",
                    "producto__categoria",
                    "promocion",
                ),
            ),
            Prefetch(
                "pagos",
                queryset=Pago.objects.filter(estado="completado"),
            ),
            # "Pidió la cuenta" por QR (Caja las muestra primero)
            Prefetch(
                "solicitudes_cobro",
                queryset=SolicitudCobro.objects.filter(atendido_en__isnull=True),
                to_attr="cuentas_pendientes",
            ),
        )
