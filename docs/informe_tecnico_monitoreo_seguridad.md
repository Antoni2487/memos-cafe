# Informe Técnico — Monitoreo, Trazas de BD y Pruebas de Seguridad
### Memo's Café — para incorporar al documento general del proyecto

Este documento detalla, con evidencia real (comandos, respuestas, código), cada herramienta usada para Monitoreo y Pruebas de Seguridad: **qué es, para qué se usó, cómo se configuró, y qué resultado dio**.

---

## PARTE 1 — LOGGING (registro de eventos de la aplicación)

### Herramienta
**Sistema de logging nativo de Python/Django** (`logging` + `RotatingFileHandler`). No es una librería externa: viene incluido en Django, se configura declarativamente en `config/settings/base.py` bajo la clave `LOGGING`.

### Cómo se configuró
Cada capa de servicio (`caja`, `ordenes`, `reportes`, `users`) obtiene su propio logger con nombre jerárquico:

```python
# memos_cafe/caja/services.py
import logging
logger = logging.getLogger("memos_cafe.caja")
```

Los handlers escriben a dos archivos rotativos en `logs/` (para no llenar el disco con el tiempo) y también a consola (para que aparezcan en el panel "Logs" de Render en producción):
- `logs/memos_cafe.log` — todos los eventos INFO en adelante.
- `logs/errores.log` — solo ERROR y superiores.

### Dónde se instrumentó (código real agregado)
| Archivo | Evento registrado |
|---|---|
| `memos_cafe/users/api/views.py` (`CustomTokenObtainPairView.post`) | Login exitoso / login fallido, con email e IP |
| `memos_cafe/users/api/views.py` (`CustomTokenBlacklistView.post`) | Logout, con usuario resuelto e IP |
| `memos_cafe/caja/services.py` (`CajaService`) | Apertura y cierre de sesión de caja |
| `memos_cafe/caja/services.py` (`PagoService`) | Pago procesado, pago anulado |
| `memos_cafe/caja/services.py` (`ComprobanteService`) | Emisión de comprobante |

### Código real (login/logout)
```python
def post(self, request, *args, **kwargs):
    email_intento = request.data.get("email", "")
    serializer = self.get_serializer(data=request.data)
    try:
        serializer.is_valid(raise_exception=True)
    except Exception:
        logger.warning("Login FALLIDO | email=%s | ip=%s", email_intento, request.META.get("REMOTE_ADDR"))
        return Response({"detail": "Credenciales inválidas."}, status=status.HTTP_401_UNAUTHORIZED)
    user = serializer.user
    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])
    logger.info("Login exitoso | usuario=%s | ip=%s", user.email, request.META.get("REMOTE_ADDR"))
    return Response(serializer.validated_data, status=status.HTTP_200_OK)
```

```python
class CustomTokenBlacklistView(TokenBlacklistView):
    def post(self, request, *args, **kwargs):
        usuario = "desconocido"
        try:
            # Hay que leer el user_id ANTES de invalidar el token:
            # una vez blacklisteado, decodificarlo de nuevo lanza TokenError.
            token = RefreshToken(request.data.get("refresh"))
            usuario = User.objects.get(pk=token["user_id"]).email
        except Exception:
            pass
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            logger.info("Logout | usuario=%s | ip=%s", usuario, request.META.get("REMOTE_ADDR"))
        return response
```

### Resultado real obtenido (capturado en consola/logs)
```
INFO  Login exitoso | usuario=qa.monitoreo@test.local | ip=172.20.0.1
WARNING  Login FALLIDO | email=qa.monitoreo@test.local | ip=172.20.0.1
INFO  Logout | usuario=qa.monitoreo@test.local | ip=172.20.0.1
```

**Interpretación:** con esto se puede detectar fuerza bruta (muchos "Login FALLIDO" seguidos desde la misma IP), auditar accesos legítimos, y saber exactamente cuándo se procesó o anuló cada pago (con orden, monto y método).

---

## PARTE 2 — TRAZAS EN BASE DE DATOS

