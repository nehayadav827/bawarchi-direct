/** Where each role lands after signing in. */
export const homeFor = (u: { role: string; outletId: string | null }) =>
  u.role === "admin" ? "/admin" : u.role === "kitchen" || u.role === "manager" ? `/kitchen/${u.outletId}` : "/";
