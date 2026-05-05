import { useEffect, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  type ColumnMapping,
  type FileData,
  CRM_FIELDS,
  autoDetectMapping,
} from "@/hooks/useImportContacts";

interface Props {
  fileData: FileData;
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}

export function ImportStepMapping({ fileData, mapping, onChange }: Props) {
  // Auto-detect on first render if mapping empty
  useEffect(() => {
    if (Object.keys(mapping).length === 0 && fileData.headers.length > 0) {
      onChange(autoDetectMapping(fileData.headers));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileData.headers]);

  const handleChange = (idx: number, field: string) => {
    onChange({ ...mapping, [idx]: field });
  };

  const validation = useMemo(() => {
    const values = Object.values(mapping);
    const hasName = values.includes("name");
    const hasPhone = values.includes("phone");
    return { hasName, hasPhone, valid: hasName && hasPhone };
  }, [mapping]);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border/50 bg-muted/20 p-3 text-xs space-y-1">
        <div className="flex items-center gap-2">
          {validation.hasName ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-destructive" />
          )}
          <span>Mapear coluna para <strong>Nome</strong></span>
        </div>
        <div className="flex items-center gap-2">
          {validation.hasPhone ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-destructive" />
          )}
          <span>Mapear coluna para <strong>Telefone</strong></span>
        </div>
      </div>

      <div className="rounded-md border border-border/50 overflow-auto quantum-scrollbar max-h-[420px]">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wide text-muted-foreground">
                Coluna do arquivo
              </th>
              <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wide text-muted-foreground">
                Exemplo
              </th>
              <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wide text-muted-foreground w-64">
                Mapear para
              </th>
            </tr>
          </thead>
          <tbody>
            {fileData.headers.map((header, idx) => {
              const sample = fileData.rows[0]?.[idx];
              const sampleStr =
                sample === null || sample === undefined ? "—" : String(sample);
              const current = mapping[idx] || "__ignore__";
              return (
                <tr key={idx} className="border-t border-border/30">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Badge variant="outline" className="font-mono">
                      {header}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground truncate max-w-[180px]">
                    {sampleStr.length > 40 ? sampleStr.slice(0, 40) + "…" : sampleStr}
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={current}
                      onValueChange={(v) => handleChange(idx, v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CRM_FIELDS.map((f) => (
                          <SelectItem key={f.key} value={f.key} className="text-xs">
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
