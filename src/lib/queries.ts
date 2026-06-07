import { supabase } from "@/integrations/supabase/client";

export type Member = {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
};

export type SmokingSession = {
  id: string;
  user_id: string;
  cigarette_price: number;
  quantity: number;
  total_cost: number;
  per_share: number;
  rounding_mode: string;
  participant_count: number;
  notes: string | null;
  created_at: string;
};

export type SessionParticipant = {
  id: string;
  session_id: string;
  member_id: string;
  share_amount: number;
  created_at: string;
};

export type PaymentMethod = "cash" | "bkash";

export type Payment = {
  id: string;
  user_id: string;
  member_id: string;
  amount: number;
  method: PaymentMethod;
  note: string | null;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  type: string;
  description: string;
  amount: number | null;
  ref_id: string | null;
  created_at: string;
};

export async function logActivity(
  type: string,
  description: string,
  amount?: number,
  ref_id?: string,
) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from("activity_logs").insert({
    user_id: u.user.id,
    type,
    description,
    amount: amount ?? null,
    ref_id: ref_id ?? null,
  });
}
