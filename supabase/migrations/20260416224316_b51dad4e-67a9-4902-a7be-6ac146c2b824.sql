
-- 1. Tabela smart_labels
CREATE TABLE IF NOT EXISTS public.smart_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#71717a',
  icon text,
  order_index integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_smart_labels_org ON public.smart_labels(organization_id, order_index);

-- 2. Coluna em contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS smart_label_keys text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_contacts_smart_labels ON public.contacts USING GIN (smart_label_keys);

-- 3. RLS
ALTER TABLE public.smart_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org smart labels"
  ON public.smart_labels FOR SELECT
  USING (
    public.is_admin_master()
    OR organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  );

CREATE POLICY "Owners can insert smart labels"
  ON public.smart_labels FOR INSERT
  WITH CHECK (
    public.is_admin_master()
    OR public.is_organization_owner(organization_id, auth.uid())
  );

CREATE POLICY "Owners can update smart labels"
  ON public.smart_labels FOR UPDATE
  USING (
    public.is_admin_master()
    OR public.is_organization_owner(organization_id, auth.uid())
  );

CREATE POLICY "Owners can delete non-system smart labels"
  ON public.smart_labels FOR DELETE
  USING (
    (public.is_admin_master() OR public.is_organization_owner(organization_id, auth.uid()))
    AND is_system = false
  );

-- 4. Trigger updated_at
CREATE TRIGGER trg_smart_labels_updated_at
  BEFORE UPDATE ON public.smart_labels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Seed function — cria 5 labels padrão para uma organização
CREATE OR REPLACE FUNCTION public.seed_default_smart_labels(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.smart_labels (organization_id, key, name, color, icon, order_index, is_system)
  VALUES
    (_org_id, 'lead',      'Lead',      '#F59E0B', 'Sparkles',      0, true),
    (_org_id, 'pago',      'Pago',      '#22C55E', 'CircleDollarSign', 1, true),
    (_org_id, 'agendado',  'Agendado',  '#3B82F6', 'CalendarClock', 2, true),
    (_org_id, 'pedido',    'Pedido',    '#A855F7', 'ShoppingBag',   3, true),
    (_org_id, 'enviado',   'Enviado',   '#14B8A6', 'Truck',         4, true)
  ON CONFLICT (organization_id, key) DO NOTHING;
END;
$$;

-- 6. Trigger: ao criar nova organização, seedar labels
CREATE OR REPLACE FUNCTION public.create_default_smart_labels_for_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_smart_labels(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_default_smart_labels
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.create_default_smart_labels_for_org();

-- 7. Backfill: seedar para organizações existentes
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_default_smart_labels(org_record.id);
  END LOOP;
END $$;
