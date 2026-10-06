from django.urls import include
from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from memos_cafe.reportes.views import AlertasView
from memos_cafe.reportes.views import DashboardView
from memos_cafe.reportes.views import HealthCheckView
from memos_cafe.reportes.views import ReporteCajaExportView
from memos_cafe.reportes.views import ReporteCajaView
from memos_cafe.reportes.views import ReporteOrdenesExportView
from memos_cafe.reportes.views import ReporteOrdenesView
from memos_cafe.reportes.views import ReporteProductosExportView
from memos_cafe.reportes.views import ReporteProductosView
from memos_cafe.reportes.views import ReporteTiemposView
from memos_cafe.reportes.views import ReporteVentasExportView
from memos_cafe.reportes.views import ReporteVentasView
from memos_cafe.users.api.views import CustomTokenBlacklistView
from memos_cafe.users.api.views import CustomTokenObtainPairView
from memos_cafe.users.api.views import UserViewSet

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")

urlpatterns = [
    # Auth JWT
    path("auth/login/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/logout/", CustomTokenBlacklistView.as_view(), name="token_blacklist"),
    # Monitoreo
    path("health/", HealthCheckView.as_view(), name="health-check"),
    # Users
    path("alertas/", AlertasView.as_view(), name="alertas"),
    path("", include(router.urls)),
    path("roles/", include("memos_cafe.roles.urls")),
    # Apps
    path("mesas/", include("memos_cafe.mesas.urls")),
    path("productos/", include("memos_cafe.productos.urls")),
    path("ordenes/", include("memos_cafe.ordenes.urls")),
    path("caja/", include("memos_cafe.caja.urls")),
    path("insumos/", include("memos_cafe.insumos.urls")),
    # Reportes y Dashboard
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("reportes/ventas/", ReporteVentasView.as_view(), name="reporte-ventas"),
    path(
        "reportes/ventas/export/",
        ReporteVentasExportView.as_view(),
        name="reporte-ventas-export",
    ),
    path(
        "reportes/productos/export/",
        ReporteProductosExportView.as_view(),
        name="reporte-productos-export",
    ),
    path(
        "reportes/productos/",
        ReporteProductosView.as_view(),
        name="reporte-productos",
    ),
    path(
        "reportes/caja/export/",
        ReporteCajaExportView.as_view(),
        name="reporte-caja-export",
    ),
    path("reportes/caja/", ReporteCajaView.as_view(), name="reporte-caja"),
    path("reportes/ordenes/", ReporteOrdenesView.as_view(), name="reporte-ordenes"),
    path("reportes/tiempos/", ReporteTiemposView.as_view(), name="reporte-tiempos"),
    path(
        "reportes/ordenes/export/",
        ReporteOrdenesExportView.as_view(),
        name="reporte-ordenes-export",
    ),
]
