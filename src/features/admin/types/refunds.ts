export interface RefundRequest {
  id: number;
  buyer_id: number;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  buyer_current_refunds: string;
  amount: string;
  status: string;
  payment_method: string;
  payment_details: Record<string, any> | string;
  notes: string;
  admin_notes: string;
  requested_at: string;
  processed_at: string;
  order_id?: number;
  order_number?: string;
  sla_deadline?: string;
  sla_status?: 'on_track' | 'warning' | 'breached' | 'met';
  is_sla_breached?: boolean;
  sla?: {
    targetHours: number;
    deadlineAt: string;
    hoursRemaining: number;
    hoursOverdue: number;
    isBreached: boolean;
    slaStatus: 'on_track' | 'warning' | 'breached' | 'met';
    isEscalated: boolean;
    escalatedAt?: string | null;
    escalationLevel?: number;
  };
}
