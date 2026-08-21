#!/usr/bin/env bash
set -u
url="https://weekendvib-jscaalye.manus.space/admin/health?cache=programmatic-4a464f29-$(date +%s)"
for attempt in 1 2 3; do
  body="$(curl -fsSL --max-time 15 "$url" 2>/dev/null || true)"
  version="$(printf '%s' "$body" | sed -n 's/.*Versão do painel:\{0,1\} \?\([^<[:space:]]*\).*/\1/p' | head -1)"
  if [ -z "$version" ]; then version="tag-not-found"; fi
  printf 'attempt=%s version=%s\n' "$attempt" "$version"
  [ "$version" = "4a464f29" ] && exit 0
  [ "$attempt" -lt 3 ] && sleep 10
done
exit 2
