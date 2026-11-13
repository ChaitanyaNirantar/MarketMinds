from django.contrib import admin

from . import models

admin.site.register(models.Business)
admin.site.register(models.Product)
admin.site.register(models.KnowledgeSource)
admin.site.register(models.Goal)
admin.site.register(models.Campaign)
admin.site.register(models.ContentItem)
admin.site.register(models.ScheduledPost)
admin.site.register(models.ChannelResult)


@admin.register(models.SocialAccount)
class SocialAccountAdmin(admin.ModelAdmin):
    list_display = ("business", "platform", "connected", "is_live", "display_name", "status", "token_expires_at")
    # Encrypted tokens are hidden from the admin form.
    exclude = ("access_token_enc", "user_token_enc", "oauth_nonce")


admin.site.register(models.MediaAsset)
admin.site.register(models.PostMetric)
