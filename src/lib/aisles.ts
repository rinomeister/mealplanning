/**
 * Shopping-list aisles, and a keyword guess at which one an item belongs in.
 * Ingredient names are free text (English and Croatian both turn up), so this
 * is a best effort; a user's own pick is stored in ShoppingAisle and wins.
 */
export const AISLES = [
  "produce",
  "meat",
  "dairy",
  "bakery",
  "pantry",
  "spices",
  "frozen",
  "drinks",
  "other",
] as const;

export type Aisle = (typeof AISLES)[number];

export const AISLE_LABELS: Record<Aisle, string> = {
  produce: "Fruit & veg",
  meat: "Meat & fish",
  dairy: "Dairy & eggs",
  bakery: "Bread & bakery",
  pantry: "Pantry",
  spices: "Spices & sauces",
  frozen: "Frozen",
  drinks: "Drinks",
  other: "Other",
};

export function isAisle(v: string): v is Aisle {
  return (AISLES as readonly string[]).includes(v);
}

/**
 * Whole phrases checked first, so "peanut butter" isn't dairy and "coconut
 * milk" isn't either.
 */
const PHRASES: [string, Aisle][] = [
  ["peanut butter", "pantry"],
  ["almond butter", "pantry"],
  ["coconut milk", "pantry"],
  ["kokosovo mlijeko", "pantry"],
  ["almond milk", "drinks"],
  ["oat milk", "drinks"],
  ["soy sauce", "spices"],
  ["soja sos", "spices"],
  ["sojin umak", "spices"],
  ["olive oil", "pantry"],
  ["maslinovo ulje", "pantry"],
  ["sweet potato", "produce"],
  ["spring onion", "produce"],
  ["mladi luk", "produce"],
  ["protein powder", "pantry"],
  ["frozen", "frozen"],
  ["smrznut", "frozen"],
  ["ice cream", "frozen"],
  ["sladoled", "frozen"],
  ["tomato paste", "pantry"],
  ["tomato sauce", "pantry"],
  ["pelati", "pantry"],
  ["passata", "pantry"],
  ["black pepper", "spices"],
  ["pepper flakes", "spices"],
  ["chili flakes", "spices"],
  ["chilli flakes", "spices"],
  ["paprika powder", "spices"],
  ["garlic powder", "spices"],
  ["onion powder", "spices"],
  ["salad dressing", "spices"],
  ["chicken stock", "pantry"],
  ["chicken broth", "pantry"],
  ["beef stock", "pantry"],
  ["pileci temeljac", "pantry"],
  ["ribani sir", "dairy"],
  ["mljevena paprika", "spices"],
  ["slatka paprika", "spices"],
  ["ljuta paprika", "spices"],
  ["mljeveni papar", "spices"],
  ["mljeveni cimet", "spices"],
  ["crni papar", "spices"],
];

/**
 * Word stems per aisle. A stem matches the start of any word in the name
 * ("piletin" → "piletina", "piletine"). Stems of three letters or fewer must
 * match a whole word, so "sir" doesn't catch "sirup".
 */
