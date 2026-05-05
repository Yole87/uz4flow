-- Unique constraint para evitar contatos duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_org_phone_unique 
ON contacts (organization_id, phone);

-- Unique constraint para evitar conversas duplicadas  
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_contact_instance_unique 
ON conversations (contact_id, instance_id) WHERE instance_id IS NOT NULL;