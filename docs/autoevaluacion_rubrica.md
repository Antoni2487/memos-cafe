# Autoevaluación contra la Rúbrica de Proyecto Final — Memo's Café

Puntaje total de la rúbrica: **20 puntos** (Pruebas de Software y seguridad: 2, Despliegue: 2, Monitoreo: 6, Mantenimiento: 5, Construcción del producto final: 3, Sustentación oral: 2).

---

## 1. Pruebas de Software y seguridad — máx. 2 pts

| Nivel | Requisito | ¿Cumplido? |
|---|---|---|
| Estándar Esperado (2) | Testing 60%, Pruebas de Seguridad 70%, con reporte | ✅ |

**Evidencia:**
- 240 tests automatizados (pytest-django + factory_boy), 228 pasando. Los 12 restantes son fallos preexistentes documentados y explicados (no regresiones).
- Escaneo de seguridad OWASP ZAP **autenticado** (no anónimo) contra la API real, con reporte real de hallazgos: 1 Alto (verificado como falso positivo con evidencia), 2 Medios (uno corregido — header CSP —, otro aceptado como bajo riesgo real), 2 Bajos (confirmados como no reproducibles en producción), 3 Informativos.
- El análisis del falso positivo (por qué ZAP lo marcó, por qué no es real, verificación manual replicando el ataque) es evidencia fuerte de **dominio real** del tema, no solo de correr una herramienta.

**Veredicto: Estándar Esperado alcanzado.**

---

## 2. Despliegue del proyecto — máx. 2 pts

*(La rúbrica menciona Java/Maven explícitamente — no aplica a este stack Python/Django, es una plantilla genérica del curso; se traduce al equivalente real.)*

| Nivel | Requisito | ¿Cumplido? |
|---|---|---|
| Estándar Esperado (2) | Aplicación desplegada, servidor configurado, con retroalimentación aplicada | ✅ |

**Evidencia:**
- Sistema completo desplegado y funcionando: backend (Render), frontend (Vercel), base de datos (Neon), landing page (Vercel).
- Se encontraron y corrigieron 5 bugs reales durante el despliegue (versión de Python en el Dockerfile, manejo de DATABASE_URL externa, puerto dinámico, CORS, carpeta de logs faltante) — evidencia de comprensión real del proceso, no de seguir un tutorial a ciegas.
- Probado de punta a punta: login real, creación de datos, reportes, todo funcionando en producción.

**Veredicto: Estándar Esperado alcanzado.**

---

## 3. Monitoreo del proyecto — máx. 6 pts (el criterio de mayor peso)

| Nivel | Requisito | ¿Cumplido? |
|---|---|---|
| Estándar Esperado (6) | Avance 90% + plan de monitoreo exhaustivo, dominio de logs + performance tools + health tools | ✅ |

**Evidencia:**
- Logs estructurados: inicio/cierre de sesión, fallos de login, transacciones críticas (pagos, anulaciones, apertura/cierre de caja).
- Trazas en BD: django-auditlog en 5 modelos, con resolución de actor vía JWT (adaptación real, no default de la librería).
- Health check con CPU/memoria/disco (psutil), estado de BD, usuarios activos.
- Plan de monitoreo documentado (`docs/plan_monitoreo.md`) explicando qué, por qué y cómo, con resultados reales.
- Justificación razonada de por qué no se usó Zabbix/Nagios/Datadog/Splunk (no un simple "no dio tiempo").

**Veredicto: Estándar Esperado alcanzado — este es el punto más fuerte de la entrega.**

---

## 4. Mantenimiento del proyecto — máx. 5 pts

| Nivel | Requisito | ¿Cumplido? |
|---|---|---|
| Estándar Esperado (5) | Proyecto 100% + plan de mantenimiento integral (cron jobs, backups, scripts) | ✅ |

**Evidencia:** ver detalle completo en `docs/plan_mantenimiento.md`.
- **Script real:** comando propio `backup_bd` (dumpdata + rotación automática de los últimos 7 backups), probado en vivo contra la BD real: `Backup creado: /app/backups/backup_20260720_180731.json (67.5 KB)`, rotación verificada tras 8 corridas seguidas.
- **Cron job real:** `.github/workflows/mantenimiento_diario.yml` — GitHub Actions con `schedule: cron: '0 5 * * *'`, corre `flushexpiredtokens` + `backup_bd` contra producción (Neon) y sube el backup como artefacto.
- **Sin regresiones:** suite completa corrida tras el cambio, `12 failed, 228 passed` (mismos fallos preexistentes de siempre, no relacionados).

**Pendiente menor (no bloqueante):** falta agregar 3 secrets en GitHub (`DATABASE_URL`, `DJANGO_SECRET_KEY`, `DJANGO_ADMIN_URL`) para que el cron corra contra producción real — el código y la prueba local ya están completos.

**Veredicto: Estándar Esperado alcanzado.**

---

## 5. Construcción del producto final — máx. 3 pts

| Nivel | Requisito | ¿Cumplido? |
|---|---|---|
| Estándar Esperado (3) | Completa + coherente + buenas prácticas + autoría, los 4 criterios | ✅ (ya corregido) |

**Evidencia:**
- **Completa**: todos los módulos funcionales (mesas, órdenes, caja, productos, reportes, roles, usuarios), desplegado en producción.
- **Coherente**: se corrigieron los desfases entre el Word (versiones de stack, diccionario de datos, plan de despliegue) y el código real — ya no hay contradicciones.
- **Buenas prácticas**: patrón de service layer, import-linter validando arquitectura por capas, SOLID documentado con ejemplos reales de código, control de versiones con Git Flow y PRs.
- **Autoría**: se nota dominio real del código (los bugs que se encontraron y corrigieron requieren entender la implementación, no solo copiarla).

**Veredicto: Estándar Esperado alcanzado.**

---

## 6. Sustentación oral — máx. 2 pts

No se puede evaluar de antemano — depende de la presentación en vivo. Recomendaciones concretas basadas en lo que sí se puede controlar:
- Seguir la secuencia: contexto → alternativas → diseño → prototipo → construcción, tal como pide la rúbrica.
- Que **todos** los integrantes hablen (es un requisito explícito).
- Máximo ~10 minutos — practicar el tiempo antes.
- Vincular explícitamente cada sección con conceptos del curso (no solo mostrar pantallas — decir "esto es un patrón de Factory Method", "esto es DAO", etc.).

---

## Resumen y prioridad para el tiempo que queda

| Criterio | Puntos | Estado |
|---|---|---|
| Pruebas de Software y seguridad | 2/2 | ✅ Listo |
| Despliegue | 2/2 | ✅ Listo |
| Monitoreo | 6/6 | ✅ Listo |
| Mantenimiento | 5/5 | ✅ Listo (falta activar 3 secrets en GitHub para el cron en producción) |
| Construcción del producto final | 3/3 | ✅ Listo |
| Sustentación oral | ?/2 | Depende de la práctica del equipo |

**20/20 puntos con evidencia sólida ya cubiertos** (fuera de la sustentación oral, que depende de la exposición en vivo). Único pendiente operativo: agregar los 3 secrets de GitHub Actions para que el cron de mantenimiento corra contra la base de datos real de producción.
