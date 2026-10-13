-- Idempotent synthetic MeiProof fixtures. This creates no Auth users,
-- memberships, storage objects, or pretend user identities.
begin;

insert into public.organizations
  (fixture_key, name, kind, country, business_identifier, website, record_source)
values
  ('mei-demo-seller', 'Northstar Components Demo', 'seller', 'India', 'SYNTH-SELLER-001', '', 'synthetic'),
  ('mei-demo-buyer', 'Cedar Retail Demo', 'buyer', 'India', 'SYNTH-BUYER-001', '', 'synthetic'),
  ('mei-demo-lender-a', 'MeiProof Test Finance A Demo', 'lender', 'India', 'SYNTH-LENDER-001', '', 'synthetic'),
  ('mei-demo-lender-b', 'MeiProof Test Finance B Demo', 'lender', 'India', 'SYNTH-LENDER-002', '', 'synthetic')
on conflict (fixture_key) do update set
  name = excluded.name, kind = excluded.kind, country = excluded.country,
  business_identifier = excluded.business_identifier, website = excluded.website,
  record_source = excluded.record_source;

insert into public.claims
  (fixture_key, seller_organization_id, buyer_organization_id, invoice_number,
   invoice_date, due_date, currency, amount, status, demo_note,
   purchase_order_reference, payment_terms_days, integrity_risk_level, payment_risk_level, record_source)
select f.fixture_key, seller.id, buyer.id, f.invoice_number, f.invoice_date, f.due_date,
  'INR', f.amount, f.status, f.demo_note, f.purchase_order_reference,
  f.payment_terms_days, f.integrity_risk_level, f.payment_risk_level, 'synthetic'
from (values
  ('mei-demo-claim-1001', 'MP-DEMO-INV-1001', date '2026-09-02', date '2026-10-02', 845000.00::numeric, 'ready_for_review', 'Synthetic consistent-field example; not independently verified.', 'MP-DEMO-PO-7781', 30, 'low', 'low'),
  ('mei-demo-claim-1002', 'MP-DEMO-INV-1002', date '2026-09-14', date '2026-10-14', 420000.00::numeric, 'pending_buyer', 'Synthetic claim awaiting a buyer response; no real response exists.', 'MP-DEMO-PO-7782', 30, 'unknown', 'moderate'),
  ('mei-demo-claim-1003', 'MP-DEMO-INV-1003', date '2026-09-21', date '2026-10-21', 1280000.00::numeric, 'needs_review', 'Synthetic amount and quantity mismatch example; no verification engine ran.', 'MP-DEMO-PO-7783', 30, 'high', 'unknown'),
  ('mei-demo-claim-1004', 'MP-DEMO-INV-1001', date '2026-09-02', date '2026-10-02', 845000.00::numeric, 'needs_review', 'Synthetic repeated normalized invoice identity; not proof of fraud.', 'MP-DEMO-PO-7781', 30, 'high', 'unknown'),
  ('mei-demo-claim-1005', 'MP-DEMO-INV-1005', date '2026-09-24', date '2026-10-24', 265000.00::numeric, 'disputed', 'Synthetic buyer dispute scenario; no real dispute was submitted.', 'MP-DEMO-PO-7785', 30, 'high', 'moderate'),
  ('mei-demo-claim-1006', 'MP-DEMO-INV-1001', date '2026-09-02', date '2026-10-02', 845000.00::numeric, 'ready_for_review', 'Synthetic second-lender registry conflict candidate using the same invoice identity.', 'MP-DEMO-PO-7781', 30, 'moderate', 'moderate')
) as f(fixture_key, invoice_number, invoice_date, due_date, amount, status, demo_note, purchase_order_reference, payment_terms_days, integrity_risk_level, payment_risk_level)
join public.organizations seller on seller.fixture_key = 'mei-demo-seller'
join public.organizations buyer on buyer.fixture_key = 'mei-demo-buyer'
on conflict (fixture_key) do update set
  seller_organization_id = excluded.seller_organization_id,
  buyer_organization_id = excluded.buyer_organization_id,
  invoice_number = excluded.invoice_number,
  invoice_date = excluded.invoice_date,
  due_date = excluded.due_date,
  currency = excluded.currency,
  amount = excluded.amount,
  status = excluded.status,
  demo_note = excluded.demo_note,
  purchase_order_reference = excluded.purchase_order_reference,
  payment_terms_days = excluded.payment_terms_days,
  integrity_risk_level = excluded.integrity_risk_level,
  payment_risk_level = excluded.payment_risk_level,
  record_source = excluded.record_source;

