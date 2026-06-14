-- ============================================================
-- Grace CRM — schema only (generated from the live database)
-- 61 tables · 15 functions · 23 triggers · 123 RLS policies
-- Structure only — contains NO data.
-- Run top-to-bottom in a NEW Supabase project: SQL Editor → paste → Run.
-- ============================================================

SET check_function_bodies = false;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------- FUNCTIONS ----------

CREATE OR REPLACE FUNCTION public.anchor_bump_conversation_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE anchor_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.anchor_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.audit_logs_block_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only; UPDATE/DELETE are not permitted (op=%)', TG_OP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_pledge_fulfillment(pledge_uuid uuid)
 RETURNS TABLE(total_pledged numeric, total_given numeric, percentage numeric, remaining numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
  p pledges%ROWTYPE;
  total_pledged_amount DECIMAL;
  total_given_amount DECIMAL;
BEGIN
  SELECT * INTO p FROM pledges WHERE id = pledge_uuid;

  IF p.frequency = 'one-time' THEN
    total_pledged_amount := p.amount;
  ELSE
    -- Calculate based on frequency and date range
    total_pledged_amount := p.amount * (
      CASE p.frequency
        WHEN 'weekly' THEN CEIL((COALESCE(p.end_date, CURRENT_DATE) - p.start_date) / 7.0)
        WHEN 'monthly' THEN CEIL(EXTRACT(MONTH FROM AGE(COALESCE(p.end_date, CURRENT_DATE), p.start_date)) + 1)
        WHEN 'quarterly' THEN CEIL((EXTRACT(MONTH FROM AGE(COALESCE(p.end_date, CURRENT_DATE), p.start_date)) + 1) / 3.0)
        WHEN 'annually' THEN CEIL(EXTRACT(YEAR FROM AGE(COALESCE(p.end_date, CURRENT_DATE), p.start_date)) + 1)
        ELSE 1
      END
    );
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO total_given_amount
  FROM giving WHERE pledge_id = pledge_uuid;

  RETURN QUERY SELECT
    total_pledged_amount,
    total_given_amount,
    CASE WHEN total_pledged_amount > 0 THEN ROUND((total_given_amount / total_pledged_amount) * 100, 2) ELSE 0 END,
    GREATEST(total_pledged_amount - total_given_amount, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_church_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'church_id')::UUID;
$function$
;

CREATE OR REPLACE FUNCTION public.get_daily_digest_data(p_church_id uuid, p_date date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'birthdays', (
      SELECT json_agg(json_build_object(
        'id', id,
        'name', first_name || ' ' || last_name,
        'email', email,
        'phone', phone
      ))
      FROM people
      WHERE church_id = p_church_id
        AND EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM p_date)
        AND EXTRACT(DAY FROM birth_date) = EXTRACT(DAY FROM p_date)
    ),
    'scheduled_messages', (
      SELECT json_agg(json_build_object(
        'id', sm.id,
        'person_name', COALESCE(p.first_name || ' ' || p.last_name, 'Unknown'),
        'channel', sm.channel,
        'scheduled_for', sm.scheduled_for,
        'source_type', sm.source_type
      ))
      FROM scheduled_messages sm
      LEFT JOIN people p ON sm.person_id = p.id
      WHERE sm.church_id = p_church_id
        AND sm.status = 'scheduled'
        AND DATE(sm.scheduled_for) = p_date
    ),
    'pending_tasks', (
      SELECT json_agg(json_build_object(
        'id', t.id,
        'title', t.title,
        'priority', t.priority,
        'person_name', COALESCE(p.first_name || ' ' || p.last_name, NULL),
        'due_date', t.due_date
      ))
      FROM tasks t
      LEFT JOIN people p ON t.person_id = p.id
      WHERE t.church_id = p_church_id
        AND t.completed = false
        AND DATE(t.due_date) <= p_date
      ORDER BY t.priority DESC, t.due_date ASC
      LIMIT 20
    ),
    'new_inbound', (
      SELECT COUNT(*)
      FROM inbound_messages
      WHERE church_id = p_church_id
        AND status = 'new'
    )
  ) INTO result;

  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_pending_messages(p_church_id uuid)
 RETURNS TABLE(id uuid, person_id uuid, person_name text, channel character varying, subject character varying, body text, scheduled_for timestamp with time zone, source_type character varying)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    sm.id,
    sm.person_id,
    COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') as person_name,
    sm.channel,
    sm.subject,
    sm.body,
    sm.scheduled_for,
    sm.source_type
  FROM scheduled_messages sm
  LEFT JOIN people p ON sm.person_id = p.id
  WHERE sm.church_id = p_church_id
    AND sm.status = 'scheduled'
    AND sm.scheduled_for <= NOW()
  ORDER BY sm.scheduled_for ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_church_id()
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT church_id FROM users WHERE clerk_id = auth.jwt()->>'sub'
$function$
;

CREATE OR REPLACE FUNCTION public.insert_agent_log(p_church_id uuid, p_agent_id character varying, p_level character varying, p_message text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO agent_logs (church_id, agent_id, level, message, metadata)
  VALUES (p_church_id, p_agent_id, p_level, p_message, p_metadata)
  RETURNING id INTO v_log_id;

  -- Auto-cleanup: keep only last 1000 logs per church
  DELETE FROM agent_logs
  WHERE church_id = p_church_id
    AND id NOT IN (
      SELECT id FROM agent_logs
      WHERE church_id = p_church_id
      ORDER BY created_at DESC
      LIMIT 1000
    );

  RETURN v_log_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.interchange_events_block_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'interchange_events is append-only; UPDATE/DELETE are not permitted (op=%, id=%). Write a kind=reversal event instead.', TG_OP, OLD.id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ledger_entries_block_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only; UPDATE/DELETE are not permitted (op=%, id=%). Write a correction entry instead.', TG_OP, OLD.id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.token_usage_block_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'token_usage is append-only; UPDATE/DELETE are not permitted (op=%)', TG_OP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_church_subscriptions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_agent_stats(p_church_id uuid, p_agent_id character varying, p_actions_executed integer DEFAULT 0, p_actions_failed integer DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO agent_stats (church_id, agent_id, total_actions, successful_actions, failed_actions, last_run_at)
  VALUES (
    p_church_id,
    p_agent_id,
    p_actions_executed + p_actions_failed,
    p_actions_executed,
    p_actions_failed,
    NOW()
  )
  ON CONFLICT (church_id, agent_id) DO UPDATE SET
    total_actions = agent_stats.total_actions + EXCLUDED.total_actions,
    successful_actions = agent_stats.successful_actions + EXCLUDED.successful_actions,
    failed_actions = agent_stats.failed_actions + EXCLUDED.failed_actions,
    last_run_at = NOW(),
    updated_at = NOW();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

-- ---------- TABLES ----------

CREATE TABLE public.agent_executions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid,
    agent_id character varying(100) NOT NULL,
    status character varying(20) NOT NULL,
    dry_run boolean DEFAULT false,
    actions_executed integer DEFAULT 0,
    actions_failed integer DEFAULT 0,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE public.agent_logs (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid,
    agent_id character varying(100) NOT NULL,
    level character varying(20) NOT NULL,
    message text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.agent_stats (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid,
    agent_id character varying(100) NOT NULL,
    total_actions integer DEFAULT 0,
    successful_actions integer DEFAULT 0,
    failed_actions integer DEFAULT 0,
    last_run_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.ai_personas (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    leader_id uuid NOT NULL,
    name text NOT NULL,
    system_prompt text DEFAULT ''::text NOT NULL,
    tone jsonb DEFAULT '{"warmth": 7, "formality": 4, "directness": 5, "faithLevel": 6}'::jsonb NOT NULL,
    boundaries text[] DEFAULT '{}'::text[] NOT NULL,
    escalation_rules jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.anchor_ai_personas (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    leader_id uuid NOT NULL,
    system_prompt text NOT NULL,
    theology_positions jsonb DEFAULT '{}'::jsonb NOT NULL,
    stock_phrases text[] DEFAULT '{}'::text[] NOT NULL,
    anchor_verses text[] DEFAULT '{}'::text[] NOT NULL,
    tone_directness integer,
    tone_scripture_weight integer,
    tone_warmth integer,
    disclosure_message text DEFAULT 'I''m an AI companion trained on this leader''s notes and teaching. I can pray with you, talk through what you''re carrying, and book you in with the real person whenever you want.'::text NOT NULL,
    refuses_to_discuss text[] DEFAULT '{}'::text[] NOT NULL,
    always_recommend_human_for text[] DEFAULT '{crisis,abuse,suicide,self-harm}'::text[] NOT NULL,
    is_approved boolean DEFAULT false NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.anchor_conversations (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    leader_id uuid NOT NULL,
    person_id uuid,
    anonymous_session_id text,
    status text DEFAULT 'active'::text NOT NULL,
    topic text,
    crisis_flagged boolean DEFAULT false NOT NULL,
    crisis_flagged_at timestamp with time zone,
    handoff_pastoral_session_id uuid,
    last_message_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone
);

CREATE TABLE public.anchor_intake_responses (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid NOT NULL,
    topics text[] DEFAULT '{}'::text[] NOT NULL,
    tone_preference integer,
    gender_preference text,
    free_text text,
    matched_leader_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.anchor_leader_applications (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    display_name text NOT NULL,
    email text NOT NULL,
    phone text,
    role text,
    audience_url text,
    audience_size text,
    expertise_areas text[] DEFAULT '{}'::text[] NOT NULL,
    bio text,
    motivation text,
    status text DEFAULT 'submitted'::text NOT NULL,
    status_notes text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    anchor_leader_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.anchor_leader_visibility (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    leader_id uuid NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    override_ai_chat_price_cents integer,
    override_human_session_price_cents integer,
    added_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.anchor_leaders (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    source_application_id uuid,
    source_church_id uuid,
    display_name text NOT NULL,
    title text NOT NULL,
    bio text NOT NULL,
    photo_url text,
    intro_video_url text,
    expertise_areas text[] DEFAULT '{}'::text[] NOT NULL,
    credentials text[] DEFAULT '{}'::text[] NOT NULL,
    years_of_practice integer,
    personality_traits text[] DEFAULT '{}'::text[] NOT NULL,
    spiritual_focus_areas text[] DEFAULT '{}'::text[] NOT NULL,
    language text DEFAULT 'English'::text NOT NULL,
    gender text,
    denomination text,
    anchor_verse text,
    is_verified boolean DEFAULT false NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    is_accepting_new_conversations boolean DEFAULT true NOT NULL,
    ai_chat_price_cents integer DEFAULT 0 NOT NULL,
    human_session_price_cents integer DEFAULT 0 NOT NULL,
    total_conversations integer DEFAULT 0 NOT NULL,
    total_sessions_completed integer DEFAULT 0 NOT NULL,
    rating_avg numeric(3,2),
    rating_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.anchor_messages (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    sender text NOT NULL,
    content text NOT NULL,
    is_disclosure boolean DEFAULT false NOT NULL,
    is_handoff_offer boolean DEFAULT false NOT NULL,
    is_crisis_flag boolean DEFAULT false NOT NULL,
    model text,
    prompt_tokens integer,
    completion_tokens integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.attendance (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid NOT NULL,
    event_id uuid,
    event_type text NOT NULL,
    event_name text,
    date date NOT NULL,
    checked_in_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.audit_logs (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid,
    actor_user_id uuid,
    actor_clerk_id text,
    actor_role text,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    before jsonb,
    after jsonb,
    route text,
    method text,
    ip_address inet,
    user_agent text,
    request_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.automation_events (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    rule_id uuid NOT NULL,
    person_id uuid,
    triggered_at timestamp with time zone DEFAULT now(),
    result text,
    details text
);

CREATE TABLE public.automation_rules (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    trigger_type text NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    action_type text NOT NULL,
    action_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_run_at timestamp with time zone,
    run_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.batch_items (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    batch_id uuid NOT NULL,
    person_id uuid,
    amount numeric(10,2) NOT NULL,
    method character varying(20) NOT NULL,
    fund character varying(50) DEFAULT 'tithe'::character varying,
    check_number character varying(50),
    memo text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.calendar_events (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone,
    all_day boolean DEFAULT false NOT NULL,
    location text,
    category text DEFAULT 'other'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.campaigns (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    goal_amount numeric(12,2),
    start_date date NOT NULL,
    end_date date,
    fund character varying(50) DEFAULT 'other'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.cards (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    cardholder_person_id uuid,
    kyc_verification_id uuid,
    i2c_card_id text NOT NULL,
    masked_pan text NOT NULL,
    cardholder_name text NOT NULL,
    expiry_month integer NOT NULL,
    expiry_year integer NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    daily_limit_micro_usd bigint DEFAULT 500000000 NOT NULL,
    monthly_limit_micro_usd bigint DEFAULT '5000000000'::bigint NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    activated_at timestamp with time zone,
    frozen_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.church_agent_settings (
    church_id uuid NOT NULL,
    member_care_enabled boolean DEFAULT true NOT NULL,
    stewardship_enabled boolean DEFAULT true NOT NULL,
    operations_enabled boolean DEFAULT true NOT NULL,
    member_care_inactive_days integer DEFAULT 30 NOT NULL,
    member_care_birthday_window_days integer DEFAULT 7 NOT NULL,
    stewardship_lapsed_days integer DEFAULT 60 NOT NULL,
    stewardship_large_gift_micro_usd bigint DEFAULT 1000000000 NOT NULL,
    stewardship_flag_first_time_gift boolean DEFAULT true NOT NULL,
    operations_event_no_leader_days integer DEFAULT 7 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_clerk_id text
);

CREATE TABLE public.church_ai_budgets (
    church_id uuid NOT NULL,
    monthly_cap_micro_usd bigint DEFAULT 50000000 NOT NULL,
    hard_cutoff_multiplier numeric(4,2) DEFAULT 1.10 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_clerk_id text
);

CREATE TABLE public.church_subscriptions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    stripe_subscription_id text NOT NULL,
    stripe_customer_id text NOT NULL,
    stripe_price_id text NOT NULL,
    plan_slug text NOT NULL,
    status text NOT NULL,
    current_period_start timestamp with time zone NOT NULL,
    current_period_end timestamp with time zone NOT NULL,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    canceled_at timestamp with time zone,
    trial_start timestamp with time zone,
    trial_end timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.churches (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    email text,
    phone text,
    address text,
    city text,
    state text,
    zip text,
    website text,
    logo_url text,
    timezone text DEFAULT 'America/New_York'::text NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    stripe_customer_id text,
    subscription_status text,
    subscription_plan text,
    trial_ends_at timestamp with time zone,
    stripe_connect_account_id text,
    stripe_connect_onboarded_at timestamp with time zone,
    stripe_connect_charges_enabled boolean DEFAULT false NOT NULL,
    stripe_connect_payouts_enabled boolean DEFAULT false NOT NULL,
    stripe_connect_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    tax_ein text
);

CREATE TABLE public.crisis_alerts (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    protocol_id uuid,
    trigger_type text NOT NULL,
    trigger_detail text,
    severity text DEFAULT 'high'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.crisis_protocols (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    name text NOT NULL,
    trigger_keywords text[] DEFAULT '{}'::text[] NOT NULL,
    trigger_sentiment_threshold numeric(3,2) DEFAULT 0.3,
    immediate_response text DEFAULT ''::text NOT NULL,
    resources jsonb DEFAULT '[]'::jsonb NOT NULL,
    notify_staff boolean DEFAULT true NOT NULL,
    notify_leader boolean DEFAULT true NOT NULL,
    escalate_immediately boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.daily_digests (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    user_id uuid,
    digest_date date NOT NULL,
    priority_tasks jsonb DEFAULT '[]'::jsonb NOT NULL,
    people_to_contact jsonb DEFAULT '[]'::jsonb NOT NULL,
    messages_to_send jsonb DEFAULT '[]'::jsonb NOT NULL,
    birthdays_today jsonb DEFAULT '[]'::jsonb NOT NULL,
    follow_ups_due jsonb DEFAULT '[]'::jsonb NOT NULL,
    ai_summary text,
    ai_recommendations jsonb DEFAULT '[]'::jsonb,
    generated_at timestamp with time zone DEFAULT now(),
    viewed_at timestamp with time zone
);

CREATE TABLE public.donation_batches (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    batch_date date NOT NULL,
    batch_name character varying(255),
    status character varying(20) DEFAULT 'open'::character varying,
    total_cash numeric(10,2) DEFAULT 0,
    total_checks numeric(10,2) DEFAULT 0,
    total_amount numeric(10,2) DEFAULT 0,
    check_count integer DEFAULT 0,
    notes text,
    created_by uuid,
    closed_by uuid,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.donor_portal_tokens (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    email text NOT NULL,
    token_hash text NOT NULL,
    consumed_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_ip text,
    request_ua text
);

CREATE TABLE public.drip_campaign_enrollments (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    person_id uuid NOT NULL,
    current_step integer DEFAULT 1 NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying,
    enrolled_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    next_message_at timestamp with time zone
);

CREATE TABLE public.drip_campaign_steps (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    step_number integer NOT NULL,
    delay_days integer DEFAULT 0 NOT NULL,
    delay_hours integer DEFAULT 0 NOT NULL,
    channel character varying(20) NOT NULL,
    subject character varying(255),
    body text NOT NULL,
    use_ai_personalization boolean DEFAULT false,
    ai_prompt text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.drip_campaigns (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    trigger_type character varying(30) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.email_outbox (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid,
    idempotency_key text NOT NULL,
    to_addr text NOT NULL,
    from_addr text NOT NULL,
    subject text NOT NULL,
    template_id text NOT NULL,
    html_body text NOT NULL,
    text_body text,
    status text DEFAULT 'queued'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    provider text,
    provider_message_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    queued_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    failed_at timestamp with time zone
);

CREATE TABLE public.email_templates (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    name text NOT NULL,
    subject text DEFAULT ''::text NOT NULL,
    blocks jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.giving (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid,
    amount numeric(10,2) NOT NULL,
    fund text DEFAULT 'tithe'::text NOT NULL,
    date date NOT NULL,
    method text DEFAULT 'cash'::text NOT NULL,
    is_recurring boolean DEFAULT false NOT NULL,
    stripe_payment_id text,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    batch_id uuid,
    pledge_id uuid,
    campaign_id uuid
);

CREATE TABLE public.giving_statements (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid,
    year integer NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    by_fund jsonb DEFAULT '{}'::jsonb,
    generated_at timestamp with time zone DEFAULT now(),
    sent_at timestamp with time zone,
    sent_method character varying(20),
    pdf_url text
);

CREATE TABLE public.grace_inbox_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid,
    source text DEFAULT 'agentmail'::text NOT NULL,
    source_message_id text NOT NULL,
    source_thread_id text,
    source_inbox_id text,
    from_email text NOT NULL,
    subject text,
    preview text,
    body_text text,
    parsed_actions jsonb DEFAULT '[]'::jsonb NOT NULL,
    seen_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    executed_action_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    flag text,
    auto_handled_at timestamp with time zone,
    auto_summary text,
    reply_sent_at timestamp with time zone
);

CREATE TABLE public.group_memberships (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    group_id uuid NOT NULL,
    person_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.help_requests (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    category text NOT NULL,
    description text,
    is_anonymous boolean DEFAULT false NOT NULL,
    anonymous_id text,
    person_id uuid,
    assigned_leader_id uuid,
    assigned_persona_id uuid,
    conversation_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    source text DEFAULT 'web'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone
);

CREATE TABLE public.inbound_messages (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid,
    channel character varying(20) NOT NULL,
    from_address character varying(255) NOT NULL,
    subject character varying(255),
    body text NOT NULL,
    ai_category character varying(30),
    ai_sentiment character varying(20),
    ai_suggested_response text,
    ai_confidence numeric(3,2),
    status character varying(20) DEFAULT 'new'::character varying,
    replied_at timestamp with time zone,
    replied_by uuid,
    in_reply_to uuid,
    received_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.interactions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid NOT NULL,
    type text NOT NULL,
    content text NOT NULL,
    created_by uuid,
    created_by_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.interchange_events (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    card_id uuid,
    i2c_event_id text NOT NULL,
    event_type text NOT NULL,
    direction text NOT NULL,
    amount_micro_usd bigint NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    merchant_name text,
    merchant_category text,
    decline_reason text,
    ledger_entry_id uuid,
    occurred_at timestamp with time zone NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.kyc_verifications (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid,
    full_name text NOT NULL,
    date_of_birth date NOT NULL,
    email text NOT NULL,
    phone text,
    status text DEFAULT 'pending'::text NOT NULL,
    i2c_kyc_id text,
    rejection_reason text,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    expires_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.leader_applications (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid,
    display_name text NOT NULL,
    title text NOT NULL,
    bio text,
    photo_url text,
    email text,
    phone text,
    expertise_areas text[] DEFAULT '{}'::text[] NOT NULL,
    credentials text[] DEFAULT '{}'::text[] NOT NULL,
    years_of_practice integer,
    personality_traits text[] DEFAULT '{}'::text[] NOT NULL,
    spiritual_focus_areas text[] DEFAULT '{}'::text[] NOT NULL,
    suitable_for text[] DEFAULT '{}'::text[] NOT NULL,
    language text DEFAULT 'English'::text NOT NULL,
    anchor_verse text,
    session_type text DEFAULT 'one-time'::text NOT NULL,
    session_frequency text DEFAULT 'Weekly'::text,
    status text DEFAULT 'submitted'::text NOT NULL,
    status_notes text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    approved_by uuid,
    approved_at timestamp with time zone,
    background_check_status text DEFAULT 'not_started'::text,
    background_check_date date,
    training_completed boolean DEFAULT false NOT NULL,
    training_completed_date date,
    training_modules_done text[] DEFAULT '{}'::text[] NOT NULL,
    reference_contacts jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.leader_availability (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    leader_id text NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.leader_profiles (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid NOT NULL,
    display_name text NOT NULL,
    title text,
    bio text,
    photo_url text,
    expertise_areas text[] DEFAULT '{}'::text[] NOT NULL,
    is_available boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.ledger_entries (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    source text NOT NULL,
    source_event_id text NOT NULL,
    kind text NOT NULL,
    direction text NOT NULL,
    amount_micro_usd bigint NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    description text,
    related_giving_id uuid,
    related_person_id uuid,
    occurred_at timestamp with time zone NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.message_archive (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid,
    scheduled_message_id uuid,
    channel character varying(20) NOT NULL,
    direction character varying(10) NOT NULL,
    subject character varying(255),
    body text NOT NULL,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    opened_at timestamp with time zone,
    clicked_at timestamp with time zone,
    replied_at timestamp with time zone,
    provider character varying(20),
    external_id character varying(255),
    status character varying(20) DEFAULT 'sent'::character varying,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.pastoral_conversations (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    help_request_id uuid NOT NULL,
    persona_id uuid,
    leader_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    category text NOT NULL,
    is_anonymous boolean DEFAULT false NOT NULL,
    anonymous_id text,
    person_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone
);

CREATE TABLE public.pastoral_messages (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    sender text NOT NULL,
    sender_name text NOT NULL,
    content text NOT NULL,
    ai_confidence numeric(3,2),
    flagged boolean DEFAULT false,
    flag_reason text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.pastoral_sessions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    leader_id text NOT NULL,
    person_id uuid,
    help_request_id text,
    category text NOT NULL,
    session_type text DEFAULT 'chat'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    duration_minutes integer,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    follow_up_needed boolean DEFAULT false NOT NULL,
    follow_up_date date,
    rating integer,
    feedback text,
    is_anonymous boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.people (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    phone text,
    status text DEFAULT 'visitor'::text NOT NULL,
    photo_url text,
    address text,
    city text,
    state text,
    zip text,
    birth_date date,
    join_date date,
    first_visit date,
    notes text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    family_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.pledges (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid,
    campaign_id uuid,
    amount numeric(10,2) NOT NULL,
    frequency character varying(20) DEFAULT 'one-time'::character varying,
    start_date date NOT NULL,
    end_date date,
    fund character varying(50) DEFAULT 'tithe'::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.prayer_requests (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid NOT NULL,
    content text NOT NULL,
    is_private boolean DEFAULT false NOT NULL,
    is_answered boolean DEFAULT false NOT NULL,
    testimony text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.recurring_giving (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid,
    amount numeric(10,2) NOT NULL,
    frequency character varying(20) NOT NULL,
    fund character varying(50) DEFAULT 'tithe'::character varying,
    next_date date NOT NULL,
    stripe_subscription_id character varying(255),
    stripe_customer_id character varying(255),
    payment_method_last4 character varying(4),
    payment_method_brand character varying(20),
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.scheduled_messages (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid,
    channel character varying(20) NOT NULL,
    subject character varying(255),
    body text NOT NULL,
    scheduled_for timestamp with time zone NOT NULL,
    sent_at timestamp with time zone,
    status character varying(20) DEFAULT 'scheduled'::character varying,
    source_type character varying(30) NOT NULL,
    source_agent character varying(50),
    campaign_id uuid,
    ai_generated boolean DEFAULT false,
    ai_prompt text,
    external_message_id character varying(255),
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.small_groups (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    leader_id uuid,
    meeting_day text,
    meeting_time text,
    location text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.tasks (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid,
    title text NOT NULL,
    description text,
    due_date date NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    priority text DEFAULT 'medium'::text NOT NULL,
    category text DEFAULT 'follow-up'::text NOT NULL,
    assigned_to uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.token_usage (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid,
    provider text NOT NULL,
    model text NOT NULL,
    feature text NOT NULL,
    prompt_tokens integer NOT NULL,
    completion_tokens integer NOT NULL,
    total_tokens integer GENERATED ALWAYS AS ((prompt_tokens + completion_tokens)) STORED,
    cost_micro_usd bigint NOT NULL,
    success boolean NOT NULL,
    error_code text,
    latency_ms integer,
    request_id text,
    actor_clerk_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.users (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    church_id uuid,
    clerk_id text,
    email text NOT NULL,
    first_name text,
    last_name text,
    role text DEFAULT 'volunteer'::text NOT NULL,
    avatar_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.webhook_dlq (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    webhook_event_id uuid NOT NULL,
    source text NOT NULL,
    event_type text NOT NULL,
    church_id uuid,
    error_message text NOT NULL,
    error_class text,
    error_stack text,
    attempt_count integer DEFAULT 1 NOT NULL,
    first_failed_at timestamp with time zone DEFAULT now() NOT NULL,
    last_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    next_retry_at timestamp with time zone,
    resolved boolean DEFAULT false NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by_clerk_id text,
    resolution_note text
);

CREATE TABLE public.webhook_events (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    source text NOT NULL,
    source_event_id text NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'received'::text NOT NULL,
    processing_error text,
    church_id uuid,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone
);

-- ---------- PRIMARY KEYS / UNIQUE / CHECK ----------

ALTER TABLE ONLY public.agent_executions ADD CONSTRAINT agent_executions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.agent_executions ADD CONSTRAINT agent_executions_status_check CHECK (((status)::text = ANY ((ARRAY['running'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])));

ALTER TABLE ONLY public.agent_logs ADD CONSTRAINT agent_logs_level_check CHECK (((level)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'error'::character varying])::text[])));

ALTER TABLE ONLY public.agent_logs ADD CONSTRAINT agent_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.agent_stats ADD CONSTRAINT agent_stats_church_id_agent_id_key UNIQUE (church_id, agent_id);

ALTER TABLE ONLY public.agent_stats ADD CONSTRAINT agent_stats_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_personas ADD CONSTRAINT ai_personas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anchor_ai_personas ADD CONSTRAINT anchor_ai_personas_leader_id_key UNIQUE (leader_id);

ALTER TABLE ONLY public.anchor_ai_personas ADD CONSTRAINT anchor_ai_personas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anchor_ai_personas ADD CONSTRAINT anchor_ai_personas_tone_directness_check CHECK (((tone_directness >= 1) AND (tone_directness <= 10)));

ALTER TABLE ONLY public.anchor_ai_personas ADD CONSTRAINT anchor_ai_personas_tone_scripture_weight_check CHECK (((tone_scripture_weight >= 1) AND (tone_scripture_weight <= 10)));

ALTER TABLE ONLY public.anchor_ai_personas ADD CONSTRAINT anchor_ai_personas_tone_warmth_check CHECK (((tone_warmth >= 1) AND (tone_warmth <= 10)));

ALTER TABLE ONLY public.anchor_conversations ADD CONSTRAINT anchor_conversations_check CHECK (((person_id IS NOT NULL) OR (anonymous_session_id IS NOT NULL)));

ALTER TABLE ONLY public.anchor_conversations ADD CONSTRAINT anchor_conversations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anchor_conversations ADD CONSTRAINT anchor_conversations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'idle'::text, 'handoff_offered'::text, 'handoff_accepted'::text, 'closed'::text, 'archived'::text])));

ALTER TABLE ONLY public.anchor_intake_responses ADD CONSTRAINT anchor_intake_responses_gender_preference_check CHECK ((gender_preference = ANY (ARRAY['male'::text, 'female'::text, 'no_preference'::text])));

ALTER TABLE ONLY public.anchor_intake_responses ADD CONSTRAINT anchor_intake_responses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anchor_intake_responses ADD CONSTRAINT anchor_intake_responses_tone_preference_check CHECK (((tone_preference >= 1) AND (tone_preference <= 10)));

ALTER TABLE ONLY public.anchor_leader_applications ADD CONSTRAINT anchor_leader_applications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anchor_leader_applications ADD CONSTRAINT anchor_leader_applications_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'reviewing'::text, 'approved'::text, 'rejected'::text])));

ALTER TABLE ONLY public.anchor_leader_visibility ADD CONSTRAINT anchor_leader_visibility_church_id_leader_id_key UNIQUE (church_id, leader_id);

ALTER TABLE ONLY public.anchor_leader_visibility ADD CONSTRAINT anchor_leader_visibility_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anchor_leaders ADD CONSTRAINT anchor_leaders_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'non-binary'::text, 'unspecified'::text])));

ALTER TABLE ONLY public.anchor_leaders ADD CONSTRAINT anchor_leaders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anchor_messages ADD CONSTRAINT anchor_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anchor_messages ADD CONSTRAINT anchor_messages_sender_check CHECK ((sender = ANY (ARRAY['member'::text, 'ai_clone'::text, 'human_leader'::text, 'system'::text])));

ALTER TABLE ONLY public.attendance ADD CONSTRAINT attendance_event_type_check CHECK ((event_type = ANY (ARRAY['sunday'::text, 'wednesday'::text, 'small-group'::text, 'special'::text])));

ALTER TABLE ONLY public.attendance ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.audit_logs ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.automation_events ADD CONSTRAINT automation_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.automation_events ADD CONSTRAINT automation_events_result_check CHECK ((result = ANY (ARRAY['success'::text, 'failure'::text, 'skipped'::text])));

ALTER TABLE ONLY public.automation_rules ADD CONSTRAINT automation_rules_action_type_check CHECK ((action_type = ANY (ARRAY['create_task'::text, 'send_email'::text, 'send_sms'::text, 'add_tag'::text, 'change_status'::text, 'notify_staff'::text])));

ALTER TABLE ONLY public.automation_rules ADD CONSTRAINT automation_rules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.automation_rules ADD CONSTRAINT automation_rules_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['new_visitor'::text, 'inactive_member'::text, 'missed_sundays'::text, 'birthday'::text, 'follow_up_overdue'::text, 'custom'::text])));

ALTER TABLE ONLY public.batch_items ADD CONSTRAINT batch_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.calendar_events ADD CONSTRAINT calendar_events_category_check CHECK ((category = ANY (ARRAY['service'::text, 'meeting'::text, 'event'::text, 'small-group'::text, 'holiday'::text, 'wedding'::text, 'funeral'::text, 'baptism'::text, 'dedication'::text, 'counseling'::text, 'rehearsal'::text, 'outreach'::text, 'class'::text, 'other'::text])));

ALTER TABLE ONLY public.calendar_events ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.campaigns ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cards ADD CONSTRAINT cards_expiry_month_check CHECK (((expiry_month >= 1) AND (expiry_month <= 12)));

ALTER TABLE ONLY public.cards ADD CONSTRAINT cards_expiry_year_check CHECK (((expiry_year >= 2024) AND (expiry_year <= 2099)));

ALTER TABLE ONLY public.cards ADD CONSTRAINT cards_i2c_card_id_key UNIQUE (i2c_card_id);

ALTER TABLE ONLY public.cards ADD CONSTRAINT cards_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cards ADD CONSTRAINT cards_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'frozen'::text, 'cancelled'::text, 'expired'::text])));

ALTER TABLE ONLY public.church_agent_settings ADD CONSTRAINT church_agent_settings_member_care_birthday_window_days_check CHECK (((member_care_birthday_window_days >= 0) AND (member_care_birthday_window_days <= 30)));

ALTER TABLE ONLY public.church_agent_settings ADD CONSTRAINT church_agent_settings_member_care_inactive_days_check CHECK (((member_care_inactive_days >= 7) AND (member_care_inactive_days <= 365)));

ALTER TABLE ONLY public.church_agent_settings ADD CONSTRAINT church_agent_settings_operations_event_no_leader_days_check CHECK (((operations_event_no_leader_days >= 1) AND (operations_event_no_leader_days <= 60)));

ALTER TABLE ONLY public.church_agent_settings ADD CONSTRAINT church_agent_settings_pkey PRIMARY KEY (church_id);

ALTER TABLE ONLY public.church_agent_settings ADD CONSTRAINT church_agent_settings_stewardship_lapsed_days_check CHECK (((stewardship_lapsed_days >= 14) AND (stewardship_lapsed_days <= 365)));

ALTER TABLE ONLY public.church_agent_settings ADD CONSTRAINT church_agent_settings_stewardship_large_gift_micro_usd_check CHECK ((stewardship_large_gift_micro_usd > 0));

ALTER TABLE ONLY public.church_ai_budgets ADD CONSTRAINT church_ai_budgets_hard_cutoff_multiplier_check CHECK (((hard_cutoff_multiplier >= 1.0) AND (hard_cutoff_multiplier <= 5.0)));

ALTER TABLE ONLY public.church_ai_budgets ADD CONSTRAINT church_ai_budgets_monthly_cap_micro_usd_check CHECK ((monthly_cap_micro_usd >= 0));

ALTER TABLE ONLY public.church_ai_budgets ADD CONSTRAINT church_ai_budgets_pkey PRIMARY KEY (church_id);

ALTER TABLE ONLY public.church_subscriptions ADD CONSTRAINT church_subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.church_subscriptions ADD CONSTRAINT church_subscriptions_plan_slug_check CHECK ((plan_slug = ANY (ARRAY['starter'::text, 'pro'::text, 'enterprise'::text])));

ALTER TABLE ONLY public.church_subscriptions ADD CONSTRAINT church_subscriptions_status_check CHECK ((status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'canceled'::text, 'unpaid'::text, 'incomplete'::text, 'incomplete_expired'::text])));

ALTER TABLE ONLY public.church_subscriptions ADD CONSTRAINT church_subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);

ALTER TABLE ONLY public.churches ADD CONSTRAINT churches_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.churches ADD CONSTRAINT churches_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.churches ADD CONSTRAINT churches_subscription_plan_check CHECK (((subscription_plan IS NULL) OR (subscription_plan = ANY (ARRAY['starter'::text, 'pro'::text, 'enterprise'::text]))));

ALTER TABLE ONLY public.churches ADD CONSTRAINT churches_subscription_status_check CHECK (((subscription_status IS NULL) OR (subscription_status = ANY (ARRAY['trial'::text, 'active'::text, 'past_due'::text, 'canceled'::text, 'unpaid'::text, 'incomplete'::text, 'incomplete_expired'::text]))));

ALTER TABLE ONLY public.crisis_alerts ADD CONSTRAINT crisis_alerts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.crisis_alerts ADD CONSTRAINT crisis_alerts_severity_check CHECK ((severity = ANY (ARRAY['medium'::text, 'high'::text, 'critical'::text])));

ALTER TABLE ONLY public.crisis_alerts ADD CONSTRAINT crisis_alerts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'acknowledged'::text, 'resolved'::text, 'false-positive'::text])));

ALTER TABLE ONLY public.crisis_alerts ADD CONSTRAINT crisis_alerts_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['keyword'::text, 'sentiment'::text, 'manual'::text, 'auto-detect'::text])));

ALTER TABLE ONLY public.crisis_protocols ADD CONSTRAINT crisis_protocols_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.daily_digests ADD CONSTRAINT daily_digests_church_id_user_id_digest_date_key UNIQUE (church_id, user_id, digest_date);

ALTER TABLE ONLY public.daily_digests ADD CONSTRAINT daily_digests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.donation_batches ADD CONSTRAINT donation_batches_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.donor_portal_tokens ADD CONSTRAINT donor_portal_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.donor_portal_tokens ADD CONSTRAINT donor_portal_tokens_token_hash_key UNIQUE (token_hash);

ALTER TABLE ONLY public.drip_campaign_enrollments ADD CONSTRAINT drip_campaign_enrollments_campaign_id_person_id_key UNIQUE (campaign_id, person_id);

ALTER TABLE ONLY public.drip_campaign_enrollments ADD CONSTRAINT drip_campaign_enrollments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.drip_campaign_enrollments ADD CONSTRAINT drip_campaign_enrollments_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'completed'::character varying, 'paused'::character varying, 'cancelled'::character varying])::text[])));

ALTER TABLE ONLY public.drip_campaign_steps ADD CONSTRAINT drip_campaign_steps_campaign_id_step_number_key UNIQUE (campaign_id, step_number);

ALTER TABLE ONLY public.drip_campaign_steps ADD CONSTRAINT drip_campaign_steps_channel_check CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'sms'::character varying, 'both'::character varying])::text[])));

ALTER TABLE ONLY public.drip_campaign_steps ADD CONSTRAINT drip_campaign_steps_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.drip_campaigns ADD CONSTRAINT drip_campaigns_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.drip_campaigns ADD CONSTRAINT drip_campaigns_trigger_type_check CHECK (((trigger_type)::text = ANY ((ARRAY['new_member'::character varying, 'new_visitor'::character varying, 'donation'::character varying, 'event_registration'::character varying, 'manual'::character varying])::text[])));

ALTER TABLE ONLY public.email_outbox ADD CONSTRAINT email_outbox_idempotency_key_key UNIQUE (idempotency_key);

ALTER TABLE ONLY public.email_outbox ADD CONSTRAINT email_outbox_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_outbox ADD CONSTRAINT email_outbox_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'failed'::text, 'skipped'::text])));

ALTER TABLE ONLY public.email_templates ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.giving ADD CONSTRAINT giving_amount_check CHECK ((amount > (0)::numeric));

ALTER TABLE ONLY public.giving ADD CONSTRAINT giving_fund_check CHECK ((fund = ANY (ARRAY['tithe'::text, 'offering'::text, 'missions'::text, 'building'::text, 'benevolence'::text, 'other'::text])));

ALTER TABLE ONLY public.giving ADD CONSTRAINT giving_method_check CHECK ((method = ANY (ARRAY['cash'::text, 'check'::text, 'card'::text, 'online'::text, 'bank'::text])));

ALTER TABLE ONLY public.giving ADD CONSTRAINT giving_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.giving_statements ADD CONSTRAINT giving_statements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.grace_inbox_messages ADD CONSTRAINT grace_inbox_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.grace_inbox_messages ADD CONSTRAINT grace_inbox_messages_source_source_message_id_key UNIQUE (source, source_message_id);

ALTER TABLE ONLY public.group_memberships ADD CONSTRAINT group_memberships_group_id_person_id_key UNIQUE (group_id, person_id);

ALTER TABLE ONLY public.group_memberships ADD CONSTRAINT group_memberships_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.help_requests ADD CONSTRAINT help_requests_category_check CHECK ((category = ANY (ARRAY['marriage'::text, 'addiction'::text, 'grief'::text, 'faith-questions'::text, 'crisis'::text, 'financial'::text, 'anxiety-depression'::text, 'parenting'::text, 'general'::text])));

ALTER TABLE ONLY public.help_requests ADD CONSTRAINT help_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.help_requests ADD CONSTRAINT help_requests_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'crisis'::text])));

ALTER TABLE ONLY public.help_requests ADD CONSTRAINT help_requests_source_check CHECK ((source = ANY (ARRAY['web'::text, 'sms'::text, 'app'::text, 'kiosk'::text])));

ALTER TABLE ONLY public.help_requests ADD CONSTRAINT help_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'resolved'::text, 'cancelled'::text])));

ALTER TABLE ONLY public.inbound_messages ADD CONSTRAINT inbound_messages_ai_category_check CHECK (((ai_category)::text = ANY ((ARRAY['question'::character varying, 'thanks'::character varying, 'concern'::character varying, 'prayer_request'::character varying, 'event_rsvp'::character varying, 'unsubscribe'::character varying, 'spam'::character varying, 'other'::character varying])::text[])));

ALTER TABLE ONLY public.inbound_messages ADD CONSTRAINT inbound_messages_ai_sentiment_check CHECK (((ai_sentiment)::text = ANY ((ARRAY['positive'::character varying, 'neutral'::character varying, 'negative'::character varying, 'urgent'::character varying])::text[])));

ALTER TABLE ONLY public.inbound_messages ADD CONSTRAINT inbound_messages_channel_check CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'sms'::character varying])::text[])));

ALTER TABLE ONLY public.inbound_messages ADD CONSTRAINT inbound_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.inbound_messages ADD CONSTRAINT inbound_messages_status_check CHECK (((status)::text = ANY ((ARRAY['new'::character varying, 'read'::character varying, 'replied'::character varying, 'archived'::character varying, 'flagged'::character varying])::text[])));

ALTER TABLE ONLY public.interactions ADD CONSTRAINT interactions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.interactions ADD CONSTRAINT interactions_type_check CHECK ((type = ANY (ARRAY['note'::text, 'call'::text, 'email'::text, 'visit'::text, 'text'::text, 'prayer'::text])));

ALTER TABLE ONLY public.interchange_events ADD CONSTRAINT interchange_events_amount_micro_usd_check CHECK ((amount_micro_usd > 0));

ALTER TABLE ONLY public.interchange_events ADD CONSTRAINT interchange_events_direction_check CHECK ((direction = ANY (ARRAY['debit'::text, 'credit'::text])));

ALTER TABLE ONLY public.interchange_events ADD CONSTRAINT interchange_events_event_type_check CHECK ((event_type = ANY (ARRAY['authorization'::text, 'capture'::text, 'refund'::text, 'reversal'::text, 'fee'::text, 'declined'::text])));

ALTER TABLE ONLY public.interchange_events ADD CONSTRAINT interchange_events_i2c_event_id_key UNIQUE (i2c_event_id);

ALTER TABLE ONLY public.interchange_events ADD CONSTRAINT interchange_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.kyc_verifications ADD CONSTRAINT kyc_verifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.kyc_verifications ADD CONSTRAINT kyc_verifications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_review'::text, 'approved'::text, 'rejected'::text, 'expired'::text])));

ALTER TABLE ONLY public.leader_applications ADD CONSTRAINT leader_applications_background_check_status_check CHECK ((background_check_status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'passed'::text, 'failed'::text, 'waived'::text])));

ALTER TABLE ONLY public.leader_applications ADD CONSTRAINT leader_applications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.leader_applications ADD CONSTRAINT leader_applications_session_type_check CHECK ((session_type = ANY (ARRAY['one-time'::text, 'recurring'::text])));

ALTER TABLE ONLY public.leader_applications ADD CONSTRAINT leader_applications_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'under_review'::text, 'interview'::text, 'training'::text, 'approved'::text, 'active'::text, 'suspended'::text, 'rejected'::text])));

ALTER TABLE ONLY public.leader_availability ADD CONSTRAINT leader_availability_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)));

ALTER TABLE ONLY public.leader_availability ADD CONSTRAINT leader_availability_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.leader_profiles ADD CONSTRAINT leader_profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ledger_entries ADD CONSTRAINT ledger_entries_amount_micro_usd_check CHECK ((amount_micro_usd > 0));

ALTER TABLE ONLY public.ledger_entries ADD CONSTRAINT ledger_entries_direction_check CHECK ((direction = ANY (ARRAY['credit'::text, 'debit'::text])));

ALTER TABLE ONLY public.ledger_entries ADD CONSTRAINT ledger_entries_kind_check CHECK ((kind = ANY (ARRAY['donation'::text, 'refund'::text, 'fee'::text, 'payout'::text, 'transfer'::text, 'adjustment'::text, 'correction'::text])));

ALTER TABLE ONLY public.ledger_entries ADD CONSTRAINT ledger_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ledger_entries ADD CONSTRAINT ledger_entries_source_check CHECK ((source = ANY (ARRAY['stripe'::text, 'i2c'::text, 'manual'::text, 'reconciliation'::text])));

ALTER TABLE ONLY public.ledger_entries ADD CONSTRAINT ledger_entries_source_source_event_id_key UNIQUE (source, source_event_id);

ALTER TABLE ONLY public.message_archive ADD CONSTRAINT message_archive_channel_check CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'sms'::character varying])::text[])));

ALTER TABLE ONLY public.message_archive ADD CONSTRAINT message_archive_direction_check CHECK (((direction)::text = ANY ((ARRAY['outbound'::character varying, 'inbound'::character varying])::text[])));

ALTER TABLE ONLY public.message_archive ADD CONSTRAINT message_archive_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.message_archive ADD CONSTRAINT message_archive_provider_check CHECK (((provider)::text = ANY ((ARRAY['resend'::character varying, 'twilio'::character varying])::text[])));

ALTER TABLE ONLY public.message_archive ADD CONSTRAINT message_archive_status_check CHECK (((status)::text = ANY ((ARRAY['sent'::character varying, 'delivered'::character varying, 'opened'::character varying, 'clicked'::character varying, 'bounced'::character varying, 'failed'::character varying])::text[])));

ALTER TABLE ONLY public.pastoral_conversations ADD CONSTRAINT pastoral_conversations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pastoral_conversations ADD CONSTRAINT pastoral_conversations_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'crisis'::text])));

ALTER TABLE ONLY public.pastoral_conversations ADD CONSTRAINT pastoral_conversations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'waiting'::text, 'escalated'::text, 'resolved'::text, 'archived'::text])));

ALTER TABLE ONLY public.pastoral_messages ADD CONSTRAINT pastoral_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pastoral_messages ADD CONSTRAINT pastoral_messages_sender_check CHECK ((sender = ANY (ARRAY['user'::text, 'ai'::text, 'leader'::text])));

ALTER TABLE ONLY public.pastoral_sessions ADD CONSTRAINT pastoral_sessions_category_check CHECK ((category = ANY (ARRAY['marriage'::text, 'addiction'::text, 'grief'::text, 'faith-questions'::text, 'crisis'::text, 'financial'::text, 'anxiety-depression'::text, 'parenting'::text, 'general'::text])));

