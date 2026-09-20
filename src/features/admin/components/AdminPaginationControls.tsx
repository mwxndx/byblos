import { ChevronLeft, ChevronRight } from '@/shared/ui/icons';
import { Button } from '@/shared/ui/button';
import type { PaginationMeta } from '../types/dashboard';

interface AdminPaginationControlsProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
}

// Shared Prev/Next + "showing X-Y of Z" footer for the 5 admin directory
// tabs (buyers/sellers/clients/creators/withdrawals), now that each fetches
// one server-paginated page instead of its full table.
export const AdminPaginationControls = ({ pagination, onPageChange }: AdminPaginationControlsProps) => {
  const { total, page, pageSize, hasMore } = pagination;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
      <p className="text-xs font-semibold text-label-3 uppercase tracking-widest">
        {total === 0 ? 'No results' : `Showing ${rangeStart.toLocaleString()}-${rangeEnd.toLocaleString()} of ${total.toLocaleString()}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="h-9 px-3 rounded-xl border-separator bg-fill text-label hover:bg-white/10 font-semibold uppercase tracking-widest text-[9px] border transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="ml-1">Prev</span>
        </Button>
        <span className="text-xs font-bold text-label-2 tabular-nums px-1">Page {page}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasMore}
          onClick={() => onPageChange(page + 1)}
          className="h-9 px-3 rounded-xl border-separator bg-fill text-label hover:bg-white/10 font-semibold uppercase tracking-widest text-[9px] border transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          <span className="mr-1">Next</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};
