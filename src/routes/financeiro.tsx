import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Receipt,
  ShoppingCart,
  Smartphone,
  Truck,
  Layers,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, dataBR, isOSCancelada, isOSFinalizada, useOrdens, type OrdemServico } from "@/lib/os-data";
import { useEstoque, type Produto, type Venda } from "@/lib/estoque";
import {
  type Periodo,
  dentroDoPeriodo,
  dataLocalISO,
  parseISO,
  MESES_NOMES,
  MESES_CURTOS,
  DIAS_SEMANA,
} from "@/lib/financeiro-utils";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "AtosPro" },
      {
        name: "description",
        content: "Dashboards financeiros diário, semanal, mensal e anual, faturamento, lucro líquido, caixa e custos.",
      },
      { property: "og:title", content: "AtosPro" },
      {
        property: "og:description",
        content: "Dashboards financeiros diário, semanal, mensal e anual, faturamento, lucro líquido, caixa e custos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Financeiro,
});

function extrairYmd(isoOrLocal: string): string {
  if (!isoOrLocal) return "";
  const d = new Date(isoOrLocal);
  if (!Number.isNaN(d.getTime()) && isoOrLocal.includes("T")) {
    return dataLocalISO(d);
  }
  return isoOrLocal.slice(0, 10);
}

function dataFinalOS(o: OrdemServico): string {
  return o.finalizacao && o.finalizacao.trim() ? o.finalizacao : o.entrada;
}

function custoDaVenda(v: Venda, produtos: Produto[]): number {
  return v.itens.reduce((acc, it) => {
    const custoUnit = it.custoUnit ?? produtos.find((p) => p.id === it.produtoId)?.custo ?? 0;
    return acc + it.quantidade * custoUnit;
  }, 0);
}

function formatMesAno(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return `${MESES_NOMES[m - 1] ?? ""}/${y}`;
}

