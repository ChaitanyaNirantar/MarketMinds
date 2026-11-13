import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useApp, type Workspace } from '../store/AppStore';
import { Button, Card, PageHeader } from './ui';
import type { AIJob, Idea } from '../rag';

function IdeaCard({ idea, index, job, onAccept, disabled }: { idea: Idea; index: number; job: AIJob; onAccept: (index: number, edits: unknown) => void; disabled: boolean }) {
  const [title, setTitle] = useState(idea.title);
  const [actions, setActions] = useState(idea.proposed_actions.join('\n'));
  return <Card className="mb-5 p-5">
    <h2 className="mb-3 text-lg font-semibold">Idea {index + 1}: {idea.title}</h2>
    <p className="mb-3">{idea.rationale}</p>
    <p className="mb-4 text-sm"><b>Audience:</b> {idea.audience}</p>
    <h3 className="font-semibold">Supporting facts — verify against the source</h3>
    {idea.supporting_facts.map((fact, i) => {
      const source = job.evidence.find((s) => s.citation_id === fact.citation_id);
      return <div key={i} className="my-3 rounded-lg bg-slate-50 p-3 text-sm">
        <p>{fact.claim}</p><blockquote className="my-2 border-l-2 border-brand-300 pl-3">“{fact.quote}”</blockquote>
        {source && <details><summary className="cursor-pointer text-brand-700">{source.source} · {source.location} [{source.citation_id}]</summary><p className="mt-2 whitespace-pre-wrap">{source.text}</p></details>}
      </div>;
    })}
    <label className="label mt-4" htmlFor={`title-${index}`}>Strategy title</label>
    <input id={`title-${index}`} className="input" maxLength={160} value={title} disabled={job.kind !== 'strategy' || disabled} onChange={(e) => setTitle(e.target.value)} />
    <label className="label mt-4" htmlFor={`actions-${index}`}>Proposed actions (one per line; edit before accepting)</label>
    <textarea id={`actions-${index}`} className="input" rows={5} value={actions} disabled={job.kind !== 'strategy' || disabled} onChange={(e) => setActions(e.target.value)} />
    {([['Assumptions to confirm', idea.assumptions], ['Success metrics', idea.success_metrics], ['Risks / limitations', idea.risks]] as const).map(([label, items]) => <div key={label} className="mt-4"><h3 className="text-sm font-semibold">{label}</h3><ul className="list-disc pl-5 text-sm text-slate-600">{items.map((text) => <li key={text}>{text}</li>)}</ul></div>)}
    {job.kind === 'strategy' && <Button className="mt-5" variant="primary" disabled={disabled || !title.trim() || !actions.trim()} onClick={() => onAccept(index, { title, proposed_actions: actions.split('\n').map((s) => s.trim()).filter(Boolean) })}>Accept this strategy and open campaign</Button>}
  </Card>;
}

