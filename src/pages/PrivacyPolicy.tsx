import { Link } from "react-router-dom";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const LAST_UPDATED = "5 de março de 2026";

const sections = [
  { id: "controlador", label: "1. Controlador" },
  { id: "dados-coletados", label: "2. Dados Coletados" },
  { id: "bases-legais", label: "3. Bases Legais" },
  { id: "uso-dados", label: "4. Uso dos Dados" },
  { id: "meta-platform", label: "5. Dados da Plataforma Meta" },
  { id: "google-apis", label: "6. Google APIs" },
  { id: "compartilhamento", label: "7. Compartilhamento" },
  { id: "armazenamento", label: "8. Armazenamento e Segurança" },
  { id: "retencao", label: "9. Retenção e Exclusão" },
  { id: "direitos", label: "10. Direitos do Titular" },
  { id: "cookies", label: "11. Cookies" },
  { id: "menores", label: "12. Menores de Idade" },
  { id: "transferencia", label: "13. Transferência Internacional" },
  { id: "alteracoes", label: "14. Alterações" },
  { id: "contato", label: "15. Contato" },
];

export default function PrivacyPolicy() {
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px" }
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader appName="Uz4Flow" />

      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Back link */}
          <Button variant="ghost" size="sm" asChild className="mb-6">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao início
            </Link>
          </Button>

          {/* Title */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Política de Privacidade</h1>
          </div>
          <p className="text-muted-foreground text-sm mb-10">
            Última atualização: {LAST_UPDATED}
          </p>

          <div className="flex gap-10">
            {/* Desktop TOC */}
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-24">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Índice</p>
                <ScrollArea className="max-h-[calc(100svh-10rem)]">
                  <nav className="space-y-1 pr-4">
                    {sections.map(({ id, label }) => (
                      <a
                        key={id}
                        href={`#${id}`}
                        className={`block text-xs py-1.5 px-2 rounded transition-colors ${
                          activeSection === id
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                      >
                        {label}
                      </a>
                    ))}
                  </nav>
                </ScrollArea>
              </div>
            </aside>

            {/* Content */}
            <article className="flex-1 max-w-3xl prose prose-sm dark:prose-invert prose-headings:scroll-mt-24 prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground">
              
              <section id="controlador">
                <h2>1. Identificação do Controlador</h2>
                <p>
                  Esta Política de Privacidade descreve como a <strong>Open Bot AI</strong>, pessoa jurídica inscrita no CNPJ/MF sob o nº <strong>63.185.666/0001-81</strong>, 
                  doravante denominada "Controladora", "nós" ou "Uz4Flow", coleta, utiliza, armazena, compartilha e protege os dados pessoais 
                  dos usuários que acessam e utilizam a plataforma Uz4Flow e seus serviços associados.
                </p>
                <p>
                  A Uz4Flow é uma plataforma de automação de comunicação empresarial que integra WhatsApp Business API, Instagram, 
                  ferramentas de CRM, prospecção de clientes, Voice AI e fluxos automatizados de mensagens.
                </p>
              </section>

              <section id="dados-coletados">
                <h2>2. Dados Pessoais Coletados</h2>
                <p>Coletamos as seguintes categorias de dados pessoais:</p>
                
                <h3>2.1 Dados Cadastrais</h3>
                <ul>
                  <li>Nome completo</li>
                  <li>Endereço de e-mail</li>
                  <li>Senha (armazenada de forma criptografada)</li>
                  <li>Dados da organização (nome da empresa, CNPJ/CPF)</li>
                </ul>

                <h3>2.2 Dados de Uso da Plataforma</h3>
                <ul>
                  <li>Logs de acesso e navegação</li>
                  <li>Configurações de fluxos, regras e automações criadas pelo usuário</li>
                  <li>Histórico de eventos e ações na plataforma</li>
                  <li>Dados de uso de funcionalidades (CRM, Kanban, prospecção, etc.)</li>
                </ul>

                <h3>2.3 Dados de Comunicação via WhatsApp</h3>
                <ul>
                  <li>Mensagens enviadas e recebidas através da integração WhatsApp Business API</li>
                  <li>Números de telefone dos contatos</li>
                  <li>Nome do perfil (push name) dos contatos</li>
                  <li>Mídias trocadas (imagens, áudios, documentos)</li>
                  <li>Metadados de mensagens (timestamps, status de entrega)</li>
                </ul>

                <h3>2.4 Dados do Instagram</h3>
                <ul>
                  <li>Dados do perfil da conta Instagram conectada (username, foto de perfil)</li>
                  <li>Mensagens diretas recebidas via Instagram Messaging API</li>
                  <li>Comentários em publicações</li>
                  <li>Dados de leads gerados a partir de interações no Instagram</li>
                  <li>IDs de usuário do Instagram (scoped user IDs)</li>
                </ul>

                <h3>2.5 Dados de Prospecção</h3>
                <ul>
                  <li>Resultados de buscas realizadas via Google Places API (nomes de empresas, endereços, telefones, avaliações)</li>
                  <li>Dados de prospecção visual (informações coletadas de páginas públicas de negócios)</li>
                </ul>

                <h3>2.6 Dados de Pagamento</h3>
                <ul>
                  <li>Informações de assinatura e plano contratado</li>
                  <li>Histórico de transações (processadas pelo MercadoPago — não armazenamos dados de cartão)</li>
                </ul>

                <h3>2.7 Dados de Voz</h3>
                <ul>
                  <li>Gravações de chamadas de voz (quando utilizada a funcionalidade Voice AI via VAPI)</li>
                  <li>Transcrições de áudio</li>
                </ul>
              </section>

              <section id="bases-legais">
                <h2>3. Bases Legais para o Tratamento (LGPD Art. 7º)</h2>
                <p>O tratamento dos seus dados pessoais é fundamentado nas seguintes bases legais da Lei Geral de Proteção de Dados (Lei nº 13.709/2018):</p>
                <ul>
                  <li><strong>Execução de contrato</strong> (Art. 7º, V): Para a prestação dos serviços contratados, incluindo automação de mensagens, CRM e prospecção.</li>
                  <li><strong>Consentimento</strong> (Art. 7º, I): Para coleta de dados opcionais, envio de comunicações de marketing e integrações com serviços de terceiros (Instagram, Google Calendar).</li>
                  <li><strong>Legítimo interesse</strong> (Art. 7º, IX): Para melhoria dos serviços, análises de uso, prevenção de fraudes e segurança da plataforma.</li>
                  <li><strong>Cumprimento de obrigação legal</strong> (Art. 7º, II): Para atender obrigações fiscais, contábeis e regulatórias.</li>
                </ul>
              </section>

              <section id="uso-dados">
                <h2>4. Finalidade do Uso dos Dados</h2>
                <p>Utilizamos os dados pessoais coletados para:</p>
                <ul>
                  <li>Prover e manter a plataforma Uz4Flow e seus serviços</li>
                  <li>Processar e entregar mensagens via WhatsApp Business API e Instagram Messaging API</li>
                  <li>Gerenciar contatos, conversas e pipeline de vendas (CRM)</li>
                  <li>Executar fluxos automatizados de mensagens e regras de roteamento</li>
                  <li>Realizar prospecção de clientes via Google Places API</li>
                  <li>Agendar eventos no Google Calendar quando autorizado pelo usuário</li>
                  <li>Processar chamadas de voz e transcrições via Voice AI</li>
                  <li>Gerar análises e insights de conversas com auxílio de inteligência artificial</li>
                  <li>Processar pagamentos e gerenciar assinaturas</li>
                  <li>Enviar notificações operacionais sobre o serviço</li>
                  <li>Melhorar a experiência do usuário e o desempenho da plataforma</li>
                  <li>Prevenir fraudes, abusos e garantir a segurança</li>
                </ul>
              </section>

              <section id="meta-platform">
                <h2>5. Dados Obtidos via Plataforma Meta</h2>
                <p>
                  A Uz4Flow utiliza a <strong>WhatsApp Business API</strong> e a <strong>Meta Graph API (Instagram)</strong> para fornecer 
                  funcionalidades de automação de comunicação. Esta seção detalha como tratamos os dados obtidos através dessas APIs, 
                  em conformidade com os <strong>Termos da Plataforma Meta</strong> e a <strong>Política de Dados da Meta</strong>.
                </p>

                <h3>5.1 WhatsApp Business API</h3>
                <ul>
                  <li>Mensagens e mídias trocadas são processadas exclusivamente para fornecer o serviço de CRM e automação contratado pelo usuário</li>
                  <li>Os dados não são vendidos, alugados ou compartilhados com terceiros para fins de marketing</li>
                  <li>Templates de mensagens são utilizados em conformidade com as Políticas de Uso do WhatsApp Business</li>
                  <li>Respeitamos a janela de atendimento de 24 horas da API do WhatsApp</li>
                </ul>

                <h3>5.2 Instagram Graph API / Messaging API</h3>
                <ul>
                  <li>Dados do Instagram são acessados apenas com autorização explícita do usuário via OAuth 2.0</li>
                  <li>Utilizamos as permissões: <code>instagram_basic</code>, <code>instagram_manage_messages</code>, <code>pages_show_list</code>, <code>pages_messaging</code></li>
                  <li>Mensagens e dados de perfil do Instagram são utilizados exclusivamente para responder a interações e executar automações configuradas pelo usuário</li>
                  <li>Não publicamos conteúdo, não coletamos dados de seguidores em massa e não utilizamos dados para scraping</li>
                  <li>Os tokens de acesso são armazenados de forma criptografada e podem ser revogados pelo usuário a qualquer momento</li>
                </ul>

                <h3>5.3 Comprometimento com as Políticas da Meta</h3>
                <ul>
                  <li>Não compartilhamos dados obtidos via APIs da Meta com data brokers ou serviços de publicidade</li>
                  <li>Não utilizamos dados da Meta para criar perfis de publicidade independentes</li>
                  <li>Removemos os dados da Meta quando solicitado pelo usuário ou quando o acesso é revogado</li>
                  <li>Mantemos logs de auditoria de todas as operações realizadas com dados da Meta</li>
                </ul>
              </section>

              <section id="google-apis">
                <h2>6. Uso de Google APIs</h2>
                <p>A Uz4Flow integra-se com os seguintes serviços do Google:</p>

                <h3>6.1 Google Places API</h3>
                <ul>
                  <li>Utilizada para buscar informações públicas de empresas (nome, endereço, telefone, avaliações)</li>
                  <li>Os dados são usados exclusivamente para a funcionalidade de prospecção de clientes</li>
                  <li>Não armazenamos dados do Google Places além do necessário para exibir resultados ao usuário</li>
                </ul>

                <h3>6.2 Google Calendar API</h3>
                <ul>
                  <li>Utilizada para criar eventos de agendamento quando o usuário autoriza via OAuth 2.0</li>
                  <li>Acessamos apenas os escopos necessários para criação de eventos</li>
                  <li>Tokens de acesso são armazenados de forma criptografada e podem ser revogados a qualquer momento</li>
                </ul>

                <h3>6.3 Conformidade com Google API Services User Data Policy</h3>
                <p>
                  O uso de dados do Google pela Uz4Flow está em conformidade com a 
                  <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
                    Google API Services User Data Policy
                  </a>, incluindo os requisitos de Limited Use. Não transferimos dados do Google para terceiros, 
                  exceto conforme necessário para fornecer o serviço, e não utilizamos dados do Google para veicular anúncios.
                </p>
              </section>

              <section id="compartilhamento">
                <h2>7. Compartilhamento de Dados com Terceiros</h2>
                <p>Compartilhamos dados pessoais apenas com:</p>
                <ul>
                  <li><strong>Provedores de infraestrutura</strong>: Serviços de hospedagem e banco de dados para armazenamento seguro dos dados</li>
                  <li><strong>Meta Platforms, Inc.</strong>: Para processamento de mensagens via WhatsApp Business API e Instagram Messaging API</li>
                  <li><strong>Google LLC</strong>: Para integração com Google Places API e Google Calendar API</li>
                  <li><strong>MercadoPago</strong>: Para processamento de pagamentos de assinaturas</li>
                  <li><strong>Provedores de IA</strong>: Para funcionalidades de inteligência artificial (análise de conversas, sugestões, transcrições), os dados são processados de acordo com as políticas de privacidade desses provedores</li>
                  <li><strong>VAPI</strong>: Para processamento de chamadas de voz (Voice AI)</li>
                </ul>
                <p>
                  <strong>Não vendemos, alugamos ou comercializamos dados pessoais com terceiros.</strong> O compartilhamento 
                  é feito exclusivamente para a operação dos serviços contratados.
                </p>
              </section>

              <section id="armazenamento">
                <h2>8. Armazenamento e Segurança dos Dados</h2>
                <p>Adotamos medidas técnicas e organizacionais para proteger seus dados:</p>
                <ul>
                  <li>Dados armazenados em infraestrutura com criptografia em repouso e em trânsito (TLS/SSL)</li>
                  <li>Chaves de API e tokens de acesso armazenados com criptografia AES-256</li>
                  <li>Controle de acesso baseado em papéis (RBAC) com Row Level Security (RLS)</li>
                  <li>Autenticação segura com hashing de senhas (bcrypt)</li>
                  <li>Políticas de segurança em nível de linha para isolamento de dados entre organizações</li>
                  <li>Monitoramento de logs de acesso e auditoria</li>
                  <li>Backups automatizados regulares</li>
                </ul>
              </section>

              <section id="retencao">
                <h2>9. Retenção e Exclusão de Dados</h2>
                <ul>
                  <li><strong>Dados da conta</strong>: Mantidos enquanto a conta estiver ativa. Após exclusão da conta, os dados são removidos em até 30 dias.</li>
                  <li><strong>Mensagens e mídias</strong>: Mantidos conforme a política de retenção configurada pelo usuário. Funcionalidades de limpeza automática de armazenamento estão disponíveis.</li>
                  <li><strong>Logs de eventos</strong>: Retidos por até 90 dias para fins de auditoria e diagnóstico.</li>
                  <li><strong>Dados de pagamento</strong>: Retidos conforme obrigações fiscais e contábeis (mínimo de 5 anos).</li>
                  <li><strong>Dados de prospecção</strong>: Mantidos apenas enquanto o usuário os mantiver em sua conta.</li>
                </ul>
                <p>
                  O usuário pode solicitar a exclusão de seus dados a qualquer momento, conforme descrito na seção "Direitos do Titular".
                  A funcionalidade de exclusão de conta está disponível diretamente na plataforma.
                </p>
              </section>

              <section id="direitos">
                <h2>10. Direitos do Titular dos Dados</h2>
                <p>Em conformidade com a LGPD, você tem os seguintes direitos:</p>
                <ul>
                  <li><strong>Confirmação e acesso</strong>: Confirmar a existência de tratamento e acessar seus dados pessoais</li>
                  <li><strong>Correção</strong>: Solicitar a correção de dados incompletos, inexatos ou desatualizados</li>
                  <li><strong>Anonimização, bloqueio ou eliminação</strong>: Solicitar o tratamento adequado de dados desnecessários ou excessivos</li>
                  <li><strong>Portabilidade</strong>: Solicitar a portabilidade dos dados a outro fornecedor de serviço</li>
                  <li><strong>Eliminação</strong>: Solicitar a eliminação dos dados tratados com base em consentimento</li>
                  <li><strong>Informação sobre compartilhamento</strong>: Ser informado sobre com quem seus dados são compartilhados</li>
                  <li><strong>Revogação do consentimento</strong>: Revogar o consentimento a qualquer momento, sem afetar a legalidade do tratamento anterior</li>
                  <li><strong>Oposição</strong>: Opor-se ao tratamento realizado com fundamento em uma das hipóteses de dispensa de consentimento</li>
                </ul>
                <p>
                  Para exercer seus direitos, entre em contato conosco pelo e-mail <a href="mailto:suporte@openbotai.com.br">suporte@openbotai.com.br</a>. 
                  Responderemos no prazo de 15 dias, conforme exigido pela legislação.
                </p>
              </section>

              <section id="cookies">
                <h2>11. Cookies e Tecnologias de Rastreamento</h2>
                <p>A Uz4Flow utiliza:</p>
                <ul>
                  <li><strong>Cookies essenciais</strong>: Necessários para autenticação, manutenção de sessão e segurança</li>
                  <li><strong>Armazenamento local (localStorage)</strong>: Para preferências de interface e configurações do usuário</li>
                  <li><strong>Tokens de sessão</strong>: Para manter o usuário autenticado de forma segura</li>
                </ul>
                <p>
                  Não utilizamos cookies de publicidade ou rastreamento de terceiros. As tecnologias utilizadas são estritamente 
                  necessárias para o funcionamento da plataforma.
                </p>
              </section>

              <section id="menores">
                <h2>12. Menores de Idade</h2>
                <p>
                  A Uz4Flow é destinada exclusivamente a usuários maiores de 18 anos. Não coletamos intencionalmente 
                  dados pessoais de menores de 18 anos. Caso tome conhecimento de que um menor está utilizando nossos serviços, 
                  entre em contato conosco para que possamos tomar as providências necessárias para a exclusão dos dados.
                </p>
              </section>

              <section id="transferencia">
                <h2>13. Transferência Internacional de Dados</h2>
                <p>
                  Alguns dos nossos provedores de serviço estão localizados fora do Brasil, incluindo serviços de infraestrutura, 
                  APIs da Meta e do Google, e provedores de inteligência artificial. A transferência internacional de dados é realizada 
                  em conformidade com o Art. 33 da LGPD, garantindo nível adequado de proteção ou mediante cláusulas contratuais padrão.
                </p>
              </section>

              <section id="alteracoes">
                <h2>14. Alterações nesta Política</h2>
                <p>
                  Reservamo-nos o direito de atualizar esta Política de Privacidade a qualquer momento. Notificaremos sobre mudanças 
                  significativas por e-mail ou através de aviso na plataforma. A continuidade do uso dos serviços após a publicação 
                  de alterações constitui aceitação da política revisada.
                </p>
              </section>

              <section id="contato">
                <h2>15. Contato — Encarregado de Proteção de Dados (DPO)</h2>
                <p>
                  Para questões relacionadas à privacidade e proteção de dados, entre em contato com nosso Encarregado de Proteção de Dados:
                </p>
                <ul>
                  <li><strong>Empresa</strong>: Open Bot AI</li>
                  <li><strong>CNPJ</strong>: 63.185.666/0001-81</li>
                  <li><strong>E-mail</strong>: <a href="mailto:suporte@openbotai.com.br">suporte@openbotai.com.br</a></li>
                </ul>
                <p>
                  Se considerar que o tratamento dos seus dados pessoais viola a legislação de proteção de dados, 
                  você tem o direito de apresentar uma reclamação à <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong>.
                </p>
              </section>
            </article>
          </div>
        </div>
      </div>

      <LandingFooter appName="Uz4Flow" supportEmail="suporte@openbotai.com.br" />
    </div>
  );
}