function Financeiro() {
  const hojeYmd = useMemo(() => dataLocalISO(), []);

  const [periodo, setPeriodo] = useState<Periodo>("diario");
  const [dataDiaria, setDataDiaria] = useState<string>(hojeYmd);
  const [dataSemanal, setDataSemanal] = useState<string>(hojeYmd);
  const [mesMensal, setMesMensal] = useState<string>(hojeYmd.slice(0, 7));
  const [anoAnual, setAnoAnual] = useState<string>(hojeYmd.slice(0, 4));
  const [abaConsolidado, setAbaConsolidado] = useState<"lucro" | "despesas">("lucro");

  const { produtos, fornecedores, notas, vendas, caixa = [] } = useEstoque();
  const ordens = useOrdens();

  const refAtiva = useMemo(() => {
    if (periodo === "diario") return dataDiaria || hojeYmd;
    if (periodo === "semanal") return dataSemanal || hojeYmd;
    if (periodo === "mensal") return mesMensal || hojeYmd.slice(0, 7);
    return anoAnual || hojeYmd.slice(0, 4);
  }, [periodo, dataDiaria, dataSemanal, mesMensal, anoAnual, hojeYmd]);

  // Vendas enriquecidas com custo e lucro líquido
  const vendasEnriquecidas = useMemo(() => {
    return vendas
      .map((v) => {
        const dataYmd = extrairYmd(v.dataHora);
        const custoProdutos = +custoDaVenda(v, produtos).toFixed(2);
        const lucroLiquido = +(v.total - custoProdutos).toFixed(2);
        return {
          ...v,
          dataYmd,
          custoProdutos,
          lucroLiquido,
        };
      })
      .sort((a, b) => b.dataHora.localeCompare(a.dataHora));
  }, [vendas, produtos]);

  // Ordens de Serviço finalizadas enriquecidas com custo de peça e lucro líquido (excluindo OS Cancelada)
  const servicosFinalizados = useMemo(() => {
    return ordens
      .filter((o) => !isOSCancelada(o.status) && isOSFinalizada(o.status))
      .map((o) => {
        const dataFinal = dataFinalOS(o);
        const custoPeca = +(o.custoPeca ?? 0).toFixed(2);
        const valorCobrado = +(o.valor ?? 0).toFixed(2);
        const lucroLiquido = +(valorCobrado - custoPeca).toFixed(2);
        return {
          ...o,
          dataFinal,
          custoPeca,
          valorCobrado,
          lucroLiquido,
        };
      })
      .sort((a, b) => b.dataFinal.localeCompare(a.dataFinal));
  }, [ordens]);

  // Notas de compras de fornecedores enriquecidas
  const notasEnriquecidas = useMemo(() => {
    return notas
      .map((n) => {
        const forn = fornecedores.find((f) => f.id === n.fornecedorId);
        return {
          ...n,
          fornecedorNome: forn?.nome ?? "Fornecedor não identificado",
          fornecedorCnpj: forn?.cnpj || "—",
        };
      })
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [notas, fornecedores]);

  // Movimentações do Caixa enriquecidas com dataYmd
  const caixaEnriquecido = useMemo(() => {
    return caixa
      .map((m) => ({
        ...m,
        dataYmd: extrairYmd(m.dataHora),
        valorAssinado: m.tipo === "entrada" ? +m.valor : -m.valor,
      }))
      .sort((a, b) => b.dataHora.localeCompare(a.dataHora));
  }, [caixa]);

  // Filtragem pelo período selecionado (Diário, Semanal, Mensal ou Anual) e data/mês/ano correspondente
  const vendasFiltradas = useMemo(
    () => vendasEnriquecidas.filter((v) => dentroDoPeriodo(v.dataYmd, periodo, refAtiva)),
    [vendasEnriquecidas, periodo, refAtiva],
  );

  const servicosFiltrados = useMemo(
    () => servicosFinalizados.filter((s) => dentroDoPeriodo(s.dataFinal, periodo, refAtiva)),
    [servicosFinalizados, periodo, refAtiva],
  );

  const notasFiltradas = useMemo(
    () => notasEnriquecidas.filter((n) => dentroDoPeriodo(n.data, periodo, refAtiva)),
    [notasEnriquecidas, periodo, refAtiva],
  );

  const caixaFiltrado = useMemo(
    () => caixaEnriquecido.filter((m) => dentroDoPeriodo(m.dataYmd, periodo, refAtiva)),
    [caixaEnriquecido, periodo, refAtiva],
  );

  // Anos disponíveis para o seletor Anual
  const anosDisponiveis = useMemo(() => {
    const anos = new Set<string>([
      hojeYmd.slice(0, 4),
      "2024",
      "2025",
      "2026",
      "2027",
    ]);
    for (const v of vendasEnriquecidas) if (v.dataYmd) anos.add(v.dataYmd.slice(0, 4));
    for (const s of servicosFinalizados) if (s.dataFinal) anos.add(s.dataFinal.slice(0, 4));
    for (const n of notasEnriquecidas) if (n.data) anos.add(n.data.slice(0, 4));
    for (const c of caixaEnriquecido) if (c.dataYmd) anos.add(c.dataYmd.slice(0, 4));
    return Array.from(anos).filter(Boolean).sort((a, b) => b.localeCompare(a));
  }, [hojeYmd, vendasEnriquecidas, servicosFinalizados, notasEnriquecidas, caixaEnriquecido]);

  // Métricas dos Cards de Resumo + Vínculo com "Caixa"
  const resumo = useMemo(() => {
    const faturamentoVendas = vendasFiltradas.reduce((s, v) => s + v.total, 0);
    const faturamentoServicos = servicosFiltrados.reduce((s, o) => s + o.valorCobrado, 0);
    const faturamentoTotal = faturamentoVendas + faturamentoServicos;

    const lucroVendas = vendasFiltradas.reduce((s, v) => s + v.lucroLiquido, 0);
    const lucroServicos = servicosFiltrados.reduce((s, o) => s + o.lucroLiquido, 0);
    const lucroOperacional = lucroVendas + lucroServicos;

    const caixaAvulsoFiltrado = caixaFiltrado.filter((m) => !m.origemVendaId);
    const saldoCaixaAvulsoPeriodo = +caixaAvulsoFiltrado.reduce((s, m) => s + m.valorAssinado, 0).toFixed(2);

    const caixaEntradas = caixaFiltrado
      .filter((m) => m.tipo === "entrada")
      .reduce((s, m) => s + m.valor, 0);
    const caixaSaidas = caixaFiltrado
      .filter((m) => m.tipo === "saida")
      .reduce((s, m) => s + m.valor, 0);
    const saldoCaixaPeriodo = caixaEntradas - caixaSaidas;

    const caixaEntradasGlobal = caixaEnriquecido
      .filter((m) => m.tipo === "entrada")
      .reduce((s, m) => s + m.valor, 0);
    const caixaSaidasGlobal = caixaEnriquecido
      .filter((m) => m.tipo === "saida")
      .reduce((s, m) => s + m.valor, 0);
    const saldoFisicoCaixaGlobal = caixaEntradasGlobal - caixaSaidasGlobal;

    const custosNotasFornecedores = notasFiltradas.reduce((s, n) => s + n.total, 0);
    const custoProdutosVendidos = vendasFiltradas.reduce((s, v) => s + v.custoProdutos, 0);
    const custoPecasOS = servicosFiltrados.reduce((s, o) => s + o.custoPeca, 0);

    // Saldo Total com Caixa = Lucro Líquido das Vendas + Lucro Líquido dos Serviços (OS) + Movimentações Avulsas da Gaveta (Caixa)
    const lucroLiquidoTotal = lucroOperacional;
    const saldoTotalComCaixa = +(lucroOperacional + saldoCaixaAvulsoPeriodo).toFixed(2);
    const saldoLiquidoFinalCaixaEmpresa = saldoTotalComCaixa;

    const qtdOperacoes = vendasFiltradas.length + servicosFiltrados.length;
    const ticketMedio = qtdOperacoes > 0 ? faturamentoTotal / qtdOperacoes : 0;

    return {
      faturamentoVendas,
      faturamentoServicos,
      faturamentoTotal,
      lucroVendas,
      lucroServicos,
      lucroOperacional,
      lucroLiquidoTotal,
      caixaEntradas,
      caixaSaidas,
      saldoCaixaPeriodo,
      saldoFisicoCaixaGlobal,
      saldoTotalComCaixa,
      saldoLiquidoFinalCaixaEmpresa,
      custosNotasFornecedores,
      custoProdutosVendidos,
      custoPecasOS,
      qtdOperacoes,
      ticketMedio,
    };
  }, [vendasFiltradas, servicosFiltrados, notasFiltradas, caixaFiltrado, caixaEnriquecido]);

  // Dados dos gráficos de acordo com o período selecionado (Diário, Semanal, Mensal ou Anual)
  const dadosGrafico = useMemo(() => {
    if (periodo === "diario") {
      const ymd = refAtiva.slice(0, 10);
      const d = parseISO(ymd);
      const diaLabel = `${DIAS_SEMANA[d.getDay()]} (${dataBR(ymd)})`;

      const recVendas = vendasFiltradas.reduce((s, x) => s + x.total, 0);
      const recServicos = servicosFiltrados.reduce((s, x) => s + x.valorCobrado, 0);
      const saldoCx = caixaFiltrado.filter((m) => !m.origemVendaId).reduce((s, x) => s + x.valorAssinado, 0);
      const lucDia =
        vendasFiltradas.reduce((s, x) => s + x.lucroLiquido, 0) +
        servicosFiltrados.reduce((s, x) => s + x.lucroLiquido, 0) +
        saldoCx;
      const custDia = notasFiltradas.reduce((s, x) => s + x.total, 0);

      return [
        {
          label: diaLabel,
          Faturamento: +(recVendas + recServicos).toFixed(2),
          "Lucro Líquido": +lucDia.toFixed(2),
          "Custos/Compras": +custDia.toFixed(2),
          Vendas: +recVendas.toFixed(2),
          Serviços: +recServicos.toFixed(2),
          Caixa: +saldoCx.toFixed(2),
        },
      ];
    }

    if (periodo === "semanal") {
      const refDate = parseISO(refAtiva.slice(0, 10));
      const pontos: {
        label: string;
        Faturamento: number;
        "Lucro Líquido": number;
        "Custos/Compras": number;
        Vendas: number;
        Serviços: number;
        Caixa: number;
      }[] = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date(refDate);
        d.setDate(refDate.getDate() - i);
        const ymd = dataLocalISO(d);
        const diaLabel = `${DIAS_SEMANA[d.getDay()]} (${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")})`;

        const vDia = vendasFiltradas.filter((v) => v.dataYmd === ymd);
        const sDia = servicosFiltrados.filter((s) => s.dataFinal === ymd);
        const nDia = notasFiltradas.filter((n) => n.data === ymd);
        const cDia = caixaFiltrado.filter((m) => m.dataYmd === ymd && !m.origemVendaId);

        const recVendas = vDia.reduce((s, x) => s + x.total, 0);
        const recServicos = sDia.reduce((s, x) => s + x.valorCobrado, 0);
        const saldoCx = cDia.reduce((s, x) => s + x.valorAssinado, 0);
        const lucDia =
          vDia.reduce((s, x) => s + x.lucroLiquido, 0) +
          sDia.reduce((s, x) => s + x.lucroLiquido, 0) +
          saldoCx;
        const custDia = nDia.reduce((s, x) => s + x.total, 0);

        pontos.push({
          label: diaLabel,
          Faturamento: +(recVendas + recServicos).toFixed(2),
          "Lucro Líquido": +lucDia.toFixed(2),
          "Custos/Compras": +custDia.toFixed(2),
          Vendas: +recVendas.toFixed(2),
          Serviços: +recServicos.toFixed(2),
          Caixa: +saldoCx.toFixed(2),
        });
      }
      return pontos;
    }

    if (periodo === "mensal") {
      const semanas = ["Semana 1 (01–07)", "Semana 2 (08–14)", "Semana 3 (15–21)", "Semana 4 (22–28)", "Semana 5 (29–31)"];
      const idxSemana = (ymd: string) => {
        const dia = Number(ymd.slice(8, 10)) || 1;
        return Math.min(4, Math.floor((dia - 1) / 7));
      };

      return semanas.map((label, idx) => {
        const vSem = vendasFiltradas.filter((v) => idxSemana(v.dataYmd) === idx);
        const sSem = servicosFiltrados.filter((s) => idxSemana(s.dataFinal) === idx);
        const nSem = notasFiltradas.filter((n) => idxSemana(n.data) === idx);
        const cSem = caixaFiltrado.filter((m) => idxSemana(m.dataYmd) === idx && !m.origemVendaId);

        const recVendas = vSem.reduce((s, x) => s + x.total, 0);
        const recServicos = sSem.reduce((s, x) => s + x.valorCobrado, 0);
        const saldoCx = cSem.reduce((s, x) => s + x.valorAssinado, 0);
        const lucSem =
          vSem.reduce((s, x) => s + x.lucroLiquido, 0) +
          sSem.reduce((s, x) => s + x.lucroLiquido, 0) +
          saldoCx;
        const custSem = nSem.reduce((s, x) => s + x.total, 0);

        return {
          label,
          Faturamento: +(recVendas + recServicos).toFixed(2),
          "Lucro Líquido": +lucSem.toFixed(2),
          "Custos/Compras": +custSem.toFixed(2),
          Vendas: +recVendas.toFixed(2),
          Serviços: +recServicos.toFixed(2),
          Caixa: +saldoCx.toFixed(2),
        };
      });
    }

    // Anual: 12 meses do ano selecionado
    const anoRef = refAtiva.slice(0, 4);
    return MESES_CURTOS.map((mesLabel, idx) => {
      const prefix = `${anoRef}-${String(idx + 1).padStart(2, "0")}`;
      const vMes = vendasFiltradas.filter((v) => v.dataYmd.startsWith(prefix));
      const sMes = servicosFiltrados.filter((s) => s.dataFinal.startsWith(prefix));
      const nMes = notasFiltradas.filter((n) => n.data.startsWith(prefix));
      const cMes = caixaFiltrado.filter((m) => m.dataYmd.startsWith(prefix) && !m.origemVendaId);

      const recVendas = vMes.reduce((s, x) => s + x.total, 0);
      const recServicos = sMes.reduce((s, x) => s + x.valorCobrado, 0);
      const saldoCx = cMes.reduce((s, x) => s + x.valorAssinado, 0);
      const lucMes =
        vMes.reduce((s, x) => s + x.lucroLiquido, 0) +
        sMes.reduce((s, x) => s + x.lucroLiquido, 0) +
        saldoCx;
      const custMes = nMes.reduce((s, x) => s + x.total, 0);

      return {
        label: mesLabel,
        Faturamento: +(recVendas + recServicos).toFixed(2),
        "Lucro Líquido": +lucMes.toFixed(2),
        "Custos/Compras": +custMes.toFixed(2),
        Vendas: +recVendas.toFixed(2),
        Serviços: +recServicos.toFixed(2),
        Caixa: +saldoCx.toFixed(2),
      };
    });
  }, [periodo, refAtiva, vendasFiltradas, servicosFiltrados, notasFiltradas, caixaFiltrado]);

  // Tabela 4 - Aba 1: Consolidado Geral (Vendas + Serviços + item vinculado "Caixa")
  const operacoesConsolidadas = useMemo(() => {
    const opsVendas = vendasFiltradas.map((v) => ({
      id: `venda-${v.id}`,
      data: v.dataYmd,
      tipo: "Venda de Produto" as const,
      referencia: `Venda #${v.numero}`,
      descricao: v.itens.map((i) => `${i.quantidade}× ${i.nome}`).join(", "),
      valorBruto: v.total,
      custoEmbutido: v.custoProdutos,
      lucroLiquido: v.lucroLiquido,
    }));

    const opsServicos = servicosFiltrados.map((o) => ({
      id: `os-${o.numero}`,
      data: o.dataFinal,
      tipo: "Serviço de Telefone (OS)" as const,
      referencia: o.numero,
      descricao: `${o.aparelho} · ${o.cliente}`,
      valorBruto: o.valorCobrado,
      custoEmbutido: o.custoPeca,
      lucroLiquido: o.lucroLiquido,
    }));

    const opsCaixa = caixaFiltrado
      .filter((m) => !m.origemVendaId)
      .map((m) => ({
        id: `caixa-${m.id}`,
        data: m.dataYmd,
        tipo: "Caixa" as const,
        referencia: "Caixa",
        descricao: `${m.tipo === "entrada" ? "Entrada/Suprimento" : "Retirada/Sangria"}: ${m.descricao}`,
        valorBruto: m.tipo === "entrada" ? m.valor : 0,
        custoEmbutido: m.tipo === "saida" ? m.valor : 0,
        lucroLiquido: m.valorAssinado,
      }));

    return [...opsVendas, ...opsServicos, ...opsCaixa].sort((a, b) => b.data.localeCompare(a.data));
  }, [vendasFiltradas, servicosFiltrados, caixaFiltrado]);

  // Tabela 4 - Aba 2: Despesas (Custos Mensais por Produto a partir das compras de fornecedores)
  const despesasMensaisPorProduto = useMemo(() => {
    const mapa = new Map<
      string,
      {
        key: string;
        produtoId: string;
        produtoNome: string;
        sku: string;
        mesAno: string;
        qtdComprada: number;
        custoTotalMes: number;
        notasRefs: string[];
        fornecedoresNomes: Set<string>;
      }
    >();

    for (const nota of notasFiltradas) {
      const mesAno = nota.data.slice(0, 7);
      for (const item of nota.itens) {
        const prod = produtos.find((p) => p.id === item.produtoId);
        const chave = `${mesAno}::${item.produtoId}`;
        const atual = mapa.get(chave) ?? {
          key: chave,
          produtoId: item.produtoId,
          produtoNome: prod?.nome ?? "Produto removido",
          sku: prod?.sku ?? "",
          mesAno,
          qtdComprada: 0,
          custoTotalMes: 0,
          notasRefs: [],
          fornecedoresNomes: new Set<string>(),
        };
        atual.qtdComprada += item.quantidade;
        atual.custoTotalMes += item.quantidade * item.valorUnit;
        if (!atual.notasRefs.includes(`NF ${nota.numero}`)) {
          atual.notasRefs.push(`NF ${nota.numero}`);
        }
        atual.fornecedoresNomes.add(nota.fornecedorNome);
        mapa.set(chave, atual);
      }
    }

    return Array.from(mapa.values())
      .map((d) => ({
        ...d,
        custoUnitMedio: d.qtdComprada > 0 ? d.custoTotalMes / d.qtdComprada : 0,
        fornecedoresLista: Array.from(d.fornecedoresNomes).join(", "),
      }))
      .sort((a, b) => b.mesAno.localeCompare(a.mesAno) || b.custoTotalMes - a.custoTotalMes);
  }, [notasFiltradas, produtos]);

  const nomeProd = (id: string) => produtos.find((p) => p.id === id)?.nome ?? "Produto";

  const inicioSemanaYmd = useMemo(() => {
    const d = parseISO(dataSemanal || hojeYmd);
    d.setDate(d.getDate() - 6);
    return dataLocalISO(d);
  }, [dataSemanal, hojeYmd]);

  const labelPeriodo = {
    diario: `Dia ${dataBR(dataDiaria || hojeYmd)} (Dashboard Diário)`,
    semanal: `${dataBR(inicioSemanaYmd)} a ${dataBR(dataSemanal || hojeYmd)} (Dashboard Semanal)`,
    mensal: `${formatMesAno(mesMensal || hojeYmd.slice(0, 7))} (Dashboard Mensal)`,
    anual: `Ano ${anoAnual || hojeYmd.slice(0, 4)} (Dashboard Anual)`,
  }[periodo];

  const tituloModoDashboard = {
    diario: "Dashboard Diário",
    semanal: "Dashboard Semanal",
    mensal: "Dashboard Mensal",
    anual: "Dashboard Anual",
  }[periodo];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Financeiro"
          subtitle="Acompanhamento completo de faturamento, lucro líquido de vendas e serviços, movimentações de Caixa e despesas com fornecedores."
        />
        <div className="inline-flex items-center gap-2 rounded-lg border bg-card px-3.5 py-2 text-xs font-medium text-muted-foreground shadow-sm">
          <Calendar className="size-4 text-primary" />
          <span>
            Período ativo: <strong className="text-foreground">{labelPeriodo}</strong>
          </span>
        </div>
      </div>

      {/* SELETOR DE MODO DE DASHBOARD INDIVIDUAL (DIÁRIO, SEMANAL, MENSAL, ANUAL) + FILTRO DE DATA/MÊS/ANO */}
      <section className="rounded-xl border bg-card p-5 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Modo de Visualização do Dashboard
            </Label>
            <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-4">
                <TabsTrigger value="diario">Diário</TabsTrigger>
                <TabsTrigger value="semanal">Semanal</TabsTrigger>
                <TabsTrigger value="mensal">Mensal</TabsTrigger>
                <TabsTrigger value="anual">Anual</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {periodo === "diario" && (
              <div className="grid gap-1.5">
                <Label htmlFor="filtro-data-diaria" className="text-xs font-medium">
                  Selecionar Data (Diário)
                </Label>
                <Input
                  id="filtro-data-diaria"
                  aria-label="Selecionar Data (Diário)"
                  type="date"
                  value={dataDiaria}
                  onChange={(e) => setDataDiaria(e.target.value || hojeYmd)}
                  className="h-9 w-44"
                />
              </div>
            )}

            {periodo === "semanal" && (
              <div className="grid gap-1.5">
                <Label htmlFor="filtro-data-semanal" className="text-xs font-medium">
                  Data Final da Semana (7 dias)
                </Label>
                <Input
                  id="filtro-data-semanal"
                  aria-label="Data Final da Semana (7 dias)"
                  type="date"
                  value={dataSemanal}
                  onChange={(e) => setDataSemanal(e.target.value || hojeYmd)}
                  className="h-9 w-44"
                />
              </div>
            )}

            {periodo === "mensal" && (
              <div className="grid gap-1.5">
                <Label htmlFor="filtro-mes-mensal" className="text-xs font-medium">
                  Selecionar Mês / Ano (Mensal)
                </Label>
                <Input
                  id="filtro-mes-mensal"
                  aria-label="Selecionar Mês / Ano (Mensal)"
                  type="month"
                  value={mesMensal}
                  onChange={(e) => setMesMensal(e.target.value || hojeYmd.slice(0, 7))}
                  className="h-9 w-44"
                />
              </div>
            )}

            {periodo === "anual" && (
              <div className="grid gap-1.5">
                <Label htmlFor="filtro-ano-anual" className="text-xs font-medium">
                  Selecionar Ano (Anual)
                </Label>
                <select
                  id="filtro-ano-anual"
                  aria-label="Selecionar Ano (Anual)"
                  value={anoAnual}
                  onChange={(e) => setAnoAnual(e.target.value)}
                  className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-ring"
                >
                  {anosDisponiveis.map((ano) => (
                    <option key={ano} value={ano}>
                      {ano}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* DASHBOARD ATIVO INDIVIDUAL (SOMENTE UM POR VEZ) */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">{tituloModoDashboard}</h2>
            <p className="text-xs text-muted-foreground">
              Exibindo indicadores, gráficos e as 4 tabelas financeiras filtradas para:{" "}
              <strong className="text-foreground">{labelPeriodo}</strong>
            </p>
          </div>
        </div>

        {/* 4 CARDS DE RESUMO */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Faturamento Total</p>
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <DollarSign className="size-5" />
              </span>
            </div>
            <p className="mt-3 font-display text-3xl font-bold">{brl(resumo.faturamentoTotal)}</p>
            <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowUpRight className="size-3.5 text-primary" />
              Vendas: {brl(resumo.faturamentoVendas)} · OS: {brl(resumo.faturamentoServicos)}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Lucro Líquido Total</p>
              <span className="grid size-9 place-items-center rounded-lg bg-status-done/15 text-status-done">
                <TrendingUp className="size-5" />
              </span>
            </div>
            <p className="mt-3 font-display text-3xl font-bold text-status-done">
              {brl(resumo.saldoTotalComCaixa)}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Operacional: {brl(resumo.lucroOperacional)} · Caixa:{" "}
              {resumo.saldoCaixaPeriodo >= 0
                ? `+${brl(resumo.saldoCaixaPeriodo)}`
                : brl(resumo.saldoCaixaPeriodo)}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total de Custos/Compras</p>
              <span className="grid size-9 place-items-center rounded-lg bg-destructive/10 text-destructive">
                <ShoppingBag className="size-5" />
              </span>
            </div>
            <p className="mt-3 font-display text-3xl font-bold text-destructive">
              {brl(resumo.custosNotasFornecedores)}
            </p>
            <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowDownRight className="size-3.5 text-destructive" />
              Custo Peças/Prod. Vendidos: {brl(resumo.custoProdutosVendidos + resumo.custoPecasOS)}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Ticket Médio</p>
              <span className="grid size-9 place-items-center rounded-lg bg-status-bench/15 text-status-bench">
                <Receipt className="size-5" />
              </span>
            </div>
            <p className="mt-3 font-display text-3xl font-bold">{brl(resumo.ticketMedio)}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Média em {resumo.qtdOperacoes} {resumo.qtdOperacoes === 1 ? "operação" : "operações"} ({vendasFiltradas.length} vendas + {servicosFiltrados.length} OS)
            </p>
          </div>
        </div>

        {/* QUADRO DE SALDO TOTAL DO FINANCEIRO VINCULADO AO ITEM "CAIXA" */}
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Wallet className="size-5" />
              </span>
              <div>
                <h3 className="font-display text-base font-semibold">
                  Quadro de Saldo Total do Financeiro (Vínculo em Tempo Real com "Caixa")
                </h3>
                <p className="text-xs text-muted-foreground">
                  O item vinculado <strong>Caixa</strong> soma os valores colocados (entradas/suprimentos) e desconta os valores retirados (saídas/sangrias)
                </p>
              </div>
            </div>
            <Link
              to="/caixa"
              className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-accent"
            >
              <Wallet className="size-3.5" /> Gerenciar Caixa
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs uppercase text-muted-foreground">Lucro (Vendas + Serviços)</p>
              <p className="mt-1 font-display text-xl font-bold text-foreground">
                {brl(resumo.lucroOperacional)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Vendas: {brl(resumo.lucroVendas)} · OS: {brl(resumo.lucroServicos)}
              </p>
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-primary">Item Vinculado: Caixa</p>
                <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                  CAIXA
                </span>
              </div>
              <p
                className={`mt-1 font-display text-xl font-bold ${
                  resumo.saldoCaixaPeriodo < 0 ? "text-destructive" : "text-status-done"
                }`}
              >
                {resumo.saldoCaixaPeriodo >= 0
                  ? `+ ${brl(resumo.saldoCaixaPeriodo)}`
                  : `− ${brl(Math.abs(resumo.saldoCaixaPeriodo))}`}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Colocado: +{brl(resumo.caixaEntradas)} · Retirado: −{brl(resumo.caixaSaidas)}
              </p>
            </div>

            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs uppercase text-muted-foreground">Saldo Total (Lucro + Caixa)</p>
              <p
                className={`mt-1 font-display text-2xl font-bold ${
                  resumo.saldoTotalComCaixa < 0 ? "text-destructive" : "text-status-done"
                }`}
              >
                {brl(resumo.saldoTotalComCaixa)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Soma das operações com as movimentações do Caixa
              </p>
            </div>

            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs uppercase text-muted-foreground">
                Saldo Geral da Empresa
              </p>
              <p
                className={`mt-1 font-display text-2xl font-bold ${
                  resumo.saldoLiquidoFinalCaixaEmpresa < 0 ? "text-destructive" : "text-primary"
                }`}
              >
                {brl(resumo.saldoLiquidoFinalCaixaEmpresa)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Lucro Líquido das Operações + Caixa Avulso
              </p>
            </div>
          </div>
        </div>

        {/* GRÁFICOS DO DASHBOARD ATIVO */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="mb-4">
              <h3 className="font-display text-base font-semibold">
                Faturamento vs. Lucro Líquido (c/ Caixa) vs. Compras ({periodo === "diario" ? "Diário" : periodo === "semanal" ? "Semanal" : periodo === "mensal" ? "Mensal" : "Anual"})
              </h3>
              <p className="text-xs text-muted-foreground">
                Comparativo entre receita bruta, lucro líquido somado ao Caixa e notas de compras de fornecedores
              </p>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGrafico} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(val: number) => brl(Number(val) || 0)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Faturamento" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Lucro Líquido" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Custos/Compras" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="mb-4">
              <h3 className="font-display text-base font-semibold">
                Origem das Movimentações: Vendas vs. Serviços de OS vs. Caixa
              </h3>
              <p className="text-xs text-muted-foreground">
                Distribuição entre PDV (vendas), bancada técnica (consertos) e movimentações físicas do Caixa
              </p>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGrafico} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(val: number) => brl(Number(val) || 0)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Vendas" name="Vendas de Produtos" stackId="a" fill="var(--chart-1)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Serviços" name="Serviços de Telefones (OS)" stackId="a" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Caixa" name="Caixa (Saldo)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ABAIXO DOS DASHBOARDS: 4 TABELAS ORGANIZADAS PARA ANÁLISE DETALHADA */}
      <div className="space-y-8">
        {/* TABELA 1: VENDAS DE PRODUTOS */}
        <section className="rounded-xl border bg-card shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <ShoppingCart className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold">Tabela 1 · Vendas de Produtos</h2>
                <p className="text-xs text-muted-foreground">
                  Registros oriundos da aba Vendas (PDV) com apuração automática de custo e lucro líquido
                </p>
              </div>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {vendasFiltradas.length} {vendasFiltradas.length === 1 ? "venda no período" : "vendas no período"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 font-medium">Itens</th>
                  <th className="px-5 py-3 font-medium">Formas de Pagamento</th>
                  <th className="px-5 py-3 font-medium">Custo dos Produtos</th>
                  <th className="px-5 py-3 font-medium">Desconto / Arredondamento</th>
                  <th className="px-5 py-3 font-medium">Valor Vendido</th>
                  <th className="px-5 py-3 text-right font-medium">Lucro Líquido</th>
                </tr>
              </thead>
              <tbody>
                {vendasFiltradas.map((v) => {
                  const ajuste = -v.desconto + v.arredondamento;
                  const listaPagamentos =
                    v.pagamentos && v.pagamentos.length > 0
                      ? v.pagamentos
                      : [{ forma: "Dinheiro" as const, valor: v.total }];
                  return (
                    <tr key={v.id} className="border-t hover:bg-muted/40">
                      <td className="whitespace-nowrap px-5 py-3">
                        <span className="font-medium">{dataBR(v.dataYmd)}</span>
                        <span className="ml-2 font-mono text-xs text-muted-foreground">#{v.numero}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="space-y-0.5">
                          {v.itens.map((it, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="font-medium">{it.quantidade}×</span> {it.nome}{" "}
                              <span className="text-xs text-muted-foreground">({brl(it.preco)}/un.)</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="space-y-1">
                          {listaPagamentos.map((pg, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-xs">
                              <span
                                className={`inline-flex rounded px-1.5 py-0.5 font-medium ${
                                  pg.forma === "Dinheiro"
                                    ? "bg-status-done/15 text-status-done"
                                    : "bg-primary/10 text-primary"
                                }`}
                              >
                                {pg.forma}
                              </span>
                              <span className="font-semibold">{brl(pg.valor)}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{brl(v.custoProdutos)}</td>
                      <td className="px-5 py-3">
                        {v.desconto === 0 && v.arredondamento === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="text-xs">
                            {v.desconto > 0 && <span className="block text-destructive">Desc.: −{brl(v.desconto)}</span>}
                            {v.arredondamento !== 0 && (
                              <span className="block text-muted-foreground">
                                Arred.: {v.arredondamento > 0 ? `+${brl(v.arredondamento)}` : brl(v.arredondamento)}
                              </span>
                            )}
                            {ajuste !== 0 && <span className="font-medium">Total ajuste: {brl(ajuste)}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 font-semibold">{brl(v.total)}</td>
                      <td
                        className={`px-5 py-3 text-right font-semibold ${
                          v.lucroLiquido < 0 ? "text-destructive" : "text-status-done"
                        }`}
                      >
                        {brl(v.lucroLiquido)}
                      </td>
                    </tr>
                  );
                })}
                {vendasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                      Nenhuma venda de produto registrada no período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
              {vendasFiltradas.length > 0 && (
                <tfoot className="border-t-2 bg-muted/30 font-semibold">
                  <tr>
                    <td colSpan={3} className="px-5 py-3">
                      Total de Vendas no Período
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{brl(resumo.custoProdutosVendidos)}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {brl(
                        vendasFiltradas.reduce((s, v) => s - v.desconto + v.arredondamento, 0),
                      )}
                    </td>
                    <td className="px-5 py-3">{brl(resumo.faturamentoVendas)}</td>
                    <td className="px-5 py-3 text-right text-status-done">{brl(resumo.lucroVendas)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        {/* TABELA 2: SERVIÇOS FEITOS EM TELEFONES (OS FINALIZADAS) */}
        <section className="rounded-xl border bg-card shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-lg bg-status-done/15 text-status-done">
                <Smartphone className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold">Tabela 2 · Serviços Feitos em Telefones</h2>
                <p className="text-xs text-muted-foreground">
                  Ordens de Serviço finalizadas (Concluída, Finalizado ou Entregue) com desconto do custo de peça utilizada
                </p>
              </div>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {servicosFiltrados.length} {servicosFiltrados.length === 1 ? "OS finalizada" : "OS finalizadas"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Data de Finalização</th>
                  <th className="px-5 py-3 font-medium">Número da OS</th>
                  <th className="px-5 py-3 font-medium">Aparelho / Telefone</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Custo de Peça</th>
                  <th className="px-5 py-3 font-medium">Valor Cobrado pelo Serviço</th>
                  <th className="px-5 py-3 text-right font-medium">Lucro Líquido do Serviço</th>
                </tr>
              </thead>
              <tbody>
                {servicosFiltrados.map((o) => (
                  <tr key={o.numero} className="border-t hover:bg-muted/40">
                    <td className="whitespace-nowrap px-5 py-3">{dataBR(o.dataFinal)}</td>
                    <td className="px-5 py-3 font-mono font-semibold text-primary">{o.numero}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium">{o.aparelho}</p>
                      <p className="text-xs text-muted-foreground">{o.servico || o.defeito}</p>
                    </td>
                    <td className="px-5 py-3">{o.cliente}</td>
                    <td className="px-5 py-3 text-muted-foreground">{brl(o.custoPeca)}</td>
                    <td className="px-5 py-3 font-semibold">{brl(o.valorCobrado)}</td>
                    <td
                      className={`px-5 py-3 text-right font-semibold ${
                        o.lucroLiquido < 0 ? "text-destructive" : "text-status-done"
                      }`}
                    >
                      {brl(o.lucroLiquido)}
                    </td>
                  </tr>
                ))}
                {servicosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                      Nenhuma Ordem de Serviço finalizada neste período.
                    </td>
                  </tr>
                )}
              </tbody>
              {servicosFiltrados.length > 0 && (
                <tfoot className="border-t-2 bg-muted/30 font-semibold">
                  <tr>
                    <td colSpan={4} className="px-5 py-3">
                      Total de Serviços Finalizados no Período
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{brl(resumo.custoPecasOS)}</td>
                    <td className="px-5 py-3">{brl(resumo.faturamentoServicos)}</td>
                    <td className="px-5 py-3 text-right text-status-done">{brl(resumo.lucroServicos)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        {/* TABELA 3: NOTAS DE COMPRAS DE FORNECEDORES */}
        <section className="rounded-xl border bg-card shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-lg bg-destructive/10 text-destructive">
                <Truck className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold">Tabela 3 · Notas de Compras de Fornecedores</h2>
                <p className="text-xs text-muted-foreground">
                  Alimentada automaticamente pelas notas de compra cadastradas dentro de cada fornecedor
                </p>
              </div>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {notasFiltradas.length} {notasFiltradas.length === 1 ? "nota registrada" : "notas registradas"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 font-medium">Fornecedor</th>
                  <th className="px-5 py-3 font-medium">CNPJ</th>
                  <th className="px-5 py-3 font-medium">Itens Comprados</th>
                  <th className="px-5 py-3 text-right font-medium">Valor Gasto</th>
                </tr>
              </thead>
              <tbody>
                {notasFiltradas.map((n) => (
                  <tr key={n.id} className="border-t hover:bg-muted/40">
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className="font-medium">{dataBR(n.data)}</span>
                      <span className="ml-2 block font-mono text-xs text-muted-foreground">NF Nº {n.numero}</span>
                    </td>
                    <td className="px-5 py-3 font-medium text-primary">{n.fornecedorNome}</td>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs">{n.fornecedorCnpj}</td>
                    <td className="px-5 py-3">
                      <div className="space-y-0.5">
                        {n.itens.map((it, idx) => (
                          <div key={idx} className="text-sm">
                            <span className="font-medium">{it.quantidade}×</span> {nomeProd(it.produtoId)}{" "}
                            <span className="text-xs text-muted-foreground">({brl(it.valorUnit)}/un.)</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-destructive">{brl(n.total)}</td>
                  </tr>
                ))}
                {notasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                      Nenhuma nota de compra de fornecedor registrada no período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
              {notasFiltradas.length > 0 && (
                <tfoot className="border-t-2 bg-muted/30 font-semibold">
                  <tr>
                    <td colSpan={4} className="px-5 py-3">
                      Total Gasto em Notas de Fornecedores no Período
                    </td>
                    <td className="px-5 py-3 text-right text-destructive">{brl(resumo.custosNotasFornecedores)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        {/* TABELA 4: CONSOLIDADO GERAL: VENDAS + SERVIÇOS + CAIXA — LUCRO VS. DESPESAS */}
        <section className="rounded-xl border bg-card shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Layers className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold">
                  Tabela 4 · Consolidado Geral: Vendas + Serviços + Caixa — Lucro vs. Despesas
                </h2>
                <p className="text-xs text-muted-foreground">
                  Análise consolidada do lucro líquido real das operações somado às movimentações do item <strong>Caixa</strong> frente às despesas mensais por produto
                </p>
              </div>
            </div>
          </div>

          <div className="p-5">
            <Tabs value={abaConsolidado} onValueChange={(v) => setAbaConsolidado(v as "lucro" | "despesas")}>
              <TabsList className="mb-5 grid h-auto w-full max-w-2xl grid-cols-1 sm:grid-cols-2">
                <TabsTrigger value="lucro" className="py-2.5">
                  Lucro Líquido (Vendas + Serviços)
                </TabsTrigger>
                <TabsTrigger value="despesas" className="py-2.5">
                  Despesas (Custos Mensais por Produto)
                </TabsTrigger>
              </TabsList>

              {/* ABA INTERNA 1: LUCRO LÍQUIDO (VENDAS + SERVIÇOS + VÍNCULO CAIXA) */}
              <TabsContent value="lucro" className="space-y-4">
                <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Lucro Líquido de Vendas</p>
                    <p className="font-display text-xl font-bold text-primary">{brl(resumo.lucroVendas)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Lucro Líquido de Serviços (OS)</p>
                    <p className="font-display text-xl font-bold text-primary">{brl(resumo.lucroServicos)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-primary">Item Vinculado: Caixa</p>
                    <p
                      className={`font-display text-xl font-bold ${
                        resumo.saldoCaixaPeriodo < 0 ? "text-destructive" : "text-status-done"
                      }`}
                    >
                      {resumo.saldoCaixaPeriodo >= 0
                        ? `+ ${brl(resumo.saldoCaixaPeriodo)}`
                        : `− ${brl(Math.abs(resumo.saldoCaixaPeriodo))}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Saldo Total (Lucro + Caixa)</p>
                    <p
                      className={`font-display text-2xl font-bold ${
                        resumo.saldoTotalComCaixa < 0 ? "text-destructive" : "text-status-done"
                      }`}
                    >
                      {brl(resumo.saldoTotalComCaixa)}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Data</th>
                        <th className="px-4 py-3 font-medium">Tipo / Vínculo</th>
                        <th className="px-4 py-3 font-medium">Referência</th>
                        <th className="px-4 py-3 font-medium">Descrição</th>
                        <th className="px-4 py-3 font-medium">Valor Entrada / Faturado</th>
                        <th className="px-4 py-3 font-medium">Custo / Saída</th>
                        <th className="px-4 py-3 text-right font-medium">Valor Líquido no Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operacoesConsolidadas.map((op) => (
                        <tr key={op.id} className="border-t hover:bg-muted/40">
                          <td className="whitespace-nowrap px-4 py-3">{dataBR(op.data)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                op.tipo === "Venda de Produto"
                                  ? "bg-primary/10 text-primary"
                                  : op.tipo === "Caixa"
                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                    : "bg-status-done/15 text-status-done"
                              }`}
                            >
                              {op.tipo}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold">{op.referencia}</td>
                          <td className="px-4 py-3 text-muted-foreground">{op.descricao}</td>
                          <td className="px-4 py-3 font-medium">
                            {op.valorBruto > 0 ? brl(op.valorBruto) : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {op.custoEmbutido > 0 ? `− ${brl(op.custoEmbutido)}` : "—"}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-semibold ${
                              op.lucroLiquido < 0 ? "text-destructive" : "text-status-done"
                            }`}
                          >
                            {op.lucroLiquido >= 0
                              ? `+ ${brl(op.lucroLiquido)}`
                              : `− ${brl(Math.abs(op.lucroLiquido))}`}
                          </td>
                        </tr>
                      ))}
                      {operacoesConsolidadas.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                            Nenhuma operação de venda, serviço finalizado ou caixa no período selecionado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {operacoesConsolidadas.length > 0 && (
                      <tfoot className="border-t-2 bg-muted/30 font-semibold">
                        <tr className="border-b bg-primary/5">
                          <td colSpan={4} className="px-4 py-2.5 text-primary">
                            Resumo do Item Vinculado: <strong>Caixa</strong> (Entradas − Retiradas no período)
                          </td>
                          <td className="px-4 py-2.5 text-status-done">+{brl(resumo.caixaEntradas)}</td>
                          <td className="px-4 py-2.5 text-destructive">−{brl(resumo.caixaSaidas)}</td>
                          <td
                            className={`px-4 py-2.5 text-right ${
                              resumo.saldoCaixaPeriodo < 0 ? "text-destructive" : "text-status-done"
                            }`}
                          >
                            {resumo.saldoCaixaPeriodo >= 0
                              ? `+ ${brl(resumo.saldoCaixaPeriodo)}`
                              : `− ${brl(Math.abs(resumo.saldoCaixaPeriodo))}`}
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="px-4 py-3">
                            Saldo Total Consolidado (Vendas + Serviços + Caixa)
                          </td>
                          <td className="px-4 py-3">{brl(resumo.faturamentoTotal + resumo.caixaEntradas)}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            − {brl(resumo.custoProdutosVendidos + resumo.custoPecasOS + resumo.caixaSaidas)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right ${
                              resumo.saldoTotalComCaixa < 0 ? "text-destructive" : "text-status-done"
                            }`}
                          >
                            {brl(resumo.saldoTotalComCaixa)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </TabsContent>

              {/* ABA INTERNA 2: DESPESAS (CUSTOS MENSAIS POR PRODUTO + VÍNCULO CAIXA) */}
              <TabsContent value="despesas" className="space-y-4">
                <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Despesas em Compras de Produtos</p>
                    <p className="font-display text-xl font-bold text-destructive">
                      {brl(resumo.custosNotasFornecedores)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Lucro Líquido Operacional</p>
                    <p className="font-display text-xl font-bold text-status-done">{brl(resumo.lucroOperacional)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-primary">Item Vinculado: Caixa</p>
                    <p
                      className={`font-display text-xl font-bold ${
                        resumo.saldoCaixaPeriodo < 0 ? "text-destructive" : "text-status-done"
                      }`}
                    >
                      {resumo.saldoCaixaPeriodo >= 0
                        ? `+ ${brl(resumo.saldoCaixaPeriodo)}`
                        : `− ${brl(Math.abs(resumo.saldoCaixaPeriodo))}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      Saldo Total Unificado (Lucro + Caixa)
                    </p>
                    <p
                      className={`font-display text-2xl font-bold ${
                        resumo.saldoLiquidoFinalCaixaEmpresa < 0 ? "text-destructive" : "text-primary"
                      }`}
                    >
                      {brl(resumo.saldoLiquidoFinalCaixaEmpresa)}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Produto / Item</th>
                        <th className="px-4 py-3 font-medium">Mês de Referência</th>
                        <th className="px-4 py-3 font-medium">Fornecedor / Origem</th>
                        <th className="px-4 py-3 font-medium">Qtd. / Movimentações</th>
                        <th className="px-4 py-3 font-medium">Custo Unit. Médio</th>
                        <th className="px-4 py-3 text-right font-medium">Impacto Mensal para o Caixa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {despesasMensaisPorProduto.map((item) => (
                        <tr key={item.key} className="border-t hover:bg-muted/40">
                          <td className="px-4 py-3">
                            <p className="font-medium">{item.produtoNome}</p>
                            {item.sku && <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-medium">{formatMesAno(item.mesAno)}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm">{item.fornecedoresLista}</p>
                            <p className="font-mono text-xs text-muted-foreground">{item.notasRefs.join(", ")}</p>
                          </td>
                          <td className="px-4 py-3 font-semibold">{item.qtdComprada} un.</td>
                          <td className="px-4 py-3 text-muted-foreground">{brl(item.custoUnitMedio)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-destructive">
                            − {brl(item.custoTotalMes)}
                          </td>
                        </tr>
                      ))}
                      {/* Linha vinculada com o nome "Caixa" */}
                      <tr className="border-t bg-primary/5 hover:bg-primary/10">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-primary">Caixa</p>
                          <p className="text-xs text-muted-foreground">Movimentações físicas vinculadas da aba Caixa</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium">
                          {periodo === "diario"
                            ? dataBR(dataDiaria || hojeYmd)
                            : periodo === "semanal"
                              ? `${dataBR(inicioSemanaYmd)} a ${dataBR(dataSemanal || hojeYmd)}`
                              : periodo === "mensal"
                                ? formatMesAno(mesMensal || hojeYmd.slice(0, 7))
                                : anoAnual || hojeYmd.slice(0, 4)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          Entradas: +{brl(resumo.caixaEntradas)} · Retiradas: −{brl(resumo.caixaSaidas)}
                        </td>
                        <td className="px-4 py-3 font-semibold">{caixaFiltrado.length} mov.</td>
                        <td className="px-4 py-3 text-muted-foreground">—</td>
                        <td
                          className={`px-4 py-3 text-right font-semibold ${
                            resumo.saldoCaixaPeriodo < 0 ? "text-destructive" : "text-status-done"
                          }`}
                        >
                          {resumo.saldoCaixaPeriodo >= 0
                            ? `+ ${brl(resumo.saldoCaixaPeriodo)}`
                            : `− ${brl(Math.abs(resumo.saldoCaixaPeriodo))}`}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot className="border-t-2 bg-muted/30 font-semibold">
                      <tr>
                        <td colSpan={3} className="px-4 py-3">
                          Total de Despesas de Compras de Produtos no Período
                        </td>
                        <td className="px-4 py-3">
                          {despesasMensaisPorProduto.reduce((s, x) => s + x.qtdComprada, 0)} un.
                        </td>
                        <td className="px-4 py-3">—</td>
                        <td className="px-4 py-3 text-right text-destructive">
                          − {brl(despesasMensaisPorProduto.reduce((s, x) => s + x.custoTotalMes, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </div>
    </div>
  );
}
