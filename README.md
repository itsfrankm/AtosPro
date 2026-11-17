# AtosPro - Sistema de Ordens de Serviço e Gestão Comercial

Sistema web moderno e completo para assistência técnica e gestão comercial (Ordens de Serviço, PDV/Vendas com Cupom Térmico, Controle de Estoque, Gestão Financeira com Dashboards, Caixa e Clientes).

## 🚀 Funcionalidades

- **Ordens de Serviço (OS):** Emissão e impressão otimizada, controle de status (Na Bancada, Em Orçamento, Concluída, etc.), laudos técnicos e custos de peças.
- **Ponto de Venda (PDV / Vendas):** Vendas rápidas, múltiplos meios de pagamento combinados, cálculo automático de troco e impressão de Cupom Térmico.
- **Controle de Estoque e Compras:** Cadastro de produtos com código SKU, custos, preços de venda, margem de lucro e notas de compra de fornecedores.
- **Gestão Financeira Consolidada:** Dashboards Diário, Semanal, Mensal e Anual, métricas de faturamento, lucro líquido real e controle da gaveta de Caixa.
- **Módulo de Caixa:** Abertura, fechamento, entradas avulsas (suprimentos) e retiradas (sangrias).
- **Segurança e Multi-Tenant:** Autenticação protegida, controle de acessos por papel (Admin / Colaborador), Row Level Security (RLS) no Supabase e proteção contra DoS.

## 🛠️ Tecnologias

- **Frontend:** React 19, TypeScript, Tailwind CSS, shadcn/ui, TanStack Router.
- **Gráficos e Impressão:** Recharts, Lucide Icons, html2canvas-pro, jsPDF.
- **Backend / Banco de Dados:** Supabase (PostgreSQL com RLS, Edge Functions, Auth REST API).

## 📦 Como Rodar Localmente

1. Clone o repositório:
```sh
git clone https://github.com/itsfrankm/atospro.git
cd atospro
```

## 📦 Conta de Teste

```
User: atconvidado@gmail.com
Senha: 123456
```

2. Instale as dependências:
```sh
npm install
```

3. Configure as variáveis de ambiente:
Copie o arquivo `.env.example` para `.env` e preencha suas credenciais do Supabase caso queira sincronização em nuvem (ou utilize o modo mock offline padrão).

4. Inicie o servidor de desenvolvimento:
```sh
npm run dev
```