export default function AIReview({ kind }: { kind: 'strategy' | 'recommendation' }) {
  const { goalId, campaignId } = useParams();
  const [params, setParams] = useSearchParams();
  const generationId = params.get('generation');
  const { refresh } = useApp();
  const [job, setJob] = useState<AIJob | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    setJob(null); setError('');
    const poll = async () => {
      try {
        let id = generationId;
        if (!id && goalId && kind === 'strategy') {
          const jobs = await api<AIJob[]>(`/ai/generations?goal_id=${encodeURIComponent(goalId)}`);
          id = jobs.find((j) => j.kind === kind)?.id ?? null;
        }
        if (!id) return;
        const next = await api<AIJob>(`/ai/generations/${id}`);
        if (!alive) return;
        if (next.kind !== kind || (goalId && next.goal_id !== goalId) || (kind === 'recommendation' && next.campaign_id !== campaignId)) {
          setError('This generation belongs to a different goal or campaign.'); return;
        }
        setJob(next);
        if (next.status === 'queued' || next.status === 'running') timer = setTimeout(() => void poll(), 2000);
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : 'Could not read the generation.'); }
    };
    void poll();
    return () => { alive = false; clearTimeout(timer); };
  }, [generationId, goalId, campaignId, kind]);
  const generate = async () => {
    setBusy(true); setError('');
    try {
      const next = await api<AIJob>('/ai/generations', { body: { kind, goal_id: goalId, campaign_id: campaignId } });
      setParams({ generation: next.id });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not queue generation.'); }
    finally { setBusy(false); }
  };
  const accept = async (index: number, edits: unknown) => {
    if (!job) return;
    setBusy(true); setError('');
    try {
      const result = await api<{ campaign_id: string; workspace: Workspace }>(`/ai/generations/${job.id}/accept`, { body: { idea_index: index, edits } });
      await refresh(); navigate(`/campaigns/${result.campaign_id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not accept strategy.'); }
    finally { setBusy(false); }
  };
  const pending = job?.status === 'queued' || job?.status === 'running';
  return <>
    <PageHeader title={kind === 'strategy' ? 'Document-grounded strategy ideas' : 'Document-grounded recommendations'} subtitle="Generated locally from your documents and saved context. Check citations and assumptions before acting." />
    <div className="mb-5 flex flex-wrap items-center gap-4">
      <Button variant="primary" disabled={busy || pending} onClick={() => void generate()}>{job ? 'Generate again' : 'Generate ideas'}</Button>
      <Link className="text-sm text-brand-700" to="/knowledge">Manage documents</Link>
      <Link className="text-sm text-brand-700" to="/goals/new">Edit goal</Link>
    </div>
    {error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-4 text-rose-800">{error}</p>}
    {!job && <p className="text-slate-600">{kind === 'recommendation' ? 'Record campaign results first, then request ideas based on those results and your business documents.' : 'No generation selected. Generate ideas or upload the missing business context.'}</p>}
    {pending && <p role="status" className="mb-4 rounded-lg bg-brand-50 p-5">{job?.stage}. You can leave this page and return. If queued, make sure the AI worker is running.</p>}
    {job?.error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-5">{job.error}</p>}
    {job?.stale && <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-5">The goal, results, or documents changed. Generate again before accepting.</p>}
    {job?.accepted && <p className="mb-4 rounded-lg bg-emerald-50 p-5">Strategy accepted. <Link className="underline" to={`/campaigns/${job.campaign_id}`}>Open campaign</Link></p>}
    {job?.output.conflicts?.length ? <Card title="Conflicting information" className="mb-5 p-5"><ul className="list-disc pl-5">{job.output.conflicts.map((m) => <li key={m}>{m}</li>)}</ul></Card> : null}
    {job?.output.missing_information?.length ? <Card title="Information needed" className="mb-5 p-5"><ul className="list-disc pl-5">{job.output.missing_information.map((m) => <li key={m}>{m}</li>)}</ul></Card> : null}
    {job?.results?.length ? <Card title="Recorded results supplied to the model" className="mb-5 p-5"><ul className="space-y-2 text-sm">{job.results.map((r) => <li key={r.channel}>{r.channel}: {r.impressions} impressions, {r.clicks} clicks, {r.leads} leads, {r.members} outcomes · source: {r.source}</li>)}</ul><p className="mt-3 text-xs text-slate-500">Owner-entered or sample data, not independently verified. These counts do not establish causation.</p></Card> : null}
    {job?.output.observations?.length ? <Card title="Observations checked against your recorded values" className="mb-5 p-5"><ul className="list-disc pl-5 text-sm">{job.output.observations.map((o, i) => <li key={i}>{o.channel} · {o.metric}: {o.value} · {o.source}</li>)}</ul></Card> : null}
    {job?.output.ideas?.map((idea, index) => <IdeaCard key={`${job.id}-${index}`} idea={idea} index={index} job={job} disabled={busy || Boolean(job.accepted || job.stale)} onAccept={(i, edits) => void accept(i, edits)} />)}
    {job?.status === 'succeeded' && <p className="text-xs text-slate-500">{job.model} · {((job.latency_ms ?? 0) / 1000).toFixed(1)} seconds. Citation and format checks do not guarantee factual accuracy. Nothing is published automatically.</p>}
  </>;
}
