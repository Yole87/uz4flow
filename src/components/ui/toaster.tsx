/**
 * Renderer legado mantido apenas para compatibilidade de imports.
 *
 * Todos os toasts do sistema agora são renderizados pelo Sonner
 * (`src/components/ui/sonner.tsx`) montado em `App.tsx`. Esse componente
 * intencionalmente NÃO renderiza nada para evitar duplicidade de toasters
 * e o problema de toast aparecer atrás de modais.
 */
export function Toaster() {
  return null;
}
