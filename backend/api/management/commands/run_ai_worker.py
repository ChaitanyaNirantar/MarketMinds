import time
from django.core.management.base import BaseCommand
from api.rag.service import process_next


class Command(BaseCommand):
    help = "Run the single local indexing/generation worker. Jobs survive browser/server restarts."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="Process at most one job, then exit")

    def handle(self, *args, **options):
        self.stdout.write("MarketMinds AI worker ready (Ctrl-C to stop).")
        try:
            while True:
                worked = process_next()
                if options["once"]:
                    return
                if not worked:
                    time.sleep(1)
        except KeyboardInterrupt:
            self.stdout.write("Worker stopped. Interrupted jobs become retryable after 12 minutes.")