insert into public.claim_lender_assignments (claim_id, lender_organization_id, record_source)
select c.id, l.id, 'synthetic'
from (values
  ('mei-demo-claim-1001', 'mei-demo-lender-a'),
  ('mei-demo-claim-1003', 'mei-demo-lender-a'),
  ('mei-demo-claim-1005', 'mei-demo-lender-a'),
  ('mei-demo-claim-1006', 'mei-demo-lender-b')
) as f(claim_key, lender_key)
join public.claims c on c.fixture_key = f.claim_key
join public.organizations l on l.fixture_key = f.lender_key
on conflict (claim_id, lender_organization_id) do update set record_source = excluded.record_source;

insert into public.claim_line_items
  (fixture_key, claim_id, line_number, description, item_reference, quantity, unit, unit_price, line_amount, record_source)
select f.fixture_key, c.id, f.line_number, f.description, f.item_reference,
  f.quantity, f.unit, f.unit_price, f.line_amount, 'synthetic'
from (values
  ('mei-demo-line-1001', 'mei-demo-claim-1001', 1, 'Industrial components', 'COMP-44', 1200.000::numeric, 'units', 704.17::numeric, 845000.00::numeric),
  ('mei-demo-line-1003-invoice', 'mei-demo-claim-1003', 1, 'Automotive assemblies on invoice', 'AUTO-17', 1200.000::numeric, 'units', 1066.67::numeric, 1280000.00::numeric),
  ('mei-demo-line-1003-delivery', 'mei-demo-claim-1003', 2, 'Automotive assemblies received (synthetic)', 'AUTO-17', 1150.000::numeric, 'units', 1066.67::numeric, 1226680.50::numeric)
) as f(fixture_key, claim_key, line_number, description, item_reference, quantity, unit, unit_price, line_amount)
join public.claims c on c.fixture_key = f.claim_key
on conflict (fixture_key) do update set
  claim_id = excluded.claim_id, line_number = excluded.line_number,
  description = excluded.description, item_reference = excluded.item_reference,
  quantity = excluded.quantity, unit = excluded.unit,
  unit_price = excluded.unit_price, line_amount = excluded.line_amount,
  record_source = excluded.record_source;

insert into public.claim_documents
  (fixture_key, claim_id, uploaded_by, original_filename, mime_type, size_bytes,
   storage_path, demo_note, document_type, source_type, version_number, sha256_hash, record_source)
select f.fixture_key, c.id, null, f.original_filename, 'application/pdf', f.size_bytes,
  null, f.demo_note, f.document_type, f.source_type, 1, f.sha256_hash, 'synthetic'
