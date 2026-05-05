import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { exportTabular, type ExportColumn } from "@/lib/reports/exporters";

interface ExportButtonProps<T> {
  rows: T[];
  columns: ExportColumn<T>[];
  fileName: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
  disabled?: boolean;
}

export function ExportButton<T>({
  rows,
  columns,
  fileName,
  label = "Exportar",
  size = "sm",
  variant = "outline",
  disabled,
}: ExportButtonProps<T>) {
  const isEmpty = !rows || rows.length === 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled || isEmpty} className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportTabular({ rows, columns, fileName, format: "csv" })}>
          <FileText className="h-4 w-4 mr-2" /> Exportar CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportTabular({ rows, columns, fileName, format: "xlsx" })}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
