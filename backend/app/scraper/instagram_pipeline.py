"""WeekendVibe Instagram weekend agenda ingestion.

The managed WeekendVibes runtime uses server/instagram-pipeline.ts because the
project's database is MySQL/TiDB. This Python entrypoint is kept portable for
PostgreSQL deployments and mirrors the exact filtering and structured-output
contract requested for the autonomous worker.
"""
from __future__ import annotations

import hashlib
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import requests
from openai import OpenAI

APIFY_URL = "https://api.apify.com/v2/actors/apify~instagram-scraper/run-sync-get-dataset-items"
MODEL = "gpt-4o-mini"
LOOKBACK_DAYS = 5
TARGETS = {
    "Moby House": "https://www.instagram.com/mobydicksantos/",
    "Projac Bar": "https://www.instagram.com/projac.bar/",
    "Meu Lugar Bar e Entretenimento": "https://www.instagram.com/meulugar.bar/",
    "Nosso After": "https://www.instagram.com/nossoafterguaruja/",
    "Curvão Surf House": "https://www.instagram.com/curvaosurfhouse/",
}
AGENDA_RE = re.compile(r"Agenda da semana")
HASHTAG_RE = re.compile(r"#Sexta-Feira|#Sábado")


def approved_text(text: str) -> bool:
    return bool(AGENDA_RE.search(text) and HASHTAG_RE.search(text))


def within_last_five_days(item: dict[str, Any], now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    raw = item.get("timestamp") or item.get("takenAt")
    if raw is None:
        return False
    try:
        timestamp = float(raw)
        posted = datetime.fromtimestamp(timestamp / 1000 if timestamp > 10_000_000_000 else timestamp, tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        try:
            posted = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except ValueError:
            return False
    return now - timedelta(days=LOOKBACK_DAYS) <= posted <= now


def scrape_posts() -> list[dict[str, Any]]:
    response = requests.post(
        APIFY_URL,
        headers={"Authorization": f"Bearer {os.environ['APIFY_API_TOKEN']}", "Content-Type": "application/json"},
        json={"resultsType": "posts", "directUrls": list(TARGETS.values()), "resultsLimit": 50},
        timeout=300,
    )
    response.raise_for_status()
    payload = response.json()
    return payload if isinstance(payload, list) else payload.get("items", [])


def ocr_image(client: OpenAI, image_url: str) -> str:
    if not image_url:
        return ""
    result = client.chat.completions.create(
        model=MODEL,
        temperature=0,
        messages=[{"role": "user", "content": [
            {"type": "text", "text": "Transcreva literalmente todo o texto legível da imagem. Não resuma nem invente."},
            {"type": "image_url", "image_url": {"url": image_url, "detail": "high"}},
        ]}],
    )
    return result.choices[0].message.content or ""


def extract_events(client: OpenAI, approved: list[tuple[dict[str, Any], str]]) -> list[dict[str, Any]]:
    raw = "\n\n".join(
        f"SOURCE_URL: {item.get('url') or item.get('shortCode', '')}\nRAW_POST_TEXT: {text}"
        for item, text in approved
    )
    completion = client.beta.chat.completions.parse(
        model=MODEL,
        temperature=0,
        messages=[
            {"role": "system", "content": "Extraia somente eventos musicais futuros de fim de semana em Santos ou Guarujá. Use apenas fatos presentes no texto. Descarte eventos sem data, cidade, endereço ou gênero verificáveis. Normalize os gêneros para funk, house_eletronica, samba_pagode ou rap_trap."},
            {"role": "user", "content": raw[:48000]},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "instagram_weekend_events",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "events": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "title": {"type": "string"}, "summary": {"type": "string"}, "eventDate": {"type": "string"}, "locationName": {"type": "string"}, "address": {"type": "string"}, "city": {"type": "string", "enum": ["Santos", "Guarujá"]}, "genre": {"type": "string", "enum": ["funk", "house_eletronica", "samba_pagode", "rap_trap"]}, "sourceUrl": {"type": "string"},
                                },
                                "required": ["title", "summary", "eventDate", "locationName", "address", "city", "genre", "sourceUrl"],
                                "additionalProperties": False,
                            },
                        },
                    },
                    "required": ["events"],
                    "additionalProperties": False,
                },
            },
        },
    )
    return completion.choices[0].message.parsed["events"]


def upsert_postgres(events: list[dict[str, Any]], source_url: str) -> int:
    import psycopg
    count = 0
    with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
        with connection.cursor() as cursor:
            for event in events:
                event_date = datetime.fromisoformat(event["eventDate"].replace("Z", "+00:00"))
                source_hash = hashlib.md5(f"{source_url}|{event_date.date()}|{event['title']}".encode()).hexdigest()
                cursor.execute("""
                    INSERT INTO events (title, slug, description, event_date, location_name, address, city, category, genre, price_cents, price_note, source_url, source_hash, is_published, is_archived)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'evento_musical', %s, 0, 'Preço não informado na agenda do Instagram', %s, %s, 1, 0)
                    ON CONFLICT (source_url, event_date) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, updated_at = NOW()
                """, (event["title"], re.sub(r"[^a-z0-9]+", "-", event["title"].lower()).strip("-"), event["summary"], event_date, event["locationName"], event["address"], event["city"], event["genre"], source_url, source_hash))
                count += 1
    return count


def main() -> dict[str, int]:
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    approved: list[tuple[dict[str, Any], str]] = []
    posts = scrape_posts()
    for item in posts:
        if not within_last_five_days(item):
            continue
        caption = str(item.get("caption") or item.get("text") or "")
        ocr_text = "" if approved_text(caption) else ocr_image(client, str(item.get("displayUrl") or item.get("imageUrl") or ""))
        text = "\n".join(part for part in (caption, ocr_text) if part)
        if approved_text(text):
            approved.append((item, text))
    events = extract_events(client, approved) if approved else []
    imported = 0
    for event in events:
        source_url = str(event.get("sourceUrl") or next((item.get("url") for item, _ in approved if item.get("url")), ""))
        if source_url:
            imported += upsert_postgres([event], source_url)
    return {"received_posts": len(posts), "approved_posts": len(approved), "structured_events": len(events), "imported": imported}


if __name__ == "__main__":
    print(main())