from (values
  ('mei-demo-doc-1001', 'mei-demo-claim-1001', 'MP-DEMO-INV-1001.pdf', 184220::bigint, 'invoice', 'seller_submitted', 'Synthetic metadata only; no file bytes or storage object exists.', repeat('1', 64)),
  ('mei-demo-doc-1001-po', 'mei-demo-claim-1001', 'MP-DEMO-PO-7781.pdf', 104820::bigint, 'purchase_order', 'seller_submitted', 'Synthetic metadata only; no file bytes or storage object exists.', repeat('2', 64)),
  ('mei-demo-doc-1001-delivery', 'mei-demo-claim-1001', 'MP-DEMO-DR-501.pdf', 85214::bigint, 'delivery_receipt', 'seller_submitted', 'Synthetic metadata only; delivery is not independently corroborated.', repeat('3', 64)),
  ('mei-demo-doc-1001-contract', 'mei-demo-claim-1001', 'MP-DEMO-CONTRACT-12.pdf', 153008::bigint, 'contract', 'seller_submitted', 'Synthetic metadata only; no file bytes or storage object exists.', repeat('4', 64)),
  ('mei-demo-doc-1002', 'mei-demo-claim-1002', 'MP-DEMO-INV-1002.pdf', 121001::bigint, 'invoice', 'seller_submitted', 'Synthetic metadata only; no file bytes or storage object exists.', repeat('5', 64)),
  ('mei-demo-doc-1003-review', 'mei-demo-claim-1003', 'MP-DEMO-INV-1003.pdf', 205412::bigint, 'invoice', 'seller_submitted', 'Synthetic metadata only; mismatch status is illustrative.', repeat('6', 64)),
  ('mei-demo-doc-1003-po', 'mei-demo-claim-1003', 'MP-DEMO-PO-7783.pdf', 110201::bigint, 'purchase_order', 'seller_submitted', 'Synthetic metadata only; no file bytes or storage object exists.', repeat('7', 64)),
  ('mei-demo-doc-1003-delivery', 'mei-demo-claim-1003', 'MP-DEMO-DR-503.pdf', 99201::bigint, 'delivery_receipt', 'seller_submitted', 'Synthetic metadata only; no file bytes or storage object exists.', repeat('8', 64)),
  ('mei-demo-doc-1005', 'mei-demo-claim-1005', 'MP-DEMO-INV-1005.pdf', 93121::bigint, 'invoice', 'seller_submitted', 'Synthetic metadata only; no file bytes or storage object exists.', repeat('9', 64)),
  ('mei-demo-doc-1006', 'mei-demo-claim-1006', 'MP-DEMO-INV-1006.pdf', 111222::bigint, 'invoice', 'seller_submitted', 'Synthetic metadata only; no file bytes or storage object exists.', repeat('a', 64))
) as f(fixture_key, claim_key, original_filename, size_bytes, document_type, source_type, demo_note, sha256_hash)
join public.claims c on c.fixture_key = f.claim_key
on conflict (fixture_key) do update set
  claim_id = excluded.claim_id, uploaded_by = null,
  original_filename = excluded.original_filename, mime_type = excluded.mime_type,
  size_bytes = excluded.size_bytes, storage_path = null,
  demo_note = excluded.demo_note, document_type = excluded.document_type,
  source_type = excluded.source_type, version_number = 1,
  sha256_hash = excluded.sha256_hash, record_source = 'synthetic';

insert into public.document_extractions
  (fixture_key, claim_id, document_id, engine, engine_version, status, started_at, completed_at, record_source)
select f.fixture_key, c.id, d.id, 'synthetic-fixture', '1', 'completed',
  timestamptz '2026-10-12 10:00:00+00', timestamptz '2026-10-12 10:00:01+00', 'synthetic'
from (values
  ('mei-demo-extraction-1001', 'mei-demo-claim-1001', 'mei-demo-doc-1001'),
  ('mei-demo-extraction-1003', 'mei-demo-claim-1003', 'mei-demo-doc-1003-review')
) as f(fixture_key, claim_key, document_key)
join public.claims c on c.fixture_key = f.claim_key
join public.claim_documents d on d.fixture_key = f.document_key
on conflict (fixture_key) do update set claim_id = excluded.claim_id, document_id = excluded.document_id,
  engine = excluded.engine, engine_version = excluded.engine_version, status = excluded.status,
  started_at = excluded.started_at, completed_at = excluded.completed_at, record_source = 'synthetic';

insert into public.document_extracted_fields
  (fixture_key, extraction_id, claim_id, field_key, raw_value, normalized_value, page_number, confidence, provenance_type, record_source)
select f.fixture_key, e.id, c.id, f.field_key, jsonb_build_object('value', f.field_value),
  f.normalized_value, 1, 0.9900, 'extracted', 'synthetic'
from (values
  ('mei-demo-field-1001-number', 'mei-demo-extraction-1001', 'mei-demo-claim-1001', 'invoice.number', 'MP-DEMO-INV-1001', 'MP-DEMO-INV-1001'),
  ('mei-demo-field-1001-amount', 'mei-demo-extraction-1001', 'mei-demo-claim-1001', 'invoice.amount', '845000.00', '845000.00'),
  ('mei-demo-field-1003-number', 'mei-demo-extraction-1003', 'mei-demo-claim-1003', 'invoice.number', 'MP-DEMO-INV-1003', 'MP-DEMO-INV-1003'),
  ('mei-demo-field-1003-quantity', 'mei-demo-extraction-1003', 'mei-demo-claim-1003', 'invoice.quantity', '1200', '1200')
) as f(fixture_key, extraction_key, claim_key, field_key, field_value, normalized_value)
join public.document_extractions e on e.fixture_key = f.extraction_key
join public.claims c on c.fixture_key = f.claim_key
on conflict (fixture_key) do update set extraction_id = excluded.extraction_id, claim_id = excluded.claim_id,
  field_key = excluded.field_key, raw_value = excluded.raw_value, normalized_value = excluded.normalized_value,
  page_number = excluded.page_number, confidence = excluded.confidence,
  provenance_type = excluded.provenance_type, record_source = 'synthetic';

