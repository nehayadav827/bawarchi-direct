/**
 * Fictional sample data (assumptions A1, A2). Prices in paise, GST-inclusive.
 * FSSAI numbers are obviously fake. Outlet coordinates are approximate area centres.
 */
export const OUTLETS = [
  { id: "kondapur", name: "Kondapur", city: "Hyderabad", kind: "OUTLET", lat: 17.4605, lng: 78.3645, radiusKm: 5, minPrepMinutes: 20, capacityUnits: 14, fssai: "10000000000001" },
  { id: "gachibowli-ck", name: "Gachibowli cloud kitchen", city: "Hyderabad", kind: "CLOUD_KITCHEN", lat: 17.4401, lng: 78.3489, radiusKm: 6, minPrepMinutes: 20, capacityUnits: 18, fssai: "10000000000002" },
  { id: "kukatpally", name: "Kukatpally", city: "Hyderabad", kind: "OUTLET", lat: 17.4948, lng: 78.3996, radiusKm: 5, minPrepMinutes: 25, capacityUnits: 12, fssai: "10000000000003" },
  { id: "banjara-hills", name: "Banjara Hills", city: "Hyderabad", kind: "OUTLET", lat: 17.4126, lng: 78.4482, radiusKm: 5, minPrepMinutes: 20, capacityUnits: 12, fssai: "10000000000004" },
] as const;

export type Category = "Biryani" | "Starters" | "Curries" | "Breads & Sides" | "Desserts" | "Beverages";

export interface SeedItem {
  slug: string; name: string; category: Category; description: string;
  veg: boolean; spice: 0 | 1 | 2 | 3; allergens: string[]; prepMinutes: number;
  pricePaise: number; /** Optional daily window (24h, IST) for time-based menus */ window?: { from: string; to: string };
  portions?: { label: string; pricePaise: number }[]; addOns?: { label: string; pricePaise: number }[];
}

export const MENU: SeedItem[] = [
  { slug: "chicken-dum-biryani", name: "Chicken dum biryani", category: "Biryani", description: "Basmati slow-cooked under dough seal with marinated chicken.", veg: false, spice: 2, allergens: ["milk"], prepMinutes: 25, pricePaise: 34900,
    portions: [{ label: "Regular", pricePaise: 34900 }, { label: "Family pack", pricePaise: 94000 }], addOns: [{ label: "Extra raita", pricePaise: 3000 }, { label: "Boiled egg", pricePaise: 2500 }] },
  { slug: "mutton-dum-biryani", name: "Mutton dum biryani", category: "Biryani", description: "Tender mutton, saffron rice, sealed and slow-cooked.", veg: false, spice: 3, allergens: ["milk"], prepMinutes: 30, pricePaise: 44900,
    portions: [{ label: "Regular", pricePaise: 44900 }, { label: "Family pack", pricePaise: 129900 }] },
  { slug: "veg-biryani", name: "Veg biryani", category: "Biryani", description: "Seasonal vegetables and paneer with fragrant basmati.", veg: true, spice: 1, allergens: ["milk"], prepMinutes: 22, pricePaise: 26000,
    portions: [{ label: "Regular", pricePaise: 26000 }, { label: "Family pack", pricePaise: 79900 }] },
  { slug: "egg-biryani", name: "Egg biryani", category: "Biryani", description: "Masala eggs layered with dum rice.", veg: false, spice: 2, allergens: ["egg", "milk"], prepMinutes: 22, pricePaise: 24900 },
  { slug: "chicken-65", name: "Chicken 65", category: "Starters", description: "Crisp, spiced, curry-leaf tossed chicken.", veg: false, spice: 3, allergens: ["gluten", "egg"], prepMinutes: 15, pricePaise: 22900 },
  { slug: "paneer-majestic", name: "Paneer majestic", category: "Starters", description: "Fried paneer in a spicy yoghurt glaze.", veg: true, spice: 2, allergens: ["milk", "gluten"], prepMinutes: 15, pricePaise: 21900 },
  { slug: "mirchi-ka-salan", name: "Mirchi ka salan", category: "Curries", description: "Green chillies in peanut, sesame and tamarind gravy.", veg: true, spice: 2, allergens: ["peanut", "sesame"], prepMinutes: 12, pricePaise: 12000 },
  { slug: "bagara-baingan", name: "Bagara baingan", category: "Curries", description: "Baby aubergines in a rich nutty gravy.", veg: true, spice: 2, allergens: ["peanut", "sesame"], prepMinutes: 14, pricePaise: 18900 },
  { slug: "mutton-haleem", name: "Mutton haleem", category: "Curries", description: "Slow-cooked wheat, lentils and mutton, topped with fried onions.", veg: false, spice: 2, allergens: ["gluten"], prepMinutes: 15, pricePaise: 35000, window: { from: "16:00", to: "23:00" } },
  { slug: "rumali-roti", name: "Rumali roti", category: "Breads & Sides", description: "Paper-thin handkerchief bread.", veg: true, spice: 0, allergens: ["gluten"], prepMinutes: 8, pricePaise: 4000 },
  { slug: "double-ka-meetha", name: "Double ka meetha", category: "Desserts", description: "Fried bread pudding in saffron milk and nuts.", veg: true, spice: 0, allergens: ["gluten", "milk", "nuts"], prepMinutes: 8, pricePaise: 12000 },
  { slug: "irani-chai", name: "Irani chai", category: "Beverages", description: "Creamy, sweet, Hyderabad-style tea.", veg: true, spice: 0, allergens: ["milk"], prepMinutes: 6, pricePaise: 5000, window: { from: "07:00", to: "23:00" } },
];

export const SAMPLE_COUPONS = [
  { code: "DIRECT10", type: "PERCENT", value: 10, minOrderPaise: 40000, maxDiscountPaise: 15000 },
  { code: "FLAT75", type: "FLAT", value: 7500, minOrderPaise: 60000 },
] as const;

/** The three orders from the client brief (assumption: customer names are fictional). */
export const SAMPLE_ORDERS = [
  { ref: "WEB-778120", outletId: "kondapur", items: [["chicken-dum-biryani", "Family pack", 1], ["double-ka-meetha", null, 2]], totalPaise: 118000, payment: "UPI", placed: "20:14", promised: "20:59", status: "PREPARING" },
  { ref: "WEB-778131", outletId: "gachibowli-ck", items: [["veg-biryani", "Regular", 2], ["mirchi-ka-salan", null, 1]], totalPaise: 64000, payment: "CARD", placed: "20:21", promised: "21:01", status: "READY" },
  { ref: "WEB-778146", outletId: "kukatpally", items: [["mutton-haleem", null, 3]], totalPaise: 105000, payment: "UPI", placed: "20:26", promised: "21:16", status: "PREPARING" },
] as const;
