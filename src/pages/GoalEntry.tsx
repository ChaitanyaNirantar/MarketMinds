import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Loader2, Package, History, Sparkles } from 'lucide-react';
import { Button, Card, Field, PageHeader, PlatformTag, StatusChip } from '../components/ui';
import { goalExamples, PLATFORMS, previousGoals, products, type Platform } from '../data/mock';
import { useApp, type GoalDraft } from '../store/AppStore';

const outcomes = ['Memberships', 'Class bookings', 'Trial signups', 'Email subscribers', 'Repeat members', 'Program awareness'];

/** Lightweight stand-in for the goal-interpretation agent. */
function interpret(text: string, prev: GoalDraft): GoalDraft {
  const t = text.toLowerCase();
  const targets = [...t.matchAll(/(\d[\d,]*)(\s*days?)?/g)].filter((m) => !m[2]).map((m) => Number(m[1].replace(/,/g, '')));
  const days = t.match(/(\d+)\s*days?/);
  const outcome = /member/.test(t)
    ? t.includes('repeat')
      ? 'Repeat members'
      : 'Memberships'
    : /book/.test(t)
      ? 'Class bookings'
      : /email|list/.test(t)
        ? 'Email subscribers'
        : /trial/.test(t)
          ? 'Trial signups'
          : /promote|program/.test(t)
            ? 'Program awareness'
            : prev.outcome;
  let deadline = prev.deadline;
  if (days) {
    const d = new Date('2026-10-26');
    d.setDate(d.getDate() + Number(days[1]));
    deadline = d.toISOString().slice(0, 10);
  } else if (/this month/.test(t)) deadline = '2026-11-30';
  return { ...prev, text, outcome, target: targets[0] ?? prev.target, deadline };
}

export default function GoalEntry() {
  const { goal, setGoal, sources, notify } = useApp();
  const [draft, setDraft] = useState<GoalDraft>(goal);
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => setDraft(goal), [goal]);

  const update = (text: string) => setDraft((d) => interpret(text, { ...d, text }));
  const toggle = (p: Platform) =>
    setDraft((d) => ({ ...d, channels: d.channels.includes(p) ? d.channels.filter((c) => c !== p) : [...d.channels, p] }));

  const generate = () => {
    setGoal(draft);
    setGenerating(true);
    setTimeout(() => navigate('/goals/12/strategy'), 1100);
  };

  const indexed = sources.length;

  return (
    <>
      <PageHeader title="What do you want to achieve?" subtitle="Describe your goal in plain language. We will turn it into a strategy for you to review." />

      <Card className="p-6">
        <textarea
          rows={3}
          value={draft.text}
          onChange={(e) => update(e.target.value)}
          aria-label="Your goal"
          className="w-full resize-none rounded-xl border-2 border-slate-200 bg-slate-50/50 px-5 py-4 text-xl font-medium leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none"
          placeholder="e.g. I want to generate 100 new memberships in the next 30 days."
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Try:</span>
          {goalExamples.map((ex) => (
            <button key={ex} onClick={() => update(ex)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">
              {ex}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/50 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-brand-800">
            <Sparkles className="h-4 w-4" /> We understood your goal as
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Outcome">
              <select className="input" value={draft.outcome} onChange={(e) => setDraft({ ...draft, outcome: e.target.value })}>
                {outcomes.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="Target">
              <input type="number" className="input" value={draft.target} onChange={(e) => setDraft({ ...draft, target: Number(e.target.value) })} />
            </Field>
            <Field label="Deadline">
              <input type="date" className="input" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} />
            </Field>
            <Field label="Budget (opt.)">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-2 text-sm text-slate-400">$</span>
                <input type="number" className="input pl-6" value={draft.budget} onChange={(e) => setDraft({ ...draft, budget: Number(e.target.value) })} />
              </div>
            </Field>
          </div>
          <div className="mt-4">
            <div className="label">Channels to consider</div>
            <div className="flex flex-wrap gap-3">
              {PLATFORMS.map((p) => (
                <label key={p} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <input type="checkbox" checked={draft.channels.includes(p)} onChange={() => toggle(p)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                  <PlatformTag platform={p} full />
                </label>
              ))}
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">You can edit any value. Nothing is created until you press Generate.</p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Context the AI will use:</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs">
              <BookOpen className="h-3.5 w-3.5" /> {indexed} sources
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs">
              <Package className="h-3.5 w-3.5" /> {products.length} products
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs">
              <History className="h-3.5 w-3.5" /> Past campaigns: 1
            </span>
            <Link to="/knowledge" className="text-xs font-medium text-brand-700 hover:underline">
              Manage knowledge base
            </Link>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setGoal(draft);
                notify('Draft saved');
              }}
            >
              Save draft
            </Button>
            <Button variant="primary" size="lg" onClick={generate} disabled={generating || !draft.text.trim()}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? 'Generating strategy…' : 'Generate strategy'}
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Previous goals" className="mt-6">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Goal</th>
              <th className="th">Result</th>
              <th className="th">Status</th>
              <th className="th text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {previousGoals.map((g) => (
              <tr key={g.goal}>
                <td className="td font-medium text-slate-900">{g.goal}</td>
                <td className="td tabular-nums">{g.result}</td>
                <td className="td">
                  <StatusChip status={g.status} />
                </td>
                <td className="td text-right">
                  <Button size="sm" variant="ghost" onClick={() => update(`Get ${g.goal.replace(/\s*\(.*\)/, '')} this month`)}>
                    Reuse
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
