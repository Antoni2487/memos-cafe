class APICSPMiddleware:
    """Agrega Content-Security-Policy a las respuestas de /api/.

    Encontrado por un escaneo OWASP ZAP: la API no enviaba cabecera CSP
    (CWE-693). Se restringe solo a /api/ -- ahi todo son respuestas JSON,
    asi que "default-src 'none'" es seguro. No se toca /django-admin-panel/
    ni el resto del sitio para no arriesgar romper la UI del admin de Django
    (que puede depender de estilos/scripts inline) sin poder probarlo a fondo.

    Excepcion: /api/docs/ no es JSON -- sirve la UI de Swagger (HTML que
    carga su JS/CSS desde cdn.jsdelivr.net y ejecuta scripts inline para
    renderizar la pagina). "default-src 'none'" ahi bloquea todo eso y deja
    la pagina en blanco, asi que se excluye explicitamente. /api/schema/ SI
    queda cubierto por la politica estricta: devuelve el schema OpenAPI
    crudo (JSON/YAML), sin HTML ni JS que ejecutar.
    """

    RUTAS_EXCLUIDAS = ("/api/docs/",)

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith("/api/") and not request.path.startswith(self.RUTAS_EXCLUIDAS):
            response["Content-Security-Policy"] = "default-src 'none'"
        return response