insert into public.verification_runs
  (fixture_key, claim_id, ruleset, ruleset_version, status, summary, started_at, completed_at, record_source)
select f.fixture_key, c.id, 'synthetic-cross-document', '1', 'completed', f.summary,
  timestamptz '2026-10-12 10:01:00+00', timestamptz '2026-10-12 10:01:01+00', 'synthetic'
from (values
  ('mei-demo-verification-1001', 'mei-demo-claim-1001', '{"label":"Synthetic consistent example","engine_ran":false}'::jsonb),
  ('mei-demo-verification-1003', 'mei-demo-claim-1003', '{"label":"Synthetic mismatch example","engine_ran":false}'::jsonb),
  ('mei-demo-verification-1005', 'mei-demo-claim-1005', '{"label":"Synthetic buyer dispute","engine_ran":false}'::jsonb)
) as f(fixture_key, claim_key, summary)
join public.claims c on c.fixture_key = f.claim_key
on conflict (fixture_key) do update set claim_id = excluded.claim_id, ruleset = excluded.ruleset,
  ruleset_version = excluded.ruleset_version, status = excluded.status, summary = excluded.summary,
  started_at = excluded.started_at, completed_at = excluded.completed_at, record_source = 'synthetic';

insert into public.verification_findings
  (fixture_key, verification_run_id, claim_id, rule_code, result, severity, field_key, evidence_summary, source_values, recommended_action, record_source)
select f.fixture_key, r.id, c.id, f.rule_code, f.result, f.severity, f.field_key,
  f.evidence_summary, f.source_values, f.recommended_action, 'synthetic'
from (values
  ('mei-demo-finding-1001-match', 'mei-demo-verification-1001', 'mei-demo-claim-1001', 'DOC.AMOUNT_MATCH', 'pass', 'none', 'invoice.amount', 'Synthetic invoice and PO values agree in this example.', '[{"source":"invoice","value":"845000.00"},{"source":"purchase_order","value":"845000.00"}]'::jsonb, 'Still obtain independent corroboration.'),
  ('mei-demo-finding-1003-quantity', 'mei-demo-verification-1003', 'mei-demo-claim-1003', 'DOC.QUANTITY_MISMATCH', 'fail', 'high', 'invoice.quantity', 'Synthetic invoice quantity differs from the delivery record.', '[{"source":"invoice","value":"1200"},{"source":"delivery_receipt","value":"1150"}]'::jsonb, 'Request supporting evidence and review the discrepancy.'),
  ('mei-demo-finding-1005-buyer', 'mei-demo-verification-1005', 'mei-demo-claim-1005', 'BUYER.DISPUTE', 'warning', 'high', null, 'A synthetic buyer dispute example is present.', '[]'::jsonb, 'Hold for authorized lender review.')
) as f(fixture_key, run_key, claim_key, rule_code, result, severity, field_key, evidence_summary, source_values, recommended_action)
join public.verification_runs r on r.fixture_key = f.run_key
join public.claims c on c.fixture_key = f.claim_key
on conflict (fixture_key) do update set verification_run_id = excluded.verification_run_id,
  claim_id = excluded.claim_id, rule_code = excluded.rule_code, result = excluded.result,
  severity = excluded.severity, field_key = excluded.field_key,
  evidence_summary = excluded.evidence_summary, source_values = excluded.source_values,
  recommended_action = excluded.recommended_action, record_source = 'synthetic';

insert into public.duplicate_candidates
  (fixture_key, verification_run_id, claim_id, candidate_claim_id, match_basis, similarity, match_evidence, disposition, record_source)
