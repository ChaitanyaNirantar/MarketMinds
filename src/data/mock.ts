export type Platform = 'Instagram' | 'Facebook' | 'LinkedIn';
export const PLATFORMS: Platform[] = ['Instagram', 'Facebook', 'LinkedIn'];

export const business = {
  name: 'Iron Peak Fitness',
  website: 'https://ironpeakfitness.com',
  industry: 'Fitness studio',
  location: 'Champaign, IL',
  description:
    'Boutique strength-training studio offering small-group classes and personal training for beginners and returning lifters. Every session is coached.',
};

export const industries = [
  'Fitness studio',
  'Restaurant / café',
  'Retail shop',
  'Salon / spa',
  'Professional services',
  'Other',
];

export interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
}

export const products: Product[] = [
  { id: 'p1', name: 'Small-group class', description: '45-min coached session', price: '$18' },
  { id: 'p2', name: 'Beginner Foundations', description: '6-week small-group intro to lifting', price: '$149' },
];

export const brandVoices = ['Friendly', 'Professional', 'Playful', 'Authoritative', 'Inspirational'];

export type SourceType = 'PDF' | 'Website' | 'DOCX' | 'TXT';
export type SourceStatus = 'Indexed' | 'Processing' | 'Failed';

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  status: SourceStatus;
  chunks: number | null;
  progress?: number;
  error?: string;
}

export const sources: Source[] = [
  { id: 's1', name: 'services-and-prices.pdf', type: 'PDF', status: 'Indexed', chunks: 24 },
  { id: 's2', name: 'ironpeakfitness.com', type: 'Website', status: 'Indexed', chunks: 61 },
  { id: 's3', name: 'brand-guidelines.docx', type: 'DOCX', status: 'Processing', chunks: null, progress: 45 },
  { id: 's4', name: 'member-testimonials.txt', type: 'TXT', status: 'Indexed', chunks: 9 },
  {
    id: 's5',
    name: 'old-menu.pdf',
    type: 'PDF',
    status: 'Failed',
    chunks: null,
    error: 'This PDF is a scanned image with no readable text. Upload a text-based PDF or retry with OCR.',
  },
];

export interface Passage {
  text: string;
  source: string;
  score: number;
}

export const retrievalCorpus: Passage[] = [
  {
    text: 'Beginner Foundations: a 6-week small-group intro to lifting. Max 6 people per coach, no experience needed.',
    source: 'services-and-prices.pdf, p.2',
    score: 0.92,
  },
  {
    text: 'New members start with a free coached intro session. Book online and we will pair you with a coach.',
    source: 'ironpeakfitness.com/start',
    score: 0.88,
  },
  {
    text: '"I had never touched a barbell. Six weeks later I deadlifted my bodyweight." — Dana R.',
    source: 'member-testimonials.txt',
    score: 0.71,
  },
  {
    text: 'Small-group classes run 45 minutes, Monday to Saturday, 6 AM to 8 PM.',
    source: 'services-and-prices.pdf, p.1',
    score: 0.64,
  },
];

export const goalExamples = [
  'Get 50 class bookings this month',
  'Promote our new beginner program',
  'Grow our email list by 200',
];

export const previousGoals = [
  { goal: '50 trial signups (Sept)', result: '58 / 50', status: 'Completed' as const },
  { goal: 'Launch Saturday open gym (Aug)', result: '31 / 40', status: 'Missed' as const },
];

export type PhaseName = 'Awareness' | 'Education' | 'Social proof' | 'Conversion';

export const phases: { name: PhaseName; subtitle: string; start: number; end: number }[] = [
  { name: 'Awareness', subtitle: 'Reach new people', start: 0, end: 1.25 },
  { name: 'Education', subtitle: 'Show how classes work', start: 0.75, end: 2.25 },
  { name: 'Social proof', subtitle: 'Member stories', start: 1.75, end: 3.25 },
  { name: 'Conversion', subtitle: 'Free intro offer', start: 2.75, end: 4 },
];

export type ContentStatus = 'Draft' | 'Awaiting' | 'Edited' | 'Approved' | 'Rejected';

