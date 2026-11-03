import clsx from 'clsx';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Pencil, Sparkles, Target } from 'lucide-react';
import { CampaignTabs } from '../components/Layout';
import { Button, Card, PageHeader, PlatformTag, Select, StatusChip } from '../components/ui';
import { phases } from '../data/mock';
import { useApp } from '../store/AppStore';

const metrics = [
  { value: '100', label: 'memberships' },
  { value: '400', label: 'landing visits' },
  { value: '25%', label: 'visit-to-trial' },
];

export default function CampaignPlan() {
  const { content, notify } = useApp();
  const [phaseFilter, setPhaseFilter] = useState('All phases');
  const [generating, setGenerating] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const navigate = useNavigate();

  const rows = content.filter((c) => phaseFilter === 'All phases' || c.phase === phaseFilter);
  const planStatus = (s: string) => (s === 'Approved' || s === 'Edited' || s === 'Rejected' ? s : 'Draft');

  return (
    <>
      <PageHeader
        eyebrow="Campaign"
        title="Fall Member Drive"
        subtitle="Objective: 100 new memberships · Audience: local beginners · Nov 1 – Nov 25"
        right={<StatusChip status="Plan ready" className="px-3 py-1 text-sm" />}
      />
      <CampaignTabs />

      <Card title="Timeline" subtitle="Click a phase to edit its dates and goal" className="mb-5">
        <div className="p-5">
          <div className="grid grid-cols-4 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          <div className="relative mt-3 space-y-2.5">
            <div className="pointer-events-none absolute inset-0 grid grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={clsx(i > 0 && 'border-l border-dashed border-slate-200')} />
              ))}
            </div>
            {phases.map((p, i) => {
              const last = i === phases.length - 1;
              return (
                <div key={p.name} className="relative h-12">
                  <button
                    onClick={() => setSelectedPhase(selectedPhase === p.name ? null : p.name)}
                    style={{ left: `${(p.start / 4) * 100}%`, width: `${((p.end - p.start) / 4) * 100}%` }}
                    className={clsx(
                      'absolute top-0 flex h-full flex-col justify-center rounded-lg px-3 text-left transition',
                      last ? 'bg-brand-600 text-white shadow-sm hover:bg-brand-700' : 'border border-brand-200 bg-brand-50 text-brand-900 hover:border-brand-400',
                      selectedPhase === p.name && 'ring-2 ring-brand-500 ring-offset-2',
                    )}
                  >
                    <span className="text-sm font-semibold">{p.name}</span>
                    <span className={clsx('text-xs', last ? 'text-brand-100' : 'text-brand-700')}>{p.subtitle}</span>
                  </button>
                </div>
              );
            })}
          </div>
          {selectedPhase && (
            <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-800">Edit “{selectedPhase}”</div>
              <input className="input w-40" type="date" defaultValue="2026-11-01" aria-label="Start" />
              <input className="input w-40" type="date" defaultValue="2026-11-09" aria-label="End" />
              <input className="input flex-1" defaultValue={phases.find((p) => p.name === selectedPhase)?.subtitle} aria-label="Phase goal" />
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setSelectedPhase(null);
                  notify('Phase updated');
                }}
              >
                Save phase
              </Button>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title={`Content plan (${rows.length} pieces)`}
          action={<Select value={phaseFilter} onChange={setPhaseFilter} options={['All phases', ...phases.map((p) => p.name)]} className="py-1 text-xs" />}
        >
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th w-16">Week</th>
                <th className="th">Topic</th>
                <th className="th">Format</th>
                <th className="th">Platform</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows
                .sort((a, b) => a.week - b.week)
                .map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/campaigns/7/content?item=${c.id}`)}>
                    <td className="td tabular-nums">{c.week}</td>
                    <td className="td font-medium text-slate-900">{c.topic}</td>
                    <td className="td">{c.format}</td>
                    <td className="td">
                      <PlatformTag platform={c.platform} full />
                    </td>
                    <td className="td">
                      <StatusChip status={planStatus(c.status)} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>

        <Card title="Success metrics" subtitle="Targets the dashboard compares with actual results">
          <div className="space-y-3 p-5">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Target className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-xl font-semibold tabular-nums text-slate-900">{m.value}</div>
                  <div className="text-xs text-slate-500">{m.label}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setSelectedPhase(phases[0].name)}>
          Edit phases
        </Button>
        <Button
          variant="primary"
          size="lg"
          icon={generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          onClick={() => {
            setGenerating(true);
            setTimeout(() => navigate('/campaigns/7/content'), 1000);
          }}
        >
          {generating ? 'Content Agent is drafting…' : 'Generate content'}
        </Button>
      </div>
    </>
  );
}
