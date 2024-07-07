import { App as AntApp } from 'antd';
import { Layout } from 'components/Layout/Layout';
import { EditSongPage } from 'pages/Songs/EditSongPage';
import { NewSongPage } from 'pages/Songs/NewSongPage';
import { SongsListingPage } from 'pages/Songs/SongsListingPage';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from 'services/AuthProvider';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { HomePage } from './pages/Home';

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
                <Route path="/songs/:songId" element={<div>Song</div>} />
                <Route path="/songs/:songId/edit" element={<EditSongPage />} />
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
