from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("api.urls")),
    # Uploaded post images. Instagram downloads them from PUBLIC_BASE_URL/media/...,
    # so they are served even with DEBUG off. Use object storage (S3/R2) in production.
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]
