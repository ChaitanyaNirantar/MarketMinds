import clsx from 'clsx';
import { useRef, useState, type DragEvent } from 'react';
import { AlertTriangle, FileText, Globe, Search, UploadCloud } from 'lucide-react';
import { Button, Card, PageHeader, ProgressBar, SourceTag, StatusChip } from '../components/ui';
import { type Passage, type SourceType } from '../data/mock';
import { useApp } from '../store/AppStore';

const typeFromName = (n: string): SourceType => (n.endsWith('.pdf') ? 'PDF' : n.endsWith('.docx') ? 'DOCX' : 'TXT');

export default function KnowledgeBase() {
  const { sources, addSource, removeSource, retrySource, notify, passages, searchKnowledge } = useApp();
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState('');
  const [query, setQuery] = useState('What classes do we offer for beginners?');
  const [results, setResults] = useState<Passage[]>(passages.slice(0, 2));
  const fileInput = useRef<HTMLInputElement>(null);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    Array.from(e.dataTransfer.files).forEach((f) => addSource(f.name, typeFromName(f.name)));
  };

  const search = async () => {
    const scored = await searchKnowledge(query);
    setResults(scored.slice(0, 3));
  };

  return (
    <>
      <PageHeader title="Business Knowledge Base" subtitle="Everything the AI is allowed to say about your business comes from here." />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={clsx(
          'mb-6 rounded-xl border-2 border-dashed p-8 text-center transition',
          dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-white',
        )}
      >
        <UploadCloud className={clsx('mx-auto h-9 w-9', dragging ? 'text-brand-600' : 'text-slate-400')} />
        <p className="mt-2 text-sm font-medium text-slate-800">Drag and drop files here</p>
        <p className="text-xs text-slate-500">PDF, DOCX, TXT · up to 20 MB each</p>
        <div className="mx-auto mt-5 flex max-w-xl flex-wrap items-center justify-center gap-3">
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(e) => Array.from(e.target.files ?? []).forEach((f) => addSource(f.name, typeFromName(f.name)))}
          />
          <Button icon={<FileText className="h-4 w-4" />} onClick={() => fileInput.current?.click()}>
            Choose files
          </Button>
          <span className="text-xs text-slate-400">or</span>
          <div className="flex flex-1 gap-2">
            <input className="input" placeholder="Paste website URL" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button
              icon={<Globe className="h-4 w-4" />}
              disabled={!url.trim()}
              onClick={() => {
                addSource(url.replace(/^https?:\/\//, ''), 'Website');
                notify('Website import started');
                setUrl('');
              }}
            >
              Import
            </Button>
          </div>
        </div>
      </div>

      <Card title={`Sources (${sources.length})`} subtitle="Status updates live while documents are parsed, chunked and embedded." className="mb-6">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Source</th>
              <th className="th">Type</th>
              <th className="th">Status</th>
              <th className="th">Chunks</th>
              <th className="th text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sources.map((s) => (
              <tr key={s.id} className={clsx(s.status === 'Failed' && 'bg-rose-50/40')}>
                <td className="td">
                  <div className="flex items-center gap-2 font-medium text-slate-900">
                    {s.type === 'Website' ? <Globe className="h-4 w-4 text-slate-400" /> : <FileText className="h-4 w-4 text-slate-400" />}
                    {s.name}
                  </div>
                  {s.status === 'Processing' && (
                    <div className="mt-2 flex items-center gap-2">
                      <ProgressBar value={s.progress ?? 0} className="max-w-xs" />
                      <span className="text-xs tabular-nums text-slate-500">{s.progress}% · chunking & embedding</span>
                    </div>
                  )}
                  {s.status === 'Failed' && (
                    <div className="mt-1 flex items-start gap-1.5 text-xs text-rose-700">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {s.error}
                    </div>
                  )}
                </td>
                <td className="td">{s.type}</td>
                <td className="td">
                  <StatusChip status={s.status} />
                </td>
                <td className="td tabular-nums">{s.chunks ?? '–'}</td>
                <td className="td text-right">
                  {s.status === 'Indexed' && (
                    <Button size="sm" variant="ghost" onClick={() => removeSource(s.id)}>
                      Remove
                    </Button>
                  )}
                  {s.status === 'Processing' && (
                    <Button size="sm" variant="ghost" onClick={() => removeSource(s.id)}>
                      Cancel
                    </Button>
                  )}
                  {s.status === 'Failed' && (
                    <Button size="sm" onClick={() => retrySource(s.id)}>
                      Retry
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Test what the AI will retrieve" subtitle="Type a question a customer might ask and see which passages the AI would use.">
        <div className="p-5">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input className="input pl-9" placeholder="e.g. What classes do we offer for beginners?" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Button variant="primary" type="submit">
              Search
            </Button>
          </form>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {results.map((r) => (
              <div key={r.text} className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-sm text-slate-800">{r.text}</p>
                <div className="mt-3 flex items-center justify-between">
                  <SourceTag>{r.source}</SourceTag>
                  <span className="text-[11px] tabular-nums text-slate-400">relevance {r.score.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </>
  );
}
