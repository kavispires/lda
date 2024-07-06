import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from 'services/AuthProvider';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from 'components/Layout/Layout';
import { HomePage } from './pages/Home';
import { NewSongPage } from 'pages/Songs/NewSongPage';
import { SongsListingPage } from 'pages/Songs/SongsListingPage';

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
        <HashRouter>
          <AuthProvider>
            <Layout>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/songs/new" element={<NewSongPage />} />
                <Route path="/songs" element={<SongsListingPage />} />
              </Routes>
            </Layout>
          </AuthProvider>
        </HashRouter>
      </AntApp>
    </QueryClientProvider>
  );
}

export default App;