const STEMS: Record<Exclude<Aisle, "other">, string[]> = {
  produce: [
    // English
    "apple", "banana", "berry", "berries", "blueberr", "strawberr", "raspberr",
    "lemon", "lime", "orange", "grape", "pear", "peach", "plum", "mango",
    "pineapple", "kiwi", "avocado", "tomato", "cucumber", "lettuce", "salad",
    "spinach", "kale", "rucola", "arugula", "carrot", "onion", "shallot",
    "garlic", "ginger", "potato", "pepper", "chili", "chilli", "zucchini",
    "courgette", "eggplant", "aubergine", "broccoli", "cauliflower", "cabbage",
    "celery", "leek", "mushroom", "pumpkin", "squash", "corn", "pea", "peas",
    "bean sprout", "beetroot", "radish", "parsley", "cilantro", "coriander",
    "basil leaves", "dill", "mint", "herbs", "fruit", "veg", "vegetable",
    // Croatian
    "jabuk", "banan", "bobic", "borovnic", "jagod", "malin", "limun", "limet",
    "narand", "narandz", "naranc", "grozd", "krusk", "breskv", "sljiv", "mang",
    "ananas", "avokad", "rajcic", "paradajz", "krastav", "salat", "zelena salata",
    "spinat", "blitv", "kelj", "mrkv", "luk", "luka", "kapul", "cesnjak", "cesnjk",
    "dumbir", "krumpir", "paprik", "feferon", "tikvic", "patlidzan", "brokul",
    "cvjetac", "kupus", "celer", "poriluk", "gljiv", "sampinjon", "bundev",
    "kukuruz", "grasak", "cikl", "rotkvic", "persin", "perso", "kopar", "metvic",
    "voce", "povrc",
  ],
  meat: [
    "chicken", "turkey", "beef", "steak", "pork", "ham", "bacon", "sausage",
    "mince", "minced", "lamb", "veal", "salami", "prosciutto", "fish", "salmon",
    "tuna steak", "cod", "hake", "shrimp", "prawn", "squid", "mussel", "seafood",
    "piletin", "pilec", "pileci", "pilet", "puret", "pureci", "purec",
    "junetin", "juneci", "govedin", "goveđ", "goved", "svinjetin", "svinjsk",
    "slanin", "kobasic", "mljeven", "mljeveno", "janjetin", "teletin",
    "salam", "prsut", "sunk", "riba", "ribe", "losos", "oslic", "bakalar",
    "skamp", "kozic", "lign", "dagnj", "meso", "mesa", "file", "fileti",
    "hrenovk", "cevap", "pljeskav",
  ],
  dairy: [
    "milk", "cheese", "cheddar", "mozzarella", "parmesan", "feta", "ricotta",
    "cottage", "yogurt", "yoghurt", "skyr", "kefir", "butter", "cream",
    "egg", "eggs", "quark",
    "mlijek", "sir", "sira", "sirni", "mozzarell", "parmezan", "gauda",
    "edamer", "jogurt", "vrhnj", "maslac", "jaja", "jaje",
    "skuta", "zrnat", "mlijecn", "puding", "pudding",
  ],
  bakery: [
    "bread", "baguette", "bun", "buns", "roll", "rolls", "tortilla", "wrap",
    "wraps", "pita", "bagel", "croissant", "toast",
    "kruh", "kruha", "pecivo", "peciva", "lepinj", "tortilj", "kifl", "baget",
    "tost", "zemick",
  ],
  pantry: [
    "rice", "pasta", "spaghetti", "penne", "noodle", "oat", "oats", "flour",
    "sugar", "oil", "lentil", "chickpea", "beans", "bean", "quinoa", "couscous",
    "cereal", "granola", "muesli", "honey", "jam", "nut", "nuts", "almond",
    "walnut", "cashew", "peanut", "seed", "seeds", "chia", "flax", "tuna",
    "canned", "can", "stock", "broth", "cocoa", "chocolate", "baking",
    "yeast", "raisin", "date", "dates", "crackers", "rice cakes",
    "riza", "rize", "tjestenin", "spaget", "makaron", "njok", "zob",
    "zobene", "zobeni", "brasn", "secer", "ulje", "ulja", "lec", "leca",
    "slanut", "grah", "kvinoj", "kus kus", "pahuljic", "musli", "med", "meda",
    "dzem", "marmelad", "orah", "orasi", "badem", "indijsk",
    "kikiriki", "sjemenk", "lan", "tune", "konzerv", "temeljac",
    "kakao", "cokolad", "kvasac", "prasak", "grozdic", "datul", "krekeri",
    "proteinski", "protein",
  ],
  spices: [
    "salt", "pepper flakes", "black pepper", "paprika powder", "cumin",
    "oregano", "basil", "thyme", "rosemary", "cinnamon", "nutmeg", "curry",
    "turmeric", "spice", "seasoning", "vinegar", "ketchup", "mustard", "mayo",
    "mayonnaise", "sauce", "salsa", "pesto", "sriracha", "dressing", "vanilla",
    "sol", "soli", "papar", "papra", "kumin", "origan", "bosilj", "timijan",
    "ruzmarin", "cimet", "muskatn", "kari", "kurkum", "zacin", "vegeta",
    "ocat", "octa", "kecap", "senf", "majonez", "umak", "umaka", "pesto",
    "vanilij", "lovor",
  ],
  frozen: ["frozen", "smrznut", "ice"],
  drinks: [
    "water", "juice", "coffee", "tea", "soda", "cola", "beer", "wine",
    "voda", "vode", "sok", "soka", "kava", "kave", "caj", "pivo", "vino",
  ],
};

/** Lower-case and strip diacritics: "Pileća prsa" → "pileca prsa". */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Prepared once: folded stems in aisle order, so earlier aisles win ties
// (e.g. "pepper" the vegetable before "black pepper" is only a phrase match).
const PREPARED_PHRASES = PHRASES.map(([p, a]) => [fold(p), a] as const);
const PREPARED_STEMS = (
  Object.entries(STEMS) as [Exclude<Aisle, "other">, string[]][]
).map(([aisle, stems]) => [aisle, stems.map(fold).filter(Boolean)] as const);

/** Best guess at an item's aisle from its name; "other" when nothing matches. */
export function guessAisle(name: string): Aisle {
  const folded = fold(name);
  if (!folded) return "other";
  const padded = ` ${folded} `;
  for (const [phrase, aisle] of PREPARED_PHRASES) {
    if (padded.includes(` ${phrase}`)) return aisle;
  }
  const words = folded.split(" ");
  // Multi-word stems ("zelena salata") are checked against the whole name.
  for (const [aisle, stems] of PREPARED_STEMS) {
    for (const stem of stems) {
      if (stem.includes(" ")) {
        if (padded.includes(` ${stem}`)) return aisle;
        continue;
      }
      const exact = stem.length <= 3;
      if (words.some((w) => (exact ? w === stem : w.startsWith(stem)))) {
        return aisle;
      }
    }
  }
  return "other";
}

/** The key aisle choices are stored under: the trimmed, lower-cased name. */
export function aisleKey(name: string): string {
  return name.trim().toLowerCase();
}
