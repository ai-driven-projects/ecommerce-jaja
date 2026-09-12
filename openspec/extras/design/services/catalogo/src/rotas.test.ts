import { describe, expect, it } from "vitest";
import { createService } from "./servico.js";

const { app } = createService({ dbPath: ":memory:" });

describe("GET /eta", () => {
  it("soma preparo do hub + deslocamento do bairro", async () => {
    const res = await app.inject({ url: "/eta?bairro=Aldeota" });
    expect(res.statusCode).toBe(200);
    // Hub Aldeota: preparo 8 + deslocamento 6
    expect(res.json()).toMatchObject({ hub: "Hub Aldeota", etaMin: 14 });
  });

  it("responde 404 com a lista de bairros quando não atendido", async () => {
    const res = await app.inject({ url: "/eta?bairro=Papicu" });
    expect(res.statusCode).toBe(404);
    expect(res.json().erro).toBe("bairro_nao_atendido");
    expect(res.json().bairrosAtendidos.length).toBeGreaterThan(0);
  });
});

describe("GET /produtos/:slug", () => {
  it("devolve o estoque do hub certo para bairros diferentes", async () => {
    // envelope-pardo-a4: 16 no hub Aldeota, 0 no hub Centro
    const aldeota = await app.inject({ url: "/produtos/envelope-pardo-a4?bairro=Aldeota" });
    expect(aldeota.statusCode).toBe(200);
    expect(aldeota.json()).toMatchObject({ hub: "Hub Aldeota", estoque: 16 });

    const centro = await app.inject({ url: "/produtos/envelope-pardo-a4?bairro=Centro" });
    expect(centro.json()).toMatchObject({ hub: "Hub Centro", estoque: 0 });
  });

  it("traz até 3 relacionados da mesma categoria com estoque no hub", async () => {
    const res = await app.inject({ url: "/produtos/cafe-coado-1l?bairro=Aldeota" });
    const relacionados = res.json().relacionados;
    expect(relacionados.length).toBeLessThanOrEqual(3);
    for (const r of relacionados) expect(r.categoria).toBe("café e lanches");
  });

  it("responde 404 para slug inexistente", async () => {
    const res = await app.inject({ url: "/produtos/nao-existe?bairro=Aldeota" });
    expect(res.statusCode).toBe(404);
    expect(res.json().erro).toBe("produto_nao_encontrado");
  });
});
