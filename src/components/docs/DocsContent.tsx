import { 
  Sparkles, 
  MessageSquare, 
  Kanban, 
  UserSearch, 
  Plug, 
  GitBranch, 
  Route, 
  FileText,
  Settings, 
  HelpCircle,
  Smartphone,
  Bot,
  Users,
  Zap,
  Send,
  Tag,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Server,
  ShieldCheck,
  PhoneForwarded,
  Phone,
  MapPin,
  SortAsc,
  Instagram,
  RefreshCw,
  Workflow,
  BookOpen,
  CreditCard,
  MousePointerClick,
  Forward,
  Wand2,
} from "lucide-react";
import { DocSection } from "./DocSection";
import { DocCard } from "./DocCard";
import { DocCallout } from "./DocCallout";

export function DocsContent() {
  return (
    <div className="space-y-2">
      {/* ==================== INTRODUÇÃO ==================== */}
      <DocSection
        id="intro"
        title="Introdução"
        icon={Sparkles}
        description="Bem-vindo ao Uz4Flow — veja o que você pode fazer"
        defaultOpen
      >
        <div className="prose prose-sm prose-invert max-w-none">
          <p className="text-muted-foreground leading-relaxed">
            O <strong className="text-foreground">Uz4Flow</strong> é a sua plataforma completa para 
            atender, vender e se relacionar com clientes pelo WhatsApp e Instagram — tudo em um só lugar. 
            Com ele, você conecta suas plataformas de vendas (como Kiwify, Hotmart e Eduzz), envia mensagens 
            automáticas, acompanha seu funil de vendas e ainda conta com inteligência artificial para te ajudar.
          </p>
        </div>

        <DocCard
          title="O que você pode fazer com o Uz4Flow"
          icon={Zap}
          description="Veja as principais funcionalidades disponíveis"
        >
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Atender pelo WhatsApp</strong> — Converse com seus clientes em uma interface profissional, parecida com o WhatsApp Web</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Automatizar mensagens</strong> — Envie mensagens automáticas quando uma venda for realizada</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Acompanhar vendas no funil</strong> — Veja em que etapa cada cliente está (Pipeline)</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Fazer ligações com IA</strong> — Crie campanhas de ligação automática com voz artificial</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Prospectar clientes</strong> — Encontre empresas e contatos em fontes públicas como o Google Maps</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Automatizar o Instagram</strong> — Responda DMs, comentários e menções automaticamente</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Distribuir leads na equipe</strong> — Divida contatos automaticamente entre seus atendentes</span>
            </li>
          </ul>
        </DocCard>

        <DocCard
          title="Para quem é esta ferramenta?"
          icon={Users}
          description="Ideal para quem vende pela internet e quer automatizar o atendimento"
        >
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Infoprodutores</strong> que vendem cursos e desejam automatizar o pós-venda</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Agências</strong> que gerenciam múltiplos clientes e precisam centralizar o atendimento</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Times de vendas</strong> que precisam acompanhar leads em um funil visual</span>
            </li>
          </ul>
        </DocCard>

        <DocCard
          title="Como começar"
          icon={CheckCircle2}
          steps={[
            "Acesse 'Configurações' no menu lateral e vá na aba 'WhatsApp AI'",
            "Preencha suas credenciais de conexão com o Sistema de WhatsApp AI",
            "Vá até o CRM e adicione sua primeira instância (conexão com um número de WhatsApp)",
            "Configure um conector para receber avisos automáticos de vendas (ex: Kiwify)",
            "Crie um fluxo de mensagens automáticas e vincule ao conector via regra de roteamento"
          ]}
        />

        <DocCard
          title="Glossário Rápido"
          icon={BookOpen}
          description="Termos usados nesta documentação explicados de forma simples"
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[120px] shrink-0">Instância</span>
              <span>É a conexão entre o Uz4Flow e um número de WhatsApp. Cada número precisa de uma instância.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[120px] shrink-0">Webhook</span>
              <span>É um endereço (URL) que recebe avisos automáticos. Por exemplo, quando uma venda acontece, a plataforma envia um aviso para esse endereço.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[120px] shrink-0">API Key</span>
              <span>É uma senha especial que permite que dois sistemas se comuniquem de forma segura. Você obtém no painel do serviço.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[120px] shrink-0">Pipeline / Funil</span>
              <span>São as etapas que um cliente percorre até fechar a compra (ex: Novo Lead → Qualificação → Proposta → Fechado).</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[120px] shrink-0">Fluxo</span>
              <span>Sequência de mensagens automáticas que são enviadas quando algo acontece (ex: nova venda).</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[120px] shrink-0">Conector</span>
              <span>Ponte entre uma plataforma de vendas (Kiwify, Hotmart, etc.) e o Uz4Flow.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[120px] shrink-0">Rotação de leads</span>
              <span>Distribuição automática de novos contatos entre os membros da sua equipe.</span>
            </div>
          </div>
        </DocCard>

        <DocCallout type="tip">
          Comece configurando o WhatsApp AI em Configurações antes de criar automações. 
          Isso garante que as mensagens enviadas pelos fluxos apareçam corretamente nas conversas do CRM.
        </DocCallout>

        <DocCard
          title="Checklist de onboarding"
          icon={CheckCircle2}
          description="Os 5 passos do guia que aparece no Dashboard quando você entra pela primeira vez"
        >
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li><strong className="text-foreground">Conectar WhatsApp</strong> — vincule um número via QR Code ou API Oficial.</li>
            <li><strong className="text-foreground">Configurar funil Kanban</strong> — personalize os estágios do seu pipeline.</li>
            <li><strong className="text-foreground">Criar primeiro fluxo</strong> — automação inicial de qualificação.</li>
            <li><strong className="text-foreground">Convidar equipe</strong> (opcional) — atendentes e rotação de leads.</li>
            <li><strong className="text-foreground">Importar contatos</strong> (opcional) — base inicial via planilha.</li>
          </ol>
          <p className="text-xs text-muted-foreground mt-3">
            O checklist se atualiza sozinho conforme você avança. Você pode dispensá-lo a qualquer momento pelo X no canto direito.
          </p>
        </DocCard>
      </DocSection>

      {/* ==================== EQUIPE & FILA ==================== */}
      <DocSection
        id="equipe"
        title="Equipe & Fila de Atendimento"
        icon={Users}
        description="Convites, permissões, rotação de leads e fila"
      >
        <DocCard
          title="Convidando atendentes"
          icon={Users}
          steps={[
            "Acesse Configurações → Equipe",
            "Clique em 'Adicionar Membro'",
            "Informe nome, email e telefone do atendente",
            "Defina as permissões (perfis pré-definidos ou customizadas)",
            "O atendente recebe um email com a senha temporária para o primeiro acesso"
          ]}
        />
        <DocCard
          title="Rotação automática de leads"
          icon={RefreshCw}
          description="Distribuição justa entre atendentes"
        >
          <p className="text-sm text-muted-foreground">
            Configure rotação <strong className="text-foreground">sequencial</strong> (round-robin) ou <strong className="text-foreground">aleatória</strong> em Equipe → Rotação. Filtros por palavra-chave e por pipeline limitam quando a rotação se aplica.
          </p>
        </DocCard>
        <DocCard
          title="Fila de Atendimento"
          icon={Clock}
          description="Visão centralizada de quem está atendendo o quê"
        >
          <p className="text-sm text-muted-foreground">
            A página <strong className="text-foreground">Fila</strong> mostra cada atendente, suas conversas ativas e tempo médio de resposta. Útil para gestão de SLA e redistribuição manual de carga.
          </p>
        </DocCard>
      </DocSection>

      {/* ==================== AVALIAÇÃO POR IA ==================== */}
      <DocSection
        id="ai-evaluation"
        title="Avaliação Automática por IA"
        icon={Sparkles}
        description="Análise contínua de conversas com extração de dados"
      >
        <DocCard
          title="Como funciona"
          icon={Bot}
        >
          <p className="text-sm text-muted-foreground">
            Um cron job analisa conversas que tiveram interação inbound nas últimas 4 horas, gera um resumo, classifica sentimento e nível de interesse, e (opcionalmente) envia o resultado para um webhook externo. Configure em <strong className="text-foreground">Configurações → Avaliação por IA</strong>.
          </p>
        </DocCard>
        <DocCard
          title="Frequências disponíveis"
          icon={Clock}
        >
          <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-5">
            <li><strong className="text-foreground">silence_only</strong> — só avalia após silêncio configurado</li>
            <li><strong className="text-foreground">once_per_conversation</strong> — uma única vez por conversa</li>
            <li><strong className="text-foreground">once_per_day</strong> — no máximo uma avaliação por dia/conversa</li>
            <li><strong className="text-foreground">every_inbound</strong> — a cada nova mensagem do contato</li>
          </ul>
        </DocCard>
      </DocSection>

      {/* ==================== AFILIADOS ==================== */}
      <DocSection
        id="afiliados"
        title="Programa de Afiliados"
        icon={Sparkles}
        description="Indique e ganhe comissão recorrente"
      >
        <DocCard
          title="Como participar"
          icon={CheckCircle2}
          steps={[
            "Acesse a página Afiliados no menu lateral",
            "Aceite os termos e cadastre seus dados bancários (PIX)",
            "Aguarde aprovação do admin (geralmente em até 24h)",
            "Compartilhe seu link único de indicação",
            "Ganhe comissão sobre cada pagamento recorrente do indicado"
          ]}
        />
        <DocCard
          title="Comissão e Payout"
          icon={CreditCard}
        >
          <p className="text-sm text-muted-foreground">
            A comissão padrão é <strong className="text-foreground">20%</strong> sobre o valor pago, com <strong className="text-foreground">8 dias de carência</strong> (proteção contra estornos). Após esse período, o saldo fica disponível para saque via PIX (mínimo configurável).
          </p>
        </DocCard>
      </DocSection>

      {/* ==================== CRM WHATSAPP ==================== */}
      <DocSection
        id="crm"
        title="CRM WhatsApp"
        icon={MessageSquare}
        description="Gerencie conversas e contatos do WhatsApp em um só lugar"
      >
        <div className="prose prose-sm prose-invert max-w-none">
          <p className="text-muted-foreground leading-relaxed">
            O CRM é onde você visualiza e responde todas as conversas do WhatsApp. 
            A interface é parecida com o WhatsApp Web, mas com recursos extras: tags, notas, 
            análise por inteligência artificial, encaminhamento de mensagens e muito mais.
          </p>
        </div>

        <DocCard
          title="Conectar uma instância (número de WhatsApp)"
          icon={Smartphone}
          description="Vincule seu WhatsApp ao sistema"
          steps={[
            "Acesse a página CRM pelo menu lateral",
            "Clique no botão '+' no canto superior direito",
            "Informe um nome para identificar a conta (ex: 'WhatsApp Principal')",
            "Insira o ID da instância e a API Key (obtidos no painel do Sistema de WhatsApp AI)",
            "Clique em 'Criar Instância'"
          ]}
        />

        <DocCallout type="info">
          O Sistema de WhatsApp AI é o serviço responsável pela conexão direta com o WhatsApp. 
          O Uz4Flow se conecta a ele para enviar e receber mensagens. Você configura as credenciais 
          em <strong>Configurações → aba WhatsApp AI</strong>.
        </DocCallout>

        <DocCard
          title="Interface de 3 painéis"
          icon={MessageSquare}
          description="Navegue facilmente entre contatos, chat e detalhes"
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">1</div>
              <div>
                <strong className="text-foreground">Painel de Contatos (esquerda)</strong>
                <p className="text-xs mt-0.5">Lista todas as conversas. Use a barra de busca para encontrar contatos por nome ou telefone. Filtre por tags, instância ou status.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">2</div>
              <div>
                <strong className="text-foreground">Painel de Chat (centro)</strong>
                <p className="text-xs mt-0.5">Visualize e responda mensagens. Suporta texto, áudio, imagens e documentos. A IA sugere respostas automaticamente enquanto você digita.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">3</div>
              <div>
                <strong className="text-foreground">Painel Inspetor (direita)</strong>
                <p className="text-xs mt-0.5">Veja detalhes do contato, adicione tags, notas, arquivos anexos e peça uma análise de IA da conversa.</p>
              </div>
            </div>
          </div>
        </DocCard>

        <DocCard
          title="Iniciar uma nova conversa"
          icon={Send}
          description="Envie a primeira mensagem para um contato"
          steps={[
            "No CRM, clique no ícone de nova conversa (✏️) no topo da lista de contatos",
            "Informe o número de telefone do contato (com código do país, ex: 5511999998888)",
            "Opcionalmente, preencha o nome do contato",
            "Selecione a instância (número de WhatsApp) que deseja usar para enviar",
            "Escreva a mensagem e envie"
          ]}
        />

        <DocCard
          title="Encaminhamento e seleção em lote"
          icon={Forward}
          description="Trabalhe com várias mensagens ou conversas de uma vez"
        >
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Encaminhar mensagens:</strong> Clique com o botão direito em uma mensagem (ou pressione e segure no celular) e selecione "Encaminhar" para enviar a mensagem para outro contato.</p>
            <p><strong className="text-foreground">Seleção em lote de conversas:</strong> Marque várias conversas na lista de contatos para realizar ações em lote, como arquivar ou excluir múltiplas conversas de uma vez.</p>
          </div>
        </DocCard>

        <DocCard
          title="Sugestões de texto com IA"
          icon={Wand2}
          description="A IA sugere respostas enquanto você digita"
        >
          <p className="text-sm text-muted-foreground">
            Enquanto você escreve uma mensagem no chat, a IA analisa o contexto da conversa e 
            sugere opções de resposta acima do campo de texto. Clique em uma sugestão para usá-la 
            como base da sua resposta. Isso agiliza o atendimento e mantém a qualidade das respostas.
          </p>
        </DocCard>

        <DocCard
          title="Tipos de mensagem"
          icon={Send}
        >
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
              <div className="h-2 w-2 rounded-full bg-zinc-400"></div>
              <span className="text-muted-foreground"><strong className="text-foreground">Cliente:</strong> Mensagens enviadas pelo contato</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
              <div className="h-2 w-2 rounded-full bg-purple-400"></div>
              <span className="text-muted-foreground"><strong className="text-foreground">IA / Automação:</strong> Mensagens enviadas automaticamente por fluxos</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
              <div className="h-2 w-2 rounded-full bg-blue-400"></div>
              <span className="text-muted-foreground"><strong className="text-foreground">Atendente:</strong> Mensagens enviadas manualmente pelo CRM</span>
            </div>
          </div>
        </DocCard>

        <DocCard
          title="Análise de IA"
          icon={Sparkles}
          description="Use inteligência artificial para entender suas conversas"
        >
          <p className="text-sm text-muted-foreground">
            No painel Inspetor (à direita), clique em "Analisar Conversa" para obter:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>• <strong className="text-foreground">Resumo:</strong> Síntese do que foi conversado</li>
            <li>• <strong className="text-foreground">Sentimento:</strong> Positivo, neutro ou negativo</li>
            <li>• <strong className="text-foreground">Nível de interesse:</strong> Alto, médio ou baixo</li>
            <li>• <strong className="text-foreground">Sugestão de resposta:</strong> Próxima mensagem recomendada</li>
            <li>• <strong className="text-foreground">Próxima ação:</strong> O que fazer a seguir com esse contato</li>
          </ul>
        </DocCard>

        <DocCard
          title="Tags e Notas"
          icon={Tag}
          description="Organize seus contatos de forma eficiente"
        >
          <p className="text-sm text-muted-foreground">
            No painel Inspetor você pode adicionar <strong className="text-foreground">tags coloridas</strong> para categorizar contatos 
            (ex: "Lead Quente", "Cliente VIP") e <strong className="text-foreground">notas internas</strong> para registrar informações importantes 
            que só sua equipe pode ver.
          </p>
        </DocCard>

        <DocCard
          title="Equipe e Rotação de Leads"
          icon={RefreshCw}
          description="Distribua contatos automaticamente entre seus atendentes"
        >
          <p className="text-sm text-muted-foreground">
            Acesse <strong className="text-foreground">CRM → Equipe</strong> no menu lateral para gerenciar sua equipe:
          </p>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Perfis:</strong> Crie perfis de equipe para organizar os papéis (ex: "Vendas", "Suporte").</p>
            <p><strong className="text-foreground">Membros:</strong> Adicione membros da equipe e vincule-os a perfis.</p>
            <p><strong className="text-foreground">Rotação de Leads (distribuição automática):</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Sequencial:</strong> Distribui na ordem (João → Maria → José → João...)</li>
              <li><strong className="text-foreground">Aleatório:</strong> Distribui de forma randômica entre membros ativos</li>
              <li><strong className="text-foreground">Filtro por palavra-chave:</strong> A rotação só acontece quando a mensagem contém a palavra definida</li>
              <li><strong className="text-foreground">Pipeline associado:</strong> Vincule a rotação a um funil específico</li>
            </ul>
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Tag do responsável:</strong> Na lista de conversas do CRM, cada contato exibe uma tag colorida 
            com o nome do atendente responsável. Você pode alterar o responsável manualmente pelo painel Inspetor.</p>
          </div>
        </DocCard>
      </DocSection>

      {/* ==================== PIPELINE ==================== */}
      <DocSection
        id="pipeline"
         title="Funil Kanban"
         icon={Kanban}
         description="Acompanhe seus leads em um funil visual de vendas"
      >
        <div className="prose prose-sm prose-invert max-w-none">
          <p className="text-muted-foreground leading-relaxed">
            O Funil Kanban é um quadro visual onde você vê todos os seus contatos 
            organizados por etapa de venda. Arraste e solte os cards entre as colunas para 
            atualizar em que fase cada cliente está.
          </p>
        </div>

        <DocCard
          title="O que é um funil de vendas?"
          icon={ArrowRightLeft}
        >
          <p className="text-sm text-muted-foreground">
            Um funil de vendas representa as etapas que um contato percorre até se tornar cliente. 
            Exemplo típico:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Novo Lead", "Qualificação", "Proposta", "Negociação", "Fechado"].map((stage, i) => (
              <div key={stage} className="flex items-center gap-1">
                <span className="px-2 py-1 rounded text-xs bg-muted text-foreground">{stage}</span>
                {i < 4 && <span className="text-muted-foreground">→</span>}
              </div>
            ))}
          </div>
        </DocCard>

        <DocCard
          title="Como usar o Funil Kanban"
          icon={Kanban}
          steps={[
            "Acesse 'Funil Kanban' no menu lateral (dentro do grupo CRM)",
            "Os contatos do CRM aparecem automaticamente como cards",
            "Arraste um card para outra coluna para mudar a etapa",
            "Clique em um card para abrir detalhes ou ir ao CRM"
          ]}
        />

        <DocCard
          title="Criar e editar funis personalizados"
          icon={Settings}
          description="Personalize as etapas do seu funil de vendas"
          steps={[
             "Na página do Funil Kanban, clique no seletor de funil no topo da tela",
             "Clique em 'Editar Funil' ou 'Novo Funil'",
             "Defina o nome do funil e adicione as etapas desejadas",
             "Personalize as cores de cada etapa para facilitar a visualização",
            "Salve e o novo funil estará disponível imediatamente"
          ]}
        />

        <DocCard
          title="Dashboard do Funil"
          icon={Zap}
          description="Veja métricas e o gráfico de funil"
        >
          <p className="text-sm text-muted-foreground">
            No topo da página do Funil Kanban, clique em <strong className="text-foreground">"Dashboard"</strong> para ver um resumo visual com:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>• <strong className="text-foreground">Métricas por etapa:</strong> Quantidade de contatos em cada fase</li>
            <li>• <strong className="text-foreground">Gráfico de funil:</strong> Visualização da conversão entre etapas</li>
            <li>• <strong className="text-foreground">Tempo médio:</strong> Quanto tempo os contatos ficam em cada etapa</li>
          </ul>
        </DocCard>

        <DocCallout type="tip">
          A configuração das etapas é feita diretamente na página do Funil Kanban — não precisa ir em Configurações. 
          Personalize cores e nomes para refletir seu processo de vendas.
        </DocCallout>

        <DocCard
          title="Integração CRM ↔ Funil Kanban"
          icon={ArrowRightLeft}
        >
          <p className="text-sm text-muted-foreground">
             O CRM e o Funil Kanban compartilham os mesmos contatos. Quando você move um card no Funil, 
             a etapa é atualizada automaticamente no CRM. Da mesma forma, ao mudar a etapa de um 
             contato no CRM, o card se move no Funil.
          </p>
        </DocCard>

        <DocCard
          title="Automação do Funil"
          icon={Workflow}
          description="Mova contatos entre etapas automaticamente por palavras-chave"
        >
          <p className="text-sm text-muted-foreground">
            Configure regras automáticas para mover contatos entre etapas com base em 
            palavras-chave encontradas nas mensagens. Exemplo: se o contato enviar "quero comprar",
            ele é movido automaticamente para a etapa "Negociação".
          </p>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Como configurar:</strong></p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Acesse o Funil Kanban no menu lateral</li>
              <li>Clique no botão <strong>"Automações"</strong> no cabeçalho</li>
              <li>Defina a palavra-chave que ativa a regra</li>
              <li>Selecione a etapa de destino</li>
              <li>Ative a regra</li>
            </ol>
          </div>
        </DocCard>
      </DocSection>

      {/* ==================== FOLLOW-UP ==================== */}
      <DocSection
        id="followup"
        title="Follow-up"
        icon={PhoneForwarded}
        description="Campanhas de ligação automática com IA integradas ao CRM"
      >
        <div className="prose prose-sm prose-invert max-w-none">
          <p className="text-muted-foreground leading-relaxed">
            O módulo de Follow-up permite criar campanhas de ligação automática com inteligência artificial,
            conectadas ao CRM. Ideal para retomar contato com leads, confirmar presença ou informar promoções.
          </p>
        </div>

        <DocCallout type="info">
          O Follow-up está dentro da página <strong>"Voice AI"</strong> no menu lateral, na aba <strong>"Follow-up"</strong>. 
          Nessa mesma página você também encontra as abas "Campanhas" (ligações avulsas) e "Configurações" (credenciais VAPI).
        </DocCallout>

        <DocCard
          title="Modos de ligação"
          icon={Phone}
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <div className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-medium shrink-0">Informativo</div>
              <p>A IA liga para informar algo ao contato (ex: promoção, lembrete). Não aguarda resposta específica.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-xs font-medium shrink-0">Ação</div>
              <p>A IA liga com um objetivo e aguarda resposta do contato (ex: confirmar presença, aceitar proposta).</p>
            </div>
          </div>
        </DocCard>

        <DocCard
          title="Templates de Follow-up"
          icon={FileText}
          description="Salve configurações prontas para reutilizar"
        >
          <p className="text-sm text-muted-foreground">
            Crie templates com script de ligação, motivo da chamada, mensagem WhatsApp pós-ligação e
            fluxo vinculado. Reutilize em novas campanhas sem precisar reconfigurar tudo do zero.
          </p>
        </DocCard>

        <DocCard
          title="Ajuste com IA"
          icon={Sparkles}
          description="Melhore o script da ligação automaticamente"
        >
          <p className="text-sm text-muted-foreground">
            Use o botão "Ajustar com IA" para refinar o script da ligação. A inteligência artificial 
            reescreve o texto tornando-o mais natural, persuasivo e adequado ao modo escolhido.
          </p>
        </DocCard>

        <DocCard
          title="Criar uma campanha de Follow-up"
          icon={PhoneForwarded}
          steps={[
            "Acesse 'Voice AI' no menu lateral e vá na aba 'Follow-up'",
            "Clique em 'Nova Campanha'",
            "Escolha o modo (Informativo ou Ação)",
            "Selecione contatos do CRM ou importe uma lista",
            "Configure o script da ligação (ou use um template salvo)",
            "Opcionalmente, ative o envio de mensagem WhatsApp após a ligação",
            "Defina o agendamento (imediato ou programado)",
            "Inicie a campanha"
          ]}
        />

        <DocCard
          title="Mensagem WhatsApp pós-ligação"
          icon={Send}
        >
          <p className="text-sm text-muted-foreground">
            Após cada ligação realizada com sucesso, o sistema pode enviar automaticamente uma mensagem
            via WhatsApp para o contato. Configure o texto e, opcionalmente, vincule um fluxo de automação 
            para continuar o atendimento.
          </p>
        </DocCard>

        <DocCallout type="warning">
          O Follow-up requer a configuração do serviço de voz (VAPI). Acesse <strong>Voice AI → aba Configurações</strong> 
          e preencha a chave de API e o número de telefone antes de criar campanhas.
        </DocCallout>
      </DocSection>

      {/* ==================== PROSPECÇÃO ==================== */}
      <DocSection
        id="prospection"
        title="Prospecção"
        icon={UserSearch}
        description="Encontre novos leads e adicione ao seu CRM"
      >
        <div className="prose prose-sm prose-invert max-w-none">
          <p className="text-muted-foreground leading-relaxed">
            A ferramenta de Prospecção permite buscar empresas e contatos em fontes públicas 
            como o Google Maps. Encontre potenciais clientes, veja os dados disponíveis 
            e exporte-os diretamente para o CRM com um clique.
          </p>
        </div>

        <DocCard
          title="Buscar empresas no Google Maps"
          icon={ExternalLink}
          description="Encontre negócios locais por palavra-chave e região"
          steps={[
            "Acesse 'Prospecção' no menu lateral",
            "Insira o termo de busca (ex: 'restaurantes', 'clínicas odontológicas')",
            "Use o campo de localização para informar País, Estado, Cidade, Bairro ou CEP",
            "Ajuste o número máximo de resultados desejado",
            "Clique em 'Buscar' e aguarde os resultados",
            "Ordene os resultados clicando nos cabeçalhos das colunas",
            "Selecione os contatos desejados e clique em 'Exportar para CRM'"
          ]}
        />

        <DocCard
          title="Localização detalhada"
          icon={MapPin}
          description="Refine sua busca com localização mais específica"
        >
          <p className="text-sm text-muted-foreground">
            O campo de localização permite informar País, Estado, Cidade, Bairro e CEP.
            Quanto mais específico, mais precisos serão os resultados. Por exemplo: 
            buscar "restaurantes" em "São Paulo, Jardins" traz resultados muito mais relevantes 
            do que buscar apenas "restaurantes" no Brasil.
          </p>
        </DocCard>

        <DocCard
          title="Recursos da tabela de resultados"
          icon={SortAsc}
        >
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Ordenação:</strong> Clique no cabeçalho de qualquer coluna para ordenar os resultados</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Formatação de telefone:</strong> Os telefones são automaticamente formatados no padrão brasileiro</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Quantidade de resultados:</strong> Você pode ajustar quantos resultados deseja buscar antes de iniciar</span>
            </li>
          </ul>
        </DocCard>

        <DocCallout type="info">
          Os dados de prospecção vêm de fontes públicas. Sempre respeite as leis de proteção de dados 
          e as políticas de privacidade ao entrar em contato com os leads encontrados.
        </DocCallout>
      </DocSection>

      {/* ==================== LIGAÇÕES IA ==================== */}
      <DocSection
        id="voice-campaigns"
        title="Ligações IA"
        icon={Phone}
        description="Campanhas de ligação por voz avulsas com inteligência artificial"
      >
        <div className="prose prose-sm prose-invert max-w-none">
          <p className="text-muted-foreground leading-relaxed">
            O módulo Ligações IA permite criar campanhas de voz avulsas (sem vínculo com o Follow-up do CRM).
            Ideal para testes rápidos ou campanhas independentes com voz artificial.
          </p>
        </div>

        <DocCallout type="info">
          Este módulo está dentro da página <strong>"Voice AI"</strong> no menu lateral, na aba <strong>"Campanhas"</strong>. 
          Na mesma página, a aba <strong>"Configurações"</strong> permite configurar as credenciais do serviço de voz (VAPI): 
          chave de API, número de telefone e ID de voz.
        </DocCallout>

        <DocCard
          title="Como usar"
          icon={Phone}
          steps={[
            "Acesse 'Voice AI' no menu lateral e vá na aba 'Campanhas'",
            "Configure o script da ligação e os números de destino",
            "Inicie a campanha e acompanhe em tempo real",
            "Veja os resultados: ligações atendidas, não atendidas e erros"
          ]}
        />

        <DocCallout type="warning">
          Antes de criar campanhas, configure o serviço de voz na aba <strong>"Configurações"</strong> da página Voice AI. 
          Você precisará da chave de API do VAPI e de um número de telefone válido.
        </DocCallout>
      </DocSection>

      {/* ==================== AUTOMAÇÃO - CONECTORES ==================== */}
      <DocSection
        id="connectors"
        title="Conectores"
        icon={Plug}
        description="Receba avisos automáticos de plataformas de vendas"
      >
        <div className="prose prose-sm prose-invert max-w-none">
          <p className="text-muted-foreground leading-relaxed">
            Conectores são a ponte entre suas plataformas de vendas (Kiwify, Hotmart, 
            Eduzz, etc.) e o Uz4Flow. Quando uma venda acontece, a plataforma envia um aviso 
            automático (webhook) para o conector, que dispara as ações configuradas.
          </p>
        </div>

        <DocCard
          title="Como funciona?"
          icon={Zap}
        >
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><span className="text-primary font-medium">1.</span> Você cria um conector para uma plataforma (ex: Kiwify)</li>
            <li className="flex gap-2"><span className="text-primary font-medium">2.</span> O sistema gera um endereço exclusivo (URL de webhook)</li>
            <li className="flex gap-2"><span className="text-primary font-medium">3.</span> Você copia esse endereço e cola na plataforma de vendas</li>
            <li className="flex gap-2"><span className="text-primary font-medium">4.</span> Quando uma venda acontece, a plataforma envia os dados automaticamente</li>
            <li className="flex gap-2"><span className="text-primary font-medium">5.</span> O Uz4Flow recebe, processa e executa o fluxo de mensagens vinculado</li>
          </ol>
        </DocCard>

        <DocCard
          title="Criar um conector (exemplo: Kiwify)"
          icon={Plug}
          steps={[
            "Acesse 'Automação → Conectores' no menu lateral",
            "Clique em 'Novo Conector'",
            "Selecione 'Kiwify' como plataforma",
            "Dê um nome descritivo (ex: 'Vendas Curso X')",
            "Copie o endereço (URL de webhook) gerado",
            "No painel da Kiwify, vá em Webhooks e cole o endereço",
            "Teste enviando um webhook de teste para confirmar que está funcionando"
          ]}
        />

        <DocCallout type="warning">
          Sempre teste o conector após configurar para garantir que a integração funciona. 
          Você pode acompanhar os avisos recebidos em <strong>Configurações → aba WhatsApp AI → Logs de Eventos</strong>.
        </DocCallout>
      </DocSection>

      {/* ==================== AUTOMAÇÃO - FLUXOS ==================== */}
      <DocSection
        id="flows"
        title="Fluxos"
        icon={GitBranch}
        description="Sequências de mensagens automáticas"
      >
        <div className="prose prose-sm prose-invert max-w-none">
          <p className="text-muted-foreground leading-relaxed">
            Fluxos são sequências de ações executadas automaticamente quando algo acontece 
            (como uma venda ou uma mensagem recebida). Você pode enviar mensagens, aguardar respostas, 
            fazer perguntas interativas e muito mais.
          </p>
        </div>

        <DocCard
          title="Editor Visual de Fluxos"
          icon={GitBranch}
        >
          <p className="text-sm text-muted-foreground">
            O editor visual permite criar fluxos adicionando e organizando blocos de ação:
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="p-2 rounded bg-muted/50 border border-border text-sm">
              <strong className="text-foreground">📝 Mensagem</strong>
              <p className="text-xs text-muted-foreground mt-0.5">Envia uma mensagem de texto ao contato</p>
            </div>
            <div className="p-2 rounded bg-muted/50 border border-border text-sm">
              <strong className="text-foreground">⏱️ Delay</strong>
              <p className="text-xs text-muted-foreground mt-0.5">Aguarda um tempo antes da próxima ação</p>
            </div>
            <div className="p-2 rounded bg-muted/50 border border-border text-sm">
              <strong className="text-foreground">❓ Pergunta</strong>
              <p className="text-xs text-muted-foreground mt-0.5">Aguarda resposta do contato antes de continuar</p>
            </div>
            <div className="p-2 rounded bg-muted/50 border border-border text-sm">
              <strong className="text-foreground">🔀 Condição</strong>
              <p className="text-xs text-muted-foreground mt-0.5">Direciona o fluxo com base em regras</p>
            </div>
          </div>
        </DocCard>

        <DocCard
          title="Criar um fluxo de boas-vindas"
          icon={Send}
          steps={[
            "Acesse 'Automação → Fluxos' no menu lateral",
            "Clique em 'Novo Fluxo'",
            "Dê um nome (ex: 'Boas-vindas Curso X')",
            "Adicione um bloco 'Mensagem' com a mensagem de boas-vindas",
            "Adicione um bloco 'Delay' de 30 segundos",
            "Adicione outra mensagem com instruções de acesso",
            "Salve o fluxo"
          ]}
        />

        <DocCallout type="tip">
          Use variáveis como <code className="bg-muted px-1 rounded text-xs">{"{{nome}}"}</code> e{" "}
          <code className="bg-muted px-1 rounded text-xs">{"{{email}}"}</code> para personalizar 
          mensagens. Os dados são preenchidos automaticamente com as informações do cliente.
        </DocCallout>
      </DocSection>

      {/* ==================== AUTOMAÇÃO - REGRAS ==================== */}
      <DocSection
        id="rules"
        title="Regras de Roteamento"
        icon={Route}
        description="Conecte conectores a fluxos com condições"
      >
        <div className="prose prose-sm prose-invert max-w-none">
          <p className="text-muted-foreground leading-relaxed">
            Regras de roteamento definem <strong className="text-foreground">qual fluxo será executado</strong> quando um aviso 
            (evento) chegar em um conector. Você pode criar múltiplas regras com condições diferentes 
            para direcionar cada situação ao fluxo correto.
          </p>
        </div>

        <DocCard
          title="Exemplo de regra"
          icon={Route}
        >
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-xs font-medium">SE</div>
              <p className="text-muted-foreground">Um aviso chegar do conector "Vendas Curso X"</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="px-2 py-1 rounded bg-amber-500/20 text-amber-400 text-xs font-medium">E</div>
              <p className="text-muted-foreground">O status da compra for "aprovada"</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-medium">ENTÃO</div>
              <p className="text-muted-foreground">Executar o fluxo "Boas-vindas Curso X"</p>
            </div>
          </div>
        </DocCard>

        <DocCard
          title="Criar uma regra"
          icon={Route}
          steps={[
            "Acesse 'Automação → Regras' no menu lateral",
            "Clique em 'Nova Regra'",
            "Selecione o conector de origem (de onde vem o aviso)",
            "Defina condições, se necessário (ex: status = aprovada)",
            "Selecione o fluxo que será executado",
            "Ative a regra"
          ]}
        />
      </DocSection>

      {/* ==================== AUTOMAÇÃO - TEMPLATES ==================== */}
      <DocSection
        id="templates"
        title="Templates de Mensagem"
        icon={FileText}
        description="Modelos de mensagem reutilizáveis com variáveis"
      >
        <div className="prose prose-sm prose-invert max-w-none">
          <p className="text-muted-foreground leading-relaxed">
            Templates são modelos de mensagem prontos que você pode reutilizar em diferentes fluxos. 
            Eles aceitam variáveis que são substituídas automaticamente pelos dados reais do cliente.
          </p>
        </div>

        <DocCard
          title="Variáveis disponíveis"
          icon={Tag}
        >
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <code className="p-2 rounded bg-muted text-foreground text-xs">{"{{nome}}"}</code>
            <code className="p-2 rounded bg-muted text-foreground text-xs">{"{{email}}"}</code>
            <code className="p-2 rounded bg-muted text-foreground text-xs">{"{{telefone}}"}</code>
            <code className="p-2 rounded bg-muted text-foreground text-xs">{"{{produto}}"}</code>
            <code className="p-2 rounded bg-muted text-foreground text-xs">{"{{valor}}"}</code>
            <code className="p-2 rounded bg-muted text-foreground text-xs">{"{{data_compra}}"}</code>
          </div>
        </DocCard>

        <DocCard
          title="Exemplo de template"
          icon={FileText}
        >
          <div className="p-3 rounded bg-muted/50 border border-border">
            <p className="text-sm text-foreground">
              Olá <code className="bg-muted px-1 rounded text-xs text-accent">{"{{nome}}"}</code>! 🎉
            </p>
            <p className="text-sm text-foreground mt-2">
              Obrigado por adquirir o <code className="bg-muted px-1 rounded text-xs text-accent">{"{{produto}}"}</code>!
            </p>
            <p className="text-sm text-foreground mt-2">
              Seu acesso foi liberado. Em breve você receberá um email em{" "}
              <code className="bg-muted px-1 rounded text-xs text-accent">{"{{email}}"}</code> com as instruções.
            </p>
          </div>
        </DocCard>
      </DocSection>

      {/* ==================== SERVIDORES MCP ==================== */}
      <DocSection
        id="mcp-servers"
        title="Servidores MCP"
        icon={Server}
        description="Permita que o chatbot do WhatsApp use ferramentas externas"
      >
        <div className="prose prose-sm prose-invert max-w-none">
          <p className="text-muted-foreground leading-relaxed">
            O Hub MCP permite que o chatbot do WhatsApp use <strong className="text-foreground">ferramentas externas</strong> para 
            buscar informações ou realizar ações durante uma conversa. Por exemplo: consultar o estoque, 
            buscar dados em um CRM externo, ou verificar o status de um pedido — tudo de forma automática.
          </p>
        </div>

        <DocCallout type="warning">
          O Hub MCP é <strong>unidirecional e seguro</strong>: o seu sistema busca informações em servidores externos, 
          mas esses servidores <strong>nunca</strong> têm acesso aos seus dados (contatos, conversas, pipeline, etc.).
        </DocCallout>

        <DocCard
          title="Como funciona?"
          icon={Server}
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">1</div>
              <div>
                <strong className="text-foreground">O contato envia uma mensagem pelo WhatsApp</strong>
                <p className="text-xs mt-0.5">A mensagem chega ao Sistema de WhatsApp AI.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">2</div>
              <div>
                <strong className="text-foreground">O chatbot identifica que precisa de uma ferramenta externa</strong>
                <p className="text-xs mt-0.5">O Sistema de WhatsApp AI envia a solicitação ao Hub MCP.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">3</div>
              <div>
                <strong className="text-foreground">O Hub MCP consulta o servidor externo</strong>
                <p className="text-xs mt-0.5">Conecta ao servidor configurado, executa a ferramenta e obtém o resultado.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">4</div>
              <div>
                <strong className="text-foreground">A resposta é enviada ao contato</strong>
                <p className="text-xs mt-0.5">O resultado é devolvido ao chatbot, que formula a resposta e envia ao contato pelo WhatsApp.</p>
              </div>
            </div>
          </div>
        </DocCard>

        <DocCard
          title="Segurança"
          icon={ShieldCheck}
          description="Seus dados estão protegidos"
        >
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Seus dados ficam protegidos:</strong> Nenhum dado interno (contatos, conversas, pipeline) é compartilhado com servidores externos.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Conexão segura:</strong> Suporte a chave de acesso (API Key) e cabeçalhos personalizados para servidores que exigem autenticação.</span>
            </li>
          </ul>
        </DocCard>

        <DocCard
          title="Cadastrar um servidor MCP"
          icon={Server}
          steps={[
            "Acesse 'Servidores MCP' no menu lateral",
            "Clique em 'Adicionar Servidor MCP'",
            "Informe o nome, o endereço do servidor e o nome da ferramenta",
            "Configure a autenticação se necessário (chave de acesso ou cabeçalhos)",
            "Use 'Testar Conexão' para validar antes de salvar",
            "Ative o servidor para que o chatbot possa utilizá-lo"
          ]}
        />

        <DocCallout type="info">
          Use apenas servidores que você confia e verificou. Servidores não confiáveis podem retornar 
          informações incorretas nas respostas do chatbot.
        </DocCallout>
      </DocSection>

      {/* ==================== INSTAGRAM ==================== */}
      <DocSection
        id="instagram"
        title="Instagram"
        icon={Instagram}
        description="Automatize respostas e gerencie interações no Instagram"
      >
        <div className="prose prose-sm prose-invert max-w-none">
          <p className="text-muted-foreground leading-relaxed">
            O módulo Instagram permite conectar contas profissionais do Instagram e criar automações
            para responder mensagens (DMs), comentários e menções automaticamente usando a API oficial da Meta.
          </p>
        </div>

        <DocCard
          title="Requisitos do App Meta"
          icon={Settings}
          description="Configuração obrigatória no painel Meta for Developers"
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Antes de conectar contas, o aplicativo Meta precisa estar configurado corretamente:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-foreground">Tipo do app:</strong> Business</li>
              <li><strong className="text-foreground">Produto adicionado:</strong> "Login do Facebook para empresas" (não o Login do Facebook padrão)</li>
              <li><strong className="text-foreground">Informações básicas obrigatórias:</strong> Nome do app, logotipo (1024×1024), URL de Política de Privacidade, URL de Termos de Serviço, e-mail de contato e categoria</li>
              <li><strong className="text-foreground">Escopos configurados:</strong> <code className="bg-muted px-1 rounded text-xs">instagram_business_basic</code>, <code className="bg-muted px-1 rounded text-xs">instagram_business_manage_messages</code>, <code className="bg-muted px-1 rounded text-xs">instagram_business_manage_comments</code></li>
              <li><strong className="text-foreground">URI de redirecionamento:</strong> Adicionada em "Login do Facebook para empresas → Configurações"</li>
              <li><strong className="text-foreground">Publicação:</strong> O app precisa estar <strong className="text-foreground">publicado</strong> no painel Meta para funcionar</li>
            </ul>
          </div>
        </DocCard>

        <DocCard
          title="Conectar uma conta Instagram"
          icon={Instagram}
          steps={[
            "Acesse 'Instagram' no menu lateral",
            "Na aba 'Contas', clique em '+ Conectar Instagram'",
            "Você será redirecionado para a tela de autorização do Instagram",
            "Autorize o acesso à conta profissional",
            "A conta aparecerá na lista com status ativo e a data de expiração do token (60 dias)",
            "Quando o token estiver próximo de expirar, use o botão 'Renovar' para estender por mais 60 dias"
          ]}
        />

        <DocCallout type="info">
          Sua conta Instagram precisa ser uma conta profissional (Business ou Creator). 
          Não é necessário ter uma página do Facebook vinculada.
        </DocCallout>

        <DocCard
          title="Automações"
          icon={Bot}
          description="Respostas automáticas a DMs, comentários e menções"
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Crie automações com diferentes gatilhos:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="p-2 rounded bg-muted/50 border border-border">
                <strong className="text-foreground">💬 DM Recebida</strong>
                <p className="text-xs mt-0.5">Responda automaticamente a mensagens diretas</p>
              </div>
              <div className="p-2 rounded bg-muted/50 border border-border">
                <strong className="text-foreground">💬 Comentário</strong>
                <p className="text-xs mt-0.5">Responda a comentários em posts</p>
              </div>
              <div className="p-2 rounded bg-muted/50 border border-border">
                <strong className="text-foreground">📢 Menção</strong>
                <p className="text-xs mt-0.5">Reaja quando alguém mencionar sua conta</p>
              </div>
              <div className="p-2 rounded bg-muted/50 border border-border">
                <strong className="text-foreground">🔗 Story Reply</strong>
                <p className="text-xs mt-0.5">Responda a respostas nos seus stories</p>
              </div>
            </div>
          </div>
        </DocCard>

        <DocCard
          title="Templates de Instagram"
          icon={FileText}
          description="Mensagens reutilizáveis para automações"
        >
          <p className="text-sm text-muted-foreground">
            Crie templates de resposta por categoria para reutilizar em diferentes automações.
            Organize por tipo (boas-vindas, suporte, vendas) para manter suas respostas consistentes.
          </p>
        </DocCard>

        <DocCard
          title="Logs de Eventos"
          icon={Clock}
          description="Monitore todas as interações processadas"
        >
          <p className="text-sm text-muted-foreground">
            Na aba 'Logs', acompanhe em tempo real todos os eventos recebidos do Instagram,
            com status de processamento, erros e detalhes de cada automação executada.
          </p>
        </DocCard>
      </DocSection>

      {/* ==================== CONFIGURAÇÕES ==================== */}
      <DocSection
        id="settings"
        title="Configurações"
        icon={Settings}
        description="Configure integrações, credenciais e gerencie sua assinatura"
      >
        <div className="prose prose-sm prose-invert max-w-none">
          <p className="text-muted-foreground leading-relaxed">
            A página de Configurações possui duas abas principais: <strong className="text-foreground">WhatsApp AI</strong> (para configurar 
            a integração com o Sistema de WhatsApp AI) e <strong className="text-foreground">Assinatura</strong> (para gerenciar seu plano).
          </p>
        </div>

        <DocCard
          title="Aba WhatsApp AI — Configuração da integração"
          icon={Bot}
          description="Tudo que você precisa para conectar o WhatsApp ao sistema"
        >
          <p className="text-sm text-muted-foreground mb-3">
            A aba WhatsApp AI está dividida em 3 seções:
          </p>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">1</div>
              <div>
                <strong className="text-foreground">Motor de Automação (Flows)</strong>
                <p className="text-xs mt-0.5">Configuração das credenciais para o motor de fluxos automáticos. Aqui você insere a API Key e a URL do Sistema de WhatsApp AI para que os fluxos possam enviar mensagens.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">2</div>
              <div>
                <strong className="text-foreground">CRM & WhatsApp</strong>
                <p className="text-xs mt-0.5">Configuração das credenciais para o CRM, campanhas de follow-up e automações Instagram. Aqui você preenche a API Key e a URL de envio de mensagens do CRM.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">3</div>
              <div>
                <strong className="text-foreground">Logs de Eventos</strong>
                <p className="text-xs mt-0.5">Painel que mostra em tempo real todos os avisos recebidos e mensagens enviadas, com status de sucesso ou erro. Útil para diagnosticar problemas.</p>
              </div>
            </div>
          </div>
        </DocCard>

        <DocCard
          title="Configurar a integração WhatsApp AI"
          icon={Bot}
          steps={[
            "Acesse 'Configurações' no menu lateral",
            "Vá até a aba 'WhatsApp AI'",
            "Na seção 'Motor de Automação', insira sua API Key e URL do Sistema de WhatsApp AI",
            "Na seção 'CRM & WhatsApp', insira a API Key e URL de envio do CRM",
            "Configure a URL de webhook (endereço de recebimento de mensagens) no painel do Sistema de WhatsApp AI",
            "Clique em 'Salvar' em cada seção"
          ]}
        />

        <DocCallout type="warning">
          As chaves de acesso (API Keys) são armazenadas de forma segura e criptografada. 
          Nunca compartilhe suas chaves com terceiros.
        </DocCallout>

        <DocCard
          title="Aba Assinatura"
          icon={CreditCard}
          description="Gerencie seu plano e pagamentos"
        >
          <p className="text-sm text-muted-foreground">
            Na aba <strong className="text-foreground">Assinatura</strong>, você pode:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>• Visualizar seu plano atual e os limites de uso</li>
            <li>• Fazer upgrade ou downgrade de plano</li>
            <li>• Verificar o status do pagamento</li>
            <li>• Aplicar cupons de desconto</li>
          </ul>
        </DocCard>
      </DocSection>

      {/* ==================== FAQ ==================== */}
      <DocSection
        id="faq"
        title="FAQ"
        icon={HelpCircle}
        description="Perguntas frequentes e solução de problemas"
      >
        <DocCard title="Por que minhas mensagens não estão chegando no CRM?">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Verifique os seguintes pontos:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>A API Key do Sistema de WhatsApp AI está configurada corretamente em <strong className="text-foreground">Configurações → aba WhatsApp AI</strong>?</li>
              <li>O endereço de recebimento (webhook) está configurado no painel do Sistema de WhatsApp AI?</li>
              <li>A instância (conexão com o número de WhatsApp) está ativa?</li>
              <li>Confira os <strong className="text-foreground">Logs de Eventos</strong> na aba WhatsApp AI das Configurações para ver se há erros</li>
            </ul>
          </div>
        </DocCard>

        <DocCard title="Como testar se a integração está funcionando?">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Envie uma mensagem de teste para o número do WhatsApp conectado e verifique:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>A mensagem aparece no CRM?</li>
              <li>O evento foi registrado nos Logs de Eventos?</li>
              <li>Você consegue responder pelo CRM?</li>
            </ul>
          </div>
        </DocCard>

        <DocCard title="O que significa cada status de evento nos logs?">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400">success</span>
              <span className="text-muted-foreground">Evento processado com sucesso</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">error</span>
              <span className="text-muted-foreground">Erro ao processar o evento — clique para ver detalhes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs bg-zinc-500/20 text-zinc-400">ignored</span>
              <span className="text-muted-foreground">Evento ignorado (duplicado ou mensagem de saída)</span>
            </div>
          </div>
        </DocCard>

        <DocCard title="Como resolver erro de webhook?">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Passos para diagnóstico:</strong></p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Acesse <strong className="text-foreground">Configurações → aba WhatsApp AI → Logs de Eventos</strong></li>
              <li>Clique no evento com erro para ver detalhes</li>
              <li>Verifique a mensagem de erro para entender o problema</li>
              <li>Corrija a configuração conforme indicado</li>
              <li>Teste novamente</li>
            </ol>
          </div>
        </DocCard>

        <DocCard title="Como alterar meu plano ou assinatura?">
          <div className="space-y-2 text-sm text-muted-foreground">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Acesse <strong className="text-foreground">Configurações</strong> no menu lateral</li>
              <li>Clique na aba <strong className="text-foreground">Assinatura</strong></li>
              <li>Veja seu plano atual e clique em "Alterar plano" ou "Fazer upgrade"</li>
              <li>Escolha o novo plano desejado e confirme</li>
            </ol>
          </div>
        </DocCard>

        <DocCard title="Como adicionar membros à minha equipe?">
          <div className="space-y-2 text-sm text-muted-foreground">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Acesse <strong className="text-foreground">CRM → Equipe</strong> no menu lateral</li>
              <li>Na aba <strong className="text-foreground">Membros</strong>, clique em "Adicionar Membro"</li>
              <li>Preencha o nome, email e selecione o perfil de acesso</li>
              <li>O novo membro receberá um convite por email</li>
            </ol>
          </div>
        </DocCard>

        <DocCard title="Como configurar a rotação automática de leads?">
          <div className="space-y-2 text-sm text-muted-foreground">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Acesse <strong className="text-foreground">CRM → Equipe</strong> no menu lateral</li>
              <li>Na aba <strong className="text-foreground">Rotação</strong>, ative a distribuição automática</li>
              <li>Escolha o modo: Sequencial (por ordem) ou Aleatório</li>
              <li>Opcionalmente, defina uma palavra-chave de filtro</li>
              <li>Vincule a um pipeline específico se desejar</li>
            </ol>
          </div>
        </DocCard>

        <DocCard title="O que fazer quando o token do Instagram expirar?">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>O token do Instagram tem validade de <strong className="text-foreground">60 dias</strong>. Quando estiver próximo de expirar:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Acesse <strong className="text-foreground">Instagram</strong> no menu lateral</li>
              <li>Na aba <strong className="text-foreground">Contas</strong>, verifique a data de expiração</li>
              <li>Clique no botão <strong className="text-foreground">"Renovar"</strong> para estender por mais 60 dias</li>
              <li>Se o token já expirou, clique em <strong className="text-foreground">"Reconectar"</strong> para autorizar novamente</li>
            </ol>
          </div>
        </DocCard>

        <DocCard title="Problemas ao conectar o Instagram">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Problemas comuns e soluções:</strong></p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-foreground">Conta não é profissional:</strong> A conta Instagram precisa ser do tipo Business ou Creator. Converta nas configurações do Instagram antes de conectar.</li>
              <li><strong className="text-foreground">Erro de autorização:</strong> Tente desconectar a conta e conectar novamente. Certifique-se de autorizar todos os acessos solicitados na tela de login.</li>
              <li><strong className="text-foreground">App Meta não publicado:</strong> O aplicativo precisa estar publicado no painel Meta for Developers para funcionar com contas externas.</li>
            </ul>
          </div>
        </DocCard>

        <DocCallout type="info">
          Se você continua enfrentando problemas, verifique se sua assinatura está ativa 
          e se você não excedeu os limites do seu plano em <strong>Configurações → Assinatura</strong>.
        </DocCallout>
      </DocSection>
    </div>
  );
}
