import { toast } from "sonner";

// Catálogo de erros conhecidos com mensagens claras em português
export interface TranslatedError {
  code: string;
  message: string;
  isKnown: boolean;
}

// ============================================
// Mapeamento de erros do Supabase Auth para PT-BR
// ============================================
const AUTH_ERROR_MAP: Record<string, string> = {
  "Password is known to be weak": "Sua senha atende aos requisitos mínimos, mas foi identificada como insegura por já ter aparecido em vazamentos públicos. Escolha outra senha única.",
  "weak_password": "Sua senha atende aos requisitos mínimos, mas foi identificada como insegura por já ter aparecido em vazamentos públicos. Escolha outra senha única.",
  "Password should be at least": "A senha deve ter no mínimo 8 caracteres, com letra maiúscula, minúscula, número e símbolo.",
  "Email not confirmed": "Email não confirmado. Verifique sua caixa de entrada.",
  "Email rate limit exceeded": "Muitas tentativas. Aguarde alguns minutos.",
  "Invalid login credentials": "Email ou senha incorretos.",
  "User already registered": "Este email já está cadastrado. Tente fazer login.",
  "New password should be different": "A nova senha deve ser diferente da atual.",
  "Signup requires a valid password": "Senha inválida. Use no mínimo 6 caracteres.",
  "Unable to validate email": "Email inválido. Verifique o endereço informado.",
  "User not found": "Usuário não encontrado.",
  "Email link is invalid or has expired": "Link inválido ou expirado. Solicite um novo.",
  "Token has expired or is invalid": "Sessão expirada. Faça login novamente.",
  "For security purposes, you can only request this once every": "Por segurança, aguarde antes de tentar novamente.",
  "Auth session missing": "Sessão não encontrada. Faça login novamente.",
  "Invalid Refresh Token": "Sessão expirada. Faça login novamente.",
  "over_email_send_rate_limit": "Muitas tentativas de envio de email. Aguarde alguns minutos.",
  "anonymous sign-ins are disabled": "Cadastro anônimo não permitido.",
};

/**
 * Traduz mensagem de erro do Supabase Auth para PT-BR.
 * Faz match parcial (includes) para cobrir variações.
 */
export function translateAuthError(errorMessage: string): string {
  for (const [key, translated] of Object.entries(AUTH_ERROR_MAP)) {
    if (errorMessage.includes(key)) {
      return translated;
    }
  }
  return "Ocorreu um erro. Tente novamente.";
}

/**
 * Helper para exibir toast de erro sempre em PT-BR.
 * Aceita prefixo contextual opcional (ex: "Erro ao salvar").
 */
export function toastError(error: unknown, contextPrefix?: string): void {
  const msg = error instanceof Error ? error.message : String(error || "");
  
  // Try auth error map first
  for (const [key, translated] of Object.entries(AUTH_ERROR_MAP)) {
    if (msg.includes(key)) {
      toast.error(contextPrefix ? `${contextPrefix}: ${translated}` : translated);
      return;
    }
  }

  // Try general error catalog
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (msg.includes(key)) {
      toast.error(contextPrefix ? `${contextPrefix}: ${value.message}` : value.message);
      return;
    }
  }

  // Fallback: if message looks Portuguese already, show it; otherwise generic
  const looksPortuguese = /[àáâãéêíóôõúç]/.test(msg) || msg.startsWith("Erro") || msg.startsWith("Não") || msg.startsWith("Limite");
  if (looksPortuguese && msg.length < 200) {
    toast.error(contextPrefix ? `${contextPrefix}: ${msg}` : msg);
  } else {
    toast.error(contextPrefix ? `${contextPrefix}. Tente novamente.` : "Ocorreu um erro. Tente novamente.");
  }
}