select f.fixture_key, r.id, source_claim.id, candidate.id, f.match_basis, f.similarity, f.evidence, 'candidate', 'synthetic'
from (values
  ('mei-demo-duplicate-1004', 'mei-demo-verification-1003', 'mei-demo-claim-1004', 'mei-demo-claim-1001', 'normalized_invoice_identity', 1.0000::numeric, '{"invoice_number":"same synthetic invoice identity"}'::jsonb),
  ('mei-demo-duplicate-1006', null, 'mei-demo-claim-1006', 'mei-demo-claim-1001', 'field_similarity', 0.9200::numeric, '{"reason":"synthetic participating-registry scenario"}'::jsonb)
) as f(fixture_key, run_key, source_key, candidate_key, match_basis, similarity, evidence)
left join public.verification_runs r on r.fixture_key = f.run_key
join public.claims source_claim on source_claim.fixture_key = f.source_key
join public.claims candidate on candidate.fixture_key = f.candidate_key
on conflict (fixture_key) do update set verification_run_id = excluded.verification_run_id,
  claim_id = excluded.claim_id, candidate_claim_id = excluded.candidate_claim_id,
  match_basis = excluded.match_basis, similarity = excluded.similarity,
  match_evidence = excluded.match_evidence, disposition = excluded.disposition, record_source = 'synthetic';

insert into public.claim_status_history
  (fixture_key, claim_id, previous_status, new_status, reason, record_source, created_at)
select f.fixture_key, c.id, f.previous_status, f.new_status, f.reason, 'synthetic', f.created_at
from (values
  ('mei-demo-status-1001-submit', 'mei-demo-claim-1001', null::text, 'submitted', 'Synthetic fixture submitted.', timestamptz '2026-10-10 09:00:00+00'),
  ('mei-demo-status-1001-ready', 'mei-demo-claim-1001', 'pending_buyer', 'ready_for_review', 'Synthetic fixture state; no service changed it.', timestamptz '2026-10-10 09:05:00+00'),
  ('mei-demo-status-1002-pending', 'mei-demo-claim-1002', 'submitted', 'pending_buyer', 'Synthetic buyer confirmation is pending.', timestamptz '2026-10-10 09:10:00+00'),
  ('mei-demo-status-1005-dispute', 'mei-demo-claim-1005', 'pending_buyer', 'disputed', 'Synthetic dispute fixture.', timestamptz '2026-10-10 09:15:00+00')
) as f(fixture_key, claim_key, previous_status, new_status, reason, created_at)
join public.claims c on c.fixture_key = f.claim_key
on conflict (fixture_key) do update set claim_id = excluded.claim_id, previous_status = excluded.previous_status,
  new_status = excluded.new_status, reason = excluded.reason, record_source = 'synthetic', created_at = excluded.created_at;

insert into public.claim_buyer_responses
  (claim_id, buyer_organization_id, actor_id, response, reason_code, comment, record_source)
select c.id, c.buyer_organization_id, null, 'disputed', 'delivery_quantity',
  'Synthetic buyer dispute fixture. No real buyer submitted this response.', 'synthetic'
from public.claims c where c.fixture_key = 'mei-demo-claim-1005'
  and not exists (select 1 from public.claim_buyer_responses r where r.claim_id = c.id and r.record_source = 'synthetic');

insert into public.claim_lender_reviews
  (claim_id, lender_organization_id, actor_id, decision, note, record_source)
select c.id, l.id, null, 'request_information',
  'Synthetic review example. No lender reviewed or approved this claim.', 'synthetic'
from public.claims c join public.organizations l on l.fixture_key = 'mei-demo-lender-a'
where c.fixture_key = 'mei-demo-claim-1003'
  and not exists (select 1 from public.claim_lender_reviews r where r.claim_id = c.id and r.record_source = 'synthetic');

insert into public.buyer_payment_records
  (fixture_key, buyer_organization_id, claim_id, invoice_reference, currency, amount,
   invoice_date, due_date, paid_date, outstanding_amount, source_type, source_reference, record_source)
select f.fixture_key, buyer.id, c.id, f.invoice_reference, 'INR', f.amount,
  f.invoice_date, f.due_date, f.paid_date, f.outstanding_amount,
  'synthetic', 'Synthetic sample; not imported from a buyer or accounting system.', 'synthetic'
