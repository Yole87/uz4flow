import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle } from "lucide-react";

/**
 * Mapa entre cada item REAL do menu da plataforma e a categoria de
 * tutorial correspondente. As chaves devem bater com o slug/nome
 * usado em `tutorial_categories.name` (ou conter parte dele).
 */
const MENU_TO_TUTORIAL_CATEGORY: Array<{
  menu: string;
  match: string[];
}> = [
  { menu: "Primeiros Passos", match: ["primeiros passos", "introdução", "início"] },
  { menu: "Dashboard", match: ["dashboard", "visão geral"] },
  { menu: "CRM", match: ["crm", "atendimento"] },
  { menu: "Kanban", match: ["kanban", "funil"] },
  { menu: "Prospecção", match: ["prospecção", "prospeccao"] },
  { menu: "Voice AI", match: ["voice", "voz", "ligação", "ligacao"] },
  { menu: "Instagram", match: ["instagram"] },
  { menu: "MCP Gateway", match: ["mcp", "gateway"] },
  { menu: "Automação", match: ["automação", "automacao", "fluxo", "flow"] },
  { menu: "Conectores", match: ["conector", "webhook"] },
  { menu: "Integrações", match: ["integração", "integracao"] },
  { menu: "Equipe", match: ["equipe", "team", "membros"] },
  { menu: "Afiliados", match: ["afiliado"] },
  { menu: "Configurações", match: ["configuração", "configuracao", "settings"] },
];

interface Category {
  id: string;
  name: string;
}
interface Tutorial {
  id: string;
  category_id: string | null;
  is_published: boolean;
}

interface Props {
  categories: Category[];
  tutorials: Tutorial[];
}

interface Row {
  menu: string;
  matchedCategories: string[];
  total: number;
  published: number;
}

export function TutorialCoverageCard({ categories, tutorials }: Props) {
  const rows: Row[] = useMemo(() => {
    return MENU_TO_TUTORIAL_CATEGORY.map(({ menu, match }) => {
      const matchedCats = categories.filter((c) =>
        match.some((m) => c.name.toLowerCase().includes(m))
      );
      const matchedIds = new Set(matchedCats.map((c) => c.id));
      const tuts = tutorials.filter((t) => t.category_id && matchedIds.has(t.category_id));
      return {
        menu,
        matchedCategories: matchedCats.map((c) => c.name),
        total: tuts.length,
        published: tuts.filter((t) => t.is_published).length,
      };
    });
  }, [categories, tutorials]);

  const covered = rows.filter((r) => r.published > 0).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Cobertura de tutoriais por menu
          <Badge variant="outline" className="ml-2 font-normal">
            {covered}/{rows.length} cobertos
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Menu / Módulo</TableHead>
                <TableHead>Categoria(s) detectada(s)</TableHead>
                <TableHead className="w-24 text-center">Total</TableHead>
                <TableHead className="w-28 text-center">Publicados</TableHead>
                <TableHead className="w-32">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const ok = r.published > 0;
                return (
                  <TableRow key={r.menu}>
                    <TableCell className="font-medium">{r.menu}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.matchedCategories.length > 0 ? r.matchedCategories.join(", ") : "—"}
                    </TableCell>
                    <TableCell className="text-center">{r.total}</TableCell>
                    <TableCell className="text-center">{r.published}</TableCell>
                    <TableCell>
                      {ok ? (
                        <Badge className="gap-1" variant="default">
                          <ShieldCheck className="h-3 w-3" /> Coberto
                        </Badge>
                      ) : (
                        <Badge className="gap-1" variant="destructive">
                          <AlertTriangle className="h-3 w-3" /> Faltando
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
