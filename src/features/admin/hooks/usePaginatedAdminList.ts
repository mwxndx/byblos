import { useEffect, useState } from 'react';

// Network debounce for server-side search, distinct from useDeferredValue
// (which only reprioritizes renders, not fetches) -- without this, every
// keystroke would fire its own paginated request to the backend.
const SEARCH_DEBOUNCE_MS = 400;

export interface PaginatedAdminListControls {
  page: number;
  setPage: (page: number) => void;
  search: string;
  setSearch: (search: string) => void;
  /** The value to actually pass to the query -- debounced so typing doesn't fire a request per keystroke. */
  debouncedSearch: string;
}

/**
 * Page + search state for one admin directory tab (buyers/sellers/creators/
 * withdrawal requests), now that each fetches a server-paginated,
 * server-searched page instead of a full unpaginated table.
 */
export function usePaginatedAdminList(): PaginatedAdminListControls {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search]);

  // A page number from the previous search term doesn't carry over: page 3
  // of "john" has no relationship to page 3 of the unfiltered list, so reset
  // to page 1 whenever the term that actually drives the query changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  return { page, setPage, search, setSearch, debouncedSearch };
}
