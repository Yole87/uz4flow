/** Paleta por provedor externo. Exceção legítima ao design system —
 *  não é cor semântica, é identidade visual da marca do provedor
 *  (Kiwify=green, Hotmart=orange, Eduzz=blue). */
export const SOURCE_COLORS: Record<string, string> = {
  kiwify: "bg-green-500/10 text-green-500",
  hotmart: "bg-orange-500/10 text-orange-500",
  eduzz: "bg-blue-500/10 text-blue-500",
  monetizze: "bg-purple-500/10 text-purple-500",
  custom: "bg-muted text-muted-foreground",
};

export const SOURCE_LABELS: Record<string, string> = {
  kiwify: "Kiwify",
  hotmart: "Hotmart",
  eduzz: "Eduzz",
  monetizze: "Monetizze",
  custom: "Personalizado",
};
