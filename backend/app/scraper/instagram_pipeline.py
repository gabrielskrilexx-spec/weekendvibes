"""Portable WeekendVibes Instagram agenda collector.

The managed application uses the TypeScript pipeline. This module mirrors its
safe contract for PostgreSQL deployments: official Meta Business Discovery is
preferred when its two secrets are present; otherwise only public profile HTML
is read. Redirects and rate limits produce an empty, valid collection rather
than fabricated events.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import requests
from openai import OpenAI

META_GRAPH_BASE_URL = "https://graph.facebook.com/v26.0"
MODEL = "gpt-4o-mini"
LOOKBACK_DAYS = 5
TARGETS = {
    "Moby House": ("mobydicksantos", "https://www.instagram.com/mobydicksantos/"),
    "Projac Bar": ("projac.bar", "https://www.instagram.com/projac.bar/"),
    "Meu Lugar Bar e Entretenimento": ("meulugar.bar", "https://www.instagram.com/meulugar.bar/"),
    "Nosso After": ("nossoafterguaruja", "https://www.instagram.com/nossoafterguaruja/"),
    "Curvão Surf House": ("curvaosurfhouse", "https://www.instagram.com/curvaosurfhouse/"),
    "Flamingo Bar": ("flamingomusicbar", "https://www.instagram.com/flamingomusicbar/"),
    "Rocket Sea Club": ("rocketseaclub", "https://www.instagram.com/rocketseaclub/"),
    "Ativa House": ("ativahouse", "https://www.instagram.com/ativahouse/"),
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


def _silent_status(status: int) -> bool:
    return status in {302, 303, 307, 308, 429}


def _public_posts() -> list[dict[str, Any]]:
    posts: list[dict[str, Any]] = []
    for _name, (username, url) in TARGETS.items():
        response = requests.get(url, headers={"Accept": "text/html", "User-Agent": "WeekendVibes/1.0"}, allow_redirects=False, timeout=30)
        if _silent_status(response.status_code):
            continue
        response.raise_for_status()
        captions = re.findall(r'"text"\s*:\s*"((?:\\.|[^"\\])*)', response.text)
        timestamps = re.findall(r'"taken_at_timestamp"\s*:\s*(\d+)', response.text)
        for index, caption in enumerate(captions):
            posts.append({"caption": bytes(caption, "utf-8").decode("unicode_escape"), "timestamp": timestamps[index] if index < len(timestamps) else None, "ownerUsername": username, "url": url})
    return posts


def _meta_posts() -> list[dict[str, Any]]:
    token = os.getenv("META_INSTAGRAM_TOKEN", "").strip()
    account_id = os.getenv("META_INSTAGRAM_ACCOUNT_ID", "").strip()
    if not token or not account_id:
        return _public_posts()
    posts: list[dict[str, Any]] = []
    for _name, (username, _url) in TARGETS.items():
        fields = f"business_discovery.username({username}){{username,media.limit(25){{id,caption,timestamp,permalink,media_url}}}}"
        response = requests.get(f"{META_GRAPH_BASE_URL}/{account_id}", params={"fields": fields, "access_token": token}, timeout=30)
        if _silent_status(response.status_code):
            continue
        response.raise_for_status()
        media = response.json().get("business_discovery", {}).get("media", {}).get("data", [])
        posts.extend({"caption": item.get("caption", ""), "timestamp": item.get("timestamp"), "url": item.get("permalink"), "displayUrl": item.get("media_url"), "ownerUsername": username} for item in media)
    return posts


def scrape_posts() -> list[dict[str, Any]]:
    return _meta_posts()


def ocr_image(client: OpenAI, image_url: str) -> str:
    if not image_url:
        return ""
    result = client.chat.completions.create(model=MODEL, temperature=0, messages=[{"role": "user", "content": [{"type": "text", "text": "Transcreva literalmente todo o texto legível da imagem. Não resuma nem invente."}, {"type": "image_url", "image_url": {"url": image_url, "detail": "high"}}]}])
    return result.choices[0].message.content or ""


def extract_events(client: OpenAI, approved: list[tuple[dict[str, Any], str]]) -> list[dict[str, Any]]:
    raw = "\n\n".join(f"SOURCE_URL: {item.get('url', '')}\nRAW_POST_TEXT: {text}" for item, text in approved)
    completion = client.beta.chat.completions.parse(model=MODEL, temperature=0, messages=[{"role": "system", "content": "Extraia somente eventos musicais futuros de fim de semana em Santos ou Guarujá. Use apenas fatos presentes no texto. Descarte eventos sem data, cidade, endereço ou gênero verificáveis. Normalize os gêneros para funk, house_eletronica, samba_pagode ou rap_trap."}, {"role": "user", "content": raw[:48000]}], response_format={"type": "json_schema", "json_schema": {"name": "instagram_weekend_events", "strict": True, "schema": {"type": "object", "properties": {"events": {"type": "array", "items": {"type": "object", "properties": {"title": {"type": "string"}, "summary": {"type": "string"}, "eventDate": {"type": "string"}, "locationName": {"type": "string"}, "address": {"type": "string"}, "city": {"type": "string", "enum": ["Santos", "Guarujá"]}, "genre": {"type": "string", "enum": ["funk", "house_eletronica", "samba_pagode", "rap_trap"]}, "sourceUrl": {"type": "string"}}, "required": ["title", "summary", "eventDate", "locationName", "address", "city", "genre", "sourceUrl"], "additionalProperties": False}}}, "required": ["events"], "additionalProperties": False}}})
    return completion.choices[0].message.parsed["events"]


def upsert_postgres(events: list[dict[str, Any]], source_url: str) -> int:
    import psycopg
    count = 0
    with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
        with connection.cursor() as cursor:
            for event in events:
                event_date = datetime.fromisoformat(event["eventDate"].replace("Z", "+00:00"))
                source_hash = hashlib.md5(f"{source_url}|{event_date.date()}|{event['title']}".encode()).hexdigest()
                cursor.execute("""INSERT INTO events (title, slug, description, event_date, location_name, address, city, category, genre, price_cents, price_note, source_url, source_hash, is_published, is_archived) VALUES (%s, %s, %s, %s, %s, %s, %s, 'evento_musical', %s, 0, 'Preço não informado na agenda do Instagram', %s, %s, 1, 0) ON CONFLICT (source_url, event_date) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, updated_at = NOW()""", (event["title"], re.sub(r"[^a-z0-9]+", "-", event["title"].lower()).strip("-"), event["summary"], event_date, event["locationName"], event["address"], event["city"], event["genre"], source_url, source_hash))
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
    imported = sum(upsert_postgres([event], str(event.get("sourceUrl", ""))) for event in events if event.get("sourceUrl"))
    return {"received_posts": len(posts), "approved_posts": len(approved), "structured_events": len(events), "imported": imported}


if __name__ == "__main__":
    print(json.dumps(main()))
