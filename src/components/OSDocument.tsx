import { forwardRef } from "react";
import type { Cliente } from "@/lib/os-data";
import { dataBR } from "@/lib/os-data";

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
}

const v = (s?: string) => (s && s.trim() ? s : "—");

function Row({ label, value }: { label: string; value?: string | undefined }) {
  return (
    <div className="os-doc-row">
      <span className="os-doc-label">{label}</span>
      <span className="os-doc-value">{v(value)}</span>
    </div>
  );
}

export const OSDocument = forwardRef<HTMLDivElement, { data: OSDocumentData }>(({ data }, ref) => {
  const c = data.cliente;
  return (
    <div ref={ref} className="os-doc">
      <header className="os-doc-header">
        <div>
          <div className="os-doc-brand">TecnoFix</div>
          <div className="os-doc-muted">Assistência Técnica Especializada</div>
          <div className="os-doc-muted">Rua Exemplo, 100 · Centro · (11) 99999-0000 · contato@tecnofix.com.br</div>
          <div className="os-doc-muted">CNPJ 00.000.000/0001-00</div>
        </div>
        <div className="os-doc-numbox">
          <div className="os-doc-label">Ordem de Serviço</div>
          <div className="os-doc-num">{data.numero}</div>
          <div className="os-doc-muted">Status: {data.status}</div>
        </div>
      </header>

      <div className="os-doc-grid2">
        <Row label="Data de Entrada" value={data.entrada ? dataBR(data.entrada) : ""} />
        <Row label="Data de Finalização" value={data.finalizacao ? dataBR(data.finalizacao) : ""} />
      </div>

      <section className="os-doc-section">
        <h3 className="os-doc-title">Dados do Cliente</h3>
        <div className="os-doc-grid2">
          <Row label="Nome" value={c?.nome} />
          <Row label="CPF/CNPJ" value={c?.documento} />
          <Row label="Telefone/WhatsApp" value={c?.whatsapp} />
          <Row label="E-mail" value={c?.email} />
          <Row label="CEP" value={c?.cep} />
          <Row label="Endereço" value={c?.endereco} />
        </div>
      </section>

      <section className="os-doc-section">
        <h3 className="os-doc-title">Dados do Aparelho</h3>
        <div className="os-doc-grid2">
          <Row label="Equipamento" value={data.aparelho.equipamento} />
          <Row label="Marca/Modelo" value={data.aparelho.marcaModelo} />
          <Row label="Nº de Série/IMEI" value={data.aparelho.serie} />
          <Row label="Acessórios deixados" value={data.aparelho.acessorios} />
        </div>
        <Row label="Estado físico / Avarias prévias" value={data.aparelho.estado} />
      </section>

      <section className="os-doc-box">
        <h3 className="os-doc-title">Defeito Informado pelo Cliente</h3>
        {data.sintomas.length > 0 && <p className="os-doc-muted">Sintomas: {data.sintomas.join(", ")}</p>}
        <p className="os-doc-text">{v(data.defeito)}</p>
      </section>

      <section className="os-doc-box">
        <h3 className="os-doc-title">Laudo do Técnico</h3>
        <p className="os-doc-text">{v(data.laudo)}</p>
        <p className="os-doc-muted">Técnico responsável: {v(data.tecnico)}</p>
      </section>

      <section className="os-doc-box">
        <h3 className="os-doc-title">Serviço Realizado</h3>
        <p className="os-doc-text">{v(data.servico)}</p>
        <div className="os-doc-grid2">
          <Row label="Peças trocadas" value={data.pecas} />
          <Row label="Garantia" value={data.garantia} />
        </div>
        {data.observacoes.trim() && <Row label="Observações finais" value={data.observacoes} />}
      </section>

      <div className="os-doc-signs">
        <div className="os-doc-sign">
          <div className="os-doc-line" />
          <div>Assinatura do Cliente</div>
          <div className="os-doc-muted">{c?.nome ?? ""}</div>
        </div>
        <div className="os-doc-sign">
          <div className="os-doc-line" />
          <div>Assinatura do Técnico</div>
          <div className="os-doc-muted">{data.tecnico}</div>
        </div>
      </div>
    </div>
  );
});
OSDocument.displayName = "OSDocument";