ALTER TABLE ONLY public.pastoral_sessions ADD CONSTRAINT pastoral_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pastoral_sessions ADD CONSTRAINT pastoral_sessions_rating_check CHECK (((rating >= 1) AND (rating <= 5)));

ALTER TABLE ONLY public.pastoral_sessions ADD CONSTRAINT pastoral_sessions_session_type_check CHECK ((session_type = ANY (ARRAY['chat'::text, 'video'::text, 'phone'::text, 'in-person'::text])));

ALTER TABLE ONLY public.pastoral_sessions ADD CONSTRAINT pastoral_sessions_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'active'::text, 'completed'::text, 'cancelled'::text, 'no-show'::text])));

ALTER TABLE ONLY public.people ADD CONSTRAINT people_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.people ADD CONSTRAINT people_status_check CHECK ((status = ANY (ARRAY['visitor'::text, 'regular'::text, 'member'::text, 'leader'::text, 'inactive'::text])));

ALTER TABLE ONLY public.pledges ADD CONSTRAINT pledges_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.prayer_requests ADD CONSTRAINT prayer_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.recurring_giving ADD CONSTRAINT recurring_giving_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.scheduled_messages ADD CONSTRAINT scheduled_messages_channel_check CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'sms'::character varying, 'both'::character varying])::text[])));

ALTER TABLE ONLY public.scheduled_messages ADD CONSTRAINT scheduled_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.scheduled_messages ADD CONSTRAINT scheduled_messages_source_type_check CHECK (((source_type)::text = ANY ((ARRAY['manual'::character varying, 'drip_campaign'::character varying, 'birthday'::character varying, 'anniversary'::character varying, 'donation'::character varying, 'follow_up'::character varying, 'pastoral_care'::character varying, 'ai_generated'::character varying])::text[])));

ALTER TABLE ONLY public.scheduled_messages ADD CONSTRAINT scheduled_messages_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'scheduled'::character varying, 'sent'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[])));

ALTER TABLE ONLY public.small_groups ADD CONSTRAINT small_groups_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tasks ADD CONSTRAINT tasks_category_check CHECK ((category = ANY (ARRAY['follow-up'::text, 'care'::text, 'admin'::text, 'outreach'::text])));

ALTER TABLE ONLY public.tasks ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tasks ADD CONSTRAINT tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));

ALTER TABLE ONLY public.token_usage ADD CONSTRAINT token_usage_completion_tokens_check CHECK ((completion_tokens >= 0));

ALTER TABLE ONLY public.token_usage ADD CONSTRAINT token_usage_cost_micro_usd_check CHECK ((cost_micro_usd >= 0));

ALTER TABLE ONLY public.token_usage ADD CONSTRAINT token_usage_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.token_usage ADD CONSTRAINT token_usage_prompt_tokens_check CHECK ((prompt_tokens >= 0));

ALTER TABLE ONLY public.users ADD CONSTRAINT users_clerk_id_key UNIQUE (clerk_id);

ALTER TABLE ONLY public.users ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users ADD CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'staff'::text, 'volunteer'::text])));

ALTER TABLE ONLY public.webhook_dlq ADD CONSTRAINT webhook_dlq_attempt_count_check CHECK ((attempt_count >= 1));

ALTER TABLE ONLY public.webhook_dlq ADD CONSTRAINT webhook_dlq_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.webhook_events ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.webhook_events ADD CONSTRAINT webhook_events_source_source_event_id_key UNIQUE (source, source_event_id);

ALTER TABLE ONLY public.webhook_events ADD CONSTRAINT webhook_events_status_check CHECK ((status = ANY (ARRAY['received'::text, 'processed'::text, 'failed'::text, 'skipped'::text])));

-- ---------- FOREIGN KEYS ----------

ALTER TABLE ONLY public.agent_executions ADD CONSTRAINT agent_executions_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.agent_logs ADD CONSTRAINT agent_logs_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.agent_stats ADD CONSTRAINT agent_stats_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_personas ADD CONSTRAINT ai_personas_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES leader_profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anchor_ai_personas ADD CONSTRAINT anchor_ai_personas_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.anchor_ai_personas ADD CONSTRAINT anchor_ai_personas_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES anchor_leaders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anchor_conversations ADD CONSTRAINT anchor_conversations_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anchor_conversations ADD CONSTRAINT anchor_conversations_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES anchor_leaders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anchor_conversations ADD CONSTRAINT anchor_conversations_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.anchor_intake_responses ADD CONSTRAINT anchor_intake_responses_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anchor_intake_responses ADD CONSTRAINT anchor_intake_responses_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anchor_leader_applications ADD CONSTRAINT anchor_leader_applications_anchor_leader_id_fkey FOREIGN KEY (anchor_leader_id) REFERENCES anchor_leaders(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.anchor_leader_applications ADD CONSTRAINT anchor_leader_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.anchor_leader_visibility ADD CONSTRAINT anchor_leader_visibility_added_by_fkey FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.anchor_leader_visibility ADD CONSTRAINT anchor_leader_visibility_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anchor_leader_visibility ADD CONSTRAINT anchor_leader_visibility_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES anchor_leaders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anchor_leaders ADD CONSTRAINT anchor_leaders_source_application_id_fkey FOREIGN KEY (source_application_id) REFERENCES leader_applications(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.anchor_leaders ADD CONSTRAINT anchor_leaders_source_church_id_fkey FOREIGN KEY (source_church_id) REFERENCES churches(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.anchor_messages ADD CONSTRAINT anchor_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES anchor_conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.attendance ADD CONSTRAINT attendance_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.attendance ADD CONSTRAINT attendance_event_id_fkey FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.attendance ADD CONSTRAINT attendance_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.audit_logs ADD CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.audit_logs ADD CONSTRAINT audit_logs_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.automation_events ADD CONSTRAINT automation_events_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id);

ALTER TABLE ONLY public.automation_events ADD CONSTRAINT automation_events_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id);

ALTER TABLE ONLY public.automation_events ADD CONSTRAINT automation_events_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.automation_rules ADD CONSTRAINT automation_rules_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id);

