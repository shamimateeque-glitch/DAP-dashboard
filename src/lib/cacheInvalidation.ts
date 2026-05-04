import type { QueryClient } from '@tanstack/react-query';

// Global staleTime is 5 minutes (see App.tsx). After mutating a case or any
// related row, call this to nudge every cache touched by the case lifecycle so
// list pages, the dashboard, and detail views all refetch on next render
// instead of serving the pre-mutation snapshot.
export const invalidateCaseRelated = (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: ['case'] });
    queryClient.invalidateQueries({ queryKey: ['cases'] });
    queryClient.invalidateQueries({ queryKey: ['workflow-cases'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
};
