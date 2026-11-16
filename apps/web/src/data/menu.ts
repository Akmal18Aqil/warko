import { CULINARY_GALLERY } from "./gallery";

export type MenuKind = "Minuman" | "Makanan" | "Camilan";

export type MenuItem = {
  id: string;
  barcode: string;
  name: string;
  description: string;
  price: number; // Rupiah utuh, misalnya 25000
  /** Category name; custom categories are allowed, so this is not a closed union. */
  category: string;
  image: string;
  badge?: string;
  kind: MenuKind;
  prepMinutes: number;
  /** Ready-to-sell portions. `null`/absent = not tracked; 0 = sold out (HABIS). */
  stock?: number | null;
};

/** Stock at or below this many portions shows a low-stock warning. */
export const LOW_STOCK_THRESHOLD = 5;

export function isSoldOut(item: Pick<MenuItem, "stock">): boolean {
  return item.stock !== undefined && item.stock !== null && item.stock <= 0;
}

export function isLowStock(item: Pick<MenuItem, "stock">): boolean {
  return item.stock !== undefined && item.stock !== null && item.stock > 0 && item.stock < LOW_STOCK_THRESHOLD;
}

/** Photo of a gallery entry, so the demo menu and the product image picker share one set of URLs. */
function photo(galleryId: string): string {
  const entry = CULINARY_GALLERY.find((image) => image.id === galleryId);
  if (!entry) throw new Error(`Foto galeri "${galleryId}" tidak ditemukan.`);
  return entry.url;
}

