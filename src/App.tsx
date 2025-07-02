import { StyleProvider } from '@ant-design/cssinjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
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
      <StyleProvider layer hashPriority="high">
        <ConfigProvider>
          <AntApp>
            <HashRouter>
              <AuthProvider>
                <Layout>
                  <Routes>
                    <Route path="/" element={<HomePage />} />

                    <Route path="/distributions/new" element={<NewDistributionPage />} />
                    <Route path="/distributions/:distributionId" element={<DistributionPage />} />
                    <Route path="/distributions/:distributionId/edit" element={<EditDistributionPage />} />
                    <Route
                      path="/distributions/:distributionId/formation/:formationId"
                      element={<EditFormationPage />}
                    />
                    <Route path="/distributions" element={<DistributionsListingPage />} />

                    <Route path="/groups" element={<GroupsListingPage />} />

                    <Route path="/songs/new" element={<NewSongPage />} />
                    <Route path="/songs/:songId" element={<div>Song</div>} />
                    <Route path="/songs/:songId/edit" element={<EditSongPage />} />
                    <Route path="/songs" element={<SongsListingPage />} />
                  </Routes>
                </Layout>
              </AuthProvider>
            </HashRouter>
          </AntApp>
        </ConfigProvider>
      </StyleProvider>
    </QueryClientProvider>
  );
}

export default App;
