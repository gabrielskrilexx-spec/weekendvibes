import { describe, expect, it } from "vitest";
import { mediaOriginClass, mediaOriginLabel } from "./Admin";

describe("Admin media origin helpers", () => {
  it("normaliza as origens de mídia para os rótulos da auditoria", () => {
    expect(mediaOriginLabel("instagram_story")).toBe("Story");
    expect(mediaOriginLabel("instagram_highlight")).toBe("Destaque");
    expect(mediaOriginLabel("instagram")).toBe("Post");
    expect(mediaOriginLabel(null)).toBe("Post");
  });

  it("mantém estilos visuais distintos para Story, Destaque e Post", () => {
    expect(mediaOriginClass("Story")).toContain("fuchsia");
    expect(mediaOriginClass("Destaque")).toContain("violet");
    expect(mediaOriginClass("Post")).toContain("blue");
  });
});
