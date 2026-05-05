import * as XLSX from "xlsx";
import { format } from "date-fns";

export interface ExportColumn<T = any> {
  key: string;
  label: string;
  format?: (value: any, row: T) => string | number;
}

export interface ExportTabularOptions<T = any> {
  rows: T[];
  columns: ExportColumn<T>[];
  fileName: string; // base name without extension
  format: "csv" | "xlsx";
  sheetName?: string;
}

function buildMatrix<T>(rows: T[], columns: ExportColumn<T>[]): (string | number)[][] {
  const header = columns.map((c) => c.label);
  const body = rows.map((row) =>
    columns.map((c) => {
      const raw = (row as any)[c.key];
      const v = c.format ? c.format(raw, row) : raw;
      if (v === null || v === undefined) return "";
      return v;
    })
  );
  return [header, ...body];
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportTabular<T>({ rows, columns, fileName, format: fmt, sheetName }: ExportTabularOptions<T>) {
  const matrix = buildMatrix(rows, columns);
  if (fmt === "csv") {
    const csv = matrix
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell ?? "");
            if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
            return s;
          })
          .join(",")
      )
      .join("\n");
    downloadBlob(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" }), `${fileName}.csv`);
    return;
  }
  const ws = XLSX.utils.aoa_to_sheet(matrix);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName || "Dados");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export interface ExportSheet<T = any> {
  name: string;
  rows: T[];
  columns: ExportColumn<T>[];
}

export function exportMultiSheet(opts: { sheets: ExportSheet[]; fileName: string }) {
  const wb = XLSX.utils.book_new();
  for (const sheet of opts.sheets) {
    if (!sheet.rows || sheet.rows.length === 0) continue;
    const ws = XLSX.utils.aoa_to_sheet(buildMatrix(sheet.rows, sheet.columns));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  XLSX.writeFile(wb, `${opts.fileName}.xlsx`);
}

export function buildReportFileName(tab: string, periodStart: Date, periodEnd: Date) {
  return `relatorio-${tab}-${format(periodStart, "yyyy-MM-dd")}_${format(periodEnd, "yyyy-MM-dd")}`;
}
