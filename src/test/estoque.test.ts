import { describe, it, expect } from "vitest";
import { lucroUnit, lucroPct, aplicarCompra, aplicarVenda, calcTotal, formatCNPJ } from "@/lib/estoque";

const p = [{ id: "a", nome: "A", sku: "", quantidade: 5, custo: 10, venda: 20 }];

describe("estoque", () => {
  it("lucro unitário = venda - custo", () => expect(lucroUnit(10, 25)).toBe(15));
  it("porcentagem = (venda-custo)/custo*100", () => expect(lucroPct(10, 25)).toBe(150));
  it("compra soma quantidade e atualiza custo", () => {
    const r = aplicarCompra(p, [{ produtoId: "a", quantidade: 3, valorUnit: 12 }]);
    expect(r[0]!.quantidade).toBe(8);
    expect(r[0]!.custo).toBe(12);
  });
  it("venda dá baixa no estoque", () => expect(aplicarVenda(p, [{ produtoId: "a", quantidade: 2 }])[0]!.quantidade).toBe(3));
  it("desconto em %", () => expect(calcTotal(100, 10, "%", null).total).toBe(90));
  it("desconto em R$ e valor final arredondado", () => {
    const r = calcTotal(100.75, 0.5, "R$", 100);
    expect(r.total).toBe(100);
    expect(r.arredondamento).toBe(-0.25);
  });
  it("formata CNPJ", () => expect(formatCNPJ("12345678000190")).toBe("12.345.678/0001-90"));
});
