
-- Tutorial categories table
CREATE TABLE public.tutorial_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tutorial_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active categories"
  ON public.tutorial_categories FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "Admin master can manage categories"
  ON public.tutorial_categories FOR ALL
  USING (is_admin_master())
  WITH CHECK (is_admin_master());

-- Tutorials table
CREATE TABLE public.tutorials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.tutorial_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  youtube_video_id TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view published tutorials"
  ON public.tutorials FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_published = true);

CREATE POLICY "Admin master can manage tutorials"
  ON public.tutorials FOR ALL
  USING (is_admin_master())
  WITH CHECK (is_admin_master());

-- Trigger for updated_at
CREATE TRIGGER update_tutorials_updated_at
  BEFORE UPDATE ON public.tutorials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
