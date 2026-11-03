import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as mock from '../data/mock';
import type { ChannelResult, ContentItem, ContentStatus, Platform, ScheduledPost, Source } from '../data/mock';

export interface GoalDraft {
  text: string;
  outcome: string;
  target: number;
  deadline: string;
  budget: number;
  channels: Platform[];
}

export const defaultGoal: GoalDraft = {
  text: 'I want to generate 100 new memberships in the next 30 days.',
  outcome: 'Memberships',
  target: 100,
  deadline: '2026-11-25',
  budget: 0,
  channels: ['LinkedIn', 'Instagram', 'Facebook'],
};

export const nextCampaignGoal: GoalDraft = {
  text: 'Get 40 repeat members and 20 referrals by Dec 20 with a retention-and-referral campaign.',
  outcome: 'Repeat members',
  target: 40,
  deadline: '2026-12-20',
  budget: 0,
  channels: ['Facebook', 'Instagram', 'LinkedIn'],
};

type StrategyStatus = 'Draft' | 'Awaiting approval' | 'Approved';

interface Toast {
  id: number;
  message: string;
}

interface AppState {
  signedIn: boolean;
  signIn: () => void;
  signOut: () => void;

  goal: GoalDraft;
  setGoal: (g: GoalDraft) => void;

  strategyStatus: StrategyStatus;
  setStrategyStatus: (s: StrategyStatus) => void;

  sources: Source[];
  addSource: (name: string, type: Source['type']) => void;
  removeSource: (id: string) => void;
  retrySource: (id: string) => void;

  content: ContentItem[];
  setContentStatus: (ids: string[], status: ContentStatus) => void;
  updateCaption: (id: string, caption: string) => void;

  accounts: Record<Platform, boolean>;
  connect: (p: Platform) => void;

  posts: ScheduledPost[];
  retryPost: (id: string) => void;
  movePost: (id: string, day: number) => void;
  scheduleApproved: () => number;

  results: ChannelResult[];
  setResults: (r: ChannelResult[]) => void;

  toasts: Toast[];
  notify: (message: string) => void;
}

const Ctx = createContext<AppState | null>(null);

const DAYS = ['Nov 2', 'Nov 3', 'Nov 4', 'Nov 5', 'Nov 6', 'Nov 7', 'Nov 8'];

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(true);
  const [goal, setGoal] = useState<GoalDraft>(defaultGoal);
  const [strategyStatus, setStrategyStatus] = useState<StrategyStatus>('Awaiting approval');
  const [sources, setSources] = useState<Source[]>(mock.sources);
  const [content, setContent] = useState<ContentItem[]>(mock.contentItems);
  const [accounts, setAccounts] = useState<Record<Platform, boolean>>({ LinkedIn: true, Instagram: true, Facebook: false });
  const [posts, setPosts] = useState<ScheduledPost[]>(mock.scheduledPosts);
  const [results, setResults] = useState<ChannelResult[]>(mock.channelResults);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const notify = useCallback((message: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  // Simulates parse -> chunk -> embed progress for any source in Processing state.
  useEffect(() => {
    if (!sources.some((s) => s.status === 'Processing')) return;
    const timer = setInterval(() => {
      setSources((prev) =>
        prev.map((s) => {
          if (s.status !== 'Processing') return s;
          const progress = Math.min(100, (s.progress ?? 0) + 4);
          if (progress >= 100) return { ...s, status: 'Indexed', progress: undefined, chunks: 12 + (s.name.length % 20) };
          return { ...s, progress };
        }),
      );
    }, 400);
    return () => clearInterval(timer);
  }, [sources]);

  const value = useMemo<AppState>(
    () => ({
      signedIn,
      signIn: () => setSignedIn(true),
      signOut: () => setSignedIn(false),
      goal,
      setGoal,
      strategyStatus,
      setStrategyStatus,
      sources,
      addSource: (name, type) =>
        setSources((s) => [...s, { id: `s${Date.now()}`, name, type, status: 'Processing', chunks: null, progress: 0 }]),
      removeSource: (id) => setSources((s) => s.filter((x) => x.id !== id)),
      retrySource: (id) =>
        setSources((s) => s.map((x) => (x.id === id ? { ...x, status: 'Processing', progress: 0, error: undefined } : x))),
      content,
      setContentStatus: (ids, status) => setContent((c) => c.map((x) => (ids.includes(x.id) ? { ...x, status } : x))),
      updateCaption: (id, caption) =>
        setContent((c) => c.map((x) => (x.id === id ? { ...x, caption, status: 'Edited' } : x))),
      accounts,
      connect: (p) => setAccounts((a) => ({ ...a, [p]: true })),
      posts,
      retryPost: (id) => setPosts((p) => p.map((x) => (x.id === id ? { ...x, status: 'Scheduled', error: undefined } : x))),
      movePost: (id, day) => setPosts((p) => p.map((x) => (x.id === id ? { ...x, day, date: DAYS[day] } : x))),
      scheduleApproved: () => {
        const scheduledTitles = new Set(posts.map((p) => p.title));
        const toAdd = content.filter((c) => c.status === 'Approved' && !scheduledTitles.has(c.topic));
        setPosts((p) => [
          ...p,
          ...toAdd.map((c, i) => ({
            id: `sp-${c.id}`,
            title: c.topic,
            platform: (c.platform === 'All' ? 'Instagram' : c.platform) as Platform,
            day: 6 - (i % 2),
            time: i % 2 ? '12:00 PM' : '5:30 PM',
            date: DAYS[6 - (i % 2)],
            status: 'Scheduled' as const,
          })),
        ]);
        return toAdd.length;
      },
      results,
      setResults,
      toasts,
      notify,
    }),
    [signedIn, goal, strategyStatus, sources, content, accounts, posts, results, toasts, notify],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppStoreProvider');
  return ctx;
}
