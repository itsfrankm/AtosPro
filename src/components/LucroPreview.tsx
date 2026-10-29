import { brl } from "@/lib/os-data";
import { lucroUnit, lucroPct } from "@/lib/estoque";

const pctTxt = (c: number, v: number) => {
  const p = lucroPct(c, v);
  return p == null ? "—" : `${p.toFixed(1).replace(".", ",")}%`;
};

export function LucroPreview({ custo, venda }: { custo: number; venda: number }) {
  const l = lucroUnit(custo, venda);
  const neg = l < 0;
  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border bg-accent/40 p-4">
      <div>
        <p className="text-xs uppercase text-muted-foreground">Lucro Unitário</p>
        <p className={`font-display text-xl font-bold ${neg ? "text-destructive" : "text-primary"}`}>{brl(l)}</p>
      </div>
      <div>
        <p className="text-xs uppercase text-muted-foreground">Porcentagem de Lucro</p>
        <p className={`font-display text-xl font-bold ${neg ? "text-destructive" : "text-primary"}`}>{pctTxt(custo, venda)}</p>
      </div>
    </div>
  );
}

