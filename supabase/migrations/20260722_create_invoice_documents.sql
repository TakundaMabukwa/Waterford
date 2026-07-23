-- Storage bucket for invoice documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-documents', 'invoice-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: allow all access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access on invoice-documents' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Allow all access on invoice-documents"
      ON storage.objects
      FOR ALL
      USING (bucket_id = 'invoice-documents')
      WITH CHECK (bucket_id = 'invoice-documents');
  END IF;
END $$;

-- Invoice documents table — one row per audit/trip, docs stored as jsonb array
CREATE TABLE IF NOT EXISTS public.invoice_documents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  audit_id bigint NOT NULL UNIQUE,
  trip_id text NOT NULL,
  ordernumber text NULL,
  invoice_number text NULL,
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  reference_number text NULL,
  uploaded_by text NULL,
  created_at timestamp without time zone NULL DEFAULT now(),
  updated_at timestamp without time zone NULL DEFAULT now(),
  CONSTRAINT invoice_documents_audit_id_fkey FOREIGN KEY (audit_id)
    REFERENCES public.audit (id) ON DELETE CASCADE,
  CONSTRAINT invoice_documents_trip_id_unique UNIQUE (trip_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_invoice_documents_audit_id ON public.invoice_documents USING btree (audit_id);
CREATE INDEX IF NOT EXISTS idx_invoice_documents_trip_id ON public.invoice_documents USING btree (trip_id);
CREATE INDEX IF NOT EXISTS idx_invoice_documents_ordernumber ON public.invoice_documents USING btree (ordernumber);
CREATE INDEX IF NOT EXISTS idx_invoice_documents_documents_gin ON public.invoice_documents USING gin (documents);

-- RLS
ALTER TABLE public.invoice_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access on invoice_documents' AND tablename = 'invoice_documents'
  ) THEN
    CREATE POLICY "Allow all access on invoice_documents"
      ON public.invoice_documents
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