export const ERROR_MESSAGES: Record<string, { code: string; message: string }> = {
  // Configuração
  "Integration not configured": {
    code: "CONFIG_001",
    message: "Integração não configurada. Configure sua API Key e URL do Sistema de WhatsApp AI nas Configurações.",
  },
  "OpenBot not configured": {
    code: "CONFIG_002",
    message: "Sistema de WhatsApp AI não configurado. Adicione a API Key e URL de entrada nas Configurações.",
  },
  "OpenBot URL or API key not configured": {
    code: "CONFIG_002",
    message: "Sistema de WhatsApp AI não configurado. Adicione a API Key e URL de entrada nas Configurações.",
  },
  "Phone field not configured": {
    code: "CONFIG_003",
    message: "Campo de telefone não configurado. Selecione qual campo do webhook contém o número de telefone.",
  },
  "No interactions configured": {
    code: "CONFIG_004",
    message: "Nenhuma interação configurada. Adicione pelo menos uma mensagem ou arquivo para enviar.",
  },
  
  // Dados/Payload
  "Phone number not found": {
    code: "DATA_001",
    message: "Número de telefone não encontrado no payload. Verifique se o caminho do campo está correto.",
  },
  "File not found": {
    code: "DATA_002",
    message: "Arquivo não encontrado. O arquivo pode ter sido excluído ou movido.",
  },
  "File not found in database": {
    code: "DATA_002",
    message: "Arquivo não encontrado no banco de dados. O arquivo pode ter sido excluído.",
  },
  
  // Arquivos
  "Maximum call stack size exceeded": {
    code: "FILE_001",
    message: "Arquivo muito grande para processar. Reduza o tamanho do arquivo (máximo permitido: 16MB).",
  },
  "RangeError: Maximum call stack size exceeded": {
    code: "FILE_001",
    message: "Arquivo muito grande para processar. Reduza o tamanho do arquivo (máximo permitido: 16MB).",
  },
  "Failed to download file": {
    code: "FILE_002",
    message: "Erro ao baixar arquivo do armazenamento. Tente reenviar o arquivo.",
  },
  
  // IA
  "AI not configured": {
    code: "AI_001",
    message: "Serviço de IA não disponível. Tente novamente mais tarde ou use um template fixo.",
  },
  "AI error": {
    code: "AI_002",
    message: "Erro ao gerar mensagem com IA. Tente novamente ou simplifique o prompt.",
  },
  
  // Arquivo muito grande (HTTP 413)
  "413": {
    code: "FILE_003",
    message: "O arquivo enviado excede o limite máximo de 16MB permitido pela API do WhatsApp. Reduza o tamanho do arquivo e tente novamente.",
  },
  "excede o limite máximo de 16MB": {
    code: "FILE_003",
    message: "O arquivo enviado excede o limite máximo de 16MB permitido pela API do WhatsApp. Reduza o tamanho do arquivo e tente novamente.",
  },
  
  // Rede/OpenBot
  "Network error": {
    code: "NET_001",
    message: "Erro de conexão com o Sistema de WhatsApp AI. Verifique se a URL está correta e o serviço está online.",
  },
  "HTTP 5": {
    code: "NET_002",
    message: "Servidor do Sistema de WhatsApp AI indisponível temporariamente. O sistema tentará reenviar automaticamente.",
  },
  "HTTP 4": {
    code: "NET_003",
    message: "Requisição rejeitada pelo Sistema de WhatsApp AI. Verifique a API Key e o formato do payload.",
  },
  "OpenBot returned success:false": {
    code: "OB_001",
    message: "Sistema de WhatsApp AI rejeitou a mensagem. Verifique se o número de telefone é válido e está no formato correto.",
  },
  "Max retries exceeded": {
    code: "NET_004",
    message: "Máximo de tentativas excedido. O Sistema de WhatsApp AI não está respondendo. Tente novamente mais tarde.",
  },
  
  // Configuração de interação
  "Invalid text configuration": {
    code: "INT_001",
    message: "Configuração de texto inválida. Preencha o template ou prompt de IA.",
  },
  "Invalid interaction configuration": {
    code: "INT_002",
    message: "Configuração de interação inválida. Verifique se todos os campos obrigatórios estão preenchidos.",
  },
  
  // Marcação manual
  "Marcado como falhou manualmente": {
    code: "MANUAL_001",
    message: "Este evento foi marcado como falhou manualmente pelo usuário devido a timeout ou erro não identificado.",
  },
  
  // ============================================
  // PROSPECÇÃO - Erros da API Browserless
  // ============================================
  
  // HTTP 429 - Rate Limit
  "429": {
    code: "PROSP_001",
    message: "Limite de requisições atingido. Aguarde 60 segundos e tente novamente.",
  },
  "Too Many Requests": {
    code: "PROSP_001",
    message: "Limite de requisições atingido. Aguarde 60 segundos e tente novamente.",
  },
  "concurrency limit": {
    code: "PROSP_001",
    message: "Limite de buscas simultâneas atingido. Aguarde a busca atual terminar.",
  },
  "Limite de requisições atingido (429)": {
    code: "PROSP_001",
    message: "Limite de requisições atingido. Aguarde 60 segundos e tente novamente.",
  },
  
  // HTTP 408 - Timeout
  "408": {
    code: "PROSP_002",
    message: "A busca excedeu o tempo limite do seu plano Browserless. Tente buscar menos resultados (máximo 50).",
  },
  "Request Timeout": {
    code: "PROSP_002",
    message: "Tempo limite excedido. Reduza a quantidade de resultados ou tente uma busca mais específica.",
  },
  "Tempo limite excedido (408)": {
    code: "PROSP_002",
    message: "A busca excedeu o tempo limite. Reduza a quantidade de resultados e tente novamente.",
  },
  
  // HTTP 401/403 - Auth
  "401": {
    code: "PROSP_003",
    message: "Chave Browserless inválida ou expirada. Verifique sua configuração.",
  },
  "403": {
    code: "PROSP_003",
    message: "Acesso negado pela API. Verifique se sua chave Browserless está ativa.",
  },
  "Chave Browserless inválida": {
    code: "PROSP_003",
    message: "Sua chave Browserless não é válida ou expirou. Verifique a configuração.",
  },
  
  // HTTP 503 - Service Unavailable
  "503": {
    code: "PROSP_004",
    message: "Serviço Browserless temporariamente indisponível. Aguarde 2-5 minutos e tente novamente.",
  },
  "service unavailable": {
    code: "PROSP_004",
    message: "Serviço de extração indisponível no momento. Tente novamente em alguns minutos.",
  },
  "Serviço Browserless indisponível": {
    code: "PROSP_004",
    message: "O serviço de extração está temporariamente fora do ar. Aguarde 2-5 minutos.",
  },
  
  // HTTP 500 - Server Error
  "500": {
    code: "PROSP_005",
    message: "Erro interno no serviço de extração. Aguarde 1-2 minutos e tente novamente.",
  },
  "Internal Server Error": {
    code: "PROSP_005",
    message: "Erro interno no serviço. Tente novamente em alguns minutos.",
  },
  
  // Parse/Response errors
  "Failed to parse Browserless response": {
    code: "PROSP_006",
    message: "Erro ao processar resposta da busca. O Google pode ter alterado o layout. Tente novamente.",
  },
  "Failed to parse response": {
    code: "PROSP_006",
    message: "Erro ao processar a resposta. Tente novamente.",
  },
  
  // Organization/Auth errors
  "No organization found": {
    code: "PROSP_007",
    message: "Organização não encontrada. Faça login novamente.",
  },
  
  // Configuration errors
  "Configure sua chave Browserless": {
    code: "PROSP_008",
    message: "Configure sua chave Browserless na aba Configurações antes de iniciar a prospecção.",
  },
  "Chave Browserless não está configurada": {
    code: "PROSP_008",
    message: "Sua chave Browserless não está ativa. Verifique se a configuração foi salva corretamente.",
  },
  
  // Navigation/Network errors
  "networkidle": {
    code: "PROSP_009",
    message: "A página demorou muito para carregar. Verifique sua conexão e tente novamente.",
  },
  "Navigation timeout": {
    code: "PROSP_009",
    message: "Timeout ao acessar o Google Maps. Tente novamente em alguns segundos.",
  },
  "timeout": {
    code: "PROSP_009",
    message: "A operação excedeu o tempo limite. Tente novamente.",
  },
  
  // Edge function errors
  "FunctionsHttpError": {
    code: "PROSP_010",
    message: "Erro de comunicação com o servidor. Verifique sua conexão e tente novamente.",
  },
  "FunctionsRelayError": {
    code: "PROSP_010",
    message: "Erro de comunicação. Tente novamente em alguns segundos.",
  },
  
  // ============================================
  // PROSPECÇÃO - Erros de Infraestrutura/Edge Function
  // ============================================
  
  // Edge Function não disponível (404)
  "Failed to send a request to the Edge Function": {
    code: "PROSP_100",
    message: "Serviço de busca temporariamente indisponível. Aguarde 2 minutos e tente novamente.",
  },
  "NOT_FOUND": {
    code: "PROSP_100",
    message: "Serviço de busca em manutenção. Aguarde alguns minutos e tente novamente.",
  },
  
  // Erro de conexão/rede
  "Failed to fetch": {
    code: "PROSP_101",
    message: "Não foi possível conectar ao serviço. Verifique sua conexão com a internet.",
  },
  "fetch failed": {
    code: "PROSP_101",
    message: "Falha na conexão. Verifique sua internet e tente novamente.",
  },
  "NetworkError": {
    code: "PROSP_101",
    message: "Erro de rede. Verifique sua conexão e tente novamente.",
  },
  
  // Erro de descriptografia
  "DECRYPTION_FAILED": {
    code: "PROSP_102",
    message: "Erro ao validar chave API. Reconfigure sua chave na aba Configurações.",
  },
  
  // Google Cloud Geocoding API não habilitada
  "Geocoding API request denied": {
    code: "PROSP_014",
    message: "A Geocoding API do Google não está habilitada. Habilite-a no Google Cloud Console.",
  },
  "geocoding": {
    code: "PROSP_014",
    message: "A Geocoding API do Google precisa ser habilitada para buscar por localização.",
  },
  "Cannot decrypt": {
    code: "PROSP_102",
    message: "Chave API corrompida. Reconfigure na aba Configurações.",
  },
};

