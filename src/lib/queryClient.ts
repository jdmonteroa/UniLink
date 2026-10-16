import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos de caché por defecto
      gcTime: 1000 * 60 * 30, // 30 minutos de recolección de basura
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
