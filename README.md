# Memo's Café

Sistema de punto de venta (POS) y gestión para una cafetería: mesas, comandas, cobro con métodos mixtos, control de caja, insumos, promociones, roles y reportes.

Proyecto Integrador 1.

## Funcionalidades

- **Órdenes y comandas**: se abren órdenes por mesa y se imprimen comandas por ítem pendiente.
- **Caja**: apertura y cierre de sesión con arqueo. Se exige una observación si el descuadre supera S/. 5. Hay movimientos de entrada y salida.
- **Cobros**: efectivo (con vuelto), tarjeta, Yape, etc. Admite pagos parciales o mixtos y anulación con nota de crédito.
- **Comprobantes**: boleta y factura, con validación de DNI y RUC.
- **Catálogo**: productos, categorías, promociones e insumos, con registro de consumo.
- **Usuarios y roles**: grupos `admin`, `cajero` y `mesero`, con permisos por módulo.
- **Dashboard y reportes**: ventas, productos, caja y órdenes, exportables a Excel.
- **Operación**: health check, trazas de auditoría (django-auditlog), backups y mantenimiento diario automatizado.

## Stack

| Capa | Tecnologías |
|---|---|
| Backend | Python 3.12, Django 6, Django REST Framework, Django Channels (WebSocket), SimpleJWT, drf-spectacular, PostgreSQL |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui (Radix), Recharts, Axios |
| Calidad | pytest, import-linter, ruff, pre-commit, mypy |
| Infraestructura | Docker, GitHub Actions, Render + Neon (API y BD) + Redis (tiempo real), Vercel (frontend y landing) |

## Estructura

```
.
├── config/               # settings (base/local/test/production), urls, api_router
├── memos_cafe/           # apps de Django
│   ├── caja/             #   sesiones de caja, pagos, comprobantes, notas de crédito
│   ├── ordenes/          #   órdenes y detalle
│   ├── mesas/
│   ├── productos/        #   productos, categorías, promociones
│   ├── insumos/
│   ├── roles/            #   permisos por módulo
│   ├── reportes/         #   dashboard y reportes (solo lectura, agrega varias apps)
│   ├── users/            #   usuarios y autenticación JWT
│   └── utils/            #   permisos, validadores, middleware, comando backup_bd
├── frontend/             # SPA en React + TypeScript
├── compose/              # Dockerfiles y scripts (local y producción)
├── docs/                 # planes de monitoreo y mantenimiento, informe de seguridad
├── scripts/              # escaneo OWASP ZAP
└── .github/workflows/    # CI y mantenimiento diario
```

Cada app de negocio sigue el patrón *fat services, thin views*: la lógica vive en `services.py`, y las vistas y serializers de `api/` solo orquestan. Las reglas de dependencias entre capas están en [`.importlinter`](.importlinter) y se verifican en el CI.

## Desarrollo local

### Requisitos

- Python 3.12 y [uv](https://docs.astral.sh/uv/)
- Node.js 22+
- PostgreSQL 16 (o Docker)

### Backend

```bash
# 1. Dependencias
uv sync

# 2. Base de datos (ejemplo con Postgres local)
createdb memos_cafe
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/memos_cafe
export USE_DOCKER=no
export DJANGO_SECRET_KEY=cualquier-clave-local   # si no se define, cambia en cada arranque e invalida los JWT

# 3. Migraciones, grupos iniciales y superusuario
uv run python manage.py migrate
uv run python manage.py loaddata grupos_iniciales
uv run python manage.py createsuperuser

# 4. Servidor en http://localhost:8000
uv run python manage.py runserver
```

`config.settings.local` es el módulo de settings por defecto. Si prefieres usar un archivo `.env` en la raíz, exporta `DJANGO_READ_DOT_ENV_FILE=True`.

La documentación interactiva de la API (Swagger) está en `/api/docs/` y requiere un usuario administrador.

#### Con Docker

```bash
# requiere los archivos .envs/.local/.django y .envs/.local/.postgres (no versionados)
docker compose -f docker-compose.local.yml up
```

También hay un [`justfile`](justfile) con atajos (`just up`, `just manage migrate`, `just logs`, etc.).

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Por defecto apunta a `http://127.0.0.1:8000/api`. Para otra URL, define `VITE_API_URL` en `frontend/.env.local`.

## Tests y calidad

```bash
# Backend (necesita DATABASE_URL apuntando a un Postgres)
uv run pytest
uv run lint-imports            # contratos de arquitectura

# Hooks de pre-commit (ruff, django-upgrade, djlint, etc.)
uv run pre-commit install
uv run pre-commit run          # sobre los archivos en stage

# Frontend
cd frontend
npm run build                  # typecheck (tsc) + build
npm run lint
```

## CI/CD

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) corre en cada push y PR a `main` y `develop`:

| Job | Qué verifica |
|---|---|
| `linter` | hooks de pre-commit sobre los archivos que cambian |
| `backend` | migraciones al día, contratos de import-linter y `pytest` contra Postgres 16 |
| `frontend` | ESLint, `tsc` y `vite build` |

[`.github/workflows/mantenimiento_diario.yml`](.github/workflows/mantenimiento_diario.yml) corre todos los días a las 00:00 (hora de Lima). Limpia los tokens JWT expirados y genera un backup de la BD de producción. El detalle está en [`docs/plan_mantenimiento.md`](docs/plan_mantenimiento.md).

## Despliegue

- **API**: imagen de `compose/production/django/Dockerfile` desplegada en Render, con la base de datos en Neon (PostgreSQL). También hay configuración para Railway en `railway.json`.
- **Servidor**: `daphne` (ASGI). Atiende la API y los WebSocket de Cocina y meseros en un mismo proceso; lo arranca `compose/production/django/start`.
- **Tiempo real**: Redis, usado por Django Channels. Si Redis no está disponible, la app sigue funcionando: las órdenes se crean igual y el tablero de Cocina se actualiza cada 60 s en vez de al instante.
- **Base de datos**: pool de conexiones de psycopg (Django desaconseja las conexiones persistentes bajo ASGI). Verifica cada conexión antes de usarla, porque Neon cierra las conexiones cuando suspende el cómputo por inactividad.
- **Frontend y landing**: Vercel. `frontend/vercel.json` reescribe todas las rutas a `index.html` para que funcione el router de la SPA. Los WebSocket usan el mismo dominio que `VITE_API_URL` (`https` → `wss`).

### Poner en marcha el tiempo real en Render

1. Crea una instancia de Redis: en Render es un servicio **Key Value**, en la misma región que la API. También sirve un Redis externo, como Upstash.
2. Copia su URL de conexión y agrégala a las variables de entorno del servicio de la API como `REDIS_URL`. Si es externo, usa la URL `rediss://`, con TLS.
3. Vuelve a desplegar la API.
4. Abre `https://<tu-api>/api/health/`. Si todo está bien, verás `"tiempo_real": {"estado": "ok", "backend": "RedisChannelLayer"}`.
5. En el panel de Cocina, el indicador de la esquina debe decir **En vivo**.

### Variables de entorno del backend en producción

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | cadena de conexión a PostgreSQL |
| `REDIS_URL` | cadena de conexión a Redis (tiempo real y caché) |
| `DJANGO_SECRET_KEY` | clave secreta de Django |
| `DJANGO_SETTINGS_MODULE` | `config.settings.production` |
| `DJANGO_ALLOWED_HOSTS` | dominios permitidos, separados por coma |
| `DJANGO_CORS_ALLOWED_ORIGINS` | URL del frontend desplegado |
| `DJANGO_ADMIN_URL` | ruta del admin de Django |
| `DB_POOL_MIN_SIZE` / `DB_POOL_MAX_SIZE` | opcionales: tamaño del pool de conexiones (por defecto 1 y 4) |

## Documentación adicional

- [Plan de monitoreo](docs/plan_monitoreo.md)
- [Plan de mantenimiento](docs/plan_mantenimiento.md)
- [Informe técnico de monitoreo y seguridad](docs/informe_tecnico_monitoreo_seguridad.md)

## Autor

Antoni Montenegro