/** Demo menu. Stock states covered: tracked, low (croissant, donat), sold out (cheesecake) and untracked. */
export const MENU_SEED: MenuItem[] = [
  {
    id: "kopi-susu",
    barcode: "8991002100015",
    name: "Kopi Susu",
    description: "Espresso, susu segar, dan gula aren yang lembut.",
    price: 25000,
    category: "Favorit",
    kind: "Minuman",
    prepMinutes: 2,
    badge: "Paling laris",
    image: photo("kopi-susu"),
  },
  {
    id: "nasi-goreng-spesial",
    barcode: "8991002100022",
    name: "Nasi Goreng Spesial",
    description: "Nasi goreng bumbu rempah dengan telur mata sapi dan acar.",
    price: 38000,
    category: "Favorit",
    kind: "Makanan",
    prepMinutes: 10,
    stock: 30,
    badge: "Pilihan dapur",
    image: photo("nasi-goreng"),
  },
  {
    id: "roti-panggang-isi",
    barcode: "8991002100029",
    name: "Roti Panggang Isi",
    description: "Roti sourdough panggang dengan isian keju dan telur.",
    price: 42000,
    category: "Favorit",
    kind: "Makanan",
    prepMinutes: 8,
    image: photo("roti-bakar"),
  },
  {
    id: "croissant-mentega",
    barcode: "8991002100036",
    name: "Croissant Mentega",
    description: "Croissant berlapis renyah, hangat dari oven.",
    price: 28000,
    category: "Sarapan",
    kind: "Makanan",
    prepMinutes: 4,
    stock: 4,
    image: photo("croissant"),
  },
  {
    id: "club-sandwich",
    barcode: "8991002100043",
    name: "Club Sandwich",
    description: "Roti panggang isi ayam, telur, selada, dan tomat.",
    price: 45000,
    category: "Sarapan",
    kind: "Makanan",
    prepMinutes: 7,
    stock: 15,
    image: photo("sandwich"),
  },
  {
    id: "ayam-bakar-madu",
    barcode: "8991002100050",
    name: "Ayam Bakar Madu",
    description: "Ayam bakar madu dengan nasi hangat, lalapan, dan sambal.",
    price: 52000,
    category: "Makanan",
    kind: "Makanan",
    prepMinutes: 15,
    stock: 20,
    image: photo("ayam-bakar"),
  },
  {
    id: "sate-ayam",
    barcode: "8991002100057",
    name: "Sate Ayam Bumbu Kacang",
    description: "Sepuluh tusuk sate ayam dengan bumbu kacang dan lontong.",
    price: 40000,
    category: "Makanan",
    kind: "Makanan",
    prepMinutes: 12,
    stock: 18,
    image: photo("sate-ayam"),
  },
  {
    id: "rendang-sapi",
    barcode: "8991002100064",
    name: "Rendang Sapi",
    description: "Rendang sapi empuk dimasak lama dengan santan dan rempah.",
    price: 58000,
    category: "Makanan",
    kind: "Makanan",
    prepMinutes: 10,
    stock: 12,
    image: photo("rendang-sapi"),
  },
  {
    id: "burger-keju",
    barcode: "8991002100071",
    name: "Burger Keju",
    description: "Burger daging sapi dengan keju leleh dan kentang goreng.",
    price: 49000,
    category: "Makanan",
    kind: "Makanan",
    prepMinutes: 10,
    stock: 10,
    image: photo("burger"),
  },
  {
    id: "mie-goreng-jawa",
    barcode: "8991002100078",
    name: "Mie Goreng Jawa",
    description: "Mie goreng bumbu kecap dengan telur, sayur, dan kerupuk.",
    price: 36000,
    category: "Mie & Pasta",
    kind: "Makanan",
    prepMinutes: 9,
    stock: 22,
    image: photo("mie-goreng"),
  },
  {
    id: "mie-ayam-bakso",
    barcode: "8991002100085",
    name: "Mie Ayam Bakso",
    description: "Mie ayam kuah gurih dengan bakso dan pangsit.",
    price: 30000,
    category: "Mie & Pasta",
    kind: "Makanan",
    prepMinutes: 8,
    image: photo("mie-ayam-bakso"),
  },
  {
    id: "spaghetti-bolognese",
    barcode: "8991002100092",
    name: "Spaghetti Bolognese",
    description: "Spaghetti dengan saus daging tomat dan taburan keju.",
    price: 48000,
    category: "Mie & Pasta",
    kind: "Makanan",
    prepMinutes: 10,
    stock: 16,
    image: photo("spaghetti"),
  },
  {
    id: "kopi-hitam",
    barcode: "8991002100099",
    name: "Kopi Hitam",
    description: "Seduhan biji arabika pekat tanpa gula.",
    price: 18000,
    category: "Minuman",
    kind: "Minuman",
    prepMinutes: 2,
    image: photo("kopi-hitam"),
  },
  {
    id: "cappuccino",
    barcode: "8991002100106",
    name: "Cappuccino",
    description: "Espresso, susu berbusa, dan latte art.",
    price: 28000,
    category: "Minuman",
    kind: "Minuman",
    prepMinutes: 3,
    image: photo("cappuccino"),
  },
  {
    id: "es-teh-manis",
    barcode: "8991002100113",
    name: "Es Teh Manis",
    description: "Teh segar dingin dengan irisan lemon.",
    price: 12000,
    category: "Minuman",
    kind: "Minuman",
    prepMinutes: 2,
    image: photo("es-teh-manis"),
  },
  {
    id: "es-jeruk",
    barcode: "8991002100120",
    name: "Es Jeruk Peras",
    description: "Jeruk peras segar dengan es batu.",
    price: 15000,
    category: "Minuman",
    kind: "Minuman",
    prepMinutes: 3,
    image: photo("es-jeruk"),
  },
  {
    id: "matcha-latte",
    barcode: "8991002100127",
    name: "Iced Matcha Latte",
    description: "Matcha dingin dengan susu dan sedikit madu.",
    price: 32000,
    category: "Minuman",
    kind: "Minuman",
    prepMinutes: 3,
    stock: 25,
    image: photo("matcha-latte"),
  },
  {
    id: "kentang-goreng",
    barcode: "8991002100134",
    name: "Kentang Goreng",
    description: "Kentang goreng renyah dengan saus sambal dan mayo.",
    price: 24000,
    category: "Camilan",
    kind: "Camilan",
    prepMinutes: 6,
    stock: 40,
    image: photo("kentang-goreng"),
  },
  {
    id: "dimsum-siomay",
    barcode: "8991002100141",
    name: "Dimsum Siomay",
    description: "Siomay ayam udang kukus, empat potong.",
    price: 32000,
    category: "Camilan",
    kind: "Camilan",
    prepMinutes: 7,
    stock: 14,
    image: photo("dimsum"),
  },
  {
    id: "pisang-goreng-keju",
    barcode: "8991002100148",
    name: "Pisang Goreng Keju Cokelat",
    description: "Pisang goreng renyah dengan keju dan cokelat leleh.",
    price: 22000,
    category: "Camilan",
    kind: "Camilan",
    prepMinutes: 6,
    image: photo("pisang-goreng"),
  },
  {
    id: "cheesecake-stroberi",
    barcode: "8991002100155",
    name: "Strawberry Cheesecake",
    description: "Cheesecake lembut dengan saus stroberi.",
    price: 38000,
    category: "Dessert",
    kind: "Camilan",
    prepMinutes: 3,
    stock: 0,
    image: photo("cheesecake"),
  },
  {
    id: "waffle-es-krim",
    barcode: "8991002100162",
    name: "Waffle Es Krim",
    description: "Waffle hangat dengan es krim vanila dan sirup maple.",
    price: 42000,
    category: "Dessert",
    kind: "Camilan",
    prepMinutes: 6,
    stock: 9,
    image: photo("waffle-ice-cream"),
  },
  {
    id: "donat-topping",
    barcode: "8991002100169",
    name: "Donat Aneka Topping",
    description: "Donat empuk dengan pilihan topping cokelat, gula, atau keju.",
    price: 18000,
    category: "Dessert",
    kind: "Camilan",
    prepMinutes: 3,
    stock: 3,
    image: photo("donat"),
  },
];

const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatIDR(value: number): string {
  return idrFormatter.format(value);
}