### Herramienta
**`django-auditlog`** versión `3.4.1` (declarada en `pyproject.toml`, instalada con `uv add django-auditlog`).

### Para qué
Registrar automáticamente, en la propia base de datos, **quién cambió qué campo, de qué valor a qué valor, y cuándo** — sin tener que instrumentar cada vista manualmente.

### Cómo se configuró
1. Agregado a `THIRD_PARTY_APPS` en `config/settings/base.py`: `"auditlog"`.
2. Registro de modelos (una línea por modelo a auditar):
```python
# memos_cafe/mesas/models.py
from auditlog.registry import auditlog
auditlog.register(Mesa)
```
```python
# memos_cafe/ordenes/models.py
auditlog.register(Orden)
```
```python
# memos_cafe/productos/models.py
auditlog.register(Categoria)
auditlog.register(Producto)
auditlog.register(Promocion)
```
3. Configuración adicional:
```python
AUDITLOG_INCLUDE_ALL_MODELS = False        # solo se auditan los registrados explícitamente
AUDITLOG_USE_TEXT_CHANGES_IF_JSON_IS_NONE = True
```

### Problema real resuelto: JWT vs. sesión
`django-auditlog` por defecto identifica al "actor" (usuario que hizo el cambio) leyendo la **sesión de Django** (`request.user` vía cookies). Pero esta API usa **JWT sin estado** — no hay sesión. Sin este ajuste, todos los cambios se habrían registrado con actor `None`.

**Solución (middleware propio, `memos_cafe/utils/auditlog_middleware.py`):**
```python
from auditlog.middleware import AuditlogMiddleware
from rest_framework_simplejwt.authentication import JWTAuthentication

class JWTAuditlogMiddleware(AuditlogMiddleware):
    """Extiende AuditlogMiddleware para capturar el usuario
    autenticado via JWT (Bearer token) en lugar de sesión Django."""

    def _get_actor(self, request):
        actor = super()._get_actor(request)   # primero intenta sesión Django
        if actor is not None:
            return actor
        try:
            jwt_auth = JWTAuthentication()
            result = jwt_auth.authenticate(request)
            if result is not None:
                user, _ = result
                return user
        except Exception:
            pass
        return None
```
Registrado en `MIDDLEWARE` en lugar del `AuditlogMiddleware` original.

### Resultado real obtenido
Se editó la mesa #1 vía API (autenticado con JWT) cambiando su capacidad de 2 a 6, y se consultó la tabla `auditlog_logentry`:
```
actor: qa.auditlog@test.local
accion: update
objeto: Mesa 1 (ocupada)
changes: {'capacidad': ['2', '6']}
timestamp: 2026-07-20 (fecha real de la prueba)
```

**Interpretación:** si mañana una mesa, producto o promoción aparece con datos incorrectos, se sabe exactamente quién lo cambió, cuándo, y cuál era el valor anterior — trazabilidad completa a nivel de campo, sin depender de backups para reconstruir el historial.

---

## PARTE 3 — HEALTH CHECK / PERFORMANCE

### Herramienta
Endpoint HTTP propio (`GET /api/health/`) construido sobre **`psutil` 7.2.2** (librería estándar de Python para métricas de sistema: CPU, memoria, disco).

### Por qué esta y no una plataforma externa (Datadog, Zabbix, etc.)
Un endpoint `/health` es el estándar de facto que usan Kubernetes, AWS ELB, Render, Railway, etc. para decidir si una instancia está sana. Cualquier herramienta externa de monitoreo (UptimeRobot, un balanceador, un cron con `curl`) puede consultarlo — no depende de instalar un agente propietario en el servidor.

