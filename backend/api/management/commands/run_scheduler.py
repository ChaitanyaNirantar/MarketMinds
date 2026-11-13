import time

from django.core.management.base import BaseCommand

from api.models import Business
from api.social import publish_due_posts, sync_business


class Command(BaseCommand):
    help = "Development scheduler: publish due posts every minute and sync stats every few hours."

    def add_arguments(self, parser):
        parser.add_argument("--sync-hours", type=float, default=3.0)

    def handle(self, *args, sync_hours, **options):
        last_sync = 0.0
        self.stdout.write("Scheduler running. Ctrl+C to stop.")
        while True:
            counts = publish_due_posts()
            if any(counts[k] for k in ("published", "failed", "missed")):
                self.stdout.write(f"publish: {counts}")
            if time.monotonic() - last_sync >= sync_hours * 3600:
                for business in Business.objects.filter(accounts__is_live=True, accounts__connected=True).distinct():
                    self.stdout.write(f"sync {business}: {sync_business(business)}")
                last_sync = time.monotonic()
            time.sleep(60)
