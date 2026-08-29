-- =============================================================================
-- COVE V1 - Construction Operations Value Engine
-- Migration 00003: Storage Buckets and Tenant Isolation Policies
-- =============================================================================

-- Create storage bucket for evidence, reports, documents, and feedback attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('cove-documents', 'cove-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Path Convention:
-- organizations/{organization_id}/projects/{project_id}/{entity_type}/{entity_id}/{filename}

-- Policy: Allow tenant members to download documents within their organization
CREATE POLICY "Tenant members can read documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'cove-documents' AND
    (storage.foldername(name))[1] = 'organizations' AND
    (storage.foldername(name))[2]::uuid IN (SELECT auth_user_org_ids())
);

-- Policy: Allow authorized members to upload documents
CREATE POLICY "Authorized tenant members can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'cove-documents' AND
    (storage.foldername(name))[1] = 'organizations' AND
    (storage.foldername(name))[2]::uuid IN (SELECT auth_user_org_ids())
);

-- Policy: Allow authorized members to delete documents
CREATE POLICY "Authorized tenant members can delete documents"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'cove-documents' AND
    (storage.foldername(name))[1] = 'organizations' AND
    (storage.foldername(name))[2]::uuid IN (
        SELECT om.organization_id 
        FROM organization_members om 
        JOIN profiles p ON p.id = om.user_id
        WHERE p.auth_user_id = auth.uid() 
          AND om.role IN ('OWNER', 'ADMIN', 'COMMERCIAL_MANAGER') 
          AND om.status = 'active'
    )
);
