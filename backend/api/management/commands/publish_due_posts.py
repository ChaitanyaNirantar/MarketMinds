from django.core.management.base import BaseCommand

from api.social import publish_due_posts


class Command(BaseCommand):
    help = "Publish scheduled posts whose time has come (run every minute)."

    def handle(self, *args, **options):
        counts = publish_due_posts()
        self.stdout.write(", ".join(f"{k}: {v}" for k, v in counts.items()))
