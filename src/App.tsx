import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { Layout } from 'components/Layout/Layout';
import { DistributionPage } from 'pages/Distributions/DistributionPage';
import { DistributionsListingPage } from 'pages/Distributions/DistributionsListingPage';
import { EditDistributionPage } from 'pages/Distributions/EditDistributionPage';
import { EditFormationPage } from 'pages/Distributions/EditFormationPage';
import { NewDistributionPage } from 'pages/Distributions/NewDistributionPage';
import { GroupsListingPage } from 'pages/Groups/GroupsListingPage';
import { EditSongPage } from 'pages/Songs/EditSongPage';
import { NewSongPage } from 'pages/Songs/NewSongPage';
import { SongsListingPage } from 'pages/Songs/SongsListingPage';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from 'services/AuthProvider';
import { HomePage } from './pages/Home';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: Number.POSITIVE_INFINITY,
      gcTime: 60 * 60 * 1000, // 1 hour
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
                <Route element={<HomePage />} path="/" />

                <Route element={<NewDistributionPage />} path="/distributions/new" />
                <Route element={<DistributionPage />} path="/distributions/:distributionId" />
                <Route element={<EditDistributionPage />} path="/distributions/:distributionId/edit" />
                <Route
                  element={<EditFormationPage />}
                  path="/distributions/:distributionId/formation/:formationId"
                />
                <Route element={<DistributionsListingPage />} path="/distributions" />

                <Route element={<GroupsListingPage />} path="/groups" />

                <Route element={<NewSongPage />} path="/songs/new" />
                <Route element={<div>Song</div>} path="/songs/:songId" />
                <Route element={<EditSongPage />} path="/songs/:songId/edit" />
                <Route element={<SongsListingPage />} path="/songs" />
              </Routes>
            </Layout>
          </AuthProvider>
        </HashRouter>
      </AntApp>
    </QueryClientProvider>
  );
}

export default App;
