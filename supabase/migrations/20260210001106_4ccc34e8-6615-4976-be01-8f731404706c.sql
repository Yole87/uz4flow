
-- Create contact_notes table for timeline/comments
CREATE TABLE public.contact_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL,
  content TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'comment',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org contact notes"
  ON public.contact_notes FOR SELECT
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can insert their org contact notes"
  ON public.contact_notes FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can update their org contact notes"
  ON public.contact_notes FOR UPDATE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can delete their org contact notes"
  ON public.contact_notes FOR DELETE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE INDEX idx_contact_notes_contact_id ON public.contact_notes(contact_id);

-- Create contact_attachments table
CREATE TABLE public.contact_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org attachments"
  ON public.contact_attachments FOR SELECT
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can insert their org attachments"
  ON public.contact_attachments FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can delete their org attachments"
  ON public.contact_attachments FOR DELETE
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE INDEX idx_contact_attachments_contact_id ON public.contact_attachments(contact_id);

-- Create storage bucket for contact attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('contact-attachments', 'contact-attachments', false, 10485760);

-- Storage policies
CREATE POLICY "Org members can upload contact attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contact-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Org members can view contact attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contact-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Org members can delete contact attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'contact-attachments' AND auth.uid() IS NOT NULL);
