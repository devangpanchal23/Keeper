/**
 * Krackerz Design System Tokens & Content Blueprint (60:30:10 Permanent System)
 * Strictly enforces:
 * - 60% Dominant Neutral: Cream (#F7F5EE), White (#FFFFFF), Ink (#111111), Grid Dot (#D3D0C5)
 * - 30% Secondary Brand (MAX 3 shades): Oxblood (#4E0F15), Maroon (#7A1710), Brick (#C4271B)
 * - 10% Accent: Lime (#C6FF2E) - Hard Budget: <= 10% in single viewport, <= 6% page-wide.
 */

export const KRACKERZ_TOKENS = {
  // 60% Dominant Neutral
  cream: "#F7F5EE",
  white: "#FFFFFF",
  ink: "#111111",
  gridDot: "#D3D0C5",

  // 30% Secondary Brand (Max 3 shades)
  oxblood: "#4E0F15", // Dark panels, pricing featured, footer, overlays
  maroon: "#7A1710",  // Mid-tone brand shade
  brick: "#C4271B",   // Single red for feature panels, stat cards, tags, checks

  // 10% Accent (Strictly regulated)
  lime: "#C6FF2E",
} as const;

export interface HeroCard {
  id: string;
  rotation: number;
  initialX: number;
  image: string;
  tag: string;
  tagBg: "white" | "oxblood";
  title: string;
  platform: string;
}

export const HERO_FAN_CARDS: HeroCard[] = [
  {
    id: "fan-1",
    rotation: -8,
    initialX: -40,
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80",
    tag: "TECH TALKS",
    tagBg: "white",
    title: "React 19 Server Actions Deep Dive",
    platform: "YouTube",
  },
  {
    id: "fan-2",
    rotation: -4,
    initialX: -20,
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80",
    tag: "UI LAB",
    tagBg: "oxblood",
    title: "Kinetic Kerning & Poster Motion",
    platform: "Instagram",
  },
  {
    id: "fan-3",
    rotation: 0,
    initialX: 0,
    image: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&auto=format&fit=crop&q=80",
    tag: "SCALE OPS",
    tagBg: "white",
    title: "1M DAU Redis Outage Post-Mortem",
    platform: "Reddit",
  },
  {
    id: "fan-4",
    rotation: 4,
    initialX: 20,
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80",
    tag: "AGENT RFC",
    tagBg: "oxblood",
    title: "Deterministic Execution Sandboxes",
    platform: "X / Twitter",
  },
  {
    id: "fan-5",
    rotation: 7,
    initialX: 40,
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&auto=format&fit=crop&q=80",
    tag: "ESSAY",
    tagBg: "white",
    title: "Founder Mode & Anti-Consensus",
    platform: "Substack",
  },
  {
    id: "fan-6",
    rotation: 10,
    initialX: 60,
    image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&auto=format&fit=crop&q=80",
    tag: "OPEN SOURCE",
    tagBg: "oxblood",
    title: "Tailwind v4 Oxide Rust Compiler",
    platform: "GitHub",
  },
];

export const PROBLEM_TICKETS = [
  {
    id: "prob-1",
    notch: "tr" as const,
    rotation: -2.5,
    color: KRACKERZ_TOKENS.brick, // Brick Red
    pillTag: "PROBLEM 01",
    headlineScript: "swallowed",
    headlineMain: "ALGORITHMS EAT YOUR SAVES",
    body: "You bookmark a breakthrough tutorial or architecture RFC. Within 24 hours, algorithmic feeds bury it beneath thousands of ephemeral posts. You never find it again.",
    statNum: "83%",
    statLabel: "of saved URLs are never viewed again",
  },
  {
    id: "prob-2",
    notch: "tr" as const,
    rotation: 2.5,
    color: KRACKERZ_TOKENS.oxblood, // Oxblood
    pillTag: "PROBLEM 02",
    headlineScript: "trapped",
    headlineMain: "WALLED GARDENS REFUSE TO TALK",
    body: "Reddit stays locked in Reddit. YouTube stays in playlists. Instagram stays in saved collections. Recall normalizes all 11 platforms into a sovereign knowledge database.",
    statNum: "11+",
    statLabel: "silos required to manage daily bookmarks",
  },
];