export interface ContentItem {
  id: string;
  week: number;
  topic: string;
  format: string;
  platform: Platform | 'All';
  phase: PhaseName;
  status: ContentStatus;
  caption: string;
  cta: string;
  grounding: string[];
}

export const contentItems: ContentItem[] = [
  {
    id: 'c1', week: 1, topic: 'Meet your coaches', format: 'Reel', platform: 'Instagram', phase: 'Awareness', status: 'Awaiting',
    caption: 'New to lifting? You are exactly who we built Iron Peak for. Meet the coaches who guide every rep. Try a free intro class this week. #beginnerfitness',
    cta: 'Book a free intro', grounding: ['services-and-prices.pdf', 'member-testimonials.txt'],
  },
  {
    id: 'c2', week: 1, topic: 'Myths about lifting', format: 'Carousel', platform: 'Instagram', phase: 'Awareness', status: 'Awaiting',
    caption: 'Myth: you need to be fit before you start lifting. Fact: our coaches start where you are. Swipe for 4 more myths we hear every week. #strengthtraining',
    cta: 'Book a free intro', grounding: ['ironpeakfitness.com'],
  },
  {
    id: 'c3', week: 2, topic: 'What a class looks like', format: 'Post', platform: 'Facebook', phase: 'Education', status: 'Awaiting',
    caption: 'Ever wondered what happens in a 45-minute Iron Peak class? Warm-up, coached lifts, a short finisher. Max 6 people per coach, so nobody gets lost.',
    cta: 'See the class schedule', grounding: ['services-and-prices.pdf'],
  },
  {
    id: 'c4', week: 2, topic: 'Why coached training works', format: 'Article post', platform: 'LinkedIn', phase: 'Education', status: 'Edited',
    caption: 'Busy professionals in Champaign: coached small-group strength training fits in 45 minutes and adapts to your level. Here is how our coaches plan each session.',
    cta: 'Book a free intro', grounding: ['services-and-prices.pdf', 'ironpeakfitness.com'],
  },
  {
    id: 'c5', week: 3, topic: 'Member story: Dana', format: 'Carousel', platform: 'Instagram', phase: 'Social proof', status: 'Approved',
    caption: '"I had never touched a barbell. Six weeks later I deadlifted my bodyweight." Dana started with Beginner Foundations. Your first session is free.',
    cta: 'Book a free intro', grounding: ['member-testimonials.txt'],
  },
  {
    id: 'c6', week: 3, topic: 'A morning at Iron Peak', format: 'Story', platform: 'Instagram', phase: 'Social proof', status: 'Approved',
    caption: '6 AM crew checking in. Coffee after, PRs during. Come see what mornings look like.',
    cta: 'Book a free intro', grounding: ['ironpeakfitness.com'],
  },
  {
    id: 'c7', week: 3, topic: 'Member Q&A thread', format: 'Post', platform: 'Facebook', phase: 'Social proof', status: 'Awaiting',
    caption: 'We asked members what surprised them most about their first month. Here are our favourite answers. What would you ask a coach?',
    cta: 'Book a free intro', grounding: ['member-testimonials.txt'],
  },
  {
    id: 'c8', week: 4, topic: 'Free intro week', format: 'Post + Story', platform: 'All', phase: 'Conversion', status: 'Awaiting',
    caption: 'Free intro week starts Monday. One coached session, zero pressure, no gym experience needed. Spots are limited to 6 per class.',
    cta: 'Claim your free intro', grounding: ['services-and-prices.pdf', 'ironpeakfitness.com'],
  },
  {
    id: 'c9', week: 4, topic: 'Last call: intro spots', format: 'Story', platform: 'Instagram', phase: 'Conversion', status: 'Awaiting',
    caption: 'Only a few free intro spots left this week. Tap to book yours.',
    cta: 'Claim your free intro', grounding: ['ironpeakfitness.com'],
  },
  {
    id: 'c10', week: 4, topic: 'Founder note', format: 'Post', platform: 'LinkedIn', phase: 'Conversion', status: 'Approved',
    caption: 'Why we started Iron Peak: strength training should not be intimidating. This month we are opening free intro sessions to the Champaign community.',
    cta: 'Book a free intro', grounding: ['ironpeakfitness.com'],
  },
  {
    id: 'c11', week: 2, topic: 'Lifting for runners', format: 'Post', platform: 'Facebook', phase: 'Education', status: 'Awaiting',
    caption: 'Runners: two strength sessions a week can make your miles feel easier. Our coaches build programs around your training.',
    cta: 'Book a free intro', grounding: ['services-and-prices.pdf'],
  },
  {
    id: 'c12', week: 1, topic: 'Guaranteed 10 lb loss', format: 'Post', platform: 'Facebook', phase: 'Awareness', status: 'Rejected',
    caption: 'Lose 10 lb in 2 weeks, guaranteed!',
    cta: 'Join now', grounding: [],
  },
];

export type ScheduleStatus = 'Scheduled' | 'Published' | 'Failed';

export interface ScheduledPost {
  id: string;
  title: string;
  platform: Platform;
  day: number;
  time: string;
  date: string;
  status: ScheduleStatus;
  error?: string;
}

export const scheduledPosts: ScheduledPost[] = [
  { id: 'sp1', title: 'Meet your coaches', platform: 'Instagram', day: 0, time: '9:00 AM', date: 'Nov 2', status: 'Scheduled' },
  { id: 'sp2', title: 'Why coached training works', platform: 'LinkedIn', day: 1, time: '9:00 AM', date: 'Nov 3', status: 'Scheduled' },
  { id: 'sp3', title: 'Lifting for runners', platform: 'Facebook', day: 2, time: '9:00 AM', date: 'Nov 4', status: 'Scheduled' },
  { id: 'sp4', title: 'Myths about lifting', platform: 'Instagram', day: 3, time: '9:00 AM', date: 'Nov 5', status: 'Published' },
  { id: 'sp5', title: 'What a class looks like', platform: 'Facebook', day: 4, time: '9:00 AM', date: 'Nov 6', status: 'Failed', error: 'Token expired. Reconnect Facebook, then retry.' },
  { id: 'sp6', title: 'Member story: Dana', platform: 'Instagram', day: 5, time: '9:00 AM', date: 'Nov 7', status: 'Scheduled' },
];

export type ResultSource = 'Connected' | 'Imported' | 'Sample' | 'Typed';

export interface ChannelResult {
  channel: Platform;
  impressions: number;
  clicks: number;
  leads: number;
  members: number;
  source: ResultSource;
}

export const channelResults: ChannelResult[] = [
  { channel: 'Instagram', impressions: 11400, clicks: 310, leads: 41, members: 22, source: 'Imported' },
  { channel: 'Facebook', impressions: 5200, clicks: 340, leads: 58, members: 34, source: 'Imported' },
  { channel: 'LinkedIn', impressions: 1600, clicks: 110, leads: 19, members: 11, source: 'Connected' },
];

export const sampleResults: ChannelResult[] = [
  { channel: 'Instagram', impressions: 9000, clicks: 250, leads: 30, members: 15, source: 'Sample' },
  { channel: 'Facebook', impressions: 4000, clicks: 260, leads: 45, members: 25, source: 'Sample' },
  { channel: 'LinkedIn', impressions: 1200, clicks: 80, leads: 14, members: 8, source: 'Sample' },
];

export const weeklyMembers = [
  { week: 'Wk 1', members: 9 },
  { week: 'Wk 2', members: 15 },
  { week: 'Wk 3', members: 19 },
  { week: 'Wk 4', members: 24 },
];

export const activeCampaigns = [
  { name: 'Fall Member Drive', members: 42 as number | null, status: 'Live' as const, to: '/campaigns/7' },
  { name: 'Referral Push', members: 25 as number | null, status: 'Live' as const, to: '/campaigns/7' },
  { name: 'Holiday Promo', members: null, status: 'Draft' as const, to: '/campaigns/7' },
];

export const pastRecommendations = [
  { rec: 'Post more reels (Sept)', decision: 'Accepted', outcome: '+12% visits' },
  { rec: 'Pause LinkedIn ads (Aug)', decision: 'Dismissed', outcome: '—' },
];
