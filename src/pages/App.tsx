import { App as AntApp } from "antd";
import { AuthWrapper } from "components/Layout/AuthWrapper";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "services/AuthProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: Infinity,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <AuthProvider>
          <AuthWrapper>
            <div className="App">
              <header className="App-header">
                <h1 className="text-3xl font-bold underline text-red-600">LD</h1>
              </header>
            </div>
          </AuthWrapper>
        </AuthProvider>
      </AntApp>
    </QueryClientProvider>
  );
}

export default App;
