import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, ChevronRight, Lightbulb, Plus, TrendingUp } from 'lucide-react';
import { Button, Card, PageHeader, PlatformTag, Select, StatusChip, fmt } from '../components/ui';
import { useApp } from '../store/AppStore';

export default function Dashboard() {
  const { results, campaigns, goal, business } = useApp();
  const [range, setRange] = useState('Last 30 days');
  const navigate = useNavigate();
  const members = results.reduce((s, r) => s + r.members, 0);
  const impressions = results.reduce((s, r) => s + r.impressions, 0);
  const target = goal.target || 100;
  const pct = Math.round((members / target) * 100);
  const byChannel = [...results].sort((a, b) => b.members - a.members);
  const maxMembers = Math.max(1, ...byChannel.map((c) => c.members));
  const expectedByNow = Math.round((18 / 30) * target);

  const kpis = [
    { label: 'New members', value: fmt(members), delta: '+14 vs last month' },
    { label: 'Website visits', value: '1,240', delta: '+9% (all campaigns)' },
    { label: 'Visit-to-trial rate', value: '9.5%', delta: '+0.8 pts' },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`${business.name || 'Your business'} · outcomes first`} right={<Select value={range} onChange={setRange} options={['Last 30 days', 'Last 7 days', 'This quarter']} />} />

      <section className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 to-violet-700 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-200">Goal</div>
            <h2 className="mt-1 text-xl font-semibold">{goal.target} new {goal.outcome.toLowerCase()} by {goal.deadline ? new Date(goal.deadline + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</h2>
          </div>
          <Button className="border-white/30 bg-white/10 text-white hover:bg-white/20" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/goals/new')}>
            New goal
          </Button>
        </div>
        <div className="mt-6 flex items-end gap-3">
          <span className="text-5xl font-bold tabular-nums tracking-tight">{members}</span>
          <span className="pb-1.5 text-2xl font-medium text-brand-200">/ {target}</span>
          <span className="ml-auto pb-1.5 text-sm font-medium">{pct}%</span>
        </div>
        <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
          <div className="absolute top-0 h-full w-0.5 bg-amber-300" style={{ left: `${expectedByNow}%` }} title="Expected by today" />
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm text-brand-100">
          <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-300/40">On track</span>
          12 days left, {Math.max(0, target - members)} to go
        </div>
      </section>

      <div className="mb-2 grid gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <div className="text-sm font-medium text-slate-500">{k.label}</div>
            <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{k.value}</div>
            <div className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-700">
              <TrendingUp className="h-3.5 w-3.5" /> {k.delta}
            </div>
          </Card>
        ))}
      </div>
      <p className="mb-5 text-xs text-slate-400">
        Impressions {(impressions / 1000).toFixed(1)}k · Likes 640 <span className="italic">(secondary metrics)</span>
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Active campaigns" action={<Link to="/campaigns/7" className="text-xs font-medium text-brand-700 hover:underline">View campaigns</Link>}>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Campaign</th>
                <th className="th text-right">Members</th>
                <th className="th">Status</th>
                <th className="th w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.map((c) => (
                <tr key={c.name} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(c.to)}>
                  <td className="td font-medium text-slate-900">{c.name}</td>
                  <td className="td text-right tabular-nums">{c.members ?? '–'}</td>
                  <td className="td">
                    <StatusChip status={c.status} />
                  </td>
                  <td className="td">
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="New members by channel" subtitle="Outcomes, not impressions">
          <div className="flex h-[188px] items-end justify-around gap-6 px-8 pb-5 pt-6">
            {byChannel.map((c, i) => (
              <div key={c.channel} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-sm font-semibold tabular-nums text-slate-900">{c.members}</span>
                <div className={i === 0 ? 'w-full rounded-t-lg bg-brand-600' : 'w-full rounded-t-lg bg-brand-200'} style={{ height: `${(c.members / maxMembers) * 100}%` }} />
                <PlatformTag platform={c.channel} full />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-5 border-brand-200 bg-gradient-to-r from-brand-50 to-white">
        <div className="flex flex-wrap items-start gap-4 p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Lightbulb className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">AI recommendation</h3>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Medium confidence</span>
            </div>
            <p className="mt-1 text-[15px] text-slate-700">
              Instagram brought the most impressions, but Facebook produced more new members. Shift more of the next campaign to Facebook and test a testimonial post.
            </p>
          </div>
          <div className="flex items-center gap-2 self-center">
            <Link to="/campaigns/7/recommendation" className="flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
              See why <ChevronRight className="h-4 w-4" />
            </Link>
            <Button variant="primary" icon={<ArrowUpRight className="h-4 w-4" />} onClick={() => navigate('/campaigns/7/recommendation')}>
              Review plan
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
