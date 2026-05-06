import { Link } from "react-router-dom";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const LAST_UPDATED = "5 de março de 2026";

const sections = [
  { id: "aceitacao", label: "1. Aceitação dos Termos" },
  { id: "descricao", label: "2. Descrição do Serviço" },
  { id: "elegibilidade", label: "3. Elegibilidade" },
  { id: "conta", label: "4. Conta do Usuário" },
  { id: "uso-aceitavel", label: "5. Uso Aceitável" },
  { id: "whatsapp-meta", label: "6. Conformidade Meta/WhatsApp" },
  { id: "planos", label: "7. Planos e Pagamentos" },
  { id: "propriedade", label: "8. Propriedade Intelectual" },
  { id: "dados", label: "9. Dados e Privacidade" },
  { id: "limitacao", label: "10. Limitação de Responsabilidade" },
  { id: "disponibilidade", label: "11. Disponibilidade (SLA)" },
  { id: "rescisao", label: "12. Rescisão" },
  { id: "modificacoes", label: "13. Modificações dos Termos" },
  { id: "lei-aplicavel", label: "14. Lei Aplicável e Foro" },
  { id: "contato-termos", label: "15. Contato" },
];

export default function TermsOfService() {
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
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Termos de Serviço</h1>
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
              
              <section id="aceitacao">
                <h2>1. Aceitação dos Termos</h2>
                <p>
                  Ao acessar ou utilizar a plataforma Uz4Flow, operada pela <strong>Open Bot AI</strong> (CNPJ 63.185.666/0001-81), 
                  você declara que leu, compreendeu e concorda em estar vinculado a estes Termos de Serviço ("Termos"). 
                  Se você não concorda com qualquer parte destes Termos, não utilize nossos serviços.
                </p>
                <p>
                  Ao criar uma conta, você confirma que tem capacidade legal para celebrar este contrato e que aceita 
                  integralmente estes Termos e nossa <Link to="/privacidade">Política de Privacidade</Link>.
                </p>
              </section>

              <section id="descricao">
                <h2>2. Descrição do Serviço</h2>
                <p>A Uz4Flow é uma plataforma SaaS de automação e gestão de comunicação empresarial que oferece:</p>
                <ul>
                  <li><strong>Automação WhatsApp</strong>: Integração com WhatsApp Business API para envio e recebimento automatizado de mensagens, fluxos conversacionais e regras de roteamento.</li>
                  <li><strong>CRM (Customer Relationship Management)</strong>: Gestão de contatos, conversas, funil kanban de vendas, etiquetas e campos personalizados.</li>
                  <li><strong>Instagram Automation</strong>: Automação de respostas a mensagens diretas e comentários via Meta Graph API / Instagram Messaging API.</li>
                  <li><strong>Prospecção de Clientes</strong>: Busca de potenciais clientes utilizando Google Places API e outras fontes de dados públicos.</li>
                  <li><strong>Voice AI</strong>: Chamadas de voz automatizadas com inteligência artificial via integração com VAPI.</li>
                  <li><strong>Conectores e Webhooks</strong>: Integração com sistemas externos através de webhooks e conectores configuráveis.</li>
                  <li><strong>Gestão de Equipe</strong>: Gerenciamento de membros da equipe com atribuição de conversas e controle de acesso.</li>
                  <li><strong>MCP Gateway</strong>: Gateway de integração com servidores MCP para extensão de funcionalidades.</li>
                </ul>
              </section>

              <section id="elegibilidade">
                <h2>3. Elegibilidade</h2>
                <p>Para utilizar a Uz4Flow, você deve:</p>
                <ul>
                  <li>Ter no mínimo 18 (dezoito) anos de idade</li>
                  <li>Possuir capacidade civil plena para celebrar contratos</li>
                  <li>Ser pessoa jurídica regularmente constituída ou pessoa física com CPF válido</li>
                  <li>Fornecer informações verdadeiras, atuais e completas durante o cadastro</li>
                  <li>Manter suas informações de cadastro sempre atualizadas</li>
                </ul>
              </section>

              <section id="conta">
                <h2>4. Conta do Usuário</h2>
                <h3>4.1 Registro</h3>
                <p>
                  O cadastro requer nome completo, e-mail válido e senha segura. Cada organização pode ter múltiplos membros 
                  com diferentes níveis de acesso.
                </p>
                <h3>4.2 Responsabilidades</h3>
                <ul>
                  <li>Você é responsável por todas as atividades realizadas em sua conta</li>
                  <li>Deve manter suas credenciais de acesso em sigilo</li>
                  <li>Deve notificar imediatamente qualquer uso não autorizado da conta</li>
                  <li>É responsável por todas as chaves de API, tokens e credenciais de integração configuradas em sua conta</li>
                </ul>
                <h3>4.3 Dados da Organização</h3>
                <p>
                  Cada conta é vinculada a uma organização. Os dados, contatos, conversas e configurações pertencem à organização 
                  e são isolados de outras organizações por políticas de segurança em nível de banco de dados.
                </p>
              </section>

              <section id="uso-aceitavel">
                <h2>5. Uso Aceitável e Proibições</h2>
                <h3>5.1 Uso Permitido</h3>
                <p>
                  A plataforma deve ser utilizada exclusivamente para fins comerciais legítimos de comunicação com clientes, 
                  prospecção de negócios e gestão de relacionamento.
                </p>
                <h3>5.2 Proibições</h3>
                <p>É expressamente proibido:</p>
                <ul>
                  <li>Enviar <strong>spam</strong>, mensagens em massa não solicitadas ou conteúdo indesejado</li>
                  <li>Utilizar a plataforma para atividades ilegais, fraudulentas ou enganosas</li>
                  <li>Violar as <strong>Políticas de Uso do WhatsApp Business</strong> ou os <strong>Termos da Plataforma Meta</strong></li>
                  <li>Coletar, armazenar ou utilizar dados pessoais de terceiros sem base legal adequada</li>
                  <li>Enviar conteúdo ofensivo, difamatório, discriminatório ou ilegal</li>
                  <li>Tentar acessar dados de outras organizações ou usuários</li>
                  <li>Realizar engenharia reversa, descompilação ou tentativas de extração do código-fonte</li>
                  <li>Utilizar bots ou scripts não autorizados para interagir com a plataforma</li>
                  <li>Revender ou sublicenciar o acesso à plataforma sem autorização</li>
                  <li>Exceder deliberadamente os limites do plano contratado através de métodos técnicos</li>
                </ul>
                <p>
                  O descumprimento dessas regras pode resultar em suspensão ou encerramento imediato da conta, 
                  sem direito a reembolso.
                </p>
              </section>

              <section id="whatsapp-meta">
                <h2>6. Conformidade com Políticas da Meta e WhatsApp</h2>
                <h3>6.1 WhatsApp Business Policy</h3>
                <p>Ao utilizar a integração com WhatsApp, você se compromete a:</p>
                <ul>
                  <li>Respeitar a <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer">WhatsApp Business Policy</a></li>
                  <li>Utilizar templates de mensagens aprovados para iniciar conversas fora da janela de 24 horas</li>
                  <li>Não enviar mensagens para números que não consentiram em recebê-las</li>
                  <li>Respeitar solicitações de opt-out/bloqueio dos destinatários</li>
                  <li>Não utilizar a API para disseminar conteúdo proibido pelo WhatsApp</li>
                </ul>
                <h3>6.2 Meta Platform Terms</h3>
                <p>Para as integrações com Instagram, você se compromete a:</p>
                <ul>
                  <li>Cumprir os <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer">Termos da Plataforma Meta</a></li>
                  <li>Utilizar os dados obtidos via APIs da Meta exclusivamente para os fins autorizados</li>
                  <li>Não armazenar dados da Meta além do necessário para a prestação do serviço</li>
                  <li>Deletar dados quando solicitado pelo usuário ou quando o acesso for revogado</li>
                </ul>
                <p>
                  A Uz4Flow não se responsabiliza por restrições, suspensões ou banimentos aplicados pela Meta ou WhatsApp 
                  à conta do usuário em decorrência de uso indevido.
                </p>
              </section>

              <section id="planos">
                <h2>7. Planos, Pagamentos e Cancelamento</h2>
                <h3>7.1 Planos</h3>
                <p>
                  A Uz4Flow oferece diferentes planos de assinatura com variações de recursos e limites. 
                  Os detalhes, preços e funcionalidades de cada plano estão disponíveis na página de preços da plataforma.
                </p>
                <h3>7.2 Pagamentos</h3>
                <ul>
                  <li>Os pagamentos são processados pelo <strong>MercadoPago</strong></li>
                  <li>As assinaturas são cobradas de forma recorrente (mensal)</li>
                  <li>Os preços podem ser atualizados com aviso prévio de 30 dias</li>
                  <li>Cupons de desconto podem estar sujeitos a condições específicas</li>
                </ul>
                <h3>7.3 Cancelamento</h3>
                <ul>
                  <li>O cancelamento pode ser realizado a qualquer momento pelo painel de configurações</li>
                  <li>Após o cancelamento, o acesso permanece ativo até o final do período já pago</li>
                  <li>Não há reembolso proporcional por períodos não utilizados, salvo disposição legal contrária</li>
                  <li>Os dados são mantidos por 30 dias após o cancelamento, podendo ser exportados nesse período</li>
                </ul>
              </section>

              <section id="propriedade">
                <h2>8. Propriedade Intelectual</h2>
                <ul>
                  <li>A plataforma Uz4Flow, incluindo código-fonte, design, marcas, logotipos e documentação, é propriedade exclusiva da Open Bot AI</li>
                  <li>O usuário não adquire nenhum direito de propriedade intelectual sobre a plataforma ao utilizar o serviço</li>
                  <li>Os dados e conteúdos inseridos pelo usuário na plataforma permanecem de propriedade do usuário</li>
                  <li>O usuário concede à Uz4Flow uma licença limitada para processar seus dados conforme necessário para a prestação dos serviços</li>
                </ul>
              </section>

              <section id="dados">
                <h2>9. Dados e Privacidade</h2>
                <p>
                  O tratamento de dados pessoais é regido por nossa <Link to="/privacidade">Política de Privacidade</Link>, 
                  que é parte integrante destes Termos. Ao utilizar a plataforma, você consente com as práticas de dados 
                  descritas na Política de Privacidade.
                </p>
                <p>
                  A Uz4Flow atua como <strong>operadora</strong> de dados pessoais em nome do usuário (controlador) 
                  para o processamento de mensagens e dados de contatos. O usuário é responsável por garantir que possui 
                  base legal adequada (LGPD) para o tratamento dos dados de seus clientes.
                </p>
              </section>

              <section id="limitacao">
                <h2>10. Limitação de Responsabilidade</h2>
                <ul>
                  <li>A Uz4Flow é fornecida "como está" (<em>as is</em>), sem garantias de qualquer tipo, expressas ou implícitas</li>
                  <li>Não garantimos que o serviço será ininterrupto, livre de erros ou completamente seguro</li>
                  <li>Não nos responsabilizamos por danos indiretos, consequenciais, lucros cessantes ou perda de dados</li>
                  <li>Nossa responsabilidade total é limitada ao valor pago pelo usuário nos últimos 12 meses</li>
                  <li>Não nos responsabilizamos por ações ou omissões de terceiros integrados (Meta, Google, MercadoPago, VAPI)</li>
                  <li>Não nos responsabilizamos por bloqueios ou restrições impostas pela Meta ou WhatsApp à conta do usuário</li>
                </ul>
              </section>

              <section id="disponibilidade">
                <h2>11. Disponibilidade e SLA</h2>
                <ul>
                  <li>Nos esforçamos para manter a disponibilidade da plataforma em 99,5% do tempo</li>
                  <li>Manutenções programadas serão comunicadas com antecedência sempre que possível</li>
                  <li>A indisponibilidade decorrente de serviços de terceiros (APIs Meta, Google, provedores de infraestrutura) não é contabilizada em nosso SLA</li>
                  <li>Em caso de indisponibilidade prolongada (superior a 24 horas contínuas), o usuário poderá solicitar crédito proporcional</li>
                </ul>
              </section>

              <section id="rescisao">
                <h2>12. Rescisão</h2>
                <p>Podemos suspender ou encerrar sua conta nas seguintes situações:</p>
                <ul>
                  <li>Violação destes Termos de Serviço</li>
                  <li>Uso indevido da plataforma conforme descrito na seção 5</li>
                  <li>Inadimplência por período superior a 30 dias</li>
                  <li>Solicitação de exclusão de conta pelo próprio usuário</li>
                  <li>Determinação judicial ou administrativa</li>
                </ul>
                <p>
                  Em caso de rescisão, garantimos o acesso aos dados para exportação por um período de 30 dias, 
                  exceto em casos de violação grave que exijam remoção imediata.
                </p>
              </section>

              <section id="modificacoes">
                <h2>13. Modificações dos Termos</h2>
                <p>
                  Reservamo-nos o direito de modificar estes Termos a qualquer momento. Alterações significativas serão 
                  comunicadas por e-mail ou por notificação na plataforma com antecedência mínima de 30 dias.
                </p>
                <p>
                  A continuidade do uso dos serviços após a entrada em vigor das alterações constitui aceitação 
                  dos novos Termos. Se você não concordar com as alterações, deverá encerrar sua conta antes da 
                  data de vigência dos novos Termos.
                </p>
              </section>

              <section id="lei-aplicavel">
                <h2>14. Lei Aplicável e Foro</h2>
                <p>
                  Estes Termos são regidos pelas leis da República Federativa do Brasil. Para dirimir quaisquer controvérsias 
                  decorrentes destes Termos, fica eleito o foro da Comarca da sede da Open Bot AI, com renúncia expressa a 
                  qualquer outro, por mais privilegiado que seja.
                </p>
              </section>

              <section id="contato-termos">
                <h2>15. Contato</h2>
                <p>Para dúvidas sobre estes Termos de Serviço, entre em contato:</p>
                <ul>
                  <li><strong>Empresa</strong>: Open Bot AI</li>
                  <li><strong>CNPJ</strong>: 63.185.666/0001-81</li>
                  <li><strong>E-mail</strong>: <a href="mailto:suporte@openbotai.com.br">suporte@openbotai.com.br</a></li>
                </ul>
              </section>
            </article>
          </div>
        </div>
      </div>

      <LandingFooter appName="Uz4Flow" supportEmail="suporte@openbotai.com.br" />
    </div>
  );
}