// Traduz mensagem de erro para formato amigável
export function translateError(errorMessage: string | null | undefined): TranslatedError {
  if (!errorMessage) {
    return {
      code: "UNKNOWN",
      message: "Erro desconhecido. Verifique os logs para mais detalhes.",
      isKnown: false,
    };
  }

  // Procurar correspondência nas chaves do catálogo
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (errorMessage.includes(key)) {
      return {
        code: value.code,
        message: value.message,
        isKnown: true,
      };
    }
  }

  // Verificar se já é uma mensagem traduzida (com código)
  const codeMatch = errorMessage.match(/^\[([A-Z_]+\d+)\]/);
  if (codeMatch) {
    return {
      code: codeMatch[1],
      message: errorMessage.replace(/^\[[A-Z_]+\d+\]\s*/, ""),
      isKnown: true,
    };
  }

  // Erro desconhecido
  return {
    code: "UNKNOWN",
    message: `Erro inesperado: ${errorMessage}. Entre em contato com o suporte se o problema persistir.`,
    isKnown: false,
  };
}

// Tradução específica para erros de prospecção com metadados adicionais
export interface TranslatedProspectionError {
  code: string;
  title: string;
  message: string;
  waitTime?: string;
  tip?: string;
  showConfig?: boolean;
  showRetry?: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

export function translateProspectionError(
  errorMessage: string | null | undefined
): TranslatedProspectionError {
  if (!errorMessage) {
    return {
      code: "UNKNOWN",
      title: "Erro Desconhecido",
      message: "Ocorreu um erro inesperado durante a busca.",
      showRetry: true,
    };
  }

  // HTTP 429 - Rate Limit
  if (errorMessage.includes("429") || errorMessage.includes("Too Many Requests") || 
      errorMessage.includes("concurrency limit") || errorMessage.includes("Limite de requisições")) {
    return {
      code: "PROSP_001",
      title: "Limite de Requisições Atingido",
      message: "Sua conta Browserless atingiu o limite de buscas simultâneas. Isso acontece quando há muitas extrações rodando ao mesmo tempo.",
      waitTime: "60 segundos",
      tip: "Você pode fazer upgrade do seu plano Browserless para aumentar o limite de requisições simultâneas.",
      showRetry: true,
    };
  }

  // HTTP 408 - Timeout
  if (errorMessage.includes("408") || errorMessage.includes("Request Timeout") || 
      errorMessage.includes("Tempo limite excedido")) {
    return {
      code: "PROSP_002",
      title: "Tempo Limite Excedido",
      message: "A busca demorou mais que o permitido pelo seu plano Browserless. Isso pode acontecer com buscas muito amplas.",
      tip: "Tente reduzir a quantidade de resultados (máximo 50) ou use uma busca mais específica.",
      showRetry: true,
    };
  }

  // HTTP 401/403 - Auth
  if (errorMessage.includes("401") || errorMessage.includes("403") || 
      errorMessage.includes("Chave Browserless inválida") || errorMessage.includes("sem permissão")) {
    return {
      code: "PROSP_003",
      title: "Chave Inválida ou Expirada",
      message: "Sua chave Browserless não é válida, expirou ou não tem permissão para executar esta operação.",
      tip: "Acesse o painel do Browserless para verificar o status da sua conta e gerar uma nova chave se necessário.",
      showConfig: true,
      showRetry: false,
    };
  }

  // HTTP 503 - Service Unavailable
  if (errorMessage.includes("503") || errorMessage.includes("service unavailable") || 
      errorMessage.includes("Serviço Browserless indisponível")) {
    return {
      code: "PROSP_004",
      title: "Serviço Temporariamente Indisponível",
      message: "O serviço de extração Browserless está temporariamente fora do ar para manutenção ou devido a alta demanda.",
      waitTime: "2-5 minutos",
      tip: "Este é um problema temporário. O serviço geralmente volta ao normal em poucos minutos.",
      showRetry: true,
    };
  }

  // HTTP 500 - Server Error
  if (errorMessage.includes("500") || errorMessage.includes("Internal Server Error")) {
    return {
      code: "PROSP_005",
      title: "Erro Interno do Servidor",
      message: "Ocorreu um erro interno no serviço de extração. Nossa equipe já foi notificada.",
      waitTime: "1-2 minutos",
      tip: "Tente novamente em alguns minutos. Se o problema persistir, entre em contato com o suporte.",
      showRetry: true,
    };
  }

  // Parse errors
  if (errorMessage.includes("Failed to parse") || errorMessage.includes("parse")) {
    return {
      code: "PROSP_006",
      title: "Erro ao Processar Resultados",
      message: "Não foi possível processar a resposta do Google Maps. O layout da página pode ter mudado temporariamente.",
      tip: "Aguarde alguns segundos e tente novamente. Se persistir, tente uma busca diferente.",
      showRetry: true,
    };
  }

  // Organization/Auth errors
  if (errorMessage.includes("No organization") || errorMessage.includes("Organização não encontrada")) {
    return {
      code: "PROSP_007",
      title: "Sessão Expirada",
      message: "Sua sessão expirou ou a organização não foi encontrada.",
      tip: "Faça logout e login novamente para renovar sua sessão.",
      showRetry: false,
    };
  }

  // Configuration errors
  if (errorMessage.includes("Configure sua chave") || errorMessage.includes("Chave Browserless não está") ||
      errorMessage.includes("não está ativa")) {
    return {
      code: "PROSP_008",
      title: "Configuração Necessária",
      message: "A chave Browserless ainda não foi configurada ou não está ativa.",
      tip: "Acesse a aba Configurações para adicionar sua chave Browserless.",
      showConfig: true,
      showRetry: false,
    };
  }

  // Navigation/Network errors
  if (errorMessage.includes("networkidle") || errorMessage.includes("Navigation timeout") || 
      errorMessage.includes("timeout")) {
    return {
      code: "PROSP_009",
      title: "Erro de Navegação",
      message: "O Google Maps demorou muito para carregar ou a conexão foi interrompida.",
      waitTime: "30 segundos",
      tip: "Verifique sua conexão com a internet e tente novamente.",
      showRetry: true,
    };
  }

  // Edge function errors
  if (errorMessage.includes("FunctionsHttpError") || errorMessage.includes("FunctionsRelayError")) {
    return {
      code: "PROSP_010",
      title: "Erro de Comunicação",
      message: "Houve um problema de comunicação com o servidor de extração.",
      tip: "Verifique sua conexão com a internet e tente novamente.",
      showRetry: true,
    };
  }

  // ============================================
  // Novos Erros de Infraestrutura
  // ============================================
  
  // Edge Function não disponível (404)
  if (errorMessage.includes("Failed to send a request to the Edge Function") || 
      errorMessage.includes("NOT_FOUND") ||
      errorMessage.includes("Requested function was not found")) {
    return {
      code: "PROSP_100",
      title: "Serviço Temporariamente Indisponível",
      message: "O serviço de busca está em manutenção ou atualização. Isso geralmente se resolve automaticamente.",
      waitTime: "2-3 minutos",
      tip: "Recarregue a página e tente novamente. Se persistir, aguarde alguns minutos.",
      showRetry: true,
    };
  }

  // Erro de conexão/rede
  if (errorMessage.includes("Failed to fetch") || 
      errorMessage.includes("fetch failed") ||
      errorMessage.includes("NetworkError") ||
      errorMessage.includes("network")) {
    return {
      code: "PROSP_101",
      title: "Erro de Conexão",
      message: "Não foi possível conectar ao serviço de busca. Isso pode ser um problema de rede.",
      tip: "Verifique sua conexão com a internet e tente novamente.",
      showRetry: true,
    };
  }

  // Erro de descriptografia
  if (errorMessage.includes("DECRYPTION_FAILED") || 
      errorMessage.includes("Cannot decrypt") ||
      errorMessage.includes("Erro ao validar chave API")) {
    return {
      code: "PROSP_102",
      title: "Erro de Autenticação da Chave",
      message: "A chave API armazenada não pôde ser validada. Isso pode acontecer após atualizações de segurança.",
      tip: "Acesse a aba Configurações, remova a chave atual e adicione novamente.",
      showConfig: true,
      showRetry: false,
    };
  }

  // Google Cloud Billing disabled
  if (errorMessage.includes("BILLING_DISABLED") || errorMessage.includes("billing to be enabled")) {
    return {
      code: "PROSP_011",
      title: "Faturamento Não Habilitado",
      message: "O Google Cloud requer faturamento ativo para usar a Places API. O Google oferece $200/mês de crédito gratuito.",
      tip: "Clique no botão abaixo para acessar o console do Google Cloud e ativar o faturamento no seu projeto.",
      actionUrl: "https://console.cloud.google.com/billing",
      actionLabel: "Ativar Faturamento",
      showConfig: false,
      showRetry: true,
    };
  }

  // Google Cloud API not enabled
  if (errorMessage.includes("API_NOT_ENABLED") || errorMessage.includes("This API is not activated") ||
      errorMessage.includes("This API is not enabled")) {
    return {
      code: "PROSP_012",
      title: "API Não Habilitada",
      message: "Uma ou mais APIs necessárias não estão ativadas no seu projeto Google Cloud.",
      tip: "Você precisa ativar a 'Places API (New)' e a 'Geocoding API' no console do Google Cloud.",
      actionUrl: "https://console.cloud.google.com/apis/library",
      actionLabel: "Ativar APIs",
      showConfig: false,
      showRetry: true,
    };
  }

  // Google Geocoding API específica
  if (errorMessage.includes("Geocoding API") || errorMessage.includes("geocoding") ||
      errorMessage.includes("Geocoding request denied")) {
    return {
      code: "PROSP_014",
      title: "Geocoding API Não Habilitada",
      message: "Para usar a busca por localização, você precisa habilitar a Geocoding API no Google Cloud Console.",
      tip: "Acesse o Google Cloud Console e habilite a 'Geocoding API' no seu projeto.",
      actionUrl: "https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com",
      actionLabel: "Habilitar Geocoding API",
      showConfig: false,
      showRetry: true,
    };
  }

  // Generic Google API forbidden (403 without specific reason)
  if (errorMessage.includes("GOOGLE_API_FORBIDDEN") || 
      (errorMessage.includes("403") && !errorMessage.includes("BILLING") && !errorMessage.includes("API_NOT"))) {
    return {
      code: "PROSP_013",
      title: "Acesso Negado pela API",
      message: "A API Google Places recusou a requisição. Isso pode ser um problema de configuração ou permissões.",
      tip: "Verifique se sua chave API tem as permissões corretas e se as APIs necessárias estão habilitadas.",
      actionUrl: "https://console.cloud.google.com/apis/credentials",
      actionLabel: "Ver Credenciais",
      showConfig: true,
      showRetry: true,
    };
  }

  // Default unknown error
  return {
    code: "UNKNOWN",
    title: "Erro na Busca",
    message: errorMessage,
    tip: "Se o problema persistir, entre em contato com o suporte.",
    showRetry: true,
  };
}

// Função para verificar se deve mostrar botão "Marcar como Falhou"
export function shouldShowMarkAsFailed(
  status: string,
  effectiveStatus: string,
  errorMessage: string | null | undefined
): boolean {
  // Só mostrar se está em timeout
  if (effectiveStatus !== "timeout") return false;
  
  // Se tem mensagem de erro, verificar se é conhecida
  if (errorMessage) {
    const translated = translateError(errorMessage);
    // Não mostrar botão para erros conhecidos
    if (translated.isKnown) return false;
  }
  
  // Mostrar para timeouts sem erro conhecido
  return true;
}
