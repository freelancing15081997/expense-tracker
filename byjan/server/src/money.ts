/** Integer paise only. Parts always sum to the total. */

export function splitPaise(totalPaise: number, weights: number[]): number[] {
  const total = Math.round(totalPaise);
  const w = weights.map(n => Math.max(0, Math.round(n)));
  const sum = w.reduce((a, b) => a + b, 0);
  if (!w.length || sum === 0 || total === 0) return w.map(() => 0);
  const parts = w.map(x => Math.floor((total * x) / sum));
  let rem = total - parts.reduce((a, b) => a + b, 0);
  for (let i = 0; rem > 0; i = (i + 1) % parts.length) {
    parts[i] += 1;
    rem -= 1;
  }
  return parts;
}

export type Net = { id: string; netPaise: number };
export type Transfer = { from: string; to: string; paise: number };

/** Fewest transfers that clear every net. Nets must already sum to zero. */
export function smartSettle(nets: Net[]): Transfer[] {
  const debtors = nets.filter(n => n.netPaise < 0).map(n => ({ ...n })).sort((a, b) => a.netPaise - b.netPaise);
  const creditors = nets.filter(n => n.netPaise > 0).map(n => ({ ...n })).sort((a, b) => b.netPaise - a.netPaise);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(-debtors[i].netPaise, creditors[j].netPaise);
    if (pay > 0) out.push({ from: debtors[i].id, to: creditors[j].id, paise: pay });
    debtors[i].netPaise += pay;
    creditors[j].netPaise -= pay;
    if (debtors[i].netPaise === 0) i += 1;
    if (creditors[j].netPaise === 0) j += 1;
  }
  return out;
}
