import { describe, expect, it, vi } from "vitest";
import { canonicalEventUrl, shareEventLink } from "./event-share";

describe("event share helper", () => {
  it("monta a URL canônica por ID", () => {
    expect(canonicalEventUrl(42, "https://weekendvibes.example/")).toBe("https://weekendvibes.example/evento/42");
  });

  it("usa navigator.share quando disponível", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    const result = await shareEventLink({ title: "Festa", text: "Confira", url: "https://example.com/evento/1" }, { share, writeText });
    expect(result).toBe("shared");
    expect(share).toHaveBeenCalledOnce();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copia no clipboard quando o compartilhamento nativo não existe", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await shareEventLink({ title: "Festa", text: "Confira", url: "https://example.com/evento/1" }, { writeText });
    expect(result).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://example.com/evento/1");
  });
});