ALTER TABLE ONLY public.batch_items ADD CONSTRAINT batch_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES donation_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.batch_items ADD CONSTRAINT batch_items_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.calendar_events ADD CONSTRAINT calendar_events_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.campaigns ADD CONSTRAINT campaigns_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cards ADD CONSTRAINT cards_cardholder_person_id_fkey FOREIGN KEY (cardholder_person_id) REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.cards ADD CONSTRAINT cards_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.cards ADD CONSTRAINT cards_kyc_verification_id_fkey FOREIGN KEY (kyc_verification_id) REFERENCES kyc_verifications(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.church_agent_settings ADD CONSTRAINT church_agent_settings_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.church_ai_budgets ADD CONSTRAINT church_ai_budgets_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.church_subscriptions ADD CONSTRAINT church_subscriptions_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.crisis_alerts ADD CONSTRAINT crisis_alerts_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES pastoral_conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.crisis_alerts ADD CONSTRAINT crisis_alerts_protocol_id_fkey FOREIGN KEY (protocol_id) REFERENCES crisis_protocols(id);

ALTER TABLE ONLY public.daily_digests ADD CONSTRAINT daily_digests_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.daily_digests ADD CONSTRAINT daily_digests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.donation_batches ADD CONSTRAINT donation_batches_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.donation_batches ADD CONSTRAINT donation_batches_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.donation_batches ADD CONSTRAINT donation_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.donor_portal_tokens ADD CONSTRAINT donor_portal_tokens_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.drip_campaign_enrollments ADD CONSTRAINT drip_campaign_enrollments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES drip_campaigns(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.drip_campaign_enrollments ADD CONSTRAINT drip_campaign_enrollments_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.drip_campaign_steps ADD CONSTRAINT drip_campaign_steps_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES drip_campaigns(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.drip_campaigns ADD CONSTRAINT drip_campaigns_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.drip_campaigns ADD CONSTRAINT drip_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.email_outbox ADD CONSTRAINT email_outbox_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.email_templates ADD CONSTRAINT email_templates_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id);

ALTER TABLE ONLY public.email_templates ADD CONSTRAINT email_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);

ALTER TABLE ONLY public.giving ADD CONSTRAINT giving_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES donation_batches(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.giving ADD CONSTRAINT giving_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.giving ADD CONSTRAINT giving_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.giving ADD CONSTRAINT giving_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.giving ADD CONSTRAINT giving_pledge_id_fkey FOREIGN KEY (pledge_id) REFERENCES pledges(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.giving_statements ADD CONSTRAINT giving_statements_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.giving_statements ADD CONSTRAINT giving_statements_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.grace_inbox_messages ADD CONSTRAINT grace_inbox_messages_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.grace_inbox_messages ADD CONSTRAINT grace_inbox_messages_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_memberships ADD CONSTRAINT group_memberships_group_id_fkey FOREIGN KEY (group_id) REFERENCES small_groups(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_memberships ADD CONSTRAINT group_memberships_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.help_requests ADD CONSTRAINT help_requests_assigned_leader_id_fkey FOREIGN KEY (assigned_leader_id) REFERENCES leader_profiles(id);

ALTER TABLE ONLY public.help_requests ADD CONSTRAINT help_requests_assigned_persona_id_fkey FOREIGN KEY (assigned_persona_id) REFERENCES ai_personas(id);

ALTER TABLE ONLY public.inbound_messages ADD CONSTRAINT inbound_messages_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.inbound_messages ADD CONSTRAINT inbound_messages_in_reply_to_fkey FOREIGN KEY (in_reply_to) REFERENCES message_archive(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.inbound_messages ADD CONSTRAINT inbound_messages_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.inbound_messages ADD CONSTRAINT inbound_messages_replied_by_fkey FOREIGN KEY (replied_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.interactions ADD CONSTRAINT interactions_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.interactions ADD CONSTRAINT interactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.interactions ADD CONSTRAINT interactions_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.interchange_events ADD CONSTRAINT interchange_events_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.interchange_events ADD CONSTRAINT interchange_events_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.interchange_events ADD CONSTRAINT interchange_events_ledger_entry_id_fkey FOREIGN KEY (ledger_entry_id) REFERENCES ledger_entries(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.kyc_verifications ADD CONSTRAINT kyc_verifications_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.kyc_verifications ADD CONSTRAINT kyc_verifications_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.leader_applications ADD CONSTRAINT leader_applications_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.leader_applications ADD CONSTRAINT leader_applications_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.leader_applications ADD CONSTRAINT leader_applications_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.leader_applications ADD CONSTRAINT leader_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.leader_availability ADD CONSTRAINT leader_availability_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ledger_entries ADD CONSTRAINT ledger_entries_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.ledger_entries ADD CONSTRAINT ledger_entries_related_giving_id_fkey FOREIGN KEY (related_giving_id) REFERENCES giving(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ledger_entries ADD CONSTRAINT ledger_entries_related_person_id_fkey FOREIGN KEY (related_person_id) REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.message_archive ADD CONSTRAINT message_archive_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.message_archive ADD CONSTRAINT message_archive_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.message_archive ADD CONSTRAINT message_archive_scheduled_message_id_fkey FOREIGN KEY (scheduled_message_id) REFERENCES scheduled_messages(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.pastoral_conversations ADD CONSTRAINT pastoral_conversations_help_request_id_fkey FOREIGN KEY (help_request_id) REFERENCES help_requests(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pastoral_conversations ADD CONSTRAINT pastoral_conversations_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES leader_profiles(id);

ALTER TABLE ONLY public.pastoral_conversations ADD CONSTRAINT pastoral_conversations_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES ai_personas(id);

ALTER TABLE ONLY public.pastoral_messages ADD CONSTRAINT pastoral_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES pastoral_conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pastoral_sessions ADD CONSTRAINT pastoral_sessions_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pastoral_sessions ADD CONSTRAINT pastoral_sessions_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.people ADD CONSTRAINT people_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pledges ADD CONSTRAINT pledges_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.pledges ADD CONSTRAINT pledges_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pledges ADD CONSTRAINT pledges_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.prayer_requests ADD CONSTRAINT prayer_requests_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.prayer_requests ADD CONSTRAINT prayer_requests_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.recurring_giving ADD CONSTRAINT recurring_giving_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.recurring_giving ADD CONSTRAINT recurring_giving_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.scheduled_messages ADD CONSTRAINT scheduled_messages_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.scheduled_messages ADD CONSTRAINT scheduled_messages_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.scheduled_messages ADD CONSTRAINT scheduled_messages_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.small_groups ADD CONSTRAINT small_groups_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.small_groups ADD CONSTRAINT small_groups_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.tasks ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.tasks ADD CONSTRAINT tasks_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tasks ADD CONSTRAINT tasks_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.token_usage ADD CONSTRAINT token_usage_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.users ADD CONSTRAINT users_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.webhook_dlq ADD CONSTRAINT webhook_dlq_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.webhook_dlq ADD CONSTRAINT webhook_dlq_webhook_event_id_fkey FOREIGN KEY (webhook_event_id) REFERENCES webhook_events(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.webhook_events ADD CONSTRAINT webhook_events_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE SET NULL;

-- ---------- INDEXES ----------

CREATE INDEX grace_inbox_messages_church_unseen ON public.grace_inbox_messages USING btree (church_id, created_at DESC) WHERE (seen_at IS NULL);

CREATE INDEX grace_inbox_messages_flag ON public.grace_inbox_messages USING btree (church_id, flag) WHERE (flag IS NOT NULL);

CREATE INDEX idx_agent_executions_agent ON public.agent_executions USING btree (agent_id);

CREATE INDEX idx_agent_executions_church ON public.agent_executions USING btree (church_id);

CREATE INDEX idx_agent_executions_status ON public.agent_executions USING btree (status);

CREATE INDEX idx_agent_logs_agent ON public.agent_logs USING btree (agent_id);

CREATE INDEX idx_agent_logs_church ON public.agent_logs USING btree (church_id);

CREATE INDEX idx_agent_logs_created ON public.agent_logs USING btree (created_at DESC);

CREATE INDEX idx_agent_logs_level ON public.agent_logs USING btree (level);

CREATE INDEX idx_agent_stats_church ON public.agent_stats USING btree (church_id);

CREATE INDEX idx_ai_personas_church ON public.ai_personas USING btree (church_id);

CREATE INDEX idx_ai_personas_leader ON public.ai_personas USING btree (leader_id);

CREATE INDEX idx_anchor_conversations_active ON public.anchor_conversations USING btree (status, last_message_at DESC) WHERE (status = ANY (ARRAY['active'::text, 'idle'::text]));

CREATE INDEX idx_anchor_conversations_church ON public.anchor_conversations USING btree (church_id, status);

CREATE INDEX idx_anchor_conversations_leader ON public.anchor_conversations USING btree (leader_id, last_message_at DESC);

CREATE INDEX idx_anchor_conversations_person ON public.anchor_conversations USING btree (person_id, last_message_at DESC);

CREATE INDEX idx_anchor_intake_person ON public.anchor_intake_responses USING btree (church_id, person_id, created_at DESC);

CREATE INDEX idx_anchor_leader_applications_email ON public.anchor_leader_applications USING btree (email);

CREATE INDEX idx_anchor_leader_applications_status ON public.anchor_leader_applications USING btree (status, created_at DESC);

CREATE INDEX idx_anchor_leaders_expertise ON public.anchor_leaders USING gin (expertise_areas);

CREATE INDEX idx_anchor_leaders_published ON public.anchor_leaders USING btree (is_published, is_verified) WHERE (is_published = true);

CREATE INDEX idx_anchor_messages_conversation ON public.anchor_messages USING btree (conversation_id, created_at);

CREATE INDEX idx_anchor_personas_leader ON public.anchor_ai_personas USING btree (leader_id);

CREATE INDEX idx_anchor_visibility_church ON public.anchor_leader_visibility USING btree (church_id, is_visible);

CREATE INDEX idx_anchor_visibility_leader ON public.anchor_leader_visibility USING btree (leader_id);

CREATE INDEX idx_attendance_church_id ON public.attendance USING btree (church_id);

CREATE INDEX idx_attendance_date ON public.attendance USING btree (church_id, date);

CREATE INDEX idx_attendance_person ON public.attendance USING btree (person_id, date);

CREATE INDEX idx_audit_logs_action_time ON public.audit_logs USING btree (action, created_at DESC);

CREATE INDEX idx_audit_logs_actor_time ON public.audit_logs USING btree (actor_user_id, created_at DESC);

CREATE INDEX idx_audit_logs_church_time ON public.audit_logs USING btree (church_id, created_at DESC);

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);

CREATE INDEX idx_automation_events_church ON public.automation_events USING btree (church_id);

CREATE INDEX idx_automation_events_rule ON public.automation_events USING btree (rule_id);

CREATE INDEX idx_automation_rules_active ON public.automation_rules USING btree (church_id, is_active) WHERE (is_active = true);

CREATE INDEX idx_automation_rules_church ON public.automation_rules USING btree (church_id);

CREATE INDEX idx_batch_items_batch ON public.batch_items USING btree (batch_id);

CREATE INDEX idx_batch_items_person ON public.batch_items USING btree (person_id);

CREATE INDEX idx_batches_church ON public.donation_batches USING btree (church_id);

CREATE INDEX idx_batches_date ON public.donation_batches USING btree (church_id, batch_date);

CREATE INDEX idx_batches_status ON public.donation_batches USING btree (church_id, status);

CREATE INDEX idx_calendar_events_church_id ON public.calendar_events USING btree (church_id);

CREATE INDEX idx_calendar_events_date ON public.calendar_events USING btree (church_id, start_date);

CREATE INDEX idx_campaigns_active ON public.campaigns USING btree (church_id, is_active);

CREATE INDEX idx_campaigns_church ON public.campaigns USING btree (church_id);

CREATE INDEX idx_cards_cardholder ON public.cards USING btree (cardholder_person_id) WHERE (cardholder_person_id IS NOT NULL);

CREATE INDEX idx_cards_church_status ON public.cards USING btree (church_id, status, issued_at DESC);

CREATE INDEX idx_churches_connect_active ON public.churches USING btree (id) WHERE (stripe_connect_charges_enabled = true);

CREATE UNIQUE INDEX idx_churches_stripe_connect_account ON public.churches USING btree (stripe_connect_account_id) WHERE (stripe_connect_account_id IS NOT NULL);

CREATE UNIQUE INDEX idx_churches_stripe_customer ON public.churches USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);

CREATE INDEX idx_churches_subscription_status ON public.churches USING btree (subscription_status) WHERE (subscription_status IS NOT NULL);

CREATE INDEX idx_crisis_alerts_church ON public.crisis_alerts USING btree (church_id);

CREATE INDEX idx_crisis_alerts_conversation ON public.crisis_alerts USING btree (conversation_id);

CREATE INDEX idx_crisis_alerts_severity ON public.crisis_alerts USING btree (severity);

CREATE INDEX idx_crisis_alerts_status ON public.crisis_alerts USING btree (status);

CREATE INDEX idx_crisis_protocols_active ON public.crisis_protocols USING btree (is_active);

CREATE INDEX idx_crisis_protocols_church ON public.crisis_protocols USING btree (church_id);

CREATE INDEX idx_daily_digests_lookup ON public.daily_digests USING btree (church_id, user_id, digest_date);

CREATE INDEX idx_donor_tokens_email_active ON public.donor_portal_tokens USING btree (email, expires_at) WHERE (consumed_at IS NULL);

CREATE INDEX idx_donor_tokens_expiry ON public.donor_portal_tokens USING btree (expires_at) WHERE (consumed_at IS NULL);

CREATE INDEX idx_drip_campaigns_church ON public.drip_campaigns USING btree (church_id);

CREATE INDEX idx_drip_steps_campaign ON public.drip_campaign_steps USING btree (campaign_id);

CREATE INDEX idx_email_outbox_church_time ON public.email_outbox USING btree (church_id, queued_at DESC) WHERE (church_id IS NOT NULL);

CREATE INDEX idx_email_outbox_status_queued ON public.email_outbox USING btree (status, queued_at) WHERE (status = ANY (ARRAY['queued'::text, 'failed'::text]));

CREATE INDEX idx_email_outbox_template ON public.email_outbox USING btree (template_id, queued_at DESC);

CREATE INDEX idx_email_templates_church ON public.email_templates USING btree (church_id);

CREATE INDEX idx_enrollments_campaign ON public.drip_campaign_enrollments USING btree (campaign_id);

CREATE INDEX idx_enrollments_next ON public.drip_campaign_enrollments USING btree (next_message_at) WHERE ((status)::text = 'active'::text);

CREATE INDEX idx_giving_batch ON public.giving USING btree (batch_id);

CREATE INDEX idx_giving_campaign ON public.giving USING btree (campaign_id);

CREATE INDEX idx_giving_church_id ON public.giving USING btree (church_id);

CREATE INDEX idx_giving_date ON public.giving USING btree (church_id, date DESC);

CREATE INDEX idx_giving_person ON public.giving USING btree (person_id);

CREATE INDEX idx_giving_pledge ON public.giving USING btree (pledge_id);

CREATE INDEX idx_group_memberships_group ON public.group_memberships USING btree (group_id);

CREATE INDEX idx_group_memberships_person ON public.group_memberships USING btree (person_id);

CREATE INDEX idx_help_requests_anonymous_id ON public.help_requests USING btree (anonymous_id);

CREATE INDEX idx_help_requests_category ON public.help_requests USING btree (category);

CREATE INDEX idx_help_requests_church ON public.help_requests USING btree (church_id);

CREATE INDEX idx_help_requests_priority ON public.help_requests USING btree (priority);

CREATE INDEX idx_help_requests_status ON public.help_requests USING btree (status);

CREATE INDEX idx_inbound_messages_church ON public.inbound_messages USING btree (church_id);

CREATE INDEX idx_inbound_messages_person ON public.inbound_messages USING btree (person_id);

CREATE INDEX idx_inbound_messages_status ON public.inbound_messages USING btree (status) WHERE ((status)::text = 'new'::text);

CREATE INDEX idx_interactions_church_id ON public.interactions USING btree (church_id);

CREATE INDEX idx_interactions_created_at ON public.interactions USING btree (church_id, created_at DESC);

CREATE INDEX idx_interactions_person_id ON public.interactions USING btree (person_id);

CREATE INDEX idx_interchange_card_time ON public.interchange_events USING btree (card_id, occurred_at DESC) WHERE (card_id IS NOT NULL);

CREATE INDEX idx_interchange_church_time ON public.interchange_events USING btree (church_id, occurred_at DESC);

CREATE INDEX idx_interchange_type ON public.interchange_events USING btree (event_type, occurred_at DESC);

CREATE INDEX idx_kyc_church_status ON public.kyc_verifications USING btree (church_id, status, submitted_at DESC);

CREATE INDEX idx_kyc_person ON public.kyc_verifications USING btree (person_id) WHERE (person_id IS NOT NULL);

CREATE INDEX idx_leader_applications_church ON public.leader_applications USING btree (church_id);

CREATE INDEX idx_leader_applications_person ON public.leader_applications USING btree (person_id);

CREATE INDEX idx_leader_applications_status ON public.leader_applications USING btree (church_id, status);

CREATE INDEX idx_leader_availability_leader ON public.leader_availability USING btree (leader_id);

CREATE INDEX idx_leader_profiles_active ON public.leader_profiles USING btree (is_active, is_available);

CREATE INDEX idx_leader_profiles_church ON public.leader_profiles USING btree (church_id);

CREATE INDEX idx_leader_profiles_person ON public.leader_profiles USING btree (person_id);

CREATE INDEX idx_ledger_church_occurred ON public.ledger_entries USING btree (church_id, occurred_at DESC);

CREATE INDEX idx_ledger_giving ON public.ledger_entries USING btree (related_giving_id) WHERE (related_giving_id IS NOT NULL);

CREATE INDEX idx_ledger_source_occurred ON public.ledger_entries USING btree (source, occurred_at DESC);

CREATE INDEX idx_message_archive_church ON public.message_archive USING btree (church_id);

CREATE INDEX idx_message_archive_person ON public.message_archive USING btree (church_id, person_id);

CREATE INDEX idx_message_archive_sent ON public.message_archive USING btree (sent_at DESC);

CREATE INDEX idx_pastoral_conversations_church ON public.pastoral_conversations USING btree (church_id);

CREATE INDEX idx_pastoral_conversations_leader ON public.pastoral_conversations USING btree (leader_id);

CREATE INDEX idx_pastoral_conversations_persona ON public.pastoral_conversations USING btree (persona_id);

CREATE INDEX idx_pastoral_conversations_priority ON public.pastoral_conversations USING btree (priority);

CREATE INDEX idx_pastoral_conversations_status ON public.pastoral_conversations USING btree (status);

CREATE INDEX idx_pastoral_messages_conversation ON public.pastoral_messages USING btree (conversation_id);

CREATE INDEX idx_pastoral_messages_created ON public.pastoral_messages USING btree (created_at);

CREATE INDEX idx_pastoral_messages_flagged ON public.pastoral_messages USING btree (flagged) WHERE (flagged = true);

CREATE INDEX idx_pastoral_sessions_category ON public.pastoral_sessions USING btree (church_id, category);

CREATE INDEX idx_pastoral_sessions_church ON public.pastoral_sessions USING btree (church_id);

CREATE INDEX idx_pastoral_sessions_date ON public.pastoral_sessions USING btree (church_id, started_at DESC);

CREATE INDEX idx_pastoral_sessions_leader ON public.pastoral_sessions USING btree (leader_id);

CREATE INDEX idx_pastoral_sessions_person ON public.pastoral_sessions USING btree (person_id);

CREATE INDEX idx_people_church_id ON public.people USING btree (church_id);

CREATE INDEX idx_people_last_name ON public.people USING btree (church_id, last_name);

CREATE INDEX idx_people_status ON public.people USING btree (church_id, status);

CREATE INDEX idx_pledges_campaign ON public.pledges USING btree (campaign_id);

CREATE INDEX idx_pledges_church ON public.pledges USING btree (church_id);

CREATE INDEX idx_pledges_person ON public.pledges USING btree (person_id);

CREATE INDEX idx_pledges_status ON public.pledges USING btree (church_id, status);

CREATE INDEX idx_prayer_requests_church_id ON public.prayer_requests USING btree (church_id);

CREATE INDEX idx_prayer_requests_person_id ON public.prayer_requests USING btree (person_id);

CREATE INDEX idx_recurring_church ON public.recurring_giving USING btree (church_id);

CREATE INDEX idx_recurring_next ON public.recurring_giving USING btree (church_id, next_date);

CREATE INDEX idx_recurring_person ON public.recurring_giving USING btree (person_id);

CREATE INDEX idx_recurring_status ON public.recurring_giving USING btree (church_id, status);

CREATE INDEX idx_scheduled_messages_church_date ON public.scheduled_messages USING btree (church_id, scheduled_for);

CREATE INDEX idx_scheduled_messages_person ON public.scheduled_messages USING btree (person_id);

CREATE INDEX idx_scheduled_messages_status ON public.scheduled_messages USING btree (status) WHERE ((status)::text = 'scheduled'::text);

CREATE INDEX idx_small_groups_church_id ON public.small_groups USING btree (church_id);

CREATE INDEX idx_statements_church ON public.giving_statements USING btree (church_id);

CREATE INDEX idx_statements_person ON public.giving_statements USING btree (person_id);

CREATE INDEX idx_statements_year ON public.giving_statements USING btree (church_id, year);

CREATE INDEX idx_subscriptions_church_status ON public.church_subscriptions USING btree (church_id, status);

CREATE INDEX idx_subscriptions_period_end ON public.church_subscriptions USING btree (current_period_end);

CREATE INDEX idx_subscriptions_status ON public.church_subscriptions USING btree (status);

CREATE INDEX idx_tasks_assigned ON public.tasks USING btree (assigned_to) WHERE (NOT completed);

CREATE INDEX idx_tasks_church_id ON public.tasks USING btree (church_id);

CREATE INDEX idx_tasks_due_date ON public.tasks USING btree (church_id, due_date);

CREATE INDEX idx_token_usage_church_time ON public.token_usage USING btree (church_id, created_at DESC);

CREATE INDEX idx_token_usage_feature_time ON public.token_usage USING btree (church_id, feature, created_at DESC);

CREATE INDEX idx_token_usage_time ON public.token_usage USING btree (created_at DESC);

CREATE INDEX idx_users_church_id ON public.users USING btree (church_id);

CREATE INDEX idx_users_clerk_id ON public.users USING btree (clerk_id);

CREATE INDEX idx_webhook_dlq_church ON public.webhook_dlq USING btree (church_id, last_attempt_at DESC) WHERE (church_id IS NOT NULL);

CREATE INDEX idx_webhook_dlq_event ON public.webhook_dlq USING btree (webhook_event_id);

CREATE INDEX idx_webhook_dlq_unresolved ON public.webhook_dlq USING btree (last_attempt_at DESC) WHERE (resolved = false);

CREATE INDEX idx_webhook_events_church_time ON public.webhook_events USING btree (church_id, received_at DESC) WHERE (church_id IS NOT NULL);

CREATE INDEX idx_webhook_events_source_time ON public.webhook_events USING btree (source, received_at DESC);

CREATE INDEX idx_webhook_events_status_time ON public.webhook_events USING btree (status, received_at DESC);

-- ---------- TRIGGERS ----------

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.churches FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.small_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.prayer_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.leader_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.pastoral_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trig_anchor_leader_applications_touch BEFORE UPDATE ON public.anchor_leader_applications FOR EACH ROW EXECUTE FUNCTION anchor_touch_updated_at();

CREATE TRIGGER trig_anchor_leaders_touch BEFORE UPDATE ON public.anchor_leaders FOR EACH ROW EXECUTE FUNCTION anchor_touch_updated_at();

CREATE TRIGGER trig_anchor_messages_bump AFTER INSERT ON public.anchor_messages FOR EACH ROW EXECUTE FUNCTION anchor_bump_conversation_timestamp();

CREATE TRIGGER trig_anchor_personas_touch BEFORE UPDATE ON public.anchor_ai_personas FOR EACH ROW EXECUTE FUNCTION anchor_touch_updated_at();

CREATE TRIGGER trig_anchor_visibility_touch BEFORE UPDATE ON public.anchor_leader_visibility FOR EACH ROW EXECUTE FUNCTION anchor_touch_updated_at();

CREATE TRIGGER trig_audit_logs_no_update BEFORE DELETE OR UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();

CREATE TRIGGER trig_interchange_events_no_mutation BEFORE DELETE OR UPDATE ON public.interchange_events FOR EACH ROW EXECUTE FUNCTION interchange_events_block_mutation();

CREATE TRIGGER trig_ledger_entries_no_mutation BEFORE DELETE OR UPDATE ON public.ledger_entries FOR EACH ROW EXECUTE FUNCTION ledger_entries_block_mutation();

CREATE TRIGGER trig_subscriptions_touch BEFORE UPDATE ON public.church_subscriptions FOR EACH ROW EXECUTE FUNCTION touch_church_subscriptions_updated_at();

CREATE TRIGGER trig_token_usage_no_update BEFORE DELETE OR UPDATE ON public.token_usage FOR EACH ROW EXECUTE FUNCTION token_usage_block_mutation();

CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON public.donation_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_pledges_updated_at BEFORE UPDATE ON public.pledges FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_recurring_updated_at BEFORE UPDATE ON public.recurring_giving FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------- ROW LEVEL SECURITY ----------

ALTER TABLE public.agent_executions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agent_stats ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_personas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.anchor_ai_personas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.anchor_conversations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.anchor_intake_responses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.anchor_leader_applications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.anchor_leader_visibility ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.anchor_leaders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.anchor_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.batch_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.church_agent_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.church_ai_budgets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.church_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crisis_alerts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crisis_protocols ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.daily_digests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.donation_batches ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.donor_portal_tokens ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.drip_campaign_enrollments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.drip_campaign_steps ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.drip_campaigns ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.giving ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.giving_statements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.grace_inbox_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.help_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inbound_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.interchange_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.leader_applications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.leader_availability ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.leader_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.message_archive ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pastoral_conversations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pastoral_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pastoral_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pledges ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recurring_giving ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.small_groups ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.webhook_dlq ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- ---------- RLS POLICIES ----------

CREATE POLICY "Service role can manage agent_executions" ON public.agent_executions AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.agent_executions AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage agent_logs" ON public.agent_logs AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.agent_logs AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage agent_stats" ON public.agent_stats AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.agent_stats AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.ai_personas AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY ai_personas_church_isolation ON public.ai_personas AS PERMISSIVE FOR ALL TO public USING ((church_id = (current_setting('app.church_id'::text))::uuid));

CREATE POLICY "Published leaders are publicly readable" ON public.anchor_leaders AS PERMISSIVE FOR SELECT TO public USING (((is_published = true) AND (is_verified = true)));

CREATE POLICY "Church members can manage attendance" ON public.attendance AS PERMISSIVE FOR ALL TO public USING ((church_id = get_church_id()));

CREATE POLICY "Church members can view attendance" ON public.attendance AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "Service role full access" ON public.attendance AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "audit_logs read own church" ON public.audit_logs AS PERMISSIVE FOR SELECT TO public USING (((church_id IS NOT NULL) AND (church_id = get_church_id())));

CREATE POLICY "Service role full access" ON public.automation_events AS PERMISSIVE FOR ALL TO public USING (true);

CREATE POLICY "Service role full access" ON public.automation_rules AS PERMISSIVE FOR ALL TO public USING (true);

CREATE POLICY "Church members can manage batch items" ON public.batch_items AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM donation_batches
  WHERE ((donation_batches.id = batch_items.batch_id) AND (donation_batches.church_id = get_church_id())))));

CREATE POLICY "Church members can view batch items" ON public.batch_items AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM donation_batches
  WHERE ((donation_batches.id = batch_items.batch_id) AND (donation_batches.church_id = get_church_id())))));

CREATE POLICY "Service role full access" ON public.batch_items AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Church members can manage events" ON public.calendar_events AS PERMISSIVE FOR ALL TO public USING ((church_id = get_church_id()));

CREATE POLICY "Church members can view events" ON public.calendar_events AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "Service role full access" ON public.calendar_events AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Church members can manage campaigns" ON public.campaigns AS PERMISSIVE FOR ALL TO public USING ((church_id = get_church_id()));

CREATE POLICY "Church members can view campaigns" ON public.campaigns AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "Service role full access" ON public.campaigns AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "cards read own church" ON public.cards AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "agent_settings read own church" ON public.church_agent_settings AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "ai_budgets read own church" ON public.church_ai_budgets AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "subscriptions read own church" ON public.church_subscriptions AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "Service role full access" ON public.churches AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own church" ON public.churches AS PERMISSIVE FOR SELECT TO public USING ((id = get_church_id()));

CREATE POLICY "Service role full access" ON public.crisis_alerts AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY crisis_alerts_church_isolation ON public.crisis_alerts AS PERMISSIVE FOR ALL TO public USING ((church_id = (current_setting('app.church_id'::text))::uuid));

CREATE POLICY "Service role full access" ON public.crisis_protocols AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY crisis_protocols_church_isolation ON public.crisis_protocols AS PERMISSIVE FOR ALL TO public USING ((church_id = (current_setting('app.church_id'::text))::uuid));

CREATE POLICY "Service role full access" ON public.daily_digests AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Users can insert daily_digests for their church" ON public.daily_digests AS PERMISSIVE FOR INSERT TO public WITH CHECK ((church_id IN ( SELECT users.church_id
   FROM users
  WHERE (users.clerk_id = (auth.uid())::text))));

