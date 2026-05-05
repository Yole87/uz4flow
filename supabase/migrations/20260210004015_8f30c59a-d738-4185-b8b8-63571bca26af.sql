ALTER TABLE public.contact_notes
ADD CONSTRAINT contact_notes_author_user_id_fkey
FOREIGN KEY (author_user_id) REFERENCES public.profiles(user_id);