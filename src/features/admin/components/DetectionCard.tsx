import { format } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { ShieldAlert, CheckCircle2, Undo2, User, Package } from 'lucide-react';
import type { FlaggedEarning } from '../types/detections';

interface DetectionCardProps {
  earning: FlaggedEarning;
  formatCurrency: (value: string) => string;
  onRelease: () => void;
  onReverse: () => void;
}

const EARNING_TYPE_LABEL: Record<FlaggedEarning['earning_type'], string> = {
  sales: 'Creator sales commission',
  referral: 'Creator-refers-seller reward',
};

export function DetectionCard({ earning, formatCurrency, onRelease, onReverse }: DetectionCardProps) {
  const isResolved = earning.metadata?.review_resolution !== undefined;

  return (
    <Card className="bg-surface-1 backdrop-blur-2xl border border-orange-500/20 rounded-card overflow-hidden shadow-2xl group hover:border-orange-500/40 transition-all duration-500">
      <CardHeader className="p-8 border-b border-separator bg-orange-500/[0.03]">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                <ShieldAlert className="h-4 w-4 text-orange-400" />
              </div>
              <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-widest">
                Self-dealing suspected
              </p>
              {earning.order_number && (
                <div className="px-3 py-1 bg-fill rounded-full border border-separator text-[10px] font-semibold text-label-2">
                  Order #{earning.order_number}
                </div>
              )}
            </div>
            <p className="text-[10px] font-semibold text-label-3 uppercase tracking-widest opacity-60">
              Flagged: {earning.metadata?.flagged_at ? format(new Date(earning.metadata.flagged_at), 'MMM d, yyyy • h:mm a') : format(new Date(earning.created_at), 'MMM d, yyyy • h:mm a')}
            </p>
          </div>
          {isResolved ? (
            <Badge className={`px-4 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-widest border-none ${earning.metadata.review_resolution === 'released' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {earning.metadata.review_resolution}
            </Badge>
          ) : (
            <Badge className="px-4 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-widest border-none bg-orange-500/10 text-orange-400">
              Held for review
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <p className="text-[10px] font-semibold text-label-3 uppercase tracking-widest opacity-40">Creator</p>
            <div className="flex items-center gap-4 bg-white/[0.02] p-4 rounded-2xl border border-separator">
              <div className="w-12 h-12 rounded-xl bg-fill flex items-center justify-center border border-separator shadow-inner">
                <User className="h-5 w-5 text-label-2" />
              </div>
              <div>
                <p className="text-base font-semibold text-label tracking-tight">{earning.creator_name || `Creator #${earning.creator_id}`}</p>
                <p className="text-[10px] font-bold text-label-3 uppercase tracking-widest opacity-60">{EARNING_TYPE_LABEL[earning.earning_type]}</p>
              </div>
            </div>
            {earning.buyer_id && (
              <p className="text-[10px] font-semibold text-label-3 uppercase tracking-widest ml-1">
                Buyer on this order: #{earning.buyer_id} — matched against the creator's own identity
              </p>
            )}
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-semibold text-label-3 uppercase tracking-widest opacity-40">Held amount</p>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-5 shadow-inner">
              <p className="text-[10px] text-orange-400/60 font-semibold uppercase tracking-widest mb-1">Not clearing until reviewed</p>
              <p className="text-3xl font-semibold text-orange-400 tracking-tight tabular-nums">
                {formatCurrency(earning.amount)}
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-semibold text-label-3 uppercase tracking-widest ml-1">
              <Package className="h-3 w-3" />
              {earning.status}
            </div>
          </div>
        </div>

        {earning.metadata?.review_notes && (
          <div className="pt-2">
            <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest mb-3">Reviewer notes</p>
            <p className="text-xs font-bold text-blue-400 bg-blue-500/10 p-5 rounded-2xl border border-blue-500/20">
              {earning.metadata.review_notes}
            </p>
          </div>
        )}

        {!isResolved && (
          <div className="flex gap-4 pt-6">
            <Button
              onClick={onRelease}
              className="flex-1 h-14 bg-green-500 hover:bg-green-400 text-black font-semibold text-[10px] uppercase tracking-widest rounded-2xl transition-all duration-300 shadow-lg shadow-green-500/10"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Release — legitimate
            </Button>
            <Button
              variant="outline"
              onClick={onReverse}
              className="flex-1 h-14 border-separator text-red-400 hover:bg-red-500 hover:text-white rounded-2xl bg-transparent font-semibold text-[10px] uppercase tracking-widest transition-all duration-300"
            >
              <Undo2 className="h-4 w-4 mr-2" />
              Reverse — confirmed
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
