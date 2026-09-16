# Plan de Monitoreo — Memo's Café

## 1. Objetivo

Demostrar que el sistema puede vigilarse en producción: saber si está vivo, cuánto recurso consume, quién hizo qué cambio en los datos, y qué eventos de seguridad/operación ocurrieron (logins, fallos, transacciones críticas).

Esto cubre lo pedido en la rúbrica: **logs, performance tools y health tools**, aplicado sobre el sistema real ya desplegado (`https://memos-cafe.onrender.com`), no como un ejercicio aparte.

---

## 2. Herramientas usadas y por qué

| Herramienta | Para qué | Por qué esta y no otra |
|---|---|---|
| **Logging de Django** (`RotatingFileHandler` + consola) | Registrar eventos de la aplicación (errores, transacciones, sesiones) | Ya viene integrado en el framework, sin infraestructura extra. Rota automáticamente para no llenar el disco. |
| **`django-auditlog`** | Trazas en base de datos: quién cambió qué campo y cuándo | Se integra directo con los modelos de Django (una línea por modelo: `auditlog.register(Modelo)`) y guarda el historial en la misma base de datos, sin un sistema externo. |
| **Endpoint `/api/health/` (custom, con `psutil`)** | Estado de salud: CPU, memoria, disco, base de datos, actividad de negocio | Es la forma estándar en que servicios en la nube (Render, Kubernetes, AWS, etc.) verifican si una app está sana — un endpoint HTTP que cualquier herramienta externa (UptimeRobot, un balanceador de carga, etc.) puede consultar. |
| **Dashboards nativos de Render y Neon** | CPU/memoria/logs de despliegue (Render) y métricas de la base de datos (Neon) | Vienen incluidos gratis con el hosting que ya usamos — no hay que instalar ni mantener nada aparte. |

### ¿Por qué no Datadog / Nagios / Zabbix / Splunk?

Son plataformas de nivel empresarial pensadas para monitorear *muchos* servidores/servicios a la vez, con su propia infraestructura (Zabbix y Nagios necesitan un servidor dedicado + agentes instalados en cada máquina monitoreada; Datadog y Splunk son de pago o requieren cuentas/API keys y agentes de recolección). Para un proyecto con **un** backend, **una** base de datos y **un** frontend, montar esa infraestructura agrega complejidad y puntos de falla sin aportar visibilidad adicional real. Las prácticas que exige la rúbrica (logs estructurados, métricas de performance, health checks) están igual de bien representadas con las herramientas de la tabla, con la ventaja de que están **funcionando de verdad en el sistema desplegado**, no como una demo aislada.

---

## 3. Cómo se usa cada una

### 3.1 Logging

Cada capa de servicio del backend (`caja`, `ordenes`, `reportes`, `users`) tiene su propio logger:

```python
import logging
logger = logging.getLogger("memos_cafe.caja")

logger.info("Pago #%s PROCESADO | orden=#%s | metodo=%s | monto=%s", pago.id, orden.id, metodo_pago, monto)
logger.warning("Pago #%s ANULADO | orden=#%s | usuario=%s | motivo=%s", pago.id, orden.id, usuario, motivo)
```

Los logs se escriben en dos archivos rotativos (`logs/memos_cafe.log` para todo, `logs/errores.log` solo para errores) y también en consola (visibles en el panel de "Logs" de Render en producción).

**Eventos que quedan registrados:**
- Inicio y cierre de sesión (login/logout), con el usuario y la IP.
- Intentos de login fallidos (fallo de input / credenciales inválidas).
- Transacciones críticas: apertura/cierre de caja, procesar pago, anular pago, emitir comprobante, crear/anular orden.

### 3.2 Trazas en base de datos (`django-auditlog`)

Se registra el modelo una sola vez:

```python
from auditlog.registry import auditlog
auditlog.register(Mesa)
auditlog.register(Orden)
auditlog.register(Categoria)
auditlog.register(Producto)
auditlog.register(Promocion)
```

A partir de ahí, **cada creación, edición o eliminación** de esos modelos queda guardada automáticamente en la tabla `auditlog_logentry`, con: qué campo cambió, de qué valor a qué valor, quién lo hizo y cuándo.

