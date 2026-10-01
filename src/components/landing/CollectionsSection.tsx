"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Folder,
  Layers,
  ArrowUpRight,
  Sparkles,
  ExternalLink,
  Tag,
  Clock,
  User,
  CheckCircle2,
  ChevronRight,
  Code2,
  Palette,
  Bot,
  TrendingUp,
} from "lucide-react";

interface CollectionItem {
  id: string;
  platform: string;
  platformColor: string;
  title: string;
  creator: string;
  creatorHandle: string;
  snippet: string;
  tag: string;
  durationOrRead: string;
}

interface CollectionCategory {
  id: string;
  number: string;
  name: string;
  icon: React.ElementType;
  description: string;
  accent: string;
  items: CollectionItem[];
}

const CATEGORIES: CollectionCategory[] = [
  {
    id: "engineering",
    number: "01",
    name: "React 19 & Distributed Systems",
    icon: Code2,
    description:
      "A complete technical inquiry uniting a 40-minute conference keynote, the GitHub RFC PR, and an intense HackerNews discussion on server actions.",
    accent: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    items: [
      {
        id: "item-1",
        platform: "YouTube",
        platformColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        title: "Deep Dive into React Server Components Architecture & Streaming SSR",
        creator: "Dan Abramov & Jack Herrington",
        creatorHandle: "@dan_abramov",
        snippet: "Explains wire format serialization, boundaries, and zero-bundle-size client boundaries.",
        tag: "Engineering",
        durationOrRead: "38 min watch",
      },
      {
        id: "item-2",
        platform: "GitHub",
        platformColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        title: "RFC: Async Server Functions and Optimistic Mutation Primitives #2847",
        creator: "React Core Working Group",
        creatorHandle: "facebook/react",
        snippet: "Source specification for `useActionState` and automatic pending transitions.",
        tag: "RFC / Spec",
        durationOrRead: "12 min read",
      },
      {
        id: "item-3",
        platform: "Reddit",
        platformColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        title: "Benchmark: SSR streaming latency in edge runtimes vs regional containers",
        creator: "u/distributed_nerd",
        creatorHandle: "r/reactjs",
        snippet: "94ms TTFB delta observed when co-locating KV cache at Frankfurt edge cluster.",
        tag: "Discussion",
        durationOrRead: "8 min read",
      },
      {
        id: "item-4",
        platform: "Substack",
        platformColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        title: "The Subtle Pitfalls of Waterfalls in Next.js App Router Page Trees",
        creator: "Lee Robinson",
        creatorHandle: "@leeerob",
        snippet: "Parallel data fetching strategies using `Promise.all` in async layout wrappers.",
        tag: "Architecture",
        durationOrRead: "6 min read",
      },
    ],
  },
  {
    id: "design",
    number: "02",
    name: "Design Direction & Micro-Interactions",
    icon: Palette,
    description:
      "Bridging tactile Swiss editorial typography, physical-digital skew aesthetics, and buttery 60fps spring physics.",
    accent: "bg-pink-500/10 text-pink-400 border-pink-500/30",
    items: [
      {
        id: "item-5",
        platform: "Instagram",
        platformColor: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20",
        title: "The Math of Kinetic Kerning in Contemporary Editorial Posters",
        creator: "Studio Feixen",
        creatorHandle: "@studiofeixen",
        snippet: "Variable font weight axes responding dynamically to viewport scroll momentum.",
        tag: "Typography",
        durationOrRead: "Reel • 45s",
      },
      {
        id: "item-6",
        platform: "Dribbble",
        platformColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        title: "Tactile Paper Ephemera UI Kit & Dimensional Shadow Physics",
        creator: "Bizkit Digital Agency",
        creatorHandle: "@bizkit",
        snippet: "Subtle 12-degree isometric tilt cards with dynamic ambient light occlusion.",
        tag: "Interaction",
        durationOrRead: "Case Study",
      },
      {
        id: "item-7",
        platform: "Twitter / X",
        platformColor: "bg-sky-500/10 text-sky-400 border-sky-500/20",
        title: "Why spring stiffness `170` and damping `26` feel native to the human thumb",
        creator: "Emil Kowalski",
        creatorHandle: "@emilkowalski_",
        snippet: "Physics simulation comparison between cubic-bezier easing and authentic spring mass.",
        tag: "Motion",
        durationOrRead: "Thread • 7 posts",
      },
      {
        id: "item-8",
        platform: "Medium",
        platformColor: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
        title: "Against the Bland Flat Gray: The Renaissance of Tactile High-Contrast UI",
        creator: "Rauno Freiberg",
        creatorHandle: "@raunofreiberg",
        snippet: "Crafting interfaces that feel physical, collectible, and unmistakably authorial.",
        tag: "Essay",
        durationOrRead: "10 min read",
      },
    ],
  },
  {
    id: "agents",
    number: "03",
    name: "Autonomous Agents & Memory Architecture",
    icon: Bot,
    description:
      "ArXiv research papers, live LangChain experiments, and community post-mortems on multi-agent execution loops.",
    accent: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    items: [
      {
        id: "item-9",
        platform: "ArXiv",
        platformColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        title: "Hierarchical Episodic Working Memory in Self-Refining LLM Agents",
        creator: "Park et al. (Stanford / Google)",
        creatorHandle: "arxiv:2404.1928",
        snippet: "Demonstrating 38% reduction in hallucination through vector-verified fact grounding.",
        tag: "Research Paper",
        durationOrRead: "18 pages",
      },
      {
        id: "item-10",
        platform: "YouTube",
        platformColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        title: "Building Production Agents: Context Truncation and Tool-Call Determinism",
        creator: "Harrison Chase",
        creatorHandle: "@hwchase17",
        snippet: "Defensive prompt engineering and structured schema validation for external tool state.",
        tag: "Conference Talk",
        durationOrRead: "45 min watch",
      },
      {
        id: "item-11",
        platform: "GitHub",
        platformColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        title: "autogen-core/agent_runtime.py: Token Budget Allocation Engine",
        creator: "Microsoft Research",
        creatorHandle: "microsoft/autogen",
        snippet: "Dynamic context window pruning based on semantic relevance decay curve.",
        tag: "Source Code",
        durationOrRead: "Code Review",
      },
      {
        id: "item-12",
        platform: "Reddit",
        platformColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        title: "Post-Mortem: Why our multi-agent customer support loop burned $4,000 in tokens in 2 hours",
        creator: "u/ycombinator_alumni",
        creatorHandle: "r/MachineLearning",
        snippet: "Recursive retry cascade triggered by an undocumented 429 rate limit response.",
        tag: "Post-Mortem",
        durationOrRead: "5 min read",
      },
    ],
  },
  {
    id: "strategy",
    number: "04",
    name: "Strategy, Leverage & Unfair Advantages",
    icon: TrendingUp,
    description:
      "Navigating capital efficiency, high-margin niche software, and asymmetric distribution in saturated markets.",
    accent: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    items: [
      {
        id: "item-13",
        platform: "Substack",
        platformColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        title: "The Architecture of Asymmetric Bets: Small Teams with 100x Output",
        creator: "Packy McCormick",
        creatorHandle: "Not Boring",
        snippet: "How small tooling-augmented engineering cells outmaneuver 500-person incumbents.",
        tag: "Strategy",
        durationOrRead: "14 min read",
      },
      {
        id: "item-14",
        platform: "YouTube",
        platformColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        title: "From $0 to $10M ARR with 4 Engineers: The Bootstrapper Playbook",
        creator: "Jason Cohen",
        creatorHandle: "@asmartbear",
        snippet: "Unit economics, negative churn through mission-critical workflow lock-in.",
        tag: "Masterclass",
        durationOrRead: "52 min watch",
      },
      {
        id: "item-15",
        platform: "Twitter / X",
        platformColor: "bg-sky-500/10 text-sky-400 border-sky-500/20",
        title: "The 10 rules for writing software that users refuse to cancel even in recessions",
        creator: "Shaan Puri",
        creatorHandle: "@ShaanVP",
        snippet: "Become the system of record. When deleting your app deletes company history, churn drops to zero.",
        tag: "Playbook",
        durationOrRead: "Thread",
      },
      {
        id: "item-16",
        platform: "Podcast",
        platformColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        title: "Acquired: The Untold Operating Philosophy Behind Nintendo's Creative Dominance",
        creator: "Ben Gilbert & David Rosenthal",
        creatorHandle: "Acquired FM",
        snippet: "Lateral thinking with withered technology: why constraints yield legendary intellectual property.",
        tag: "Audio Analysis",
        durationOrRead: "3 hrs 15 min",
      },
    ],
  },
];

