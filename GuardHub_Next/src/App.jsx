import { Suspense } from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./api/queryClient";
import AppRouter from "./routes/AppRouter";
import Toasts from "./components/ui/Toasts";
import { Spinner } from "./components/ui/States";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="center-screen">
              <Spinner dark />
            </div>
          }
        >
          <AppRouter />
        </Suspense>
      </BrowserRouter>
      <Toasts />
    </QueryClientProvider>
  );
}
