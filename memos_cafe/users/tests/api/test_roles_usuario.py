"""El admin asigna cualquiera de los cuatro roles, incluido el cocinero
(grupo "cocina"); un rol inexistente se rechaza en vez de crear el usuario
sin rol."""

from http import HTTPStatus

import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from memos_cafe.users.models import User
from memos_cafe.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin():
    usuario = UserFactory()
    usuario.groups.add(Group.objects.get_or_create(name="admin")[0])
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


def _nuevo(admin, rol):
    return admin.post(
        "/api/users/",
        {
            "email": f"{rol or 'sin'}@test.com",
            "password": "Nuevo1234!",
            "name": "Persona",
            "group_name": rol,
        },
        format="json",
    )


@pytest.mark.parametrize("rol", ["admin", "cajero", "mesero", "cocina"])
def test_se_crea_con_cualquiera_de_los_cuatro_roles(admin, rol):
    r = _nuevo(admin, rol)

    assert r.status_code == HTTPStatus.CREATED
    assert [g["name"] for g in r.data["groups"]] == [rol]


def test_el_rol_cocinero_funciona_aunque_el_grupo_no_exista_aun(admin):
    Group.objects.filter(name="cocina").delete()

    r = _nuevo(admin, "cocina")

    assert r.status_code == HTTPStatus.CREATED
    assert User.objects.get(email="cocina@test.com").groups.get().name == "cocina"


def test_un_rol_inexistente_se_rechaza_y_no_crea_el_usuario(admin):
    r = _nuevo(admin, "chef")

    assert r.status_code == HTTPStatus.BAD_REQUEST
    assert "group_name" in r.data
    assert not User.objects.filter(email="chef@test.com").exists()


def test_cambiar_un_mesero_a_cocinero(admin):
    mesero = UserFactory()
    mesero.groups.add(Group.objects.get_or_create(name="mesero")[0])

    r = admin.patch(
        f"/api/users/{mesero.id}/",
        {"group_name": "cocina"},
        format="json",
    )

    assert r.status_code == HTTPStatus.OK
    assert list(mesero.groups.values_list("name", flat=True)) == ["cocina"]


def test_un_rol_invalido_al_editar_no_le_quita_el_que_tenia(admin):
    mesero = UserFactory()
    mesero.groups.add(Group.objects.get_or_create(name="mesero")[0])

    r = admin.patch(
        f"/api/users/{mesero.id}/",
        {"group_name": "chef"},
        format="json",
    )

    assert r.status_code == HTTPStatus.BAD_REQUEST
    assert list(mesero.groups.values_list("name", flat=True)) == ["mesero"]
