import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import BusinessProfile from './pages/BusinessProfile';
import KnowledgeBase from './pages/KnowledgeBase';
import GoalEntry from './pages/GoalEntry';
import StrategyReview from './pages/StrategyReview';
import CampaignPlan from './pages/CampaignPlan';
import ContentApproval from './pages/ContentApproval';
import Schedule from './pages/Schedule';
import Results from './pages/Results';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Recommendation from './pages/Recommendation';
import { useApp } from './store/AppStore';

function RequireAuth() {
  const { signedIn, ready } = useApp();
  if (!ready) {
    return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Loading workspace…</div>;
  }
  if (!signedIn) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/business/new" element={<BusinessProfile />} />
          <Route path="/knowledge" element={<KnowledgeBase />} />
          <Route path="/goals/new" element={<GoalEntry />} />
          <Route path="/goals/:goalId/strategy" element={<StrategyReview />} />
          <Route path="/campaigns/:campaignId" element={<CampaignPlan />} />
          <Route path="/campaigns/:campaignId/content" element={<ContentApproval />} />
          <Route path="/campaigns/:campaignId/results" element={<Results />} />
          <Route path="/campaigns/:campaignId/analytics" element={<Analytics />} />
          <Route path="/campaigns/:campaignId/recommendation" element={<Recommendation />} />
          <Route path="/schedule" element={<Schedule />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
