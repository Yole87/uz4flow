import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { HardDrive, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { useStorageUsage } from "@/hooks/useStorageUsage";

export function StorageUsageCard() {
  const { usedMB, limitMB, percentage, isNearLimit, isAtLimit, fileCount, loading, cleaning, cleanStorage } = useStorageUsage();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const progressColor = isAtLimit
    ? "bg-destructive"
    : isNearLimit
      ? "bg-yellow-500"
      : "bg-primary";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Armazenamento
        </CardTitle>
        <CardDescription>
          Espaço utilizado por mídias e arquivos da sua organização
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {usedMB} MB de {limitMB} MB utilizados
            </span>
            <span className="font-medium">{Math.round(percentage)}%</span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full transition-all duration-500 rounded-full ${progressColor}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {fileCount} arquivo{fileCount !== 1 ? "s" : ""} armazenado{fileCount !== 1 ? "s" : ""}
          </p>
        </div>

        {isAtLimit && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">
              Limite de armazenamento atingido. Novas mídias não serão salvas.
            </p>
          </div>
        )}

        {isNearLimit && !isAtLimit && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Seu armazenamento está quase cheio. Considere limpar mídias antigas.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={cleaning || fileCount === 0}>
                {cleaning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Limpar Mídias
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar todas as mídias?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação irá remover todos os arquivos de áudio, imagem, vídeo e documentos armazenados.
                  O histórico de conversas em texto será preservado.
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={cleanStorage}>
                  Confirmar Limpeza
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <p className="text-xs text-muted-foreground">
            Mídias são limpas automaticamente a cada 3 dias
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