from (values
  ('mei-demo-payment-001', 'mei-demo-claim-1001', 'MP-DEMO-HIST-001', 390000.00::numeric, date '2026-05-01', date '2026-05-31', date '2026-05-29', 0.00::numeric),
  ('mei-demo-payment-002', 'mei-demo-claim-1002', 'MP-DEMO-HIST-002', 210000.00::numeric, date '2026-06-01', date '2026-07-01', date '2026-07-08', 0.00::numeric),
  ('mei-demo-payment-003', 'mei-demo-claim-1003', 'MP-DEMO-HIST-003', 265000.00::numeric, date '2026-07-01', date '2026-07-31', null::date, 265000.00::numeric),
  ('mei-demo-payment-004', 'mei-demo-claim-1005', 'MP-DEMO-HIST-004', 320000.00::numeric, date '2026-08-01', date '2026-08-31', null::date, 320000.00::numeric)
) as f(fixture_key, claim_key, invoice_reference, amount, invoice_date, due_date, paid_date, outstanding_amount)
join public.organizations buyer on buyer.fixture_key = 'mei-demo-buyer'
left join public.claims c on c.fixture_key = f.claim_key
on conflict (fixture_key) do update set buyer_organization_id = excluded.buyer_organization_id,
  claim_id = excluded.claim_id, invoice_reference = excluded.invoice_reference,
  currency = excluded.currency, amount = excluded.amount, invoice_date = excluded.invoice_date,
  due_date = excluded.due_date, paid_date = excluded.paid_date,
  outstanding_amount = excluded.outstanding_amount, source_type = 'synthetic',
  source_reference = excluded.source_reference, record_source = 'synthetic';

insert into public.risk_assessments
  (fixture_key, claim_id, transaction_integrity_level,
   methodology, methodology_version, explanation, source_coverage, record_source)
select f.fixture_key, c.id, f.integrity, 'illustrative-rule-fixture', '1',
  f.explanation, f.coverage, 'synthetic'
from (values
  ('mei-demo-risk-1001', 'mei-demo-claim-1001', 'low', '{"label":"Illustrative transaction-integrity signals only; no model ran."}'::jsonb, '["synthetic invoice and PO fields"]'::jsonb),
  ('mei-demo-risk-1003', 'mei-demo-claim-1003', 'high', '{"label":"Synthetic quantity mismatch; not a fraud determination."}'::jsonb, '["synthetic invoice, PO, and delivery fields"]'::jsonb)
) as f(fixture_key, claim_key, integrity, explanation, coverage)
join public.claims c on c.fixture_key = f.claim_key
on conflict (fixture_key) do update set claim_id = excluded.claim_id,
  transaction_integrity_level = excluded.transaction_integrity_level,
  methodology = excluded.methodology,
  methodology_version = excluded.methodology_version, explanation = excluded.explanation,
  source_coverage = excluded.source_coverage, record_source = 'synthetic';

insert into public.risk_assessment_factors
  (fixture_key, assessment_id, dimension, factor_code, severity, explanation, source_references)
select f.fixture_key, r.id, f.dimension, f.factor_code, f.severity, f.explanation, f.source_references
from (values
  ('mei-demo-risk-factor-1001-coverage', 'mei-demo-risk-1001', 'transaction_integrity', 'EVIDENCE.COVERAGE', 'info', 'Source fields agree in this synthetic fixture; independent corroboration is still absent.', '["mei-demo-claim-1001"]'::jsonb),
  ('mei-demo-risk-factor-1003-mismatch', 'mei-demo-risk-1003', 'transaction_integrity', 'DOCUMENT.QUANTITY', 'high', 'Synthetic invoice and delivery quantities differ.', '["mei-demo-finding-1003-quantity"]'::jsonb)
) as f(fixture_key, assessment_key, dimension, factor_code, severity, explanation, source_references)
join public.risk_assessments r on r.fixture_key = f.assessment_key
on conflict (fixture_key) do update set assessment_id = excluded.assessment_id,
  dimension = excluded.dimension, factor_code = excluded.factor_code,
  severity = excluded.severity, explanation = excluded.explanation,
  source_references = excluded.source_references;

insert into public.buyer_payment_risk_assessments
  (fixture_key, claim_id, buyer_organization_id, risk_level, methodology,
   methodology_version, explanation, source_coverage, record_source)
select f.fixture_key, c.id, c.buyer_organization_id, f.risk_level,
  'illustrative-synthetic-payment-rules', '1', f.explanation, f.coverage, 'synthetic'
