import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CampaignTabs } from '../components/Layout';
import { Card, PageHeader, StatusChip } from '../components/ui';
import { api } from '../api';
interface Plan { id: string; name: string; status: string; objective: string; audience: string; date_range: string; goal_id: string | null; actions: string[]; rationale: string }
export default function CampaignPlan() {
  const { campaignId } = useParams();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true; setPlan(null); setError('');
    api<Plan>(`/campaigns/${campaignId}/plan`).then((p) => { if (active) setPlan(p); }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [campaignId]);
  if (error) return <p role="alert" className="text-rose-700">{error}</p>;
  if (!plan) return <p role="status">Loading campaign…</p>;
  return <>
    <PageHeader title={plan.name} subtitle={plan.objective} right={<StatusChip status={plan.status} />} />
    <CampaignTabs />
    <Card title="Accepted strategy" className="p-5">
      <p className="mb-3">{plan.rationale}</p>
      <p className="mb-2 text-sm"><b>Audience:</b> {plan.audience}</p>
      <p className="mb-4 text-sm"><b>Schedule:</b> {plan.date_range}</p>
      <ol className="list-decimal space-y-2 pl-5">{plan.actions.map((action, i) => <li key={i}>{action}</li>)}</ol>
      {plan.goal_id && <Link className="mt-5 inline-block font-medium text-brand-700" to={`/goals/${plan.goal_id}/strategy`}>Review strategy evidence and alternatives</Link>}
      <p className="mt-4 text-sm text-slate-500">Acceptance saves your plan. It does not generate posts, schedule work, or publish to social accounts.</p>
    </Card>
  </>;
}
