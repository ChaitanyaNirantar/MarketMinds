from django.core.management.base import BaseCommand

from api.seed import DEMO_EMAIL, DEMO_PASSWORD, seed_demo


class Command(BaseCommand):
    help = "Create (or reset) the Iron Peak Fitness demo account and workspace."

    def add_arguments(self, parser):
        parser.add_argument("--keep", action="store_true", help="Do not wipe existing demo data.")

    def handle(self, *args, **options):
        seed_demo(reset=not options["keep"])
        self.stdout.write(self.style.SUCCESS(f"Demo ready. Log in as {DEMO_EMAIL} / {DEMO_PASSWORD}"))