from (values
  ('mei-demo-payment-risk-1001', 'mei-demo-claim-1001', 'low', '{"label":"Synthetic sample payments only; not a credit score."}'::jsonb, '["mei-demo-payment-001","mei-demo-payment-002"]'::jsonb),
  ('mei-demo-payment-risk-1003', 'mei-demo-claim-1003', 'moderate', '{"label":"Synthetic overdue receivables only; not an external credit assessment."}'::jsonb, '["mei-demo-payment-003","mei-demo-payment-004"]'::jsonb)
) as f(fixture_key, claim_key, risk_level, explanation, coverage)
join public.claims c on c.fixture_key = f.claim_key
on conflict (fixture_key) do update set claim_id = excluded.claim_id,
  buyer_organization_id = excluded.buyer_organization_id, risk_level = excluded.risk_level,
  methodology = excluded.methodology, methodology_version = excluded.methodology_version,
  explanation = excluded.explanation, source_coverage = excluded.source_coverage, record_source = 'synthetic';

insert into public.buyer_payment_risk_factors
  (fixture_key, assessment_id, factor_code, severity, explanation, source_references)
select 'mei-demo-payment-risk-factor-overdue', r.id, 'PAYMENT.OVERDUE', 'moderate',
  'Synthetic outstanding receivables are shown for illustration.', '["mei-demo-payment-003","mei-demo-payment-004"]'::jsonb
from public.buyer_payment_risk_assessments r where r.fixture_key = 'mei-demo-payment-risk-1003'
on conflict (fixture_key) do update set assessment_id = excluded.assessment_id,
  factor_code = excluded.factor_code, severity = excluded.severity,
  explanation = excluded.explanation, source_references = excluded.source_references;

insert into public.registry_reservations
  (fixture_key, claim_id, lender_organization_id, actor_id, normalized_invoice_key,
   status, reservation_expires_at, financed_amount, record_source)
select 'mei-demo-reservation-1001', c.id, l.id, null,
  lower(regexp_replace(c.seller_organization_id::text || ':' || c.buyer_organization_id::text || ':' || trim(c.invoice_number), '\s+', '', 'g')),
  'reserved', timestamptz '2026-10-20 00:00:00+00', null, 'synthetic'
from public.claims c join public.organizations l on l.fixture_key = 'mei-demo-lender-a'
where c.fixture_key = 'mei-demo-claim-1001'
on conflict (fixture_key) do update set claim_id = excluded.claim_id,
  lender_organization_id = excluded.lender_organization_id, actor_id = null,
  normalized_invoice_key = excluded.normalized_invoice_key, status = 'reserved',
  reservation_expires_at = excluded.reservation_expires_at, financed_amount = null,
  record_source = 'synthetic';

insert into public.registry_reservation_events
  (fixture_key, reservation_id, event_type, previous_status, new_status, actor_id, note, record_source)
select 'mei-demo-reservation-event-1001', r.id, 'reserved', null, 'reserved', null,
  'Synthetic active reservation fixture. No real reservation was made.', 'synthetic'
from public.registry_reservations r where r.fixture_key = 'mei-demo-reservation-1001'
on conflict (fixture_key) do update set reservation_id = excluded.reservation_id,
  event_type = excluded.event_type, previous_status = excluded.previous_status,
  new_status = excluded.new_status, actor_id = null, note = excluded.note, record_source = 'synthetic';

insert into public.registry_checks
  (fixture_key, claim_id, lender_organization_id, actor_id, normalized_invoice_key, outcome, candidate_count, generic_message, record_source)
select 'mei-demo-registry-check-1006', c.id, l.id, null,
  lower(regexp_replace(c.seller_organization_id::text || ':' || c.buyer_organization_id::text || ':' || trim(c.invoice_number), '\s+', '', 'g')),
  'conflict', 1, 'Synthetic conflict fixture. No live registry check was made.', 'synthetic'
from public.claims c join public.organizations l on l.fixture_key = 'mei-demo-lender-b'
where c.fixture_key = 'mei-demo-claim-1006'
on conflict (fixture_key) do update set claim_id = excluded.claim_id,
  lender_organization_id = excluded.lender_organization_id, actor_id = null,
  normalized_invoice_key = excluded.normalized_invoice_key, outcome = excluded.outcome,
  candidate_count = excluded.candidate_count, generic_message = excluded.generic_message,
  record_source = 'synthetic';

