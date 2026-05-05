-- Create message_templates table
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'reengajamento',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Users can view their own templates AND system defaults (is_default = true)
CREATE POLICY "Users can view their own templates and defaults"
ON public.message_templates
FOR SELECT
USING (auth.uid() = user_id OR is_default = true);

-- Users can insert their own templates
CREATE POLICY "Users can insert their own templates"
ON public.message_templates
FOR INSERT
WITH CHECK (auth.uid() = user_id AND is_default = false);

-- Users can update their own non-default templates
CREATE POLICY "Users can update their own templates"
ON public.message_templates
FOR UPDATE
USING (auth.uid() = user_id AND is_default = false);

-- Users can delete their own non-default templates
CREATE POLICY "Users can delete their own templates"
ON public.message_templates
FOR DELETE
USING (auth.uid() = user_id AND is_default = false);

-- Create trigger for updated_at
CREATE TRIGGER update_message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();