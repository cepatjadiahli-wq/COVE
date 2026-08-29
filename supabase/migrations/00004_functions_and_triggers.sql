-- =============================================================================
-- COVE V1 - Construction Operations Value Engine
-- Migration 00004: Functions & Triggers (Transitions, Reconciliation, Audit)
-- =============================================================================

-- Function: Automatically calculate invoice net receivable and outstanding
CREATE OR REPLACE FUNCTION fn_recalculate_invoice_amounts()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate net receivable
    NEW.net_receivable_amount := COALESCE(NEW.gross_amount, 0)
        - COALESCE(NEW.retention_amount, 0)
        - COALESCE(NEW.advance_recovery_amount, 0)
        - COALESCE(NEW.tax_amount, 0)
        - COALESCE(NEW.other_deduction_amount, 0);

    -- Calculate outstanding
    NEW.outstanding_amount := GREATEST(NEW.net_receivable_amount - COALESCE(NEW.cash_received_amount, 0), 0);

    -- Automatically update status if not cancelled/disputed
    IF NEW.status NOT IN ('cancelled', 'disputed', 'draft') THEN
        IF NEW.outstanding_amount = 0 AND NEW.cash_received_amount > 0 THEN
            NEW.status := 'paid';
        ELSIF NEW.cash_received_amount > 0 AND NEW.outstanding_amount > 0 THEN
            NEW.status := 'partially_paid';
        ELSIF CURRENT_DATE > NEW.due_date AND NEW.outstanding_amount > 0 THEN
            NEW.status := 'overdue';
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_recalculate
BEFORE INSERT OR UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION fn_recalculate_invoice_amounts();


-- Function: Automatically reconcile Cash Receipts into Invoice
CREATE OR REPLACE FUNCTION fn_on_cash_receipt_mutation()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_id UUID;
    v_total_received NUMERIC(20,2);
    v_net_receivable NUMERIC(20,2);
    v_org_id UUID;
    v_project_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_invoice_id := OLD.invoice_id;
        v_org_id := OLD.organization_id;
        v_project_id := OLD.project_id;
    ELSE
        v_invoice_id := NEW.invoice_id;
        v_org_id := NEW.organization_id;
        v_project_id := NEW.project_id;
    END IF;

    -- Calculate total cash received for this invoice
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_received
    FROM cash_receipts
    WHERE invoice_id = v_invoice_id;

    -- Update invoice
    UPDATE invoices
    SET cash_received_amount = v_total_received,
        updated_at = NOW()
    WHERE id = v_invoice_id;

    -- Log audit event
    INSERT INTO audit_logs (organization_id, user_id, entity_type, entity_id, event_type, old_values, new_values, source)
    VALUES (
        v_org_id,
        COALESCE(NEW.recorded_by, OLD.recorded_by),
        'cash_receipt',
        v_invoice_id,
        TG_OP,
        NULL,
        jsonb_build_object('total_received', v_total_received, 'invoice_id', v_invoice_id),
        'database_trigger'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cash_receipt_reconciliation
AFTER INSERT OR UPDATE OR DELETE ON cash_receipts
FOR EACH ROW
EXECUTE FUNCTION fn_on_cash_receipt_mutation();
