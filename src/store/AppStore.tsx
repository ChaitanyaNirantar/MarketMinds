import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from '../api';
import type { AIJob } from '../rag';
import type { ChannelResult, ContentItem, ContentStatus, Passage, Platform, Product, ScheduledPost, Source } from '../data/mock';

export interface GoalDraft {
  id?: string | null;
  text: string;
  outcome: string;
  target: number;
  deadline: string;
  budget: number;
  channels: Platform[];
}

export interface BusinessProfile {
  name: string;
  website: string;
  industry: string;
  location: string;
  description: string;
  audience: { who: string; radius: string; pains: string };
  brandVoices: string[];
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

export const emptyBusiness: BusinessProfile = {
  name: '',
  website: '',
  industry: '',
  location: '',
  description: '',
  audience: { who: '', radius: '', pains: '' },
  brandVoices: [],
};

type StrategyStatus = 'Draft' | 'Awaiting approval' | 'Approved';

interface Toast {
  id: number;
  message: string;
}

export interface Workspace {
  campaign: { id: string; name: string; status: string; objective: string; audience: string; dateRange: string } | null;
  strategy: { title: string; audience: string; messages: string[]; conversionNote: string } | null;
  user: { email: string };
  business: BusinessProfile;
  products: Product[];
  sources: Source[];
  passages: Passage[];
  goal: GoalDraft;
  previousGoals: { goal: string; result: string; status: string; id?: string }[];
  strategyStatus: StrategyStatus;
  campaigns: { name: string; members: number | null; status: string; to: string }[];
  content: ContentItem[];
  accounts: Record<Platform, boolean>;
  posts: ScheduledPost[];
  results: ChannelResult[];
  websiteOutcomes: { visits: number; leads: number; source: string } | null;
  weeklyMembers: { week: string; members: number }[];
  pastRecommendations: { rec: string; decision: string; outcome: string }[];
}

interface AppState {
  campaign: Workspace['campaign'];
  strategy: Workspace['strategy'];
  refresh: () => Promise<Workspace>;
  ready: boolean;
  apiError: string | null;
  signedIn: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => void;

  business: BusinessProfile;
  products: Product[];
  saveBusiness: (payload: { business: BusinessProfile; products: Product[] }) => Promise<void>;

  goal: GoalDraft;
  setGoal: (g: GoalDraft) => Promise<void>;
  previousGoals: Workspace['previousGoals'];
  passages: Passage[];
  weeklyMembers: Workspace['weeklyMembers'];
  campaigns: Workspace['campaigns'];
  pastRecommendations: Workspace['pastRecommendations'];
  websiteOutcomes: Workspace['websiteOutcomes'];

  strategyStatus: StrategyStatus;
  generateStrategy: (g: GoalDraft) => Promise<string>;

  sources: Source[];
  addSource: (file: File, category: string) => Promise<void>;
  removeSource: (id: string) => Promise<void>;
  retrySource: (id: string) => Promise<void>;
  searchKnowledge: (query: string) => Promise<Passage[]>;

  content: ContentItem[];
  setContentStatus: (ids: string[], status: ContentStatus) => Promise<void>;
  updateCaption: (id: string, caption: string) => Promise<void>;

  accounts: Record<Platform, boolean>;
  connect: (p: Platform) => Promise<void>;

  posts: ScheduledPost[];
  retryPost: (id: string) => Promise<void>;
  movePost: (id: string, day: number) => Promise<void>;
  scheduleApproved: () => Promise<number>;

  results: ChannelResult[];
  setResults: (r: ChannelResult[], extra?: { visits: number; leads: number; websiteSource: string }) => Promise<void>;
  loadSampleResults: () => Promise<ChannelResult[]>;

  acceptRecommendation: (text: string) => Promise<void>;

