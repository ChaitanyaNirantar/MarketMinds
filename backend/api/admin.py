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
