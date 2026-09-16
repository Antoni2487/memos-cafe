import logging
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand

logger = logging.getLogger("memos_cafe.mantenimiento")

# Modelos que no aportan valor a un backup de negocio (cache de permisos,
# sesiones, y el propio historial de auditlog que puede pesar mucho y se
# regenera solo con el uso normal del sistema).
APPS_EXCLUIDAS = [
    "contenttypes",
    "auth.permission",
    "sessions",
    "admin.logentry",
    "auditlog.logentry",
]

BACKUPS_A_CONSERVAR = 7


class Command(BaseCommand):
    """Genera un backup en JSON de los datos de negocio (dumpdata) y rota
    los backups viejos, dejando solo los ultimos N.

    Se eligio dumpdata en vez de pg_dump porque no depende de tener el
    cliente de PostgreSQL instalado en el contenedor/servidor -- usa
    unicamente Django, y por lo tanto funciona igual en local (Docker) y en
    produccion (Render + Neon), sin importar el motor de base de datos.
    """

    help = "Genera un backup JSON de la base de datos y rota los backups antiguos."

    def handle(self, *args, **options):
        carpeta_backups = Path(settings.BASE_DIR) / "backups"
        carpeta_backups.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        archivo_backup = carpeta_backups / f"backup_{timestamp}.json"

        try:
            with archivo_backup.open("w", encoding="utf-8") as f:
                call_command(
                    "dumpdata",
                    exclude=APPS_EXCLUIDAS,
                    indent=2,
                    stdout=f,
                )
        except Exception:
            logger.exception("Backup de BD FALLIDO")
            archivo_backup.unlink(missing_ok=True)
            raise

        tamano_kb = round(archivo_backup.stat().st_size / 1024, 1)
        logger.info("Backup de BD OK | archivo=%s | tamano_kb=%s", archivo_backup.name, tamano_kb)
        self.stdout.write(self.style.SUCCESS(f"Backup creado: {archivo_backup} ({tamano_kb} KB)"))

        self._rotar_backups_viejos(carpeta_backups)

    def _rotar_backups_viejos(self, carpeta_backups):
        backups = sorted(carpeta_backups.glob("backup_*.json"), key=lambda p: p.stat().st_mtime)
        sobrantes = backups[:-BACKUPS_A_CONSERVAR] if len(backups) > BACKUPS_A_CONSERVAR else []
        for backup_viejo in sobrantes:
            backup_viejo.unlink()
            logger.info("Backup rotado (eliminado por antiguedad) | archivo=%s", backup_viejo.name)