export const FEATURE_TABS = [
  {
    id: "feature-1",
    tabNumber: "01",
    tabLabel: "UNIVERSAL EXTRACTION",
    tabColor: KRACKERZ_TOKENS.brick,
    title: "TRUE CREATOR & TRANSCRIPT EXTRACTION",
    scriptWord: "real",
    description:
      "Paste any link. We fetch the actual author handle, clean thumbnail, transcript text, and article body. Never synthetic. Never hallucinated.",
    bullets: [
      "Exact YouTube Video ID & HQ Thumbnail extraction",
      "Full Instagram caption & verified creator attribution",
      "Reddit comments & OP content preserved permanently",
      "GitHub repo stats, README snippets, and commit hashes",
    ],
    ctaText: "TEST WITH LIVE URL",
    badgeIcon: "Rocket",
    badgeLabel: "ZERO GUESSING",
    image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "feature-2",
    tabNumber: "02",
    tabLabel: "GROUNDED MEMORY",
    tabColor: KRACKERZ_TOKENS.maroon,
    title: "GROUNDED NATURAL LANGUAGE RECALL",
    scriptWord: "human",
    description:
      "You will never remember the exact URL or video title. Search how human memory works: by vague concepts, partial memories, or natural questions.",
    bullets: [
      "Ask 'What did Theo say about React compiler?'",
      "99% semantic vector relevance score with provenance",
      "Instant answers citing the exact video and timestamp",
      "Local-first lightning search under 18 milliseconds",
    ],
    ctaText: "EXPLORE SEMANTIC SEARCH",
    badgeIcon: "Brain",
    badgeLabel: "PROVENANCE 100%",
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "feature-3",
    tabNumber: "03",
    tabLabel: "CROSS-PLATFORM VAULT",
    tabColor: KRACKERZ_TOKENS.oxblood,
    title: "THE TOPIC MATTERS. NOT THE PLATFORM.",
    scriptWord: "sovereign",
    description:
      "Organize content by your real projects. A YouTube keynote sits directly beside the Reddit critique that debunked its conclusions, all in one folder.",
    bullets: [
      "Cross-platform collections with custom color badges",
      "Offline export anytime to Markdown, JSON, or CSV",
      "No ad trackers, no telemetry profiling, zero lock-in",
      "Direct sync across desktop, tablet, and mobile browsers",
    ],
    ctaText: "OPEN VAULT WORKSPACE",
    badgeIcon: "Trophy",
    badgeLabel: "SOVEREIGN VAULT",
    image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
  },
];

export const TESTIMONIALS = [
  {
    id: "test-1",
    rotation: -2,
    color: KRACKERZ_TOKENS.brick,
    quote: "Recall is the only bookmarking tool that actually understands what I saved. Finding the exact React 19 talk by searching 'render cycle pitfalls' blew my mind.",
    name: "ALEX CHEN",
    role: "Staff Frontend Engineer",
    city: "San Francisco",
    tag: "VERIFIED BUILDER",
  },
  {
    id: "test-2",
    rotation: 2,
    color: KRACKERZ_TOKENS.maroon,
    quote: "My Instagram saves used to be a graveyard. Now I paste the reel link and have the creator, typography rules, and color palettes indexed permanently.",
    name: "SARA LINDQVIST",
    role: "Creative Art Director",
    city: "Stockholm",
    tag: "STUDIO LEAD",
  },
  {
    id: "test-3",
    rotation: -1.5,
    color: KRACKERZ_TOKENS.oxblood,
    quote: "Zero hallucination is the real differentiator. It quotes genuine Reddit threads and YouTube transcripts instead of making up generic AI garbage.",
    name: "MARCUS VOGEL",
    role: "AI Systems Researcher",
    city: "Berlin",
    tag: "ARXIV CONTRIBUTOR",
  },
  {
    id: "test-4",
    rotation: 2.5,
    color: KRACKERZ_TOKENS.brick,
    quote: "We canceled two other bookmark SaaS tools within 48 hours of testing Recall. The physical sticker aesthetic and speed make saving actually fun.",
    name: "PRIYA NAIR",
    role: "Founder & Product Lead",
    city: "London",
    tag: "BOOTSTRAPPER",
  },
];

