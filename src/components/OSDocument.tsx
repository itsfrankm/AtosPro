import { forwardRef } from "react";
import type { Cliente } from "@/lib/os-data";
import { brl, dataBR } from "@/lib/os-data";
import { useEstoque, perfilInicial, type PerfilEmpresa } from "@/lib/estoque";

export interface OSDocumentData {
  numero: string;
  status: string;
  entrada: string;
  finalizacao: string;
  cliente: Cliente | null;
  aparelho: { equipamento: string; marcaModelo: string; serie: string; estado: string; acessorios: string };
  defeito: string;
  sintomas: string[];
  laudo: string;
  tecnico: string;
  servico: string;
  pecas: string;
  garantia: string;
  observacoes: string;
  valor?: number;
  custoPeca?: number;
  empresa?: PerfilEmpresa;
}

const v = (s?: string) => (s && s.trim() ? s : "—");

function Row({ label, value }: { label: string; value?: string | undefined }) {
  return (
    <div className="os-doc-row flex flex-col">
      <span className="os-doc-label text-[11px] font-semibold uppercase tracking-wider text-slate-500 leading-tight">
        {label}
      </span>
      <span className="os-doc-value text-[13.5px] leading-relaxed font-medium text-slate-900 whitespace-pre-wrap">
        {v(value)}
      </span>
    </div>
  );
}

