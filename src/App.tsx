import { Navigate, Route, Routes } from 'react-router-dom';
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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
