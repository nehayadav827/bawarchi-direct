import { writeFileSync } from "node:fs";
import { MENU } from "../src/data/seed-data";

/** Illustrated placeholders for the fictional menu (assumption A2: no real photography). */
const PALETTE: Record<string, [string, string, string]> = {
  Biryani: ["#f6d58e", "#d9822b", "#7a3e12"], Starters: ["#f3b79b", "#c8472b", "#6e1d10"], Curries: ["#e9c27a", "#a8541c", "#4e2209"],
  "Breads & Sides": ["#f2e2bd", "#d8b36a", "#8a6420"], Desserts: ["#f5d3d3", "#c46a6a", "#6e2a2a"], Beverages: ["#ecd9c2", "#b5835a", "#5c3a20"],
};
const rnd = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

for (const m of MENU) {
  const [bg, mid, dark] = PALETTE[m.category]!;
  const r = rnd([...m.slug].reduce((a, c) => a + c.charCodeAt(0), 7));
  const grains = Array.from({ length: 70 }, () => {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 118;
    return `<ellipse cx="${(200 + Math.cos(a) * d).toFixed(1)}" cy="${(150 + Math.sin(a) * d * 0.62).toFixed(1)}" rx="9" ry="3.2" transform="rotate(${Math.floor(r() * 180)} ${(200 + Math.cos(a) * d).toFixed(1)} ${(150 + Math.sin(a) * d * 0.62).toFixed(1)})" fill="${r() > 0.5 ? "#fff8e6" : mid}" opacity=".85"/>`;
  }).join("");
  const herb = m.veg ? "#3f9b4b" : "#8b2a1b";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" role="img" aria-label="${m.name}">
<rect width="400" height="300" fill="${bg}"/><ellipse cx="200" cy="268" rx="150" ry="14" fill="${dark}" opacity=".18"/>
<ellipse cx="200" cy="165" rx="160" ry="104" fill="${dark}"/><ellipse cx="200" cy="150" rx="146" ry="94" fill="#f7f1e6"/>
<ellipse cx="200" cy="150" rx="128" ry="80" fill="${mid}"/>${grains}
<circle cx="168" cy="132" r="9" fill="${herb}"/><circle cx="232" cy="160" r="8" fill="${herb}"/><circle cx="205" cy="118" r="7" fill="${herb}"/></svg>`;
  writeFileSync(`public/food/${m.slug}.svg`, svg);
}
console.log(`wrote ${MENU.length} illustrations`);
