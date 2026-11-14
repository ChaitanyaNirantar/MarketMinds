import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, PageHeader, StatusChip } from '../components/ui';
import { useApp } from '../store/AppStore';
import { api } from '../api';
import type { Evidence, Readiness } from '../rag';

export default function KnowledgeBase() {
  const { sources, addSource, removeSource, retrySource } = useApp();
  const [category, setCategory] = useState('brief');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('What services and audience should this campaign focus on?');
  const [results, setResults] = useState<Evidence[] | null>(null);
  const [coverage, setCoverage] = useState<Readiness | null>(null);
  useEffect(() => {
    let active = true;
    api<Readiness>('/knowledge/readiness').then((r) => { if (active) setCoverage(r); }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [sources]);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Operation failed.'); }
    finally { setBusy(false); }
  };
  return <>
    <PageHeader title="Business knowledge base" subtitle="Upload business documents for cited strategy ideas. Review the evidence before accepting AI advice." />
    {error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-4 text-rose-800">{error}</p>}
    <Card title="Upload documentation" className="mb-5 p-5">
      <p className="mb-4 text-sm text-slate-600">Text-based PDF or UTF-8 TXT · up to 10 MB and 100 PDF pages · 20 documents per workspace. Scanned PDFs, DOCX and website imports are not supported yet.</p>
      <label className="label" htmlFor="category">What does this document cover?</label>
      <select id="category" className="input mb-4" value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="brief">Business brief (services and audience)</option><option value="products">Products / services</option>
        <option value="audience">Target audience</option><option value="brand">Brand guidelines</option>
        <option value="constraints">Restrictions / offer terms</option><option value="general">Other information</option>
      </select>
      <label className="label" htmlFor="document">Choose a document</label>
      <input id="document" className="block w-full min-w-0 text-sm" type="file" accept=".pdf,.txt" disabled={busy} onChange={(e) => {
        const file = e.target.files?.[0]; e.target.value = '';
        if (file) void act(() => addSource(file, category));
      }} />
      <p className="mt-3 text-xs text-slate-500">Files stay on the Django/Ollama machine. Indexing requires the AI worker to be running.</p>
    </Card>
    {coverage && <Card title="Context readiness" className="mb-5 p-5">
      <p className="font-medium">{coverage.ready ? 'Ready to request strategy ideas' : 'More context needed'} · {coverage.indexed_sources} indexed sources</p>
      <ul className="my-3 list-disc pl-5 text-sm">{coverage.missing.map((m) => <li key={m}>{m}</li>)}</ul>
      <p className="text-sm text-slate-600">{coverage.note}</p>
      {coverage.ready && <Link to="/goals/new" className="mt-3 inline-block font-medium text-brand-700">Create a goal →</Link>}
    </Card>}
    <Card title={`Your documents (${sources.length})`} className="mb-5 p-5">
      {!sources.length && <p className="text-slate-600">Upload your first document to get started. Seeded demo passages are not used as your evidence.</p>}
      <div className="space-y-4">{sources.map((s) => <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div><div className="font-medium">{s.name}</div><StatusChip status={s.status} />
          <p className="mt-1 text-sm text-slate-600">{s.status === 'Processing' ? `Queued / indexing · ${s.progress ?? 0}% embedded` : `${s.chunks ?? 0} searchable chunks`}</p>
          {s.error && <p className="text-sm text-rose-700">{s.error}</p>}
        </div>
        <div className="flex gap-2">
          {s.status === 'Failed' && <Button disabled={busy} onClick={() => void act(() => retrySource(s.id))}>Retry indexing</Button>}
          <Button disabled={busy} onClick={() => { if (window.confirm('Remove this document and invalidate saved AI suggestions? Accepted campaign text will remain.')) void act(async () => { await removeSource(s.id); setResults(null); }); }}>Remove</Button>
        </div>
      </div>)}</div>
    </Card>
    <Card title="Inspect retrieved evidence" className="p-5">
      <form className="flex gap-3" onSubmit={(e) => { e.preventDefault(); void act(async () => setResults(await api<Evidence[]>('/knowledge/search', { body: { query } }))); }}>
        <input aria-label="Search your documents" className="input min-w-0 flex-1" maxLength={1500} value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button type="submit" disabled={busy || !query.trim() || !coverage?.indexed_sources}>Search</Button>
      </form>
      <p className="mt-2 text-xs text-slate-500">Similarity ranks passages; it is not a confidence or factual-accuracy score.</p>
      {results?.map((r) => <article key={r.chunk_id} className="mt-4 rounded-lg border p-4"><p className="whitespace-pre-wrap text-sm">{r.text}</p><p className="mt-2 text-xs text-slate-500">{r.source} · {r.location} · similarity {r.score.toFixed(3)}</p></article>)}
    </Card>
  </>;
}
