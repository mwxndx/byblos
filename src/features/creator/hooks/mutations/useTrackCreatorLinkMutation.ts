import { useMutation } from '@tanstack/react-query';
import creatorApi from '@/features/creator/api';

export function useTrackCreatorLinkMutation() {
  return useMutation({
    mutationFn: (payload: string | { code: string; shopSlug?: string }) => creatorApi.trackLinkClick(payload),
  });
}


