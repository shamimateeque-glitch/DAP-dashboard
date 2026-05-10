// Single source of truth for brands shown in dropdowns AND their matter-code
// abbreviations. To add a brand, append one entry below and you're done —
// dropdowns, filters, and matter/invoice code generation all pick it up.
//
// `aliases` lists alternate spellings that should map to the same code (used
// when importing legacy data); the canonical `name` is what dropdowns display.

export interface Brand {
    name: string;
    code: string;
    aliases?: string[];
}

export const BRANDS: Brand[] = [
    { name: "American Eagle", code: "AE" },
    { name: "Asics", code: "ASC" },
    { name: "BMW", code: "BMW" },
    { name: "Biscoff Creamy", code: "BIS" },
    { name: "Burberry", code: "BRB" },
    { name: "Cavin Klein", code: "CK", aliases: ["Calvin Klein"] },
    { name: "Champion", code: "CHP" },
    { name: "Gucci", code: "GUC" },
    { name: "Guess", code: "GUS" },
    { name: "Harley davidson", code: "HD", aliases: ["Harley Davidson"] },
    { name: "Hugo Boss", code: "HUG" },
    { name: "Levis", code: "LEV", aliases: ["Levi's"] },
    { name: "Mars", code: "MRS" },
    { name: "New Balance", code: "NB" },
    { name: "Nike", code: "NK" },
    { name: "Nutella", code: "NUT" },
    { name: "Ordinary", code: "ORD" },
    { name: "Patek Philip", code: "PTP" },
    { name: "Peugeot", code: "PEU" },
    { name: "Porsche", code: "POR" },
    { name: "Puma", code: "PUM" },
    { name: "Reebok", code: "RBK" },
    { name: "Rolex", code: "RLX" },
    { name: "Skechers", code: "SKE" },
    { name: "Tommy Hilfiger", code: "TOM" },
    { name: "Toyota", code: "TOY" },
    { name: "US polo", code: "USP", aliases: ["U.S. Polo Assn"] },
    { name: "WD-40", code: "WD" },
].sort((a, b) => a.name.localeCompare(b.name));

// Canonical brand names for dropdowns / filters.
export const DEFAULT_BRANDS: string[] = BRANDS.map(b => b.name);

// name (and aliases) → code lookup, used by codeGenerators.
export const BRAND_ABBREVIATIONS: Record<string, string> = (() => {
    const map: Record<string, string> = {};
    for (const b of BRANDS) {
        map[b.name] = b.code;
        for (const alias of b.aliases ?? []) map[alias] = b.code;
    }
    return map;
})();
