import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { ContentLoading } from 'components/Content';
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
import { useContestantsQuery } from 'pages/TheSearch/hooks/useContestants';
import { ContestantBuilderPage } from 'pages/TheSearch/pages/ContestantBuilderPage';
import { TheSearchPage } from 'pages/TheSearch/pages/TheSearchPage';
import { ContestantsProvider } from 'pages/TheSearch/services/ContestantsProvider';
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

/**
 * Wrapper component for The Search routes that provides the global contestants state
 */
function TheSearchRoutes() {
  const { data: contestantsData, isLoading } = useContestantsQuery();

  if (isLoading || !contestantsData) {
    return <ContentLoading />;
  }

  return (
    <ContestantsProvider initialData={contestantsData}>
      <Routes>
        <Route element={<TheSearchPage />} path="/" />
        <Route element={<ContestantBuilderPage />} path="/new" />
        <Route element={<ContestantBuilderPage />} path="/edit" />
      </Routes>
    </ContestantsProvider>
  );
}

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

                <Route element={<TheSearchRoutes />} path="/the-search/*" />
              </Routes>
            </Layout>
          </AuthProvider>
        </HashRouter>
      </AntApp>
    </QueryClientProvider>
  );
}

export default App;