export function CollectionsSection() {
  const [activeTab, setActiveTab] = useState<string>("engineering");

  const currentCategory = CATEGORIES.find((c) => c.id === activeTab) || CATEGORIES[0];

  return (
    <section id="collections" className="relative py-28 px-4 sm:px-6 lg:px-8 bg-[#090b10] border-t border-white/5 overflow-hidden">
      {/* Background architectural grain grid */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 pb-8 border-b border-white/10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono tracking-widest uppercase text-white/70 mb-4">
              <Folder className="w-3.5 h-3.5 text-amber-400" />
              <span>Chapter 03 / Cross-Platform Harmony</span>
            </div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.05]">
              THE TOPIC MATTERS.
              <br />
              <span className="text-white/40">NOT THE PLATFORM.</span>
            </h2>
          </div>

          <div className="max-w-md">
            <p className="text-base text-zinc-400 leading-relaxed font-light">
              Platforms are walled gardens designed to trap attention. Recall breaks down the silos: a YouTube keynote sits directly beside the Reddit critique that tested its assumptions, organized by project in your personal vault.
            </p>
          </div>
        </div>

        {/* Category Tabs (File folder / Index card aesthetic) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-10">
          {CATEGORIES.map((category) => {
            const isActive = category.id === activeTab;
            const Icon = category.icon;

            return (
              <button
                key={category.id}
                onClick={() => setActiveTab(category.id)}
                className={`group relative text-left p-4 sm:p-5 rounded-xl border transition-all duration-300 ${
                  isActive
                    ? "bg-white/[0.08] border-white/30 shadow-[0_10px_30px_rgba(0,0,0,0.5)] translate-y-[-2px]"
                    : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/15"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`font-mono text-xs font-bold tracking-widest ${
                      isActive ? "text-amber-400" : "text-zinc-500 group-hover:text-zinc-400"
                    }`}
                  >
                    {category.number}
                  </span>
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                    }`}
                  />
                </div>

                <div className="text-sm sm:text-base font-bold text-white tracking-tight line-clamp-1">
                  {category.name}
                </div>

                <div className="mt-1 text-xs text-zinc-400 flex items-center gap-1.5">
                  <span>{category.items.length} artifacts</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-500 font-mono text-[11px]">Synced</span>
                </div>

                {isActive && (
                  <div className="absolute -bottom-[1px] left-4 right-4 h-[2px] bg-gradient-to-r from-amber-400 via-rose-400 to-indigo-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Active Category Description Banner */}
        <div className="mb-8 p-4 sm:p-5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                Collection Synthesizer
              </div>
              <div className="text-sm font-medium text-white/90">
                {currentCategory.description}
              </div>
            </div>
          </div>

          <Link
            href="/app/collections"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white transition-colors shrink-0"
          >
            <span>Explore collections in vault</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Grid of Cross-Platform Items */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
          {currentCategory.items.map((item, idx) => (
            <div
              key={item.id}
              className="group relative p-6 rounded-2xl bg-white/[0.025] hover:bg-white/[0.05] border border-white/10 hover:border-white/20 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Platform Badge & Meta Bar */}
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${item.platformColor}`}
                    >
                      {item.platform}
                    </span>
                    <span className="text-xs font-mono text-zinc-500">
                      {item.durationOrRead}
                    </span>
                  </div>

                  <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                    {item.tag}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-amber-300 transition-colors tracking-tight mb-3 leading-snug">
                  {item.title}
                </h3>

                {/* Extracted Grounded Snippet */}
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-light mb-4 line-clamp-2">
                  &ldquo;{item.snippet}&rdquo;
                </p>
              </div>

              {/* Creator & Index Footer */}
              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono font-bold text-white">
                    {item.creator.slice(0, 1)}
                  </div>
                  <div className="text-xs text-zinc-300">
                    <span className="font-medium">{item.creator}</span>
                    <span className="text-zinc-500 ml-1.5 font-mono text-[11px]">
                      {item.creatorHandle}
                    </span>
                  </div>
                </div>

                <div className="text-xs font-mono text-zinc-600 group-hover:text-zinc-400 flex items-center gap-1 transition-colors">
                  <span>Archived</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/80" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA hook */}
        <div className="mt-12 text-center">
          <Link
            href="/app/collections"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-white transition-all duration-300 hover:scale-[1.02]"
          >
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Create custom collections with smart rules in your vault</span>
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </Link>
        </div>
      </div>
    </section>
  );
}