insert into public.registry_conflicts
  (fixture_key, registry_check_id, conflict_fingerprint, conflict_status, generic_message, record_source)
select 'mei-demo-registry-conflict-1006', c.id, repeat('c', 64), 'reserved',
  'Synthetic participating-registry conflict. No other organization identity is disclosed.', 'synthetic'
from public.registry_checks c where c.fixture_key = 'mei-demo-registry-check-1006'
on conflict (fixture_key) do update set registry_check_id = excluded.registry_check_id,
  conflict_fingerprint = excluded.conflict_fingerprint, conflict_status = excluded.conflict_status,
  generic_message = excluded.generic_message, record_source = 'synthetic';

insert into public.audit_events (claim_id, actor_id, event_type, event_payload, record_source)
select c.id, null, f.event_type, f.event_payload, 'synthetic'
from (values
  ('mei-demo-claim-1001', 'claim_created', '{"label":"Synthetic claim created","source":"demo seed"}'::jsonb),
  ('mei-demo-claim-1001', 'document_added', '{"label":"Synthetic evidence metadata","file_bytes_present":false}'::jsonb),
  ('mei-demo-claim-1001', 'registry_checked', '{"label":"Synthetic registry event","service_ran":false}'::jsonb),
  ('mei-demo-claim-1005', 'buyer_responded', '{"label":"Synthetic dispute event","buyer_authenticated":false}'::jsonb),
  ('mei-demo-claim-1003', 'review_recorded', '{"label":"Synthetic review history","lender_authenticated":false}'::jsonb)
) as f(claim_key, event_type, event_payload)
join public.claims c on c.fixture_key = f.claim_key
where not exists (
  select 1 from public.audit_events e
  where e.claim_id = c.id and e.record_source = 'synthetic'
    and e.event_type = f.event_type and e.event_payload = f.event_payload
);

insert into public.chain_anchors
  (fixture_key, claim_id, anchor_type, manifest_hash, chain_id, contract_address,
   transaction_hash, block_number, status, anchored_at, record_source, demo_note)
select 'mei-demo-anchor-1001', c.id, 'submission_manifest', repeat('d', 64), 11155111,
  '0x' || repeat('1', 40), '0x' || repeat('2', 64), 12345678, 'anchored',
  timestamptz '2026-10-10 09:06:00+00', 'synthetic',
  'Synthetic placeholder only. No blockchain request or transaction occurred.'
from public.claims c where c.fixture_key = 'mei-demo-claim-1001'
on conflict (fixture_key) do update set claim_id = excluded.claim_id,
  anchor_type = excluded.anchor_type, manifest_hash = excluded.manifest_hash,
  chain_id = excluded.chain_id, contract_address = excluded.contract_address,
  transaction_hash = excluded.transaction_hash, block_number = excluded.block_number,
  status = excluded.status, anchored_at = excluded.anchored_at,
  record_source = 'synthetic', demo_note = excluded.demo_note;

insert into public.notifications
  (fixture_key, recipient_user_id, organization_id, claim_id, notification_type, title, body, route_key, record_source)
select f.fixture_key, null, recipient.id, c.id, f.notification_type, f.title, f.body, f.route_key, 'synthetic'
from (values
  ('mei-demo-notification-buyer-1002', 'mei-demo-buyer', 'mei-demo-claim-1002', 'buyer_response_needed', 'Demo: buyer response needed', 'A synthetic claim is awaiting a response.', 'inbox'),
  ('mei-demo-notification-lender-1003', 'mei-demo-lender-a', 'mei-demo-claim-1003', 'review_assigned', 'Demo: review requested', 'A synthetic discrepancy requires a review preview.', 'review-queue')
) as f(fixture_key, organization_key, claim_key, notification_type, title, body, route_key)
join public.organizations recipient on recipient.fixture_key = f.organization_key
join public.claims c on c.fixture_key = f.claim_key
on conflict (fixture_key) do update set organization_id = excluded.organization_id,
  claim_id = excluded.claim_id, notification_type = excluded.notification_type,
  title = excluded.title, body = excluded.body, route_key = excluded.route_key,
  recipient_user_id = null, record_source = 'synthetic';

commit;
