from django.core.management.base import BaseCommand

from api.models import Business
from api.social import sync_business


class Command(BaseCommand):
    help = "Pull post stats from connected Facebook / Instagram accounts (run every few hours)."

    def handle(self, *args, **options):
        businesses = Business.objects.filter(accounts__is_live=True, accounts__connected=True).distinct()
        for business in businesses:
            for platform, result in sync_business(business).items():
                self.stdout.write(f"{business}: {platform} - {result}")
        if not businesses:
            self.stdout.write("No live accounts connected.")
