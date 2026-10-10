import { useState, useRef, useEffect, useCallback } from 'react';
import { searchLocations, type LocationSearchResult } from '@/infrastructure/location/locationApi';

interface UseLocationSearchProps {
  initialValue?: string;
  onApplyResult: (result: LocationSearchResult, shouldCloseResults: boolean) => void;
}

export function useLocationSearch({
  initialValue = '',
  onApplyResult,
}: UseLocationSearchProps) {
  const [searchQuery, setSearchQuery] = useState(initialValue);
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Reset highlighted option when results or visibility changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [searchResults, showResults]);

  const searchAddress = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchError('');
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setSearchError('');
    try {
      const results = await searchLocations(query);
      setSearchResults(results);
      setShowResults(true);
      if (results.length > 0) {
        onApplyResult(results[0], false);
      }
    } catch (error) {
      console.error('Error searching address:', error);
      setSearchError('Location search is temporarily unavailable. Try again in a few seconds.');
      setSearchResults([]);
      setShowResults(true);
    } finally {
      setHasSearched(true);
      setIsSearching(false);
    }
  }, [onApplyResult]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.length > 2) {
      setShowResults(true);
      setHasSearched(false);
      setSearchError('');
      searchTimeoutRef.current = setTimeout(() => {
        searchAddress(value);
      }, 500);
    } else {
      setSearchResults([]);
      setShowResults(false);
      setSearchError('');
      setHasSearched(false);
    }
  }, [searchAddress]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults || searchResults.length === 0) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % searchResults.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev <= 0 ? searchResults.length - 1 : prev - 1));
        break;
      case 'Enter':
        if (activeIndex >= 0 && activeIndex < searchResults.length) {
          e.preventDefault();
          const selected = searchResults[activeIndex];
          setSearchQuery(selected.displayName);
          setShowResults(false);
          onApplyResult(selected, true);
        }
        break;
      case 'Escape':
        setShowResults(false);
        break;
      default:
        break;
    }
  }, [showResults, searchResults, activeIndex, onApplyResult]);

  const selectLocation = useCallback((result: LocationSearchResult) => {
    setSearchQuery(result.displayName);
    setShowResults(false);
    onApplyResult(result, true);
  }, [onApplyResult]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    showResults,
    setShowResults,
    searchError,
    hasSearched,
    activeIndex,
    setActiveIndex,
    handleSearchChange,
    handleSearchKeyDown,
    selectLocation,
  };
}
