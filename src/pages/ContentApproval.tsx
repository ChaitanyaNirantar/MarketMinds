import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Heart, ImagePlus, Loader2, MessageCircle, Pencil, RefreshCw, Send, ShieldCheck, ThumbsUp, Trash2, X } from 'lucide-react';
import { CampaignTabs } from '../components/Layout';
import { Button, Card, PageHeader, PlatformTag, Select, SourceTag, StatusChip } from '../components/ui';
import { PLATFORMS, type ContentItem, type Platform } from '../data/mock';
import { useApp } from '../store/AppStore';

type Tab = 'All' | 'Awaiting' | 'Approved' | 'Rejected';

export default function ContentApproval() {
  const { content, setContentStatus, updateCaption, uploadMedia, removeMedia, notify } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>('All');
  const [platform, setPlatform] = useState('All platforms');
  const [selected, setSelected] = useState<string[]>(['c1', 'c2']);
  const [activeId, setActiveId] = useState(params.get('item') ?? 'c1');
  const [variant, setVariant] = useState<Platform>('Instagram');
  const [editing, setEditing] = useState(false);
  const [draftCaption, setDraftCaption] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  const isAwaiting = (c: ContentItem) => c.status === 'Awaiting' || c.status === 'Edited' || c.status === 'Draft';
  const counts = {
    All: content.length,
    Awaiting: content.filter(isAwaiting).length,
    Approved: content.filter((c) => c.status === 'Approved').length,
    Rejected: content.filter((c) => c.status === 'Rejected').length,
  };

  const list = useMemo(
    () =>
      content
        .filter((c) => (tab === 'All' ? true : tab === 'Awaiting' ? isAwaiting(c) : c.status === tab))
        .filter((c) => platform === 'All platforms' || c.platform === platform || c.platform === 'All'),
    [content, tab, platform],
  );

  const active = content.find((c) => c.id === activeId) ?? content[0];

  useEffect(() => {
    setVariant(active.platform === 'All' ? 'Instagram' : active.platform);
    setEditing(false);
  }, [active.id, active.platform]);

  const toggleSel = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const unsupported = active.grounding.length === 0;

  return (
    <>
      <PageHeader eyebrow="Fall Member Drive" title="Review and approve content" subtitle="Approving does not publish. You schedule approved posts next." />
      <CampaignTabs />

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Card className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 pt-3">
            <div className="flex gap-1" role="tablist">
              {(Object.keys(counts) as Tab[]).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={clsx('-mb-px border-b-2 px-2 pb-2 text-xs font-medium', tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')}
                >
                  {t} <span className="ml-0.5 rounded-full bg-slate-100 px-1.5 text-[10px] tabular-nums text-slate-600">{counts[t]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="border-b border-slate-100 px-3 py-2">
            <Select value={platform} onChange={setPlatform} options={['All platforms', ...PLATFORMS]} className="w-full py-1.5 text-xs" />
          </div>

          {selected.length > 0 && (
            <div className="flex items-center justify-between bg-brand-600 px-3 py-2 text-sm text-white">
              <span className="font-medium">{selected.length} selected</span>
              <div className="flex gap-2">
                <button className="text-xs text-brand-100 hover:text-white" onClick={() => setSelected([])}>
                  Clear
                </button>
                <button
                  className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                  onClick={() => {
                    setContentStatus(selected, 'Approved');
                    notify(`${selected.length} posts approved`);
                    setSelected([]);
                  }}
                >
                  Approve selected
                </button>
              </div>
            </div>
          )}

          <ul className="max-h-[620px] flex-1 divide-y divide-slate-100 overflow-y-auto">
            {list.map((c) => (
              <li
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={clsx('flex cursor-pointer items-center gap-3 px-3 py-3 transition', c.id === active.id ? 'bg-brand-50/70' : 'hover:bg-slate-50')}
              >
                <input
                  type="checkbox"
                  aria-label={`Select ${c.topic}`}
                  checked={selected.includes(c.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSel(c.id)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                />
                <Thumb item={c} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900">{c.topic}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <PlatformTag platform={c.platform} />
                    <span className="text-[11px] text-slate-400">Wk {c.week} · {c.format}</span>
                  </div>
                </div>
                <StatusChip status={c.status} />
              </li>
            ))}
            {list.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Nothing here. Try another tab.</li>}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">{active.topic}</div>
              <div className="text-xs text-slate-500">
                Week {active.week} · {active.phase} · {active.format}
              </div>
            </div>
            <div className="flex rounded-lg bg-slate-100 p-1" role="tablist">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  role="tab"
                  aria-selected={variant === p}
                  onClick={() => setVariant(p)}
                  className={clsx('rounded-md px-3 py-1 text-xs font-medium', variant === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className={clsx('grid gap-6 p-5 xl:grid-cols-[minmax(0,340px)_1fr]', regenerating && 'opacity-50')}>
            <PostPreview item={active} platform={variant} />

            <div className="flex flex-col">
              <div className="label">Caption</div>
              {editing ? (
                <textarea className="input" rows={6} value={draftCaption} onChange={(e) => setDraftCaption(e.target.value)} />
              ) : (
                <p className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-sm leading-relaxed text-slate-800">{active.caption}</p>
              )}
              <div className="mt-3 text-sm text-slate-600">
                <span className="font-medium text-slate-800">Call to action:</span> {active.cta} · <span className="font-medium text-slate-800">Link:</span>{' '}
                <code className="rounded bg-slate-100 px-1 text-xs">/free-intro</code>
              </div>

              <div className="mt-4">
                <div className="label">Image</div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setUploading(true);
                    try {
                      await uploadMedia(active.id, file);
                      notify('Image added');
                    } catch (err) {
                      notify(err instanceof Error ? err.message : 'Upload failed');
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
                {active.media?.length ? (
                  <div className="flex items-center gap-3">
                    <img src={active.media[0].url} alt="" className="h-14 w-14 rounded-lg border border-slate-200 object-cover" />
                    <Button size="sm" icon={<ImagePlus className="h-3.5 w-3.5" />} onClick={() => fileRef.current?.click()} disabled={uploading}>
                      Replace
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => void removeMedia(active.id).then(() => notify('Image removed'))}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      size="sm"
                      icon={uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                    >
                      Add image
                    </Button>
                    <span className={clsx('text-xs', active.platform === 'Instagram' || active.platform === 'All' ? 'text-amber-700' : 'text-slate-500')}>
                      {active.platform === 'Instagram' || active.platform === 'All'
                        ? 'Instagram needs an image (JPEG) to publish.'
                        : 'Optional. JPEG or PNG, up to 8 MB.'}
                    </span>
                  </div>
                )}
              </div>

              <div className={clsx('mt-4 rounded-lg border p-3', unsupported ? 'border-dashed border-rose-300 bg-rose-50/60' : 'border-emerald-200 bg-emerald-50/50')}>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <ShieldCheck className={clsx('h-4 w-4', unsupported ? 'text-rose-600' : 'text-emerald-600')} /> Grounding
                </div>
                {unsupported ? (
                  <p className="text-sm text-rose-700">Unsupported claim: “guaranteed weight loss” is not in any source document.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs text-slate-600">Grounded in:</span>
                      {active.grounding.map((g) => (
                        <SourceTag key={g}>{g}</SourceTag>
                      ))}
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <Check className="h-3.5 w-3.5" /> No unsupported claims detected
                    </p>
                  </>
                )}
              </div>

              <div className="mt-auto pt-5">
                <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
                  Status: <StatusChip status={active.status} />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="danger"
                    icon={<X className="h-4 w-4" />}
                    onClick={() => {
                      setContentStatus([active.id], 'Rejected');
                      notify('Post rejected');
                    }}
                  >
                    Reject
                  </Button>
                  {editing ? (
                    <Button
                      icon={<Check className="h-4 w-4" />}
                      onClick={() => {
                        updateCaption(active.id, draftCaption);
                        setEditing(false);
                        notify('Edits saved');
                      }}
                    >
                      Save edit
                    </Button>
                  ) : (
                    <Button
                      icon={<Pencil className="h-4 w-4" />}
                      onClick={() => {
                        setDraftCaption(active.caption);
                        setEditing(true);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    icon={regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    onClick={() => {
                      setRegenerating(true);
                      setTimeout(() => {
                        setRegenerating(false);
                        notify('New draft generated');
                      }, 900);
                    }}
                  >
                    Regenerate
                  </Button>
                  <Button
                    variant="primary"
                    size="lg"
                    icon={<Check className="h-4 w-4" />}
                    disabled={active.status === 'Approved' || unsupported}
                    onClick={() => {
                      setContentStatus([active.id], 'Approved');
                      notify('Approved — ready to schedule');
                    }}
                  >
                    Approve
                  </Button>
                </div>
                <p className="mt-3 text-right text-xs text-slate-500">
                  Approving does not publish; you{' '}
                  <Link to="/schedule" className="font-medium text-brand-700 hover:underline">
                    schedule next
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

const gradients = ['from-amber-400 to-rose-500', 'from-sky-400 to-indigo-600', 'from-emerald-400 to-teal-600', 'from-fuchsia-400 to-purple-600', 'from-slate-500 to-slate-800'];

function Thumb({ item }: { item: ContentItem }) {
  const g = gradients[Number(item.id.slice(1)) % gradients.length];
  return <div className={clsx('h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br', g)} aria-hidden />;
}

function PostPreview({ item, platform }: { item: ContentItem; platform: Platform }) {
  const g = gradients[Number(item.id.slice(1)) % gradients.length];
  const caption = platform === 'LinkedIn' ? item.caption.replace(/#\w+/g, '').trim() : item.caption;
  return (
    <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">IP</span>
        <div className="leading-tight">
          <div className="text-xs font-semibold">{platform === 'Instagram' ? 'ironpeakfitness' : 'Iron Peak Fitness'}</div>
          <div className="text-[10px] text-slate-500">{platform === 'LinkedIn' ? '1,204 followers · Promoted' : platform === 'Facebook' ? 'Sponsored · Champaign, IL' : 'Champaign, Illinois'}</div>
        </div>
      </div>
      {platform !== 'Instagram' && <p className="px-3 pb-2 text-xs leading-relaxed text-slate-800">{caption}</p>}
      <div
        className={clsx('relative flex items-end bg-gradient-to-br bg-cover bg-center p-4 text-white', g, platform === 'Instagram' ? 'aspect-square' : 'aspect-[1.91/1]')}
        style={item.media?.length ? { backgroundImage: `url(${item.media[0].url})` } : undefined}
      >
        <div className={item.media?.length ? 'hidden' : undefined}>
          <div className="text-lg font-bold leading-tight drop-shadow">{item.topic}</div>
          <div className="mt-1 text-xs opacity-90">{item.cta} →</div>
        </div>
        {item.format === 'Carousel' && <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px]">1/5</span>}
        {item.format === 'Reel' && <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px]">▶ Reel</span>}
      </div>
      {platform === 'Instagram' ? (
        <div className="px-3 py-2.5">
          <div className="mb-2 flex gap-3 text-slate-700">
            <Heart className="h-5 w-5" />
            <MessageCircle className="h-5 w-5" />
            <Send className="h-5 w-5" />
          </div>
          <p className="text-xs leading-relaxed">
            <span className="font-semibold">ironpeakfitness</span> {caption}
          </p>
          {item.format === 'Carousel' && <p className="mt-1 text-[10px] text-slate-400">carousel slide 1 of 5</p>}
        </div>
      ) : (
        <div className="flex items-center justify-around border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3.5 w-3.5" /> Like
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" /> Comment
          </span>
          <span className="flex items-center gap-1">
            <Send className="h-3.5 w-3.5" /> Share
          </span>
        </div>
      )}
    </div>
  );
}
