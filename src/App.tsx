import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { ContentLoading } from 'components/Content';
import { Layout } from 'components/Layout/Layout';
import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from 'services/AuthProvider';
import { HomePage } from './pages/Home';

// Lazy load feature areas for code splitting
const DistributionPage = lazy(() =>
  import('pages/Distributions/DistributionPage').then((m) => ({ default: m.DistributionPage })),
);
const DistributionsListingPage = lazy(() =>
  import('pages/Distributions/DistributionsListingPage').then((m) => ({
    default: m.DistributionsListingPage,
  })),
);
const EditDistributionPage = lazy(() =>
  import('pages/Distributions/EditDistributionPage').then((m) => ({ default: m.EditDistributionPage })),
);
const EditFormationPage = lazy(() =>
  import('pages/Distributions/EditFormationPage').then((m) => ({ default: m.EditFormationPage })),
);
const NewDistributionPage = lazy(() =>
  import('pages/Distributions/NewDistributionPage').then((m) => ({ default: m.NewDistributionPage })),
);

const EditSongPage = lazy(() =>
  import('pages/Songs/EditSongPage').then((m) => ({ default: m.EditSongPage })),
);
const NewSongPage = lazy(() => import('pages/Songs/NewSongPage').then((m) => ({ default: m.NewSongPage })));
const SongsListingPage = lazy(() =>
  import('pages/Songs/SongsListingPage').then((m) => ({ default: m.SongsListingPage })),
);

const GroupsListingPage = lazy(() =>
  import('pages/Groups/GroupsListingPage').then((m) => ({ default: m.GroupsListingPage })),
);

const TheSearchRoutes = lazy(() =>
  import('pages/TheSearch/TheSearchRoutes').then((m) => ({ default: m.TheSearchRoutes })),
);

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
              <Suspense fallback={<ContentLoading />}>
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
              </Suspense>
            </Layout>
          </AuthProvider>
        </HashRouter>
      </AntApp>
    </QueryClientProvider>
  );
}

export default App;