CREATE POLICY "Users can view their own daily_digests" ON public.daily_digests AS PERMISSIVE FOR SELECT TO public USING (((user_id IN ( SELECT users.id
   FROM users
  WHERE (users.clerk_id = (auth.uid())::text))) OR (church_id IN ( SELECT users.church_id
   FROM users
  WHERE ((users.clerk_id = (auth.uid())::text) AND (users.role = 'admin'::text))))));

CREATE POLICY "Church members can manage donation batches" ON public.donation_batches AS PERMISSIVE FOR ALL TO public USING ((church_id = get_church_id()));

CREATE POLICY "Church members can view donation batches" ON public.donation_batches AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "Service role full access" ON public.donation_batches AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.drip_campaign_enrollments AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage enrollments for their campaigns" ON public.drip_campaign_enrollments AS PERMISSIVE FOR ALL TO public USING ((campaign_id IN ( SELECT drip_campaigns.id
   FROM drip_campaigns
  WHERE (drip_campaigns.church_id IN ( SELECT users.church_id
           FROM users
          WHERE (users.clerk_id = (auth.uid())::text))))));

CREATE POLICY "Users can view enrollments for their campaigns" ON public.drip_campaign_enrollments AS PERMISSIVE FOR SELECT TO public USING ((campaign_id IN ( SELECT drip_campaigns.id
   FROM drip_campaigns
  WHERE (drip_campaigns.church_id IN ( SELECT users.church_id
           FROM users
          WHERE (users.clerk_id = (auth.uid())::text))))));

