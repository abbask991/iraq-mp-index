"""Pull admin-editable MP fields from Supabase back into data/members.csv, so
the static dashboard reflects names / photos / socials edited in the admin panel.
"""

from __future__ import annotations

import csv
import json
import os
import ssl
import urllib.request

from .news import _ctx, _supabase_env

# columns the admin can edit in Supabase -> overwrite these in members.csv
SYNC_COLS = ["name", "governorate", "bloc", "committee", "role", "photo",
             "facebook", "x", "instagram", "telegram", "website", "search_name"]


def sync_members(data_dir: str = "data") -> int:
    url, key = _supabase_env()
    if not (url and key):
        print("no Supabase config (SUPABASE_URL/ANON_KEY) — skipping sync")
        return 0

    req = urllib.request.Request(
        f"{url}/rest/v1/mps?select=*",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "User-Agent": "Mozilla/5.0"})
    rows = json.loads(urllib.request.urlopen(req, timeout=30, context=_ctx()).read())
    supa = {int(r["id"]): r for r in rows}

    path = os.path.join(data_dir, "members.csv")
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames
        members = list(reader)

    updated = 0
    for m in members:
        s = supa.get(int(m["member_id"]))
        if not s:
            continue
        for c in SYNC_COLS:
            if c in fields and s.get(c) not in (None, ""):
                m[c] = s[c]
        updated += 1

    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(members)
    print(f"synced {updated} MPs from Supabase → {path}")
    return updated
