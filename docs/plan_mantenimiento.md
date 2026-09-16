# Plan de Mantenimiento — Memo's Café

## 1. Objetivo

Cubrir lo exigido en la rúbrica para "Mantenimiento del proyecto": **cron jobs, backups y scripts** reales, funcionando contra el sistema ya desplegado — no un ejercicio aparte.

---

## 2. Herramientas usadas y por qué

| Herramienta | Para qué | Por qué esta y no otra |
|---|---|---|
| **`dumpdata` de Django** (envuelto en un comando propio `backup_bd`) | Generar un backup completo de los datos de negocio | No depende de tener el cliente `pg_dump` instalado en el servidor — usa solo Django, así que funciona igual en local (Docker + Postgres) y en producción (Render + Neon), sin importar el motor de BD por debajo. |
| **`flushexpiredtokens`** (comando built-in de `rest_framework_simplejwt.token_blacklist`, ya instalado en el proyecto) | Purgar tokens JWT expirados de la tabla de blacklist | Ya viene con la librería de JWT que el proyecto usa — sin necesidad de escribir ni mantener código nuevo para esto. Sin esta limpieza periódica, la tabla de tokens crece indefinidamente. |
| **GitHub Actions (`schedule: cron`)** | Ejecutar ambos comandos automáticamente todos los días | Es gratuito y no depende del plan de hosting. Render sí ofrece "Cron Jobs" nativos, pero requieren una instancia de pago aparte; GitHub Actions ya se usa en el proyecto para CI (`.github/workflows/ci.yml`), así que no se agrega infraestructura nueva. |

---

## 3. Cómo se implementó

### 3.1 Backup de base de datos (`backup_bd`)

Comando nuevo: `memos_cafe/utils/management/commands/backup_bd.py`. Se registró `memos_cafe.utils` como app de Django (`config/settings/base.py`, `LOCAL_APPS`) para que Django pueda descubrir el comando.

```python
class Command(BaseCommand):
    """Genera un backup en JSON de los datos de negocio (dumpdata) y rota
    los backups viejos, dejando solo los ultimos N."""

    def handle(self, *args, **options):
        carpeta_backups = Path(settings.BASE_DIR) / "backups"
        carpeta_backups.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        archivo_backup = carpeta_backups / f"backup_{timestamp}.json"

        with archivo_backup.open("w", encoding="utf-8") as f:
            call_command("dumpdata", exclude=APPS_EXCLUIDAS, indent=2, stdout=f)

        logger.info("Backup de BD OK | archivo=%s | tamano_kb=%s", ...)
        self._rotar_backups_viejos(carpeta_backups)  # conserva solo los ultimos 7
```

Se excluyen del backup: `contenttypes`, `auth.permission`, `sessions`, `admin.logentry`, `auditlog.logentry` — son datos que se regeneran solos con el uso del sistema y no aportan valor si se necesita restaurar.

### 3.2 Limpieza de tokens JWT expirados

No requirió código nuevo — `rest_framework_simplejwt.token_blacklist` (ya en `INSTALLED_APPS`) trae el comando `flushexpiredtokens` listo para usar.

### 3.3 Script combinado (`compose/production/django/mantenimiento_diario`)

```bash
#!/bin/bash
set -o errexit
set -o pipefail
set -o nounset

python /app/manage.py flushexpiredtokens
python /app/manage.py backup_bd
```

Se agregó al `Dockerfile` de producción (mismo patrón que `/entrypoint` y `/start`) para que quede disponible dentro de la misma imagen que ya corre en Render — no se necesita una imagen ni un contenedor aparte.

### 3.4 Programación automática (GitHub Actions)

`.github/workflows/mantenimiento_diario.yml`:
```yaml
on:
  schedule:
    - cron: '0 5 * * *'  # 05:00 UTC = 00:00 hora de Lima, todos los dias
  workflow_dispatch: {}   # tambien se puede correr manualmente desde Actions
```
Corre `flushexpiredtokens` y `backup_bd` contra la base de datos de producción (Neon), usando `DATABASE_URL` como GitHub Secret, y sube el archivo de backup generado como artefacto descargable (retención de 30 días) desde la pestaña "Actions" del repositorio.

**Pendiente de activar:** hay que agregar estos 3 secrets en `Settings → Secrets and variables → Actions` del repositorio de GitHub (los mismos valores que ya están configurados como variables de entorno en Render):
- `DATABASE_URL`
- `DJANGO_SECRET_KEY`
- `DJANGO_ADMIN_URL`

---

## 4. Resultado real obtenido (evidencia)

Se probó el flujo completo contra la base de datos real del contenedor local (`memos_cafe_local_postgres`), no simulado:

**Ejecución de `backup_bd`:**
```
$ docker exec memos_cafe_local_django python manage.py backup_bd
INFO  Backup de BD OK | archivo=backup_20260720_180731.json | tamano_kb=67.5
Backup creado: /app/backups/backup_20260720_180731.json (67.5 KB)
```

**Rotación de backups verificada:** se ejecutó el comando 8 veces seguidas — al superar el límite de 7, el sistema borró automáticamente los más antiguos:
```
INFO  Backup de BD OK | archivo=backup_20260720_181320.json | tamano_kb=67.5
INFO  Backup rotado (eliminado por antiguedad) | archivo=backup_20260720_180731.json
...
$ docker exec memos_cafe_local_django ls /app/backups/ | wc -l
7
```

**Script combinado (`mantenimiento_diario`) probado de punta a punta dentro del contenedor:**
```
$ docker exec memos_cafe_local_django bash /app/mantenimiento_diario_test
INFO  Backup de BD OK | archivo=backup_20260720_181039.json | tamano_kb=67.5
Backup creado: /app/backups/backup_20260720_181039.json (67.5 KB)
```
(`flushexpiredtokens` corrió antes sin error — es silencioso cuando no hay tokens que purgar, comportamiento esperado del comando).

**Suite de tests completa corrida después del cambio, sin regresiones nuevas:**
```
12 failed, 228 passed, 66 warnings in 25.54s
```
Los 12 fallos son preexistentes y no relacionados (lógica de negocio de `caja` y generación de schema OpenAPI, ya documentados) — no hay ningún fallo nuevo causado por agregar la app `memos_cafe.utils` o el comando `backup_bd`.

---

## 5. Pendiente / próximos pasos

1. **Activar el cron real:** agregar los 3 secrets de GitHub listados en la sección 3.4. Sin esto, el workflow existe pero no puede correr contra Neon todavía.
2. **Primera corrida real contra producción:** una vez activados los secrets, correr el workflow manualmente (`workflow_dispatch`) desde la pestaña Actions para confirmar que el backup real de Neon se genera correctamente, y documentar esa evidencia.
3. **Opcional (redundancia extra):** Neon incluye recuperación de datos propia a nivel de plataforma (branching / restore point) — se recomienda revisar el dashboard de Neon como una segunda capa de respaldo, independiente de este backup en JSON.

---

## 6. Cómo demostrarlo en la exposición

1. Mostrar el código de `backup_bd.py` y explicar la decisión de usar `dumpdata` en vez de `pg_dump`.
2. Correr `docker exec memos_cafe_local_django python manage.py backup_bd` en vivo y mostrar el archivo generado.
3. Mostrar la pestaña **Actions** de GitHub con el workflow `Mantenimiento diario` (aunque sea su primera corrida manual) como evidencia del cron job real.
4. Mencionar `flushexpiredtokens` y explicar por qué hace falta (evitar que la tabla de tokens invalidados crezca indefinidamente).
