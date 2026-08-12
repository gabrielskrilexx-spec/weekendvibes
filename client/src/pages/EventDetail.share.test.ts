import { describe, expect, it, vi } from "vitest";
import { shareEventLink } from "./EventDetail";

describe("shareEventLink", () => {
  const data = { title: "Evento teste", text: "Confira este evento", url: "https://weekendvibes.test/eventos/evento" };

  it("usa Web Share quando disponível", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(shareEventLink(data, { share, writeText })).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith(data);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copia o link quando Web Share não está disponível", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(shareEventLink(data, { writeText })).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(data.url);
  });

  it("retorna cancelado quando o compartilhamento falha", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard indisponível"));

    await expect(shareEventLink(data, { writeText })).resolves.toBe("cancelled");
  });
});
