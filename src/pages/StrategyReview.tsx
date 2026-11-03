import clsx from 'clsx';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, Loader2, Pencil, RefreshCw } from 'lucide-react';
import { Button, Card, PageHeader, PlatformTag, SourceTag, StatusChip } from '../components/ui';
import type { Platform } from '../data/mock';
import { useApp } from '../store/AppStore';

const allocation: { p: Platform; pct: number }[] = [
  { p: 'Instagram', pct: 45 },
  { p: 'Facebook', pct: 35 },
  { p: 'LinkedIn', pct: 20 },
];

const evidence = [
  { kind: 'Fact', text: '62% of current members joined as complete beginners.', source: 'member-survey.pdf' },
  { kind: 'Fact', text: 'New members start with a free coached intro session.', source: 'ironpeakfitness.com/start' },
  { kind: 'Fact', text: 'September trial campaign beat its goal: 58 of 50 signups.', source: 'Past campaign' },
  { kind: 'Assumption', text: 'Beginners respond better to coach-led video than to promo graphics.', source: 'AI-inferred' },
  { kind: 'Assumption', text: 'Most prospects live within 5 miles of the studio.', source: 'AI-inferred' },
];

const fmtDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function StrategyReview() {
  const { goal, strategyStatus, setStrategyStatus, notify } = useApp();
  const [showSources, setShowSources] = useState(false);
  const [editing, setEditing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [audience, setAudience] = useState('Beginners aged 22-40 within 5 miles who want coached, low-pressure workouts.');
  const [messages, setMessages] = useState(['You do not need to be fit to start.', 'Coaches guide every rep.', 'Real member results.']);
  const navigate = useNavigate();

  const approve = () => {
    setStrategyStatus('Approved');
    notify('Strategy approved — campaign plan created');
    setTimeout(() => navigate('/campaigns/7'), 500);
  };

  return (
    <>
      <PageHeader
        eyebrow="Strategy review"
        title="Strategy: 30-day new-member acquisition"
        subtitle={`Goal: ${goal.target} new ${goal.outcome.toLowerCase()} by ${fmtDate(goal.deadline)}`}
        right={<StatusChip status={strategyStatus} className="px-3 py-1 text-sm" />}
      />

      <div className={clsx('grid gap-5 lg:grid-cols-2', regenerating && 'pointer-events-none opacity-50')}>
        <Card title="Target audience" action={<SourceTag>member survey</SourceTag>}>
          <div className="p-5">
            {editing ? (
              <textarea className="input" rows={3} value={audience} onChange={(e) => setAudience(e.target.value)} />
            ) : (
              <p className="text-[15px] leading-relaxed text-slate-800">{audience}</p>
            )}
          </div>
        </Card>

        <Card title="Key messages" action={<SourceTag>testimonials.txt</SourceTag>}>
          <ol className="space-y-2 p-5">
            {messages.map((m, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{i + 1}</span>
                {editing ? (
                  <input className="input" value={m} onChange={(e) => setMessages(messages.map((x, j) => (j === i ? e.target.value : x)))} />
                ) : (
                  <span className="pt-0.5 text-[15px] text-slate-800">{m}</span>
                )}
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Channels and focus" subtitle="Share of planned posts and effort">
          <div className="space-y-4 p-5">
            {allocation.map(({ p, pct }) => (
              <div key={p} className="flex items-center gap-3">
                <div className="w-24">
                  <PlatformTag platform={p} full />
                </div>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-10 text-right text-sm font-semibold tabular-nums text-slate-800">{pct}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Conversion path">
          <div className="p-5">
            <div className="flex items-center justify-between gap-2">
              {['Post', 'Landing', 'Trial'].map((s, i, arr) => (
                <div key={s} className="flex flex-1 items-center gap-2">
                  <div className={clsx('flex-1 rounded-lg border px-3 py-3 text-center text-sm font-semibold', i === arr.length - 1 ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-800')}>
                    {s}
                  </div>
                  {i < arr.length - 1 && <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" />}
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Send all posts to <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/free-intro</code>. Track form submissions as the conversion.
            </p>
          </div>
        </Card>
      </div>

      <Card
        title="Why this strategy? (evidence)"
        className="mt-5"
        action={
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Observed</span>
            <span className="rounded-md border border-dashed border-violet-400 bg-violet-50 px-2 py-0.5 font-medium text-violet-700">AI-inferred</span>
          </div>
        }
      >
        <div className="grid gap-5 p-5 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Facts from your documents</h3>
            <ul className="space-y-2">
              {evidence
                .filter((e) => e.kind === 'Fact')
                .map((e) => (
                  <li key={e.text} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-800">
                    {e.text}
                    {showSources && (
                      <div className="mt-2">
                        <SourceTag>{e.source}</SourceTag>
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">AI assumptions to confirm</h3>
            <ul className="space-y-2">
              {evidence
                .filter((e) => e.kind === 'Assumption')
                .map((e) => (
                  <li key={e.text} className="rounded-lg border border-dashed border-violet-300 bg-violet-50/40 p-3 text-sm text-slate-800">
                    {e.text}
                    <div className="mt-2 text-xs font-medium text-violet-700">AI-inferred · confirm or edit before approving</div>
                  </li>
                ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-100 px-5 py-3">
          <button onClick={() => setShowSources(!showSources)} className="flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
            {showSources ? 'Hide sources' : 'Show sources'} <ChevronDown className={clsx('h-4 w-4 transition', showSources && 'rotate-180')} />
          </button>
        </div>
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <span className="mr-auto text-xs text-slate-500">Approving creates a campaign plan. Nothing is published yet.</span>
        <Button icon={editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />} onClick={() => setEditing(!editing)}>
          {editing ? 'Done editing' : 'Edit'}
        </Button>
        <Button
          icon={regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          onClick={() => {
            setRegenerating(true);
            setTimeout(() => {
              setRegenerating(false);
              notify('Strategy regenerated');
            }, 1000);
          }}
        >
          Regenerate
        </Button>
        <Button variant="primary" size="lg" icon={<Check className="h-4 w-4" />} onClick={approve} disabled={strategyStatus === 'Approved'}>
          {strategyStatus === 'Approved' ? 'Strategy approved' : 'Approve strategy'}
        </Button>
      </div>
    </>
  );
}
