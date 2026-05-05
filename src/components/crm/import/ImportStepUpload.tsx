import { useRef, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { FileData } from "@/hooks/useImportContacts";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED = [".xlsx", ".xls", ".csv"];

interface Props {
  fileData: FileData | null;
  onFileLoaded: (data: FileData) => void;
  onClear: () => void;
}

export function ImportStepUpload({ fileData, onFileLoaded, onClear }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      if (!ACCEPTED.includes(ext)) {
        toast.error("Formato não suportado. Use .xlsx, .xls ou .csv");
        return;
      }
      if (file.size > MAX_SIZE) {
        toast.error("Arquivo excede o limite de 10MB");
        return;
      }

      setParsing(true);
      try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) throw new Error("Planilha vazia");
        const sheet = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
          header: 1,
          defval: null,
          raw: false,
        });

        if (json.length === 0) throw new Error("Arquivo sem dados");

        // First non-empty row = headers
        const firstRow = json[0] || [];
        const headers = firstRow.map((h, i) =>
          h === null || h === undefined || String(h).trim() === ""
            ? `Coluna ${i + 1}`
            : String(h).trim()
        );
        const rows = json.slice(1).filter((r) => r.some((c) => c !== null && String(c).trim() !== ""));

        if (rows.length === 0) throw new Error("Nenhuma linha de dados encontrada");

        onFileLoaded({
          fileName: file.name,
          fileSize: file.size,
          headers,
          rows,
        });
        toast.success(`${rows.length} linha(s) detectada(s)`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao ler arquivo");
      } finally {
        setParsing(false);
      }
    },
    [onFileLoaded]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  if (fileData) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border/50 bg-muted/30 p-6 flex items-center justify-between gap-4 min-w-0">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <FileSpreadsheet className="h-10 w-10 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-medium truncate">{fileData.fileName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {(fileData.fileSize / 1024).toFixed(1)} KB · {fileData.headers.length} coluna(s) ·{" "}
                <span className="text-primary font-semibold">{fileData.rows.length} linha(s)</span>
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClear} className="shrink-0">
            <X className="h-4 w-4 mr-1" />
            Trocar arquivo
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          Pré-visualização das primeiras linhas:
        </div>
        <div className="rounded-md border border-border/50 overflow-auto quantum-scrollbar max-h-48">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                {fileData.headers.map((h, i) => (
                  <th key={i} className="px-2 py-1.5 text-left font-mono whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fileData.rows.slice(0, 5).map((row, ri) => (
                <tr key={ri} className="border-t border-border/30">
                  {fileData.headers.map((_, ci) => (
                    <td key={ci} className="px-2 py-1 font-mono whitespace-nowrap">
                      {row[ci] === null || row[ci] === undefined ? "" : String(row[ci])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`rounded-lg border-2 border-dashed transition-all cursor-pointer p-12 text-center ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border/50 hover:border-primary/50 hover:bg-muted/20"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-sm font-medium mb-1">
        {parsing ? "Lendo arquivo..." : "Arraste um arquivo ou clique para selecionar"}
      </p>
      <p className="text-xs text-muted-foreground">
        Formatos: .xlsx, .xls, .csv · Máximo 10 MB
      </p>
    </div>
  );
}
