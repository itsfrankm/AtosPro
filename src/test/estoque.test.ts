import { describe, it, expect, beforeEach } from "vitest";
import {
  lucroUnit,
  lucroPct,
  aplicarCompra,
  aplicarVenda,
  calcTotal,
  calcularTrocoDinheiro,
  gerarMovimentacoesCaixaVenda,
  formatCNPJ,
  criarEstadoEmBranco,
  proximoNumeroVenda,
  somaItens,
} from "@/lib/estoque";
import { proximoNumeroOS } from "@/lib/os-data";
import { dentroDoPeriodo } from "@/lib/financeiro-utils";
import {
  escaparBuscaIlike,
  sanitizarTexto,
  validarArquivoLogo,
  verificarRateLimit,
  resetarRateLimitParaTestes,
  MENSAGEM_RATE_LIMIT,
} from "@/lib/security";
import {
  registrarTentativaLoginLocal,
  obterStatusBloqueioEmail,
  limparTentativasLoginParaTestes,
  padronizarUsuarioId,
  ADMIN_PADRAO,
} from "@/lib/auth";

const p = [{ id: "a", nome: "A", sku: "", quantidade: 5, custo: 10, venda: 20 }];

describe("estoque, isolamento multi-tenant e camada de segurança", () => {
  beforeEach(() => {
    resetarRateLimitParaTestes();
    limparTentativasLoginParaTestes();
  });

  it("lucro unitário = venda - custo", () => expect(lucroUnit(10, 25)).toBe(15));
  it("porcentagem = (venda-custo)/custo*100", () => expect(lucroPct(10, 25)).toBe(150));
  it("compra soma quantidade e atualiza custo", () => {
    const r = aplicarCompra(p, [{ produtoId: "a", quantidade: 3, valorUnit: 12 }]);
    expect(r[0]!.quantidade).toBe(8);
    expect(r[0]!.custo).toBe(12);
  });
  it("venda dá baixa no estoque", () => expect(aplicarVenda(p, [{ produtoId: "a", quantidade: 2 }])[0]!.quantidade).toBe(3));
  it("venda nunca deixa estoque negativo", () => expect(aplicarVenda(p, [{ produtoId: "a", quantidade: 10 }])[0]!.quantidade).toBe(0));
  it("somaItens evita erros de ponto flutuante IEEE-754", () => {
    const itens = [
      { quantidade: 3, preco: 10.33333333 },
      { quantidade: 1, preco: 0.00000001 },
    ];
    expect(somaItens(itens)).toBe(31.0);
  });
  it("desconto em %", () => expect(calcTotal(100, 10, "%", null).total).toBe(90));
  it("desconto em R$ e valor final arredondado", () => {
    const r = calcTotal(100.75, 0.5, "R$", 100);
    expect(r.total).toBe(100);
    expect(r.arredondamento).toBe(-0.25);
  });
  it("formata CNPJ", () => expect(formatCNPJ("12345678000190")).toBe("12.345.678/0001-90"));

  it("inicializa estado em branco exclusivo para novos logins", () => {
    const novo = criarEstadoEmBranco();
    expect(novo.produtos).toHaveLength(0);
    expect(novo.fornecedores).toHaveLength(0);
    expect(novo.notas).toHaveLength(0);
    expect(novo.vendas).toHaveLength(0);
    expect(novo.caixa).toHaveLength(0);
    expect(novo.perfil.nome).toBe("");
    expect(novo.perfil.logo).toBe("");
    expect(novo.aparencia.paleta).toBe("azul-escuro");
    expect(novo.aparencia.modo).toBe("light");
  });

  it("padroniza o ID de criação de usuários (id sempre igual ao user_id UUID)", () => {
    expect(ADMIN_PADRAO.id).toBe(ADMIN_PADRAO.user_id);
    const legado = padronizarUsuarioId({
      id: "usr-b18b8b3a-716b-45b6-a5ae-1d92f4ee0000",
      user_id: "b18b8b3a-716b-45b6-a5ae-1d92f4ee0000",
      nome: "Convidado",
      email: "convidado.teste@gmail.com",
      role: "usuario",
      ativo: true,
      criadoEm: "2026-11-03 10:30",
    });
    expect(legado.id).toBe("b18b8b3a-716b-45b6-a5ae-1d92f4ee0000");
    expect(legado.user_id).toBe("b18b8b3a-716b-45b6-a5ae-1d92f4ee0000");
  });

  it("numeração sequencial de OS e Venda começa em #1 para cada usuário", () => {
    expect(proximoNumeroOS([])).toBe("OS-1");
    expect(
      proximoNumeroOS([
        { numero: "OS-1", cliente: "A", aparelho: "X", defeito: "Y", status: "Em Orçamento", entrada: "2026-10-28", valor: 100 },
      ]),
    ).toBe("OS-2");

    expect(proximoNumeroVenda([])).toBe(1);
    expect(
      proximoNumeroVenda([
        { id: "v1", numero: 1, dataHora: "2026-10-28", itens: [], subtotal: 50, desconto: 0, arredondamento: 0, total: 50 },
      ]),
    ).toBe(2);
  });

  it("escapa curingas SQL (%, _, ', ;, --) e sanitiza XSS", () => {
    expect(escaparBuscaIlike("100%_teste'; --")).toBe("100\\%\\_teste''");
    expect(sanitizarTexto("<script>alert(1)</script>iPhone 13")).toBe("iPhone 13");
  });

  it("bloqueia login por 15 minutos após 5 tentativas falhas seguidas", () => {
    const email = "teste@empresa.com.br";
    for (let i = 1; i <= 4; i++) {
      const r = registrarTentativaLoginLocal(email, false);
      expect(r.bloqueado).toBe(false);
      expect(r.falhas).toBe(i);
    }

    const quinta = registrarTentativaLoginLocal(email, false);
    expect(quinta.bloqueado).toBe(true);
    expect(quinta.falhas).toBe(5);
    expect(quinta.segundosRestantes).toBeGreaterThan(800);

    // Mesmo tentando logar com sucesso durante o bloqueio, continua bloqueado
    const tentativaDuranteBloqueio = registrarTentativaLoginLocal(email, true);
    expect(tentativaDuranteBloqueio.bloqueado).toBe(true);
    expect(obterStatusBloqueioEmail(email).bloqueado).toBe(true);
  });

  it("aplica rate limiting retornando mensagem amigável", () => {
    const r1 = verificarRateLimit("criar_os", "user-1");
    expect(r1.permitido).toBe(true);
    // Segunda chamada imediata (< 400ms) é barrada pelo controle de sequência
    const r2 = verificarRateLimit("criar_os", "user-1");
    expect(r2.permitido).toBe(false);
    expect(r2.erro).toBe(MENSAGEM_RATE_LIMIT);
  });

  it("valida upload de logo (apenas PNG, JPG, WEBP até 5MB na pasta {user_id}/)", () => {
    const okPng = validarArquivoLogo(
      { name: "minha-logo.png", type: "image/png", size: 500_000 },
      "user-abc-123",
    );
    expect(okPng.valido).toBe(true);
    expect(okPng.caminhoStorage).toMatch(/^user-abc-123\/logo-\d+\.png$/);

    const erroSvg = validarArquivoLogo(
      { name: "vetor.svg", type: "image/svg+xml", size: 10_000 },
      "user-abc-123",
    );
    expect(erroSvg.valido).toBe(false);

    const erroTamanho = validarArquivoLogo(
      { name: "grande.jpg", type: "image/jpeg", size: 6 * 1024 * 1024 },
      "user-abc-123",
    );
    expect(erroTamanho.valido).toBe(false);
  });

  it("calcula troco em dinheiro e registra entrada física + saída automática de troco no Caixa", () => {
    const calc = calcularTrocoDinheiro(40, 50);
    expect(calc.valorAbatido).toBe(40);
    expect(calc.valorRecebido).toBe(50);
    expect(calc.troco).toBe(10);

    const movs = gerarMovimentacoesCaixaVenda({
      id: "venda-10",
      numero: 10,
      dataHora: "2026-10-29T12:00:00.000Z",
      itens: [{ produtoId: "p3", nome: "Conector de carga USB-C", quantidade: 1, preco: 40, custoUnit: 8 }],
      subtotal: 40,
      desconto: 0,
      arredondamento: 0,
      total: 40,
      pagamentos: [{ forma: "Dinheiro", valor: 40, valorRecebido: 50, troco: 10 }],
      valorRecebidoDinheiro: 50,
      troco: 10,
    });

    expect(movs).toHaveLength(2);
    const entrada = movs.find((m) => m.tipo === "entrada")!;
    const saida = movs.find((m) => m.tipo === "saida")!;

    expect(entrada.valor).toBe(50);
    expect(saida.valor).toBe(10);
    expect(saida.descricao).toBe("Troco da Venda #10");
    expect(entrada.valor - saida.valor).toBe(40);
  });

  it("filtra corretamente os 4 modos de Dashboard (Diário, Semanal, Mensal e Anual)", () => {
    expect(dentroDoPeriodo("2026-10-29", "diario", "2026-10-29")).toBe(true);
    expect(dentroDoPeriodo("2026-10-28", "diario", "2026-10-29")).toBe(false);

    expect(dentroDoPeriodo("2026-10-25", "semanal", "2026-10-29")).toBe(true);
    expect(dentroDoPeriodo("2026-10-10", "semanal", "2026-10-29")).toBe(false);

    expect(dentroDoPeriodo("2026-10-05", "mensal", "2026-10")).toBe(true);
    expect(dentroDoPeriodo("2026-09-30", "mensal", "2026-10")).toBe(false);

    expect(dentroDoPeriodo("2026-03-15", "anual", "2026")).toBe(true);
    expect(dentroDoPeriodo("2025-12-31", "anual", "2026")).toBe(false);
  });
});