Como la API usa JWT (no sesiones), se adaptó el middleware de auditlog (`memos_cafe/utils/auditlog_middleware.py`) para que identifique al usuario a partir del token en vez de una sesión de Django.

### 3.3 Health check (`/api/health/`)

Endpoint público (sin login, para que un monitor externo pueda consultarlo) que devuelve en tiempo real:

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

Se puede probar en vivo entrando a: `https://memos-cafe.onrender.com/api/health/`

---

## 4. Resultados reales y su interpretación

Estos son capturas reales tomadas contra el sistema ya desplegado (no simulados):

**Login exitoso y fallido, con IP:**
```
INFO  Login exitoso | usuario=qa.monitoreo@test.local | ip=172.20.0.1
WARNING  Login FALLIDO | email=qa.monitoreo@test.local | ip=172.20.0.1
```
*Por qué importa:* permite detectar intentos de fuerza bruta (muchos "Login FALLIDO" seguidos desde la misma IP) y auditar accesos legítimos.

**Cierre de sesión identificando al usuario real:**
```
INFO  Logout | usuario=qa.monitoreo@test.local | ip=172.20.0.1
```
*Detalle técnico interesante:* el endpoint de logout (`TokenBlacklistView`) invalida el refresh token, pero **no exige que la petición esté autenticada** — solo necesita el token en el cuerpo. Por eso hubo que decodificar el token para saber quién cierra sesión, y hacerlo *antes* de invalidarlo (una vez invalidado, decodificarlo de nuevo lanza un error `"Token is blacklisted"`). Este es exactamente el tipo de detalle que vale la pena mencionar en la sustentación oral — muestra comprensión real del funcionamiento de JWT, no solo copiar una librería.

**Traza de auditoría (quién cambió qué campo):**
```
actor: qa.auditlog@test.local
accion: update
objeto: Mesa 1 (ocupada)
changes: {'capacidad': ['2', '6']}
```
*Por qué importa:* si mañana una mesa aparece con datos incorrectos, se puede saber exactamente quién lo cambió, cuándo, y cuál era el valor anterior — trazabilidad completa sin necesidad de revisar backups.

**Health check con carga real del servidor:**
```
cpu_porcentaje: 48.1 | memoria_porcentaje: 72.7 | disco_porcentaje: 81.7
```
*Por qué importa:* estos números vienen del servidor gratuito de Render (recursos compartidos y limitados) — sirve para justificar en la expo por qué, si el sistema se demora, no es un bug sino una limitación esperable del plan gratuito de hosting.

---

## 5. Cobertura frente a lo exigido

| Pedido | Cómo se cubre |
|---|---|
| Trazas en BD | `django-auditlog` |
| Hardware (capacidad/recursos) | CPU/memoria/disco en `/api/health/` |
| Rendimiento | Mismo endpoint + dashboard de Render |
| Eventos o fallos | Logs de error + intentos de login fallidos |
| Software (recursos consumidos) | Métricas de memoria/CPU del proceso Django |
| Acceso a servicios | El propio health check demuestra disponibilidad del servicio |
| Usuarios activos | `usuarios_activos_30min` en el health check |
| Inicio y cierre de sesión | Logs de login/logout con usuario e IP |
| Fallos de input | Logs de intentos de login inválidos |
| Transacciones críticas | Logs de pagos, anulaciones, apertura/cierre de caja, comprobantes |
| Eliminación de datos | `django-auditlog` registra los deletes de los modelos monitoreados |
| Temperatura | No aplica — el hosting es en la nube (contenedores), no hay acceso a sensores de hardware físico. Se documenta el porqué para la sustentación. |

---

## 6. Cómo demostrarlo en la exposición

1. Abrir `https://memos-cafe.onrender.com/api/health/` en el navegador — mostrar los datos en vivo.
2. Entrar al sistema, hacer login y logout — mostrar en el panel de logs de Render cómo queda registrado cada evento.
3. Editar una mesa o un producto desde el panel de admin de Django (`/django-admin-panel/`) y mostrar la traza en `auditlog_logentry` (se puede consultar desde el admin o con una consulta directa).
4. Mostrar el dashboard de Render (CPU/memoria) y el de Neon (base de datos) como evidencia de monitoreo de infraestructura.
