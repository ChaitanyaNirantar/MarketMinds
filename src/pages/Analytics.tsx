import clsx from 'clsx';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Info } from 'lucide-react';
import { CampaignTabs } from '../components/Layout';
import { Card, PageHeader, PlatformTag, Select, StatusChip, fmt } from '../components/ui';
import { useApp } from '../store/AppStore';

export default function Analytics() {
  const { results, weeklyMembers } = useApp();
  const [campaign, setCampaign] = useState('Fall Member Drive');
  const [range, setRange] = useState('Nov 1 – Nov 22');
  const isSample = results.some((r) => r.source === 'Sample');
  const sum = (k: 'impressions' | 'clicks' | 'leads' | 'members') => results.reduce((s, r) => s + r[k], 0);
  const measured = isSample ? 'Sample' : 'Observed';

  const funnel = [
    { stage: 'Impressions', value: sum('impressions'), tag: measured },
    { stage: 'Clicks', value: sum('clicks'), tag: measured },
    { stage: 'Site visits', value: 540, tag: measured },
    { stage: 'Trial leads', value: sum('leads'), tag: isSample ? 'Sample' : 'Attributed' },
    { stage: 'Members', value: sum('members'), tag: isSample ? 'Sample' : 'Attributed' },
  ];
  const best = results.reduce((a, b) => (b.members > a.members ? b : a), results[0]);
  const maxWeek = Math.max(1, ...weeklyMembers.map((w) => w.members));

  return (
    <>
      <PageHeader
        eyebrow="Campaign analytics"
        title={campaign}
        subtitle="Which channels and content actually produced business outcomes — with the certainty of each number labelled."
        right={
          <div className="flex gap-2">
            <Select value={campaign} onChange={setCampaign} options={['Fall Member Drive', 'Referral Push']} />
            <Select value={range} onChange={setRange} options={['Nov 1 – Nov 22', 'Last 7 days', 'Nov 1 – Nov 25']} />
          </div>
        }
      />
      <CampaignTabs />

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-card">
        <Info className="h-4 w-4 text-slate-400" />
        <span className="flex items-center gap-1.5">
          <StatusChip status="Observed" /> measured directly
        </span>
        <span className="flex items-center gap-1.5">
          <StatusChip status="Attributed" /> linked by tracking
        </span>
        <span className="flex items-center gap-1.5">
          <StatusChip status="AI-inferred" /> estimated by the AI
        </span>
        {isSample && (
          <span className="flex items-center gap-1.5">
            <StatusChip status="Sample" /> demo data, not observed
          </span>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card title="From impression to member (all channels)" className="lg:col-span-3">
          <div className="space-y-3 p-5">
            {funnel.map((f, i) => {
              const width = Math.max(6, Math.sqrt(f.value / (funnel[0].value || 1)) * 100);
              const prev = funnel[i - 1];
              return (
                <div key={f.stage} className="flex items-center gap-3">
                  <div className="w-24 text-sm font-medium text-slate-700">{f.stage}</div>
                  <div className="relative h-9 flex-1">
                    <div
                      className={clsx('flex h-full items-center rounded-md px-3 text-sm font-semibold tabular-nums', i >= 3 ? 'bg-brand-600 text-white' : 'bg-brand-200 text-brand-900')}
                      style={{ width: `${width}%`, minWidth: '4.5rem' }}
                    >
                      {fmt(f.value)}
                    </div>
                  </div>
                  <span className="w-16 text-right text-xs tabular-nums text-slate-400">{prev ? `${((f.value / prev.value) * 100).toFixed(1)}%` : ''}</span>
                  <div className="w-24 text-right">
                    <StatusChip status={f.tag} />
                  </div>
                </div>
              );
            })}
            <p className="pt-1 text-xs text-slate-500">Percentages are conversion from the previous stage. Bar length uses a square-root scale so small stages stay readable.</p>
          </div>
        </Card>

        <Card title="New members per week" className="lg:col-span-2">
          <div className="flex h-[260px] items-end gap-4 px-6 pb-5 pt-6">
            {weeklyMembers.map((w) => (
              <div key={w.week} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-sm font-semibold tabular-nums">{w.members}</span>
                <div className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400" style={{ height: `${(w.members / maxWeek) * 100}%` }} />
                <span className="text-xs text-slate-500">{w.week}</span>
              </div>
            ))}
          </div>
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-emerald-700">Accelerating: each week beat the last.</p>
        </Card>
      </div>

      <Card title="Channel comparison" className="mt-5" action={<span className="flex items-center gap-1 text-xs text-slate-500"><Award className="h-3.5 w-3.5 text-brand-600" /> Highlighted = best for members</span>}>
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Channel</th>
              <th className="th text-right">Impressions</th>
              <th className="th text-right">Clicks</th>
              <th className="th text-right">Leads</th>
              <th className="th text-right">Members</th>
              <th className="th">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.map((r) => {
              const top = r.channel === best.channel;
              return (
                <tr key={r.channel} className={clsx(top && 'bg-brand-50 font-semibold')}>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <PlatformTag platform={r.channel} full />
                      {top && <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Best</span>}
                    </div>
                  </td>
                  <td className="td text-right tabular-nums">{fmt(r.impressions)}</td>
                  <td className="td text-right tabular-nums">{fmt(r.clicks)}</td>
                  <td className="td text-right tabular-nums">{fmt(r.leads)}</td>
                  <td className="td text-right tabular-nums">{fmt(r.members)}</td>
                  <td className="td">
                    <StatusChip status={r.source} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          <span>{best.channel} produced the most members with fewer impressions.</span>
          <Link to="/campaigns/7/recommendation" className="font-medium text-brand-700 hover:underline">
            See AI recommendation →
          </Link>
        </div>
      </Card>
    </>
  );
}
