import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adminSource = readFileSync(new URL("./Admin.tsx", import.meta.url), "utf8");

describe("Admin — entrada de eventos", () => {
  it("remove a criação manual e mantém somente a importação de link avulso", () => {
    expect(adminSource).not.toContain("Novo evento");
    expect(adminSource).not.toContain("Adicionar evento");
    expect(adminSource).not.toContain("trpc.events.create.useMutation");
    expect(adminSource).not.toContain("trpc.events.update.useMutation");
    expect(adminSource).not.toContain("Extrair e preencher formulário");
    expect(adminSource).toContain("Importar link avulso");
    expect(adminSource).toContain("trpc.events.importOneOffUrl.useMutation");
  });
});