export const FAQ_ITEMS = [
  {
    question: "How does Recall prevent AI hallucinations when saving links?",
    answer:
      "Unlike generic AI tools that guess content from a bare URL string, Recall follows a strict deterministic pipeline: Provider Detection → Content ID Extraction → Real Metadata Fetch → Text/Transcript Extraction → AI Synthesis ONLY on verified data. If real data is not available, Recall marks the item as METADATA_ONLY.",
  },
  {
    question: "Which platforms are natively supported today?",
    answer:
      "YouTube (including Shorts), Instagram (Reels & Posts), Reddit (Threads & Comments), X / Twitter (Posts & Threads), TikTok, LinkedIn, GitHub (Repos & Issues), Pinterest, Threads, Medium/Substack, and any open web article.",
  },
  {
    question: "Can I search my saved vault with conversational natural language?",
    answer:
      "Yes! You don't need to remember titles or tags. You can ask questions like 'Find that video I saved about React performance' or 'What broke in the 1M DAU infrastructure outage?' and Recall will match the semantic intent with grounded provenance.",
  },
  {
    question: "Is my saved data private and exportable?",
    answer:
      "100% sovereign. Your library is encrypted and local-first. You can export your entire collection, notes, summaries, and transcripts as a clean JSON or Markdown archive at any time with a single click in Settings.",
  },
  {
    question: "Do I need a credit card to get started?",
    answer:
      "No. You can start saving and testing URL extractions immediately. The Free Starter tier gives you universal ingestion and full semantic search out of the box.",
  },
];

export interface LaptopSticker {
  id: string;
  label: string;
  bg: string;
  text: string;
  initialX: number;
  initialY: number;
  initialRotate: number;
  shape: "diecut" | "pill" | "badge" | "ticket";
}

export const LAPTOP_STICKERS: LaptopSticker[] = [
  { id: "st-1", label: "ZERO GUESS", bg: KRACKERZ_TOKENS.ink, text: KRACKERZ_TOKENS.lime, initialX: 45, initialY: 35, initialRotate: -6, shape: "diecut" },
  { id: "st-2", label: "RECALL VAULT", bg: KRACKERZ_TOKENS.brick, text: KRACKERZ_TOKENS.white, initialX: 240, initialY: 40, initialRotate: 4, shape: "pill" },
  { id: "st-3", label: "100% GROUNDED", bg: KRACKERZ_TOKENS.oxblood, text: KRACKERZ_TOKENS.white, initialX: 460, initialY: 30, initialRotate: -3, shape: "badge" },
  { id: "st-4", label: "READING LIST", bg: KRACKERZ_TOKENS.cream, text: KRACKERZ_TOKENS.ink, initialX: 90, initialY: 150, initialRotate: 8, shape: "ticket" },
  { id: "st-5", label: "LOCAL FIRST", bg: KRACKERZ_TOKENS.brick, text: KRACKERZ_TOKENS.white, initialX: 290, initialY: 130, initialRotate: -4, shape: "pill" },
  { id: "st-6", label: "NO ADS EVER", bg: KRACKERZ_TOKENS.white, text: KRACKERZ_TOKENS.ink, initialX: 490, initialY: 140, initialRotate: 3, shape: "diecut" },
  { id: "st-7", label: "SUB-500ms TTFB", bg: KRACKERZ_TOKENS.maroon, text: KRACKERZ_TOKENS.white, initialX: 140, initialY: 250, initialRotate: -7, shape: "pill" },
  { id: "st-8", label: "SOVEREIGN DATA", bg: KRACKERZ_TOKENS.cream, text: KRACKERZ_TOKENS.ink, initialX: 370, initialY: 240, initialRotate: 5, shape: "badge" },
];
