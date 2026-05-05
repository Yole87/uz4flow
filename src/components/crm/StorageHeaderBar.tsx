import { useStorageUsage } from "@/hooks/useStorageUsage";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function StorageHeaderBar() {
  const { usedMB, limitMB, percentage, cleaning, cleanStorage, loading } = useStorageUsage();

  if (loading) return null;

  const barColor =
    percentage > 90 ? "bg-destructive" : percentage > 70 ? "bg-yellow-500" : "bg-emerald-500";

  const textColor =
    percentage > 90 ? "text-destructive" : percentage > 70 ? "text-yellow-500" : "text-muted-foreground";

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-default">
              <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${textColor}`}>
                {usedMB}/{limitMB} MB
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{Math.round(percentage)}% do armazenamento utilizado</p>
          </TooltipContent>
        </Tooltip>

        {percentage > 70 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                disabled={cleaning}
              >
                {cleaning ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar todas as mídias?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação irá remover todos os arquivos de áudio, imagem, vídeo e documentos armazenados.
                  O histórico de conversas em texto será preservado. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={cleanStorage}>Confirmar Limpeza</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </TooltipProvider>
  );
}
