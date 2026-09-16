import re

DNI_REGEX = re.compile(r"^\d{8}$")
RUC_REGEX = re.compile(r"^\d{11}$")
# Mismo patron que REGEX.SOLO_ALFANUMERICO en frontend/src/utils/validators.js
# -- el backend debe rechazar lo mismo que el frontend ya bloquea en el
# formulario (defensa en profundidad: cualquiera puede pegarle a la API
# directo, sin pasar por el form).
ALFANUMERICO_REGEX = re.compile(r"^[a-zA-Z0-9À-ÿñÑ\s.,#°/-]*$")
# Digitos, espacios, +, - y parentesis -- cubre formatos comunes en Peru
# (999 999 999, +51 999 999 999, (01) 234-5678) sin exigir un formato exacto.
TELEFONO_REGEX = re.compile(r"^[0-9+()\-\s]*$")


def es_dni_valido(valor: str) -> bool:
    return bool(DNI_REGEX.match(valor or ""))


def es_ruc_valido(valor: str) -> bool:
    return bool(RUC_REGEX.match(valor or ""))


def es_alfanumerico_extendido(valor: str) -> bool:
    return bool(ALFANUMERICO_REGEX.match(valor or ""))


def es_telefono_valido(valor: str) -> bool:
    return bool(TELEFONO_REGEX.match(valor or ""))
