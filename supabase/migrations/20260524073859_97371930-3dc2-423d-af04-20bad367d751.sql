
-- MEMBERS
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own members select" ON public.members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own members insert" ON public.members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own members update" ON public.members FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own members delete" ON public.members FOR DELETE USING (auth.uid() = user_id);

-- SMOKING SESSIONS
CREATE TABLE public.smoking_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cigarette_price NUMERIC(10,2) NOT NULL DEFAULT 80,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_cost NUMERIC(10,2) NOT NULL,
  per_share NUMERIC(10,2) NOT NULL,
  rounding_mode TEXT NOT NULL DEFAULT 'nearest_5',
  participant_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.smoking_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions select" ON public.smoking_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own sessions insert" ON public.smoking_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sessions update" ON public.smoking_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own sessions delete" ON public.smoking_sessions FOR DELETE USING (auth.uid() = user_id);

-- SESSION PARTICIPANTS
CREATE TABLE public.session_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.smoking_sessions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  share_amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sp_session ON public.session_participants(session_id);
CREATE INDEX idx_sp_member ON public.session_participants(member_id);
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sp select" ON public.session_participants FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own sp insert" ON public.session_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sp update" ON public.session_participants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own sp delete" ON public.session_participants FOR DELETE USING (auth.uid() = user_id);

-- PAYMENTS
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pay_member ON public.payments(member_id);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pay select" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own pay insert" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own pay update" ON public.payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own pay delete" ON public.payments FOR DELETE USING (auth.uid() = user_id);

-- ACTIVITY LOGS
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2),
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_log_user ON public.activity_logs(user_id, created_at DESC);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own log select" ON public.activity_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own log insert" ON public.activity_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own log delete" ON public.activity_logs FOR DELETE USING (auth.uid() = user_id);
