const base = process.env.BUILT_IN_FORGE_API_URL;
const key = process.env.BUILT_IN_FORGE_API_KEY;

if (!base || !key) {
  console.log("missing_server_maps_env");
  process.exit(0);
}

const url = new URL(`${base.replace(/\/+$/, "")}/v1/maps/proxy/maps/api/js`);
url.searchParams.set("key", key);
url.searchParams.set("origin", "http://127.0.0.1:3000");
url.searchParams.set("v", "weekly");
url.searchParams.set("loading", "async");
url.searchParams.set("libraries", "marker,places,geocoding,geometry,routes");

try {
  const response = await fetch(url, {
    headers: { Accept: "application/javascript", Origin: "http://127.0.0.1:3000" },
  });
  const body = await response.text();
  console.log(JSON.stringify({
    status: response.status,
    contentType: response.headers.get("content-type"),
    bytes: body.length,
    prefix: body.slice(0, 40),
  }));
} catch (error) {
  console.log(JSON.stringify({ error: error instanceof Error ? error.name : "unknown" }));
}
