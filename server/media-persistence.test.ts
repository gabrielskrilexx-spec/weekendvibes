import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchExternalMock, storagePutMock } = vi.hoisted(() => ({
  fetchExternalMock: vi.fn(),
  storagePutMock: vi.fn(),
}));

vi.mock("./external-fetch", () => ({ fetchExternal: fetchExternalMock }));
vi.mock("./storage", () => ({ storagePut: storagePutMock }));

import { clearPersistentImageCacheForTests, persistRemoteImage } from "./media-persistence";

describe("media persistence", () => {
  beforeEach(() => {
    clearPersistentImageCacheForTests();
    fetchExternalMock.mockReset();
    storagePutMock.mockReset();
    storagePutMock.mockResolvedValue({ key: "event-covers/hash.jpg", url: "/manus-storage/event-covers/hash.jpg" });
  });

  it("downloads a remote image and stores a durable project URL", async () => {
    fetchExternalMock.mockResolvedValue(new Response(Uint8Array.from([1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg", "content-length": "3" } }));

    await expect(persistRemoteImage("https://cdn.example/flyer.jpg", "event-covers")).resolves.toBe("/manus-storage/event-covers/hash.jpg");
    expect(fetchExternalMock).toHaveBeenCalledWith("https://cdn.example/flyer.jpg", expect.objectContaining({ headers: expect.anything() }), 8_000, false);
    expect(storagePutMock).toHaveBeenCalledWith(expect.stringMatching(/^event-covers\/[a-f0-9]{64}\.jpg$/), expect.any(Buffer), "image/jpeg");
  });

  it("deduplicates concurrent downloads for the same remote URL", async () => {
    fetchExternalMock.mockResolvedValue(new Response(Uint8Array.from([1]), { status: 200, headers: { "content-type": "image/png" } }));

    const results = await Promise.all([
      persistRemoteImage("https://cdn.example/same.png"),
      persistRemoteImage("https://cdn.example/same.png"),
    ]);

    expect(results).toEqual(["/manus-storage/event-covers/hash.jpg", "/manus-storage/event-covers/hash.jpg"]);
    expect(fetchExternalMock).toHaveBeenCalledTimes(1);
    expect(storagePutMock).toHaveBeenCalledTimes(1);
  });

  it("ignores non-image responses and keeps durable URLs untouched", async () => {
    fetchExternalMock.mockResolvedValue(new Response("not an image", { status: 200, headers: { "content-type": "text/html" } }));

    await expect(persistRemoteImage("https://ticket.example/og-image")).resolves.toBeNull();
    await expect(persistRemoteImage("/manus-storage/event-covers/already.jpg")).resolves.toBe("/manus-storage/event-covers/already.jpg");
    expect(storagePutMock).not.toHaveBeenCalled();
  });
});
