from django.urls import path

from . import views

urlpatterns = [
    path("health", views.health),
    path("auth/login", views.login),
    path("auth/signup", views.signup),
    path("seed", views.seed),
    path("workspace", views.workspace),
    path("business", views.save_business),
    path("sources", views.add_source),
    path("sources/<str:source_id>", views.delete_source),
    path("sources/<str:source_id>/retry", views.retry_source),
    path("knowledge/search", views.search_knowledge),
    path("goals", views.save_goal),
    path("goals/generate-strategy", views.generate_strategy),
    path("goals/approve-strategy", views.approve_strategy),
    path("campaigns/generate-content", views.generate_content),
    path("content/bulk-status", views.bulk_content_status),
    path("content/<str:content_id>", views.update_content),
    path("accounts/<str:platform>/connect", views.connect_account),
    path("posts/<str:post_id>/retry", views.retry_post),
    path("posts/<str:post_id>/move", views.move_post),
    path("schedule/approved", views.schedule_approved),
    path("results/sample", views.sample_results),
    path("results", views.save_results),
    path("recommendation/accept", views.accept_recommendation),
    path("recommendation/dismiss", views.dismiss_recommendation),
]
