import { useQuery } from '@tanstack/react-query';
import { getDrugInfo } from '../services/drugInfoProvider';

export function useDrugData(query: string) {
  return useQuery({
    queryKey: ['drugData', query],
    queryFn: () => getDrugInfo(query),
    enabled: !!query && query.trim().length > 0, // Only fetch if query is valid
    retry: 1, // Only retry once to avoid spamming public APIs if not found
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
