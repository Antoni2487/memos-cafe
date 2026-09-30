from http import HTTPStatus

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

# La API autentica solo con JWT (sin sesion), por eso se usa APIClient con
# force_authenticate en vez del admin_client de pytest-django.


@pytest.fixture
def admin_api_client(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


def test_api_docs_accessible_by_admin(admin_api_client):
    url = reverse("api-docs")
    response = admin_api_client.get(url)
    assert response.status_code == HTTPStatus.OK


@pytest.mark.django_db
def test_api_docs_not_accessible_by_anonymous_users():
    url = reverse("api-docs")
    response = APIClient().get(url)
    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_api_schema_generated_successfully(admin_api_client):
    url = reverse("api-schema")
    response = admin_api_client.get(url)
    assert response.status_code == HTTPStatus.OK