### Código real (`memos_cafe/reportes/views.py`)
```python
class HealthCheckView(APIView):
    """GET /api/health/ — Health check del sistema — logs, performance y
    estado general. Accesible sin autenticación para monitoreo externo."""
    permission_classes = []  # público

    def get(self, request):
        health = {}
        try:
            connection.ensure_connection()
            health["base_datos"] = {"estado": "ok", "motor": connection.vendor}
        except Exception as e:
            health["base_datos"] = {"estado": "error", "detalle": str(e)}

        health["performance"] = {
            "cpu_porcentaje": psutil.cpu_percent(interval=0.1),
            "memoria_total_mb": round(psutil.virtual_memory().total / 1024 / 1024, 2),
            "memoria_usada_mb": round(psutil.virtual_memory().used / 1024 / 1024, 2),
            "memoria_porcentaje": psutil.virtual_memory().percent,
            "disco_total_gb": round(psutil.disk_usage("/").total / 1024 / 1024 / 1024, 2),
            "disco_usado_gb": round(psutil.disk_usage("/").used / 1024 / 1024 / 1024, 2),
            "disco_porcentaje": psutil.disk_usage("/").percent,
        }
        health["sistema"] = {
            "django_version": django.get_version(),
            "estado": "ok",
            "zona_horaria": str(timezone.get_current_timezone()),
        }
        umbral_activos = timezone.now() - timedelta(minutes=30)
        health["actividad"] = {
            "ordenes_hoy": Orden.objects.filter(fecha_creacion__date=hoy).count(),
            "caja_abierta": Caja.objects.filter(estado="abierta").exists(),
            "mesas_ocupadas": Mesa.objects.filter(estado="ocupada", activo=True).count(),
            "usuarios_activos_30min": User.objects.filter(last_login__gte=umbral_activos).count(),
        }
        ...
```

*Nota sobre "usuarios activos":* como el JWT no mantiene estado en el servidor (no hay tabla de sesiones vivas), "activo" se define como "tuvo un login exitoso en los últimos 30 minutos" (`last_login__gte`). Es una aproximación razonable y se documenta como tal.

### Resultado real (respuesta capturada de `GET https://memos-cafe.onrender.com/api/health/`)
```json
{
  "estado": "ok",
  "timestamp": "2026-07-20T21:08:33Z",
  "base_datos": { "estado": "ok", "motor": "postgresql" },
  "performance": {
    "cpu_porcentaje": 48.1,
    "memoria_total_mb": 31386.71,
    "memoria_usada_mb": 22825.07,
    "memoria_porcentaje": 72.7,
    "disco_total_gb": 386.43,
    "disco_usado_gb": 315.57,
    "disco_porcentaje": 81.7
  },
  "sistema": { "django_version": "6.0.6", "estado": "ok", "zona_horaria": "America/Lima" },
  "actividad": {
    "ordenes_hoy": 0,
    "caja_abierta": true,
    "mesas_ocupadas": 0,
    "usuarios_activos_30min": 0
  }
}
```

**Interpretación:** los porcentajes de CPU/memoria/disco corresponden al servidor compartido y gratuito de Render — sirven como evidencia real de que el sistema responde y de qué límites tiene el plan gratuito (útil para justificar en la sustentación oral si el sistema se demora bajo carga).

---

## PARTE 4 — PRUEBAS DE SEGURIDAD (OWASP ZAP)

### Herramienta
**OWASP ZAP (Zed Attack Proxy) Desktop, versión 2.17.0.** Escaneo automatizado autenticado (Active Scan + Spider), no un escaneo anónimo.

### Por qué GUI y no el contenedor Docker de ZAP
Se intentó automatizar el escaneo vía `docker run zaproxy/zap-stable`, pero la inestabilidad del Docker Desktop local (crashes repetidos del engine) hizo inviable mantenerlo corriendo de forma confiable durante la sesión. Se optó por la versión Desktop de ZAP, apuntando al mismo backend real (`http://localhost:8000/api/`, contenedor `memos_cafe_local_django`), lo cual da el mismo resultado de fondo: tráfico HTTP real contra la API real.

### Cómo se configuró la autenticación
Esta es una API JSON con JWT — no un formulario HTML de login que ZAP pueda auto-detectar. Se usó el add-on **Replacer** de ZAP para inyectar la cabecera `Authorization: Bearer <token>` en cada petición saliente, usando un token real obtenido de:
```
POST http://localhost:8000/api/auth/login/
{"email": "...", "password": "..."}
```
Esto permite que ZAP ataque endpoints protegidos como un usuario autenticado real, no solo las rutas públicas.

