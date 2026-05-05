-- B1: Create triggers on auth.users for handle_new_user and affiliate attribution
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_affiliate ON auth.users;
CREATE TRIGGER on_auth_user_created_affiliate
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_affiliate_referral_attribution();

-- B3: Drop orphan admin_notifications table (singular) if exists
DROP TABLE IF EXISTS public.admin_notifications CASCADE;

-- Seed default affiliate terms v1 (so onboarding modal works)
INSERT INTO public.affiliate_terms_versions (version, body_md, published_at)
SELECT 1, $md$# Termos do Programa de Afiliados

## 1. Aceitação
Ao se cadastrar como afiliado, você concorda com estes termos integralmente.

## 2. Comissão
- Você recebe **20%** sobre o valor líquido de cada nova assinatura paga indicada.
- A comissão é calculada apenas sobre o **primeiro pagamento** de cada cliente indicado dentro da janela de atribuição (30 dias).
- Pagamentos recorrentes seguintes **não geram nova comissão**.

## 3. Janela de carência
- Cada comissão fica **bloqueada por 8 dias** após o pagamento (período de garantia/estorno).
- Após esse prazo, ela passa para "Disponível" e pode ser sacada.

## 4. Saques
- Valor mínimo de saque: **R$ 50,00**.
- Imposto retido na fonte: **6%** sobre o valor solicitado.
- Pagamento via **PIX** em até 5 dias úteis após aprovação.
- Apenas 1 saque pendente por vez.

## 5. Atribuição
- O clique do indicado é registrado por **30 dias** via cookie/localStorage.
- A primeira conversão dentro desse prazo conta para o afiliado.

## 6. Cancelamento e estorno
- Estornos cancelam automaticamente a comissão correspondente.
- Cancelamentos da assinatura nos primeiros 8 dias **anulam** a comissão.

## 7. Boas práticas
- Proibido spam, fraude de cliques ou auto-indicação.
- Violações resultam em **suspensão imediata** e perda do saldo.

## 8. Alterações
A plataforma pode atualizar estes termos a qualquer momento, com aviso prévio de 30 dias.
$md$, now()
WHERE NOT EXISTS (SELECT 1 FROM public.affiliate_terms_versions WHERE version = 1);

-- Make sure affiliate_settings has current_terms_version = 1
UPDATE public.affiliate_settings SET current_terms_version = 1 WHERE current_terms_version IS NULL OR current_terms_version < 1;