
from django.urls import path
from django.contrib import admin

from . import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path("", views.index, name="index"),
    path("login", views.login_view, name="login"),
    path("logout", views.logout_view, name="logout"),
    path("register", views.register, name="register"),
    path("new_post", views.new_post, name="new_post"),
    path("edit_post/<int:post_id>", views.edit_post, name="edit_post"),
    path("delete_post/<int:post_id>", views.delete_post, name="delete_post"),
    path("<str:username>", views.index, name="profile"),
    path("toggle_follow/<str:username>", views.toggle_follow, name="toggle_follow"),
    path("following", views.index, {'following': True}, name="following"),
    path("toggle_like/<int:post_id>", views.toggle_like, name="toggle_like"),
]
