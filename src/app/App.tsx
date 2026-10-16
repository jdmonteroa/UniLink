import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from '@/lib/queryClient';
import { router } from '@/app/router';
import { useAuthStore } from '@/features/auth/authStore';
import { ConfirmDialogHost } from '@/components/ConfirmDialog';

export const App: React.FC = () => {
  const init = useAuthStore((s) => s.init);

  // Restaura la sesión guardada al abrir la app (antes no se hacía y por eso
  // al recargar se perdía la sesión).
  useEffect(() => {
    void init();
  }, [init]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ConfirmDialogHost />
    </QueryClientProvider>
  );
};

export default App;
