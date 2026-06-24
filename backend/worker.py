"""RQ worker entrypoint — `python worker.py` (or `rq worker rasd`).

Consumes the 'rasd' queue defined in app/jobq.py. Runs as a separate Render
worker service so heavy jobs never block the web process. Exits cleanly (no-op)
when REDIS_URL is unset, so the same image is safe everywhere.
"""
import os
import sys


def main():
    url = os.getenv("REDIS_URL", "")
    if not url:
        print("REDIS_URL not set — worker has nothing to consume. Exiting.")
        return
    from redis import Redis
    from rq import Queue, Worker

    conn = Redis.from_url(url)
    worker = Worker([Queue("rasd", connection=conn)], connection=conn)
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    sys.exit(main())
