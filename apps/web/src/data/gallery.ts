/** Kategori galeri foto menu bawaan, urutannya dipakai sebagai filter. */
export const GALLERY_CATEGORIES = [
  "Kopi & Teh",
  "Minuman Dingin",
  "Nasi & Lauk",
  "Mie & Pasta",
  "Roti & Burger",
  "Camilan",
  "Kue & Dessert",
] as const;

export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number];

export interface GalleryImage {
  id: string;
  title: string;
  category: GalleryCategory;
  url: string;
  keywords: readonly string[];
}

/** Foto kuliner kurasi (Unsplash) untuk katalog produk. Butuh internet saat ditampilkan. */
export const CULINARY_GALLERY: readonly GalleryImage[] = [
  // Kopi & Teh
  {
    id: "kopi-susu",
    title: "Kopi Susu Aren",
    category: "Kopi & Teh",
    url: "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600&auto=format&fit=crop&q=75",
    keywords: ["kopi", "susu", "aren", "coffee", "latte", "espresso"],
  },
  {
    id: "cappuccino",
    title: "Cappuccino / Latte Art",
    category: "Kopi & Teh",
    url: "https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=75",
    keywords: ["cappuccino", "latte", "art", "kopi", "panas", "coffee"],
  },
  {
    id: "kopi-hitam",
    title: "Kopi Hitam / Americano",
    category: "Kopi & Teh",
    url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=75",
    keywords: ["kopi", "hitam", "americano", "tubruk", "espresso", "black coffee"],
  },
  {
    id: "teh-hangat",
    title: "Teh Melati / Artisan Tea",
    category: "Kopi & Teh",
    url: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=75",
    keywords: ["teh", "tea", "hangat", "melati", "jasmine", "herbal"],
  },

  // Minuman Dingin & Segar
  {
    id: "es-teh-manis",
    title: "Es Teh Manis Segar",
    category: "Minuman Dingin",
    url: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=75",
    keywords: ["es", "teh", "manis", "lemon", "iced tea", "segar"],
  },
  {
    id: "es-jeruk",
    title: "Es Jeruk Peras",
    category: "Minuman Dingin",
    url: "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600&auto=format&fit=crop&q=75",
    keywords: ["es", "jeruk", "orange", "juice", "jus", "segar", "citrus"],
  },
  {
    id: "jus-alpukat",
    title: "Jus Buah Segar",
    category: "Minuman Dingin",
    url: "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=600&auto=format&fit=crop&q=75",
    keywords: ["jus", "alpukat", "mangga", "juice", "smoothie", "buah"],
  },
  {
    id: "mocktail-soda",
    title: "Mocktail Soda Buah",
    category: "Minuman Dingin",
    url: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=75",
    keywords: ["mocktail", "soda", "mojito", "minuman", "dingin", "sparkling"],
  },
  {
    id: "boba-milk-tea",
    title: "Boba Brown Sugar Milk",
    category: "Minuman Dingin",
    url: "https://images.unsplash.com/photo-1558857563-b37cf05d8a58?w=600&auto=format&fit=crop&q=75",
    keywords: ["boba", "milk tea", "bubble", "brown sugar", "susu"],
  },
  {
    id: "matcha-latte",
    title: "Iced Matcha Latte",
    category: "Minuman Dingin",
    url: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=75",
    keywords: ["matcha", "green tea", "latte", "susu", "jepang"],
  },

  // Nasi & Lauk Utama
  {
    id: "nasi-goreng",
    title: "Nasi Goreng Spesial Telur",
    category: "Nasi & Lauk",
    url: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&auto=format&fit=crop&q=75",
    keywords: ["nasi", "goreng", "fried rice", "telur", "spesial", "makanan"],
  },
  {
    id: "ayam-goreng",
    title: "Ayam Goreng Lengkuas",
    category: "Nasi & Lauk",
    url: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&auto=format&fit=crop&q=75",
    keywords: ["ayam", "goreng", "fried chicken", "lengkuas", "crispy", "lauk"],
  },
  {
    id: "ayam-bakar",
    title: "Ayam Bakar Madu / Taliwang",
    category: "Nasi & Lauk",
    url: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&auto=format&fit=crop&q=75",
    keywords: ["ayam", "bakar", "grilled chicken", "madu", "pedas"],
  },
  {
    id: "sate-ayam",
    title: "Sate Ayam Bumbu Kacang",
    category: "Nasi & Lauk",
    url: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600&auto=format&fit=crop&q=75",
    keywords: ["sate", "satay", "ayam", "kacang", "bakar", "daging"],
  },
  {
    id: "rendang-sapi",
    title: "Rendang Sapi Minang",
    category: "Nasi & Lauk",
    url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=75",
    keywords: ["rendang", "sapi", "padang", "daging", "beef", "gulai"],
  },
  {
    id: "rice-bowl",
    title: "Rice Bowl Daging Teriyaki",
    category: "Nasi & Lauk",
    url: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=600&auto=format&fit=crop&q=75",
    keywords: ["rice bowl", "nasi", "daging", "teriyaki", "sambal", "bowl"],
  },

  // Mie & Pasta
  {
    id: "mie-goreng",
    title: "Mie Goreng Jawa / Seafood",
    category: "Mie & Pasta",
    url: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=75",
    keywords: ["mie", "goreng", "noodle", "fried noodles", "bakmi", "kwetiau"],
  },
  {
    id: "mie-ayam-bakso",
    title: "Mie Ayam & Bakso Kuah",
    category: "Mie & Pasta",
    url: "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=600&auto=format&fit=crop&q=75",
    keywords: ["mie", "ayam", "bakso", "kuah", "noodle soup", "pangsit"],
  },
  {
    id: "spaghetti",
    title: "Spaghetti Bolognese / Carbonara",
    category: "Mie & Pasta",
    url: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&auto=format&fit=crop&q=75",
    keywords: ["pasta", "spaghetti", "carbonara", "bolognese", "italia"],
  },
  {
    id: "ramen",
    title: "Ramen Kuah Gurih",
    category: "Mie & Pasta",
    url: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=75",
    keywords: ["ramen", "mie", "jepang", "kuah", "pedas"],
  },

  // Roti & Burger
  {
    id: "roti-bakar",
    title: "Roti Panggang / Toast Keju",
    category: "Roti & Burger",
    url: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&auto=format&fit=crop&q=75",
    keywords: ["roti", "toast", "panggang", "bakar", "sandwich", "sarapan"],
  },
  {
    id: "burger",
    title: "Beef Burger & Keju",
    category: "Roti & Burger",
    url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=75",
    keywords: ["burger", "beef", "daging", "keju", "cheese", "fast food"],
  },
  {
    id: "sandwich",
    title: "Club Sandwich Segar",
    category: "Roti & Burger",
    url: "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=600&auto=format&fit=crop&q=75",
    keywords: ["sandwich", "roti", "telur", "tuna", "sarapan"],
  },
  {
    id: "croissant",
    title: "Croissant Mentega",
    category: "Roti & Burger",
    url: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=75",
    keywords: ["croissant", "pastry", "roti", "bakery", "mentega"],
  },

  // Camilan & Gorengan
  {
    id: "kentang-goreng",
    title: "Kentang Goreng / French Fries",
    category: "Camilan",
    url: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600&auto=format&fit=crop&q=75",
    keywords: ["kentang", "fries", "french fries", "camilan", "snack", "goreng"],
  },
  {
    id: "dimsum",
    title: "Dimsum Siomay Kukus",
    category: "Camilan",
    url: "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=600&auto=format&fit=crop&q=75",
    keywords: ["dimsum", "siomay", "kukus", "camilan", "dumpling"],
  },
  {
    id: "pisang-goreng",
    title: "Pisang Goreng Keju Cokelat",
    category: "Camilan",
    url: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&auto=format&fit=crop&q=75",
    keywords: ["pisang", "goreng", "keju", "cokelat", "snack", "manis"],
  },
  {
    id: "tahu-crispy",
    title: "Tahu Crispy / Tempe Mendoan",
    category: "Camilan",
    url: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=75",
    keywords: ["tahu", "tempe", "gorengan", "crispy", "camilan"],
  },

  // Kue & Dessert
  {
    id: "kue-cokelat",
    title: "Kue Cokelat Fudge Cake",
    category: "Kue & Dessert",
    url: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&auto=format&fit=crop&q=75",
    keywords: ["cake", "kue", "cokelat", "chocolate", "dessert", "manis"],
  },
  {
    id: "cheesecake",
    title: "Strawberry Cheesecake",
    category: "Kue & Dessert",
    url: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&auto=format&fit=crop&q=75",
    keywords: ["cheesecake", "keju", "strawberry", "kue", "dessert"],
  },
  {
    id: "waffle-ice-cream",
    title: "Waffle & Es Krim Vanilla",
    category: "Kue & Dessert",
    url: "https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=600&auto=format&fit=crop&q=75",
    keywords: ["waffle", "es krim", "ice cream", "dessert", "manis"],
  },
  {
    id: "donat",
    title: "Donat Aneka Topping",
    category: "Kue & Dessert",
    url: "https://images.unsplash.com/photo-1527515862127-a4fc05baf7a5?w=600&auto=format&fit=crop&q=75",
    keywords: ["donat", "doughnut", "manis", "glaze", "snack"],
  },
];

/** Gallery photos in `category` (all of them when `category` is null) whose title, category or keywords contain `query`. */
export function filterGallery(query: string, category: GalleryCategory | null): GalleryImage[] {
  const q = query.trim().toLowerCase();
  return CULINARY_GALLERY.filter((image) => {
    if (category !== null && image.category !== category) return false;
    if (!q) return true;
    return (
      image.title.toLowerCase().includes(q) ||
      image.category.toLowerCase().includes(q) ||
      image.keywords.some((keyword) => keyword.toLowerCase().includes(q))
    );
  });
}