CREATE POLICY "Service role full access" ON public.drip_campaign_steps AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage drip_campaign_steps for their campaigns" ON public.drip_campaign_steps AS PERMISSIVE FOR ALL TO public USING ((campaign_id IN ( SELECT drip_campaigns.id
   FROM drip_campaigns
  WHERE (drip_campaigns.church_id IN ( SELECT users.church_id
           FROM users
          WHERE (users.clerk_id = (auth.uid())::text))))));

CREATE POLICY "Users can view drip_campaign_steps for their campaigns" ON public.drip_campaign_steps AS PERMISSIVE FOR SELECT TO public USING ((campaign_id IN ( SELECT drip_campaigns.id
   FROM drip_campaigns
  WHERE (drip_campaigns.church_id IN ( SELECT users.church_id
           FROM users
          WHERE (users.clerk_id = (auth.uid())::text))))));

CREATE POLICY "Service role full access" ON public.drip_campaigns AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage drip_campaigns for their church" ON public.drip_campaigns AS PERMISSIVE FOR ALL TO public USING ((church_id IN ( SELECT users.church_id
   FROM users
  WHERE (users.clerk_id = (auth.uid())::text))));

CREATE POLICY "Users can view drip_campaigns for their church" ON public.drip_campaigns AS PERMISSIVE FOR SELECT TO public USING ((church_id IN ( SELECT users.church_id
   FROM users
  WHERE (users.clerk_id = (auth.uid())::text))));

CREATE POLICY "email_outbox read own church" ON public.email_outbox AS PERMISSIVE FOR SELECT TO public USING (((church_id IS NOT NULL) AND (church_id = get_church_id())));

CREATE POLICY "Service role full access" ON public.email_templates AS PERMISSIVE FOR ALL TO public USING (true);

CREATE POLICY "Church members can manage giving" ON public.giving AS PERMISSIVE FOR ALL TO public USING ((church_id = get_church_id()));

CREATE POLICY "Church members can view giving" ON public.giving AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "Service role full access" ON public.giving AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Church members can manage giving statements" ON public.giving_statements AS PERMISSIVE FOR ALL TO public USING ((church_id = get_church_id()));

CREATE POLICY "Church members can view giving statements" ON public.giving_statements AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "Service role full access" ON public.giving_statements AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Church members can update inbox" ON public.grace_inbox_messages AS PERMISSIVE FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Church members can view inbox" ON public.grace_inbox_messages AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY "Service role full access" ON public.grace_inbox_messages AS PERMISSIVE FOR ALL TO public USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY "Church members can manage memberships" ON public.group_memberships AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM small_groups
  WHERE ((small_groups.id = group_memberships.group_id) AND (small_groups.church_id = get_church_id())))));

CREATE POLICY "Church members can view memberships" ON public.group_memberships AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM small_groups
  WHERE ((small_groups.id = group_memberships.group_id) AND (small_groups.church_id = get_church_id())))));

CREATE POLICY "Service role full access" ON public.group_memberships AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.help_requests AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY help_requests_church_isolation ON public.help_requests AS PERMISSIVE FOR ALL TO public USING ((church_id = (current_setting('app.church_id'::text))::uuid));

CREATE POLICY "Service role full access" ON public.inbound_messages AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Users can insert inbound_messages for their church" ON public.inbound_messages AS PERMISSIVE FOR INSERT TO public WITH CHECK ((church_id IN ( SELECT users.church_id
   FROM users
  WHERE (users.clerk_id = (auth.uid())::text))));

CREATE POLICY "Users can update inbound_messages for their church" ON public.inbound_messages AS PERMISSIVE FOR UPDATE TO public USING ((church_id IN ( SELECT users.church_id
   FROM users
  WHERE (users.clerk_id = (auth.uid())::text))));

CREATE POLICY "Users can view inbound_messages for their church" ON public.inbound_messages AS PERMISSIVE FOR SELECT TO public USING ((church_id IN ( SELECT users.church_id
   FROM users
  WHERE (users.clerk_id = (auth.uid())::text))));

CREATE POLICY "Church members can create interactions" ON public.interactions AS PERMISSIVE FOR INSERT TO public WITH CHECK ((church_id = get_church_id()));

CREATE POLICY "Church members can view interactions" ON public.interactions AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "Service role full access" ON public.interactions AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "interchange read own church" ON public.interchange_events AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "kyc read own church" ON public.kyc_verifications AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "Church members can manage leader applications" ON public.leader_applications AS PERMISSIVE FOR ALL TO public USING ((church_id = get_church_id()));

CREATE POLICY "Church members can view leader applications" ON public.leader_applications AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "Service role full access" ON public.leader_applications AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Church members can manage leader availability" ON public.leader_availability AS PERMISSIVE FOR ALL TO public USING ((church_id = get_church_id()));

CREATE POLICY "Church members can view leader availability" ON public.leader_availability AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "Service role full access" ON public.leader_availability AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.leader_profiles AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY leader_profiles_church_isolation ON public.leader_profiles AS PERMISSIVE FOR ALL TO public USING ((church_id = (current_setting('app.church_id'::text))::uuid));

CREATE POLICY "ledger_entries read own church" ON public.ledger_entries AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "Service role full access" ON public.message_archive AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Users can insert message_archive for their church" ON public.message_archive AS PERMISSIVE FOR INSERT TO public WITH CHECK ((church_id IN ( SELECT users.church_id
   FROM users
  WHERE (users.clerk_id = (auth.uid())::text))));

CREATE POLICY "Users can view message_archive for their church" ON public.message_archive AS PERMISSIVE FOR SELECT TO public USING ((church_id IN ( SELECT users.church_id
   FROM users
  WHERE (users.clerk_id = (auth.uid())::text))));

CREATE POLICY "Service role full access" ON public.pastoral_conversations AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY pastoral_conversations_church_isolation ON public.pastoral_conversations AS PERMISSIVE FOR ALL TO public USING ((church_id = (current_setting('app.church_id'::text))::uuid));

CREATE POLICY "Service role full access" ON public.pastoral_messages AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY pastoral_messages_church_isolation ON public.pastoral_messages AS PERMISSIVE FOR ALL TO public USING ((church_id = (current_setting('app.church_id'::text))::uuid));

CREATE POLICY "Church members can manage pastoral sessions" ON public.pastoral_sessions AS PERMISSIVE FOR ALL TO public USING ((church_id = get_church_id()));

CREATE POLICY "Church members can view pastoral sessions" ON public.pastoral_sessions AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "Service role full access" ON public.pastoral_sessions AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Church admins can delete people" ON public.people AS PERMISSIVE FOR DELETE TO public USING ((church_id = get_church_id()));

CREATE POLICY "Church members can insert people" ON public.people AS PERMISSIVE FOR INSERT TO public WITH CHECK ((church_id = get_church_id()));

CREATE POLICY "Church members can update people" ON public.people AS PERMISSIVE FOR UPDATE TO public USING ((church_id = get_church_id()));

CREATE POLICY "Church members can view people" ON public.people AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "Service role full access" ON public.people AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Church members can manage pledges" ON public.pledges AS PERMISSIVE FOR ALL TO public USING ((church_id = get_church_id()));

CREATE POLICY "Church members can view pledges" ON public.pledges AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "Service role full access" ON public.pledges AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Church members can manage prayers" ON public.prayer_requests AS PERMISSIVE FOR ALL TO public USING ((church_id = get_church_id()));

CREATE POLICY "Church members can view public prayers" ON public.prayer_requests AS PERMISSIVE FOR SELECT TO public USING (((church_id = get_church_id()) AND ((NOT is_private) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'staff'::text]))))))));

CREATE POLICY "Service role full access" ON public.prayer_requests AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Church members can manage recurring giving" ON public.recurring_giving AS PERMISSIVE FOR ALL TO public USING ((church_id = get_church_id()));

CREATE POLICY "Church members can view recurring giving" ON public.recurring_giving AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "Service role full access" ON public.recurring_giving AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.scheduled_messages AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Users can delete scheduled_messages for their church" ON public.scheduled_messages AS PERMISSIVE FOR DELETE TO public USING ((church_id IN ( SELECT users.church_id
   FROM users
  WHERE (users.clerk_id = (auth.uid())::text))));

CREATE POLICY "Users can insert scheduled_messages for their church" ON public.scheduled_messages AS PERMISSIVE FOR INSERT TO public WITH CHECK ((church_id IN ( SELECT users.church_id
   FROM users
  WHERE (users.clerk_id = (auth.uid())::text))));

CREATE POLICY "Users can update scheduled_messages for their church" ON public.scheduled_messages AS PERMISSIVE FOR UPDATE TO public USING ((church_id IN ( SELECT users.church_id
   FROM users
  WHERE (users.clerk_id = (auth.uid())::text))));

CREATE POLICY "Users can view scheduled_messages for their church" ON public.scheduled_messages AS PERMISSIVE FOR SELECT TO public USING ((church_id IN ( SELECT users.church_id
   FROM users
  WHERE (users.clerk_id = (auth.uid())::text))));

CREATE POLICY "Church members can manage groups" ON public.small_groups AS PERMISSIVE FOR ALL TO public USING ((church_id = get_church_id()));

CREATE POLICY "Church members can view groups" ON public.small_groups AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "Service role full access" ON public.small_groups AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Church members can manage tasks" ON public.tasks AS PERMISSIVE FOR ALL TO public USING ((church_id = get_church_id()));

CREATE POLICY "Church members can view tasks" ON public.tasks AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "Service role full access" ON public.tasks AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "token_usage read own church" ON public.token_usage AS PERMISSIVE FOR SELECT TO public USING (((church_id IS NOT NULL) AND (church_id = get_church_id())));

CREATE POLICY "Service role full access" ON public.users AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Users can view same-church users" ON public.users AS PERMISSIVE FOR SELECT TO public USING ((church_id = get_church_id()));

CREATE POLICY "webhook_dlq read own church" ON public.webhook_dlq AS PERMISSIVE FOR SELECT TO public USING (((church_id IS NOT NULL) AND (church_id = get_church_id())));

CREATE POLICY "webhook_events read own church" ON public.webhook_events AS PERMISSIVE FOR SELECT TO public USING (((church_id IS NOT NULL) AND (church_id = get_church_id())));