export const OSDocument = forwardRef<HTMLDivElement, { data: OSDocumentData }>(({ data }, ref) => {
  const { perfil = perfilInicial } = useEstoque();
  const emp = data.empresa ?? perfil;
  const c = data.cliente;

  return (
    <div
      ref={ref}
      className="os-doc w-[194mm] max-w-none min-h-[276mm] max-h-[280mm] flex flex-col justify-between box-border bg-white text-slate-900 p-0 overflow-hidden"
      style={{
        width: "194mm",
        minHeight: "276mm",
        maxHeight: "280mm",
        padding: 0,
        boxSizing: "border-box",
        backgroundColor: "#ffffff",
        color: "#0f172a",
      }}
    >
      {/* CABEÇALHO */}
      <header className="os-doc-header flex justify-between items-center gap-4 pb-3 border-b-2 border-blue-800">
        <div className="os-doc-brand-wrap flex items-center gap-3.5">
          {emp.logo && (
            <img
              src={emp.logo}
              alt={emp.nome || "Logo"}
              className="os-doc-logo w-16 h-16 object-contain rounded shrink-0"
              style={{ maxWidth: "64px", maxHeight: "64px" }}
            />
          )}
          <div>
            <div className="os-doc-brand text-2xl font-bold text-blue-800 leading-tight">
              {emp.nome || "AtosPro"}
            </div>
            <div className="os-doc-muted text-xs text-slate-600">Assistência Técnica Especializada</div>
            <div className="os-doc-muted text-xs text-slate-600">{v(emp.endereco)}</div>
            <div className="os-doc-muted text-xs text-slate-600">
              {[emp.telefone ? `Tel: ${emp.telefone}` : "", emp.email ? `E-mail: ${emp.email}` : ""]
                .filter(Boolean)
                .join(" · ") || "—"}
            </div>
            <div className="os-doc-muted text-xs text-slate-600">CNPJ: {v(emp.cnpj)}</div>
          </div>
        </div>
        <div className="os-doc-numbox border border-slate-300 rounded-lg px-4 py-2 bg-slate-50 text-right shrink-0">
          <div className="os-doc-label text-[11px] font-semibold uppercase text-slate-500">Ordem de Serviço</div>
          <div className="os-doc-num text-xl font-bold font-mono text-blue-800">{data.numero}</div>
          <div className="os-doc-muted text-xs font-semibold text-slate-600">Status: {data.status}</div>
        </div>
      </header>

      {/* DATAS DE ENTRADA E FINALIZAÇÃO */}
      <div className="os-doc-dates grid grid-cols-2 gap-4 px-1 py-1">
        <Row label="Data de Entrada" value={data.entrada ? dataBR(data.entrada) : ""} />
        <Row label="Data de Finalização" value={data.finalizacao ? dataBR(data.finalizacao) : ""} />
      </div>

      {/* DADOS DO CLIENTE */}
      <section className="os-doc-section border border-slate-300 rounded-lg p-3.5 bg-white">
        <h3 className="os-doc-title text-xs font-bold tracking-wide uppercase text-blue-800 mb-2">
          DADOS DO CLIENTE
        </h3>
        <div className="os-doc-grid3 grid grid-cols-3 gap-x-4 gap-y-2">
          <Row label="Nome" value={c?.nome} />
          <Row label="CPF/CNPJ" value={c?.documento} />
          <Row label="Telefone/WhatsApp" value={c?.whatsapp} />
          <Row label="E-mail" value={c?.email} />
          <Row label="CEP" value={c?.cep} />
          <Row label="Endereço" value={c?.endereco} />
        </div>
      </section>

      {/* DADOS DO APARELHO */}
      <section className="os-doc-section border border-slate-300 rounded-lg p-3.5 bg-white">
        <h3 className="os-doc-title text-xs font-bold tracking-wide uppercase text-blue-800 mb-2">
          DADOS DO APARELHO
        </h3>
        <div className="os-doc-grid2 grid grid-cols-2 gap-x-4 gap-y-2">
          <Row label="Equipamento" value={data.aparelho.equipamento} />
          <Row label="Marca/Modelo" value={data.aparelho.marcaModelo} />
          <Row label="Nº de Série/IMEI" value={data.aparelho.serie} />
          <Row label="Acessórios deixados" value={data.aparelho.acessorios} />
        </div>
        <div className="mt-2 pt-1 border-t border-slate-100">
          <Row label="Estado físico / Avarias prévias" value={data.aparelho.estado} />
        </div>
      </section>

      {/* DEFEITO INFORMADO PELO CLIENTE */}
      <section
        className="os-doc-box border border-slate-300 rounded-lg p-4 min-h-[80px] bg-white flex flex-col justify-start"
        style={{ minHeight: "80px" }}
      >
        <h3 className="os-doc-title text-xs font-bold tracking-wide uppercase text-blue-800 mb-1.5">
          DEFEITO INFORMADO PELO CLIENTE
        </h3>
        {data.sintomas.length > 0 && (
          <p className="os-doc-muted text-xs text-slate-600 mb-1 font-medium">
            Sintomas: {data.sintomas.join(", ")}
          </p>
        )}
        <p className="os-doc-text text-[13.5px] leading-relaxed font-medium text-slate-900 whitespace-pre-wrap break-words">
          {v(data.defeito)}
        </p>
      </section>

      {/* LAUDO DO TÉCNICO */}
      <section
        className="os-doc-box border border-slate-300 rounded-lg p-4 min-h-[80px] bg-white flex flex-col justify-start"
        style={{ minHeight: "80px" }}
      >
        <h3 className="os-doc-title text-xs font-bold tracking-wide uppercase text-blue-800 mb-1.5">
          LAUDO DO TÉCNICO
        </h3>
        <p className="os-doc-text text-[13.5px] leading-relaxed font-medium text-slate-900 whitespace-pre-wrap break-words">
          {v(data.laudo)}
        </p>
        <p className="os-doc-muted text-xs text-slate-600 mt-1 font-medium">
          Técnico responsável: {v(data.tecnico)}
        </p>
      </section>

      {/* SERVIÇO REALIZADO E VALORES */}
      <section
        className="os-doc-box border border-slate-300 rounded-lg p-4 min-h-[80px] bg-white flex flex-col justify-start"
        style={{ minHeight: "80px" }}
      >
        <h3 className="os-doc-title text-xs font-bold tracking-wide uppercase text-blue-800 mb-1.5">
          SERVIÇO REALIZADO E VALORES
        </h3>
        <p className="os-doc-text text-[13.5px] leading-relaxed font-medium text-slate-900 whitespace-pre-wrap break-words mb-2">
          {v(data.servico)}
        </p>
        <div className="os-doc-grid3 grid grid-cols-3 gap-x-4 gap-y-2">
          <Row label="Peças trocadas" value={data.pecas} />
          <Row label="Garantia" value={data.garantia} />
          <Row label="Valor do Serviço" value={data.valor ? brl(data.valor) : "—"} />
        </div>
        {data.observacoes.trim() && (
          <div className="mt-2 pt-1 border-t border-slate-100">
            <Row label="Observações finais" value={data.observacoes} />
          </div>
        )}
      </section>

      {/* ASSINATURAS ANCORADAS NO FINAL DA PÁGINA */}
      <div className="os-doc-signs mt-auto pt-6 pb-2 grid grid-cols-2 gap-12 text-center">
        <div className="os-doc-sign">
          <div className="os-doc-line border-t border-slate-900 mb-1.5" />
          <div className="text-[13px] font-semibold text-slate-900">Assinatura do Cliente</div>
          <div className="os-doc-muted text-xs text-slate-500">{c?.nome || ""}</div>
        </div>
        <div className="os-doc-sign">
          <div className="os-doc-line border-t border-slate-900 mb-1.5" />
          <div className="text-[13px] font-semibold text-slate-900">Assinatura do Técnico</div>
          <div className="os-doc-muted text-xs text-slate-500">{data.tecnico || ""}</div>
        </div>
      </div>
    </div>
  );
});
OSDocument.displayName = "OSDocument";
