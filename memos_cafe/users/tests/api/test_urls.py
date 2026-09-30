from __future__ import annotations

from typing import TYPE_CHECKING

from django.urls import resolve
from django.urls import reverse

if TYPE_CHECKING:
    from memos_cafe.users.models import User


def test_user_detail(user: User):
    assert reverse("user-detail", kwargs={"pk": user.pk}) == f"/api/users/{user.pk}/"
    assert resolve(f"/api/users/{user.pk}/").view_name == "user-detail"


def test_user_list():
    assert reverse("user-list") == "/api/users/"
    assert resolve("/api/users/").view_name == "user-list"


def test_user_me():
    assert reverse("user-me") == "/api/users/me/"
    assert resolve("/api/users/me/").view_name == "user-me"