### Alcance del escaneo (datos reales del reporte)
- **Sitio objetivo:** `http://localhost:8000`
- **Fecha:** lunes 20 jul. 2026, 16:54:52 (hora local) — `2026-07-20T21:54:52Z`
- **Endpoints descubiertos:** 8 totales — 87% GET, 12% POST
- **Distribución de respuestas:** 2% códigos 2xx, 13% 3xx, 83% 4xx, 1% 5xx

### Resultado real: 1 Alto, 2 Medio, 2 Bajo, 3 Informativo

#### 🔴 ALTO — "Inyección SQL" (plugin 40018, CWE-89) — **Falso positivo, verificado**

**Lo que reportó ZAP:** en `POST /api/auth/login/`, campos `email` y `password`, con los payloads:
```
email:    zap.scan@test.local' OR '1'='1' -- 
password: ZapScan-Local-2026!' OR '1'='1' -- 
```
ZAP detectó que las respuestas a `... AND '1'='1'` y `... OR '1'='1'` diferían y las marcó como posible inyección booleana.

**Verificación manual (por qué es falso positivo):** se replicó exactamente el mismo ataque con `curl` directo contra el endpoint real:
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.local'"'"' OR '"'"'1'"'"'='"'"'1'"'"' -- ","password":"x"}'
```
Resultado: **401 Unauthorized** en todos los casos, sin bypass de autenticación. Además, el proyecto usa exclusivamente el ORM de Django (verificado: cero uso de `.raw()` o `.extra()` en todo el código de autenticación) — no hay forma de que un `'` llegue a concatenarse en SQL crudo.

**Causa real de la diferencia que confundió a ZAP:** el endpoint de login tiene un throttle propio (`LoginRateThrottle`, `5/minute`). Durante el escaneo automatizado, algunas de las peticiones comparativas de ZAP recibieron **429 Too Many Requests** en vez de 401, y esa diferencia de contenido/código de respuesta fue lo que el heurístico de "SQLi booleana" de ZAP interpretó como "los resultados cambiaron según la condición lógica". No es una inyección real — es una interferencia entre el rate limiter y el algoritmo de comparación diferencial de ZAP.

**Estado:** documentado, sin acción de código necesaria (la protección real —ORM parametrizado— ya existe).

#### 🟠 MEDIO — "Cabecera Content-Security-Policy no configurada" (plugin 10038, CWE-693) — **Corregido**

**Lo que reportó ZAP:** faltaba la cabecera `Content-Security-Policy` en `/api/`, `/robots.txt`, `/sitemap.xml`.

**Corrección aplicada** (`memos_cafe/utils/security_middleware.py`, nuevo):
```python
class APICSPMiddleware:
    """Agrega Content-Security-Policy a las respuestas de /api/.
    Se restringe solo a /api/ -- ahi todo son respuestas JSON, asi que
    "default-src 'none'" es seguro. No se toca /django-admin-panel/ ni el
    resto del sitio para no arriesgar romper la UI del admin de Django."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith("/api/"):
            response["Content-Security-Policy"] = "default-src 'none'"
        return response
```
Registrado al final de `MIDDLEWARE` en `config/settings/base.py`.

**Verificación:** suite completa de tests (228 pasando, 12 fallos preexistentes no relacionados) ejecutada tras el cambio, confirmando la cabecera presente en las respuestas:
```
Content-Security-Policy: default-src 'none'
12 failed, 228 passed, 66 warnings in 26.66s
```

**Estado:** ✅ corregido y verificado con tests.

#### 🟠 MEDIO — "Configuración Incorrecta Cross-Domain" (plugin 10098, CWE-264) — **Aceptado, solo entorno local**

**Lo que reportó ZAP:** cabecera `Access-Control-Allow-Origin: *` en `/static/debug_toolbar/css/print.css`, `toolbar.css`, `js/toolbar.js`.

