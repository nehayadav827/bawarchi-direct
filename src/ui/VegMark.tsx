export function VegMark({ veg }: { veg: boolean }) {
  return <span className={`vegmark ${veg ? "veg" : "nonveg"}`} role="img" aria-label={veg ? "Vegetarian" : "Non-vegetarian"} />;
}
