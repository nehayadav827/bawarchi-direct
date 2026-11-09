"use client";
import { useState } from "react";
import { formatINR } from "@/domain/money";
import { VegMark } from "./VegMark";

export interface MenuEntry {
  id: string; name: string; category: string; description: string; veg: boolean; spice: number; allergens: string[]; pricePaise: number;
  portions: { label: string; pricePaise: number }[]; addOns: { label: string; pricePaise: number }[]; imageUrl: string | null;
  windowFrom: string | null; unavailable: "OUT_OF_STOCK" | "OUTSIDE_HOURS" | null;
}

export function ItemSheet({ item, initialPortion, onClose, onAdd }: { item: MenuEntry; initialPortion?: string | null; onClose: () => void; onAdd: (c: { portion?: string; addOns: string[]; qty: number; unitPaise: number }) => void }) {
  const [portion, setPortion] = useState(item.portions.find((p) => p.label === initialPortion)?.label ?? item.portions[0]?.label);
  const [addOns, setAddOns] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const base = item.portions.find((p) => p.label === portion)?.pricePaise ?? item.pricePaise;
  const unit = base + addOns.reduce((s, l) => s + (item.addOns.find((a) => a.label === l)?.pricePaise ?? 0), 0);
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={item.name} onClick={(e) => e.stopPropagation()}>
        <div className="row between"><h2 className="row"><VegMark veg={item.veg} /> {item.name}</h2><button className="link" onClick={onClose}>Close</button></div>
        <p className="muted small">{item.description}</p>
        {item.portions.length > 0 && (
          <fieldset style={{ border: 0, padding: 0, display: "grid", gap: 8 }}><legend className="small muted">Portion</legend>
            {item.portions.map((p) => <label key={p.label} className="opt"><span className="row"><input type="radio" name="portion" checked={portion === p.label} onChange={() => setPortion(p.label)} />{p.label}</span><span className="price">{formatINR(p.pricePaise)}</span></label>)}
          </fieldset>
        )}
        {item.addOns.length > 0 && (
          <fieldset style={{ border: 0, padding: 0, display: "grid", gap: 8 }}><legend className="small muted">Add-ons</legend>
            {item.addOns.map((a) => <label key={a.label} className="opt"><span className="row"><input type="checkbox" checked={addOns.includes(a.label)} onChange={(e) => setAddOns(e.target.checked ? [...addOns, a.label] : addOns.filter((x) => x !== a.label))} />{a.label}</span><span className="price">+{formatINR(a.pricePaise)}</span></label>)}
          </fieldset>
        )}
        <div className="row between">
          <div className="stepper"><button aria-label="Fewer" onClick={() => setQty(Math.max(1, qty - 1))}>−</button><b aria-live="polite">{qty}</b><button aria-label="More" onClick={() => setQty(Math.min(20, qty + 1))}>+</button></div>
          <button className="btn" onClick={() => onAdd({ portion, addOns, qty, unitPaise: unit })}>Add · {formatINR(unit * qty)}</button>
        </div>
      </div>
    </div>
  );
}