**Análisis:** estos 3 archivos pertenecen a **Django Debug Toolbar**, que solo se activa cuando `DEBUG = True` (confirmado en `config/settings/local.py:7` y `:32-33` — `INSTALLED_APPS += ["debug_toolbar"]`). En producción (`config/settings/production.py`), `debug_toolbar` no está instalado y `DEBUG` no se fuerza a `True` — por lo tanto estos archivos ni siquiera existen en `https://memos-cafe.onrender.com`.

**Estado:** sin riesgo real en producción — es un artefacto exclusivo del entorno de desarrollo local. No requiere corrección.

#### 🟡 BAJO — "Divulgación de error de aplicación" (plugin 90022, CWE-550)

**Lo que reportó ZAP:** un `HTTP 500` en `/api/` devolvió un traceback de Python con rutas de archivo (`/app/.venv/lib/python3.12/site-packages/django_extensions/...`).

**Análisis:** esto ocurre porque el entorno local corre con `DEBUG = True` (obligatorio para desarrollar), que en Django muestra la página de depuración con el traceback completo ante cualquier error 500. En producción, `DEBUG` es `False` por defecto (`config/settings/production.py`, sin el override que existe en `local.py`) — Django devuelve una página de error genérica sin información sensible.

**Estado:** sin riesgo real en producción — comportamiento esperado y correcto del entorno de desarrollo.

#### 🟡 BAJO — "El servidor filtra información de versión" (plugin 10036, CWE-497)

**Lo que reportó ZAP:** cabecera `Server: Werkzeug/3.1.8 Python/3.12.12` en varias respuestas.

**Análisis:** `Werkzeug` es el servidor de desarrollo usado por `runserver_plus` (django-extensions) localmente. En producción, el `Dockerfile` (`compose/production/django/start`) levanta **Gunicorn**, no Werkzeug — la cabecera y la versión expuesta serán distintas y no revelan la misma información.

**Estado:** sin riesgo real en producción — artefacto del servidor de desarrollo local.

#### ⚪ INFORMATIVO (3 hallazgos, sin acción requerida)
- **"Aplicación Web Moderna"** — ZAP detecta que es una SPA y sugiere usar Ajax Spider. Informativo, no es una vulnerabilidad.
- **"Comentarios sospechosos"** — detectó palabras como `DEBUG`, `FROM`, `USER` en comentarios de JS de debug_toolbar y en el traceback de depuración (mismo origen que el hallazgo de CWE-550 arriba). Mismo análisis: solo entorno local.
- **"Petición de Autenticación Identificada"** — ZAP simplemente confirma que reconoció `/api/auth/login/` como el endpoint de login. Confirma que la configuración de autenticación (Replacer) funcionó correctamente.

### Resumen de la tabla de hallazgos ZAP

| Riesgo | Hallazgo | CWE | Estado |
|---|---|---|---|
| Alto | Inyección SQL | 89 | Falso positivo verificado (rate limiter + ORM parametrizado) |
| Medio | CSP no configurada | 693 | ✅ Corregido (middleware nuevo) |
| Medio | CORS en debug_toolbar | 264 | Sin riesgo — solo `DEBUG=True` local |
| Bajo | Traceback expuesto en error 500 | 550 | Sin riesgo — solo `DEBUG=True` local |
| Bajo | Server header (Werkzeug) | 497 | Sin riesgo — prod usa Gunicorn |
| Info ×3 | SPA / comentarios / auth detectada | — | Sin acción |

---

## Recomendación pendiente

Este escaneo se hizo contra `localhost:8000` (Docker local). Para cerrar el ciclo, se recomienda correr el mismo escaneo (Replacer + Active Scan) contra `https://memos-cafe.onrender.com/api/` para confirmar en vivo que:
1. El header CSP ya aparece (el fix se hizo después de este escaneo).
2. Los hallazgos de CORS/traceback/Werkzeug **no aparecen** en producción (por `DEBUG=False` y Gunicorn), confirmando el análisis de esta sección.