  toasts: Toast[];
  notify: (message: string) => void;
}

const Ctx = createContext<AppState | null>(null);

const emptyAccounts: Record<Platform, boolean> = { LinkedIn: false, Instagram: false, Facebook: false };

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [campaign, setCampaign] = useState<Workspace['campaign']>(null);
  const [strategy, setStrategy] = useState<Workspace['strategy']>(null);
  const [ready, setReady] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [goal, setGoalState] = useState<GoalDraft>(defaultGoal);
  const [strategyStatus, setStrategyStatusState] = useState<StrategyStatus>('Draft');
  const [sources, setSources] = useState<Source[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [accounts, setAccounts] = useState<Record<Platform, boolean>>(emptyAccounts);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [results, setResultsState] = useState<ChannelResult[]>([]);
  const [business, setBusiness] = useState<BusinessProfile>(emptyBusiness);
  const [products, setProducts] = useState<Product[]>([]);
  const [previousGoals, setPreviousGoals] = useState<Workspace['previousGoals']>([]);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [weeklyMembers, setWeeklyMembers] = useState<Workspace['weeklyMembers']>([]);
  const [campaigns, setCampaigns] = useState<Workspace['campaigns']>([]);
  const [pastRecommendations, setPastRecommendations] = useState<Workspace['pastRecommendations']>([]);
  const [websiteOutcomes, setWebsiteOutcomes] = useState<Workspace['websiteOutcomes']>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const notify = useCallback((message: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const apply = useCallback((ws: Workspace) => {
    setCampaign(ws.campaign);
    setStrategy(ws.strategy);
    setBusiness(ws.business);
    setProducts(ws.products);
    setSources(ws.sources);
    setPassages(ws.passages);
    setGoalState({ ...defaultGoal, ...ws.goal, deadline: ws.goal.deadline || defaultGoal.deadline });
    setPreviousGoals(ws.previousGoals);
    setStrategyStatusState(ws.strategyStatus);
    setCampaigns(ws.campaigns);
    setContent(ws.content);
    setAccounts({ ...emptyAccounts, ...ws.accounts });
    setPosts(ws.posts);
    setResultsState(ws.results);
    setWebsiteOutcomes(ws.websiteOutcomes);
    setWeeklyMembers(ws.weeklyMembers);
    setPastRecommendations(ws.pastRecommendations);
    setApiError(null);
  }, []);

  const refresh = useCallback(async () => {
    const ws = await api<Workspace>('/workspace');
    apply(ws);
    return ws;
  }, [apply]);

  useEffect(() => {
    (async () => {
      if (!getToken()) {
        setReady(true);
        return;
      }
      try {
        await refresh();
        setSignedIn(true);
      } catch (err) {
        setToken(null);
        setSignedIn(false);
        setApiError(err instanceof Error ? err.message : 'Could not load workspace');
      } finally {
        setReady(true);
      }
    })();
  }, [refresh]);

  useEffect(() => {
    if (!signedIn || !sources.some((s) => s.status === 'Processing')) return;
    const timer = setInterval(() => {
      refresh().catch(() => undefined);
    }, 2000);
    return () => clearInterval(timer);
  }, [signedIn, sources, refresh]);

  const run = useCallback(
    async (fn: () => Promise<Workspace | (Workspace & { added?: number }) | void>) => {
      try {
        const ws = await fn();
        if (ws && 'sources' in ws) apply(ws as Workspace);
        setApiError(null);
        return ws;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Request failed';
        setApiError(message);
        throw err;
      }
    },
    [apply],
  );

  const value = useMemo<AppState>(
    () => ({
      campaign, strategy, refresh,
      ready,
      apiError,
      signedIn,
      signIn: async (email, password) => {
        const res = await api<{ token: string; workspace: Workspace }>('/auth/login', { body: { email, password } });
        setToken(res.token);
        apply(res.workspace);
        setSignedIn(true);
      },
      signUp: async (email, password, name) => {
        const res = await api<{ token: string; workspace: Workspace }>('/auth/signup', { body: { email, password, name } });
        setToken(res.token);
        apply(res.workspace);
        setSignedIn(true);
      },
      signOut: () => {
        setToken(null);
        setSignedIn(false);
      },
      business,
      products,
      saveBusiness: async (payload) => {
        await run(() =>
          api('/business', {
            method: 'PUT',
            body: { ...payload.business, products: payload.products },
          }),
        );
      },
      goal,
      setGoal: async (g) => {
        setGoalState(g);
        await run(() => api('/goals', { method: 'PUT', body: g }));
      },
      previousGoals,
      passages,
      weeklyMembers,
      campaigns,
      pastRecommendations,
      websiteOutcomes,
      strategyStatus,
      generateStrategy: async (g) => {
        const ws = await api<Workspace>('/goals', { method: 'PUT', body: g });
        apply(ws);
        const job = await api<AIJob>('/ai/generations', { body: { kind: 'strategy', goal_id: ws.goal.id } });
        return `/goals/${ws.goal.id}/strategy?generation=${job.id}`;
      },
      sources,
      addSource: async (file, category) => {
        const body = new FormData(); body.append('file', file); body.append('category', category);
        await api('/sources', { body });
        await refresh();
      },
      removeSource: async (id) => {
        await run(() => api(`/sources/${id}`, { method: 'DELETE' }));
      },
      retrySource: async (id) => {
        await run(() => api(`/sources/${id}/retry`, { method: 'POST', body: {} }));
      },
      searchKnowledge: (query) => api<Passage[]>('/knowledge/search', { body: { query } }),
      content,
      setContentStatus: async (ids, status) => {
        await run(() => api('/content/bulk-status', { body: { ids, status } }));
      },
      updateCaption: async (id, caption) => {
        await run(() => api(`/content/${id}`, { method: 'PATCH', body: { caption } }));
      },
      accounts,
      connect: async (p) => {
        await run(() => api(`/accounts/${p}/connect`, { method: 'POST', body: {} }));
      },
      posts,
      retryPost: async (id) => {
        await run(() => api(`/posts/${id}/retry`, { method: 'POST', body: {} }));
      },
      movePost: async (id, day) => {
        await run(() => api(`/posts/${id}/move`, { method: 'POST', body: { day } }));
      },
      scheduleApproved: async () => {
        const ws = (await run(() => api<Workspace & { added?: number }>('/schedule/approved', { method: 'POST', body: {} }))) as
          | (Workspace & { added?: number })
          | void;
        return ws?.added ?? 0;
      },
      results,
      setResults: async (r, extra) => {
        await run(() =>
          api('/results', {
            method: 'PUT',
            body: { rows: r, visits: extra?.visits, leads: extra?.leads, websiteSource: extra?.websiteSource },
          }),
        );
      },
      loadSampleResults: () => api<ChannelResult[]>('/results/sample'),
      acceptRecommendation: async (text) => {
        await run(() => api('/recommendation/accept', { body: { text } }));
      },
      toasts,
      notify,
    }),
    [
      campaign, strategy,
      ready,
      apiError,
      signedIn,
      business,
      products,
      goal,
      previousGoals,
      passages,
      weeklyMembers,
      campaigns,
      pastRecommendations,
      websiteOutcomes,
      strategyStatus,
      sources,
      content,
      accounts,
      posts,
      results,
      toasts,
      notify,
      apply,
      run,
      refresh,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppStoreProvider');
  return ctx;
}
