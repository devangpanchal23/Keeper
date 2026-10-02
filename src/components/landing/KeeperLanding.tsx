"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Camera,
  Check,
  ChevronDown,
  Command,
  CirclePlay,
  FileText,
  Folder,
  Globe2,
  Menu,
  MessageCircle,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useRecall } from "@/context/RecallContext";
import { AddContentModal } from "@/components/modals/AddContentModal";
import { getPlanLabel } from "@/lib/user-plan";
import { startKeeperSubscription } from "@/lib/subscription-checkout";

type DemoSave = {
  title: string;
  creator: string;
  source: string;
  collection: string;
  kind: string;
  excerpt: string;
  icon: typeof CirclePlay;
  tone: string;
};

const demoSaves: DemoSave[] = [
  {
    title: "10 React Performance Pitfalls Every Senior Dev Should Avoid in 2025",
    creator: "Theo Browne · @t3dotgg",
    source: "YouTube",
    collection: "React Learning",
    kind: "VIDEO · 24:15",
    excerpt: "Profile real bottlenecks first. React Compiler now handles many memoization cases automatically.",
    icon: CirclePlay,
    tone: "red",
  },
  {
    title: "How to Build Production Multi-Agent Systems That Don’t Hallucinate",
    creator: "Andrej Karpathy · @karpathy",
    source: "X / Twitter",
    collection: "AI & Automation",
    kind: "THREAD · 14 POSTS",
    excerpt: "Bound each agent’s execution budget, validate structured outputs, and keep an append-only event log.",
    icon: MessageCircle,
    tone: "ink",
  },
  {
    title: "Sleek Button Hover States with Framer Motion & CSS Variables",
    creator: "Minimalist UI · @minimalist.ui",
    source: "Instagram",
    collection: "UI Inspiration",
    kind: "REEL · SOURCE DETAILS",
    excerpt: "Track pointer position with CSS variables to create a responsive radial highlight without rerendering.",
    icon: Camera,
    tone: "plum",
  },
];

const steps = [
  {
    number: "01",
    title: "Save from anywhere",
    description: "Paste a link from YouTube, Instagram, Reddit, LinkedIn, X, or a web page.",
    icon: Bookmark,
  },
  {
    number: "02",
    title: "Keep the useful context",
    description: "Keeper organizes the source details and builds a concise, searchable summary when content is available.",
    icon: Sparkles,
  },
  {
    number: "03",
    title: "Find it in your own words",
    description: "Search by a title, creator, topic, or the half-remembered idea you want to revisit.",
    icon: Search,
  },
];

const faqs = [
  {
    question: "What can I save to Keeper?",
    answer: "Keeper accepts links from YouTube, Instagram, Reddit, LinkedIn, X, and the wider web. The details it can extract depend on what each source makes available.",
  },
  {
    question: "Does Keeper replace the original source?",
    answer: "No. A saved item keeps its source link and available creator and description details. AI summaries and extracted topics are stored as derived information alongside that source context.",
  },
  {
    question: "Can I search without remembering the exact title?",
    answer: "Yes. Search across titles, source descriptions, creators, tags, collections, and available summaries using the words you remember.",
  },
  {
    question: "What happens when a platform restricts a post?",
    answer: "Keeper keeps the link and any details you provide or imported. It marks unavailable media honestly instead of substituting an unrelated image.",
  },
  {
    question: "How are save credits used?",
    answer: "Each successfully saved item uses one credit. Items skipped as duplicates or unsupported during a bulk import don’t use credits.",
  },
  {
    question: "Is there an extra charge for bulk imports?",
    answer: "No per-import fee is proposed. Bulk imports draw from your plan’s save-credit allowance, one credit for each item Keeper successfully saves.",
  },
];

function KeeperMark({ light = false }: { light?: boolean }) {
  return (
    <span className={`keeper-mark${light ? " keeper-mark-light" : ""}`} aria-hidden="true">
      K
    </span>
  );
}

function KeeperNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { openAddContent, user, isAuthenticated, authLoading, logout } = useRecall();
  const router = useRouter();
  const links = [
    { label: "How it works", href: "#how-it-works" },
    { label: "The workspace", href: "#product" },
    { label: "Pricing", href: "#pricing" },
    { label: "Why Keeper", href: "#why-keeper" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <header className="keeper-nav-wrap">
      <div className="keeper-nav">
        <Link href="/" className="keeper-wordmark" aria-label="Keeper home">
          <KeeperMark />
          <span>keeper</span>
        </Link>

        <nav className="keeper-nav-links" aria-label="Main navigation">
          {links.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
        </nav>

        <div className="keeper-nav-actions">
          {!authLoading && (isAuthenticated && user ? (
            <div className="keeper-nav-account">
              <button
                type="button"
                className="keeper-nav-avatar"
                aria-label={`Open ${user.name}'s account menu (${getPlanLabel(user.tier)} plan)`}
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((open) => !open)}
              >
                {user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
              </button>
              {profileOpen && <>
                <button type="button" className="keeper-nav-account-dismiss" aria-label="Close account menu" onClick={() => setProfileOpen(false)} />
                <div className="keeper-nav-account-menu">
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                  <small>{getPlanLabel(user.tier)} workspace</small>
                  <Link href="/app" onClick={() => setProfileOpen(false)}>Open workspace <ArrowUpRight size={14} /></Link>
                  <Link href="/app/profile" onClick={() => setProfileOpen(false)}>Profile &amp; account <ArrowUpRight size={14} /></Link>
                  <button type="button" onClick={() => {
                    logout();
                    setProfileOpen(false);
                    router.push("/sign-in");
                  }}>Log out</button>
                </div>
              </>}
            </div>
          ) : <Link href="/sign-in" className="keeper-nav-signin">Sign in</Link>)}
          {!authLoading && (isAuthenticated ? (
            <button type="button" className="keeper-button keeper-button-dark keeper-nav-cta" onClick={() => openAddContent()}>
              Save a link <ArrowUpRight size={15} />
            </button>
          ) : (
            <Link href="/sign-up" className="keeper-button keeper-button-dark keeper-nav-cta">Create account <ArrowRight size={15} /></Link>
          ))}
          <button
            type="button"
            className="keeper-menu-toggle"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="keeper-mobile-menu">
          <nav aria-label="Mobile navigation">
            {links.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}<ArrowUpRight size={16} /></a>
            ))}
          </nav>
          {!authLoading && (isAuthenticated ? (
            <>
              <Link href="/app" onClick={() => setMenuOpen(false)}>Open your workspace <ArrowRight size={16} /></Link>
              <button type="button" className="keeper-button keeper-button-quiet" onClick={() => {
                logout();
                setMenuOpen(false);
                router.push("/sign-in");
              }}>Log out</button>
            </>
          ) : <Link href="/sign-in" onClick={() => setMenuOpen(false)}>Sign in to your library <ArrowRight size={16} /></Link>)}
          {isAuthenticated ? (
            <button type="button" className="keeper-button keeper-button-dark" onClick={() => { setMenuOpen(false); openAddContent(); }}>
              Save a link <ArrowUpRight size={15} />
            </button>
          ) : (
            <Link href="/sign-up" onClick={() => setMenuOpen(false)} className="keeper-button keeper-button-dark">Create account <ArrowRight size={15} /></Link>
          )}
        </div>
      )}
    </header>
  );
}

function ProductPreview() {
  const [activeTab, setActiveTab] = useState<"library" | "collections" | "search">("library");
  const [activeSave, setActiveSave] = useState(0);
  const [query, setQuery] = useState("render performance");
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const save = demoSaves[activeSave];
  const searchTerms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const filteredSaves = demoSaves.filter((item) => {
    const content = `${item.title} ${item.creator} ${item.collection} ${item.excerpt}`.toLowerCase();
    return searchTerms.some((term) => content.includes(term));
  });

  const cycleSave = (direction: number) => {
    setActiveSave((current) => (current + direction + demoSaves.length) % demoSaves.length);
  };

  return (
    <div className="keeper-product-frame" aria-label="Interactive preview of the Keeper library">
      <div className="keeper-window-bar">
        <div className="keeper-window-dots" aria-hidden="true"><i /><i /><i /></div>
        <div className="keeper-window-title"><KeeperMark light /><span>keeper / sample library</span></div>
        <div className="keeper-window-shortcut"><Command size={12} /> K</div>
      </div>

      <div className="keeper-workspace-preview">
        <aside className="keeper-preview-sidebar" aria-label="Preview navigation">
          <div className="keeper-preview-side-brand"><KeeperMark /><span>Keeper</span></div>
          <span className="keeper-side-label">YOUR SPACE</span>
          <button type="button" className={`keeper-side-link${activeTab === "library" ? " is-active" : ""}`} onClick={() => setActiveTab("library")}><Bookmark size={15} /> All saves</button>
          <button type="button" className={`keeper-side-link${activeTab === "collections" ? " is-active" : ""}`} onClick={() => setActiveTab("collections")}><Folder size={15} /> Collections</button>
          <button type="button" className={`keeper-side-link${activeTab === "search" ? " is-active" : ""}`} onClick={() => setActiveTab("search")}><Search size={15} /> Search</button>
          <div className="keeper-preview-collections">
            <span className="keeper-side-label">COLLECTIONS</span>
            <span><i className="collection-dot dot-gold" /> React Learning</span>
            <span><i className="collection-dot dot-lilac" /> AI &amp; Automation</span>
            <span><i className="collection-dot dot-green" /> UI Inspiration</span>
          </div>
          <div className="keeper-preview-profile"><span className="keeper-avatar">K</span><span><b>Sample workspace</b><small>Personal library</small></span></div>
        </aside>

        <main className="keeper-preview-main">
          <div className="keeper-preview-heading">
            <div><span className="keeper-overline">A LITTLE MORE FINDABLE</span><h2>{activeTab === "collections" ? "Collections" : activeTab === "search" ? "Search your saves" : "Recently saved"}</h2></div>
            <button type="button" className="keeper-preview-add" onClick={() => setActiveTab("library")}><span>+</span> Add save</button>
          </div>

          {activeTab === "search" ? (
            <div className="keeper-demo-search">
              <label className="keeper-demo-searchbox"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search demo saves" /><span>⌘ K</span></label>
              <p className="keeper-search-caption">MATCHES FROM YOUR SAVED CONTEXT</p>
              {(filteredSaves.length ? filteredSaves : []).map((item) => (
                <button className="keeper-search-result" key={item.title} onClick={() => { setActiveSave(demoSaves.indexOf(item)); setActiveTab("library"); }}>
                  <span className={`keeper-source-icon tone-${item.tone}`}><item.icon size={15} /></span><span><b>{item.title}</b><small>{item.source} · {item.collection}</small></span><ArrowUpRight size={14} />
                </button>
              ))}
              {filteredSaves.length === 0 && <p className="keeper-no-results">No sample saves match that search.</p>}
            </div>
          ) : activeTab === "collections" ? (
            <div className="keeper-collection-list">
              {demoSaves.map((item, index) => (
                <button type="button" key={item.collection} className="keeper-collection-row" onClick={() => { setActiveSave(index); setActiveTab("library"); }}>
                  <span className={`collection-illustration collection-${index}`}><Folder size={19} /></span>
                  <span><b>{item.collection}</b><small>{item.source} · one saved reference</small></span><ArrowUpRight size={15} />
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="keeper-preview-filter-row"><span>All sources <ChevronDown size={13} /></span><span>Recently added <ChevronDown size={13} /></span><span className="keeper-preview-count">YOUR SAVED STREAM</span></div>
              <div
                className="keeper-card-stack"
                aria-live="polite"
                onTouchStart={(event) => { const touch = event.touches[0]; touchStart.current = { x: touch.clientX, y: touch.clientY }; }}
                onTouchEnd={(event) => {
                  const start = touchStart.current;
                  const touch = event.changedTouches[0];
                  touchStart.current = null;
                  if (start && Math.abs(touch.clientX - start.x) > 42 && Math.abs(touch.clientX - start.x) > Math.abs(touch.clientY - start.y)) {
                    cycleSave(touch.clientX < start.x ? 1 : -1);
                  }
                }}
              >
                {[1, 2].map((depth) => {
                  const behind = demoSaves[(activeSave + depth) % demoSaves.length];
                  return <div key={depth} className={`keeper-stack-shadow keeper-stack-shadow-${depth}`} aria-hidden="true"><span>{behind.title}</span></div>;
                })}
                <article className="keeper-save-card" key={save.title}>
                  <div className={`keeper-save-art tone-${save.tone}`}>
                    <span className="keeper-art-index">0{activeSave + 1} <span>/ 03</span></span>
                    <span className="keeper-art-icon"><save.icon size={22} /></span>
                    <span className="keeper-art-kind">{save.kind}</span>
                    <span className="keeper-art-word">{save.source === "YouTube" ? "Watch" : save.source === "Instagram" ? "Look" : "Read"}<i>.</i></span>
                  </div>
                  <div className="keeper-save-info">
                    <div className="keeper-save-tags"><span>{save.source}</span><span>{save.collection}</span></div>
                    <h3>{save.title}</h3>
                    <p>{save.creator}</p>
                    <div className="keeper-card-footer"><span><FileText size={13} /> Source details kept</span><button type="button" aria-label="Show next saved item" onClick={() => cycleSave(1)}><ArrowRight size={15} /></button></div>
                  </div>
                </article>
              </div>
              <div className="keeper-preview-pagination"><button type="button" onClick={() => cycleSave(-1)} aria-label="Previous saved item">←</button><span>{String(activeSave + 1).padStart(2, "0")} <i /> {String(demoSaves.length).padStart(2, "0")}</span><button type="button" onClick={() => cycleSave(1)} aria-label="Next saved item">→</button></div>
            </>
          )}
        </main>

        <aside className="keeper-preview-detail">
          <span className="keeper-overline">THE GOOD PART</span>
          <div className="keeper-detail-glyph"><Sparkles size={16} /></div>
          <p className="keeper-detail-label">A useful note, ready when you are</p>
          <h3>{save.excerpt}</h3>
          <div className="keeper-detail-rule" />
          <span className="keeper-overline">FILED UNDER</span>
          <span className="keeper-detail-collection"><i className="collection-dot dot-gold" />{save.collection}</span>
          <span className="keeper-detail-source"><Globe2 size={13} /> Original source linked</span>
        </aside>
      </div>
      <div className="keeper-preview-caption"><span>YOUR IDEAS, NOT YOUR TABS.</span><span>SAMPLE CONTENT · INTERACTIVE PREVIEW <i /></span></div>
    </div>
  );
}

function StepSection() {
  return (
    <section id="how-it-works" className="keeper-section keeper-how">
      <div className="keeper-section-intro">
        <span className="keeper-overline">A SMALL, BETTER HABIT</span>
        <h2>From “I’ll find it later”<br />to <em>found.</em></h2>
        <p>One quiet place for the things you want to remember. No new workflow to learn.</p>
      </div>
      <div className="keeper-steps">
        {steps.map(({ number, title, description, icon: Icon }) => (
          <article className="keeper-step" key={number}>
            <div className="keeper-step-top"><span>{number}</span><Icon size={19} strokeWidth={1.6} /></div>
            <h3>{title}</h3><p>{description}</p>
          </article>
        ))}
      </div>
      <a className="keeper-text-link" href="#product">Take a look inside <ArrowDown size={15} /></a>
    </section>
  );
}

function SourceSection() {
  return (
    <section id="why-keeper" className="keeper-source-section">
      <div className="keeper-source-copy">
        <span className="keeper-overline">GOOD CONTEXT CHANGES EVERYTHING</span>
        <h2>Keep the source.<br /><em>Keep the meaning.</em></h2>
        <p>A link is only the beginning. Keeper keeps the creator, original details, and your own notes close to the ideas worth saving.</p>
        <ul className="keeper-check-list">
          <li><Check size={16} /> Creator and source stay attached</li>
          <li><Check size={16} /> Summaries sit alongside original details</li>
          <li><Check size={16} /> Group ideas by the way you think</li>
        </ul>
        <Link href="/app/library" className="keeper-text-link">Explore your library <ArrowRight size={15} /></Link>
      </div>
      <div className="keeper-source-visual">
        <div className="keeper-context-paper">
          <span className="keeper-overline">SOURCE NOTE · YOUTUBE</span>
          <h3>10 React Performance Pitfalls Every Senior Dev Should Avoid in 2025</h3>
          <p className="keeper-context-author">Theo Browne <span>·</span> @t3dotgg</p>
          <div className="keeper-context-divider" />
          <span className="keeper-overline">KEEPER SUMMARY</span>
          <p>Profile real bottlenecks first. React Compiler handles many memoization cases automatically; context splitting still matters.</p>
          <div className="keeper-context-tags"><span>React</span><span>Performance</span><span>Frontend</span></div>
          <div className="keeper-context-url"><Globe2 size={13} /> youtube.com <ArrowUpRight size={13} /></div>
        </div>
        <div className="keeper-context-stamp"><Bookmark size={15} /><span>STILL<br />YOURS</span></div>
      </div>
    </section>
  );
}

function SourcesSection() {
  const sources = [
    { name: "YouTube", icon: CirclePlay, kind: "Videos & Shorts" },
    { name: "Instagram", icon: Camera, kind: "Posts & Reels" },
    { name: "Reddit", icon: MessageCircle, kind: "Threads & comments" },
    { name: "LinkedIn", icon: Globe2, kind: "Posts & articles" },
    { name: "X", icon: MessageCircle, kind: "Posts & threads" },
    { name: "The web", icon: FileText, kind: "Articles & notes" },
  ];

  return (
    <section className="keeper-sources-section">
      <div className="keeper-sources-heading"><span className="keeper-overline">THE INTERNET IS A BIG PLACE</span><h2>One place to <em>keep up.</em></h2><p>Bring useful things home from the places you already read and watch.</p></div>
      <div className="keeper-source-list">
        {sources.map(({ name, icon: Icon, kind }) => <div key={name} className="keeper-source-item"><span className="keeper-source-badge"><Icon size={17} /></span><span><b>{name}</b><small>{kind}</small></span><Check size={15} className="keeper-source-check" /></div>)}
      </div>
    </section>
  );
}

function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<{ text: string; error: boolean } | null>(null);
  const { user, isAuthenticated, addToast, syncBillingTier } = useRecall();
  const isYearly = billingCycle === "yearly";
  const plans = [
    {
      name: "Basic",
      monthlyPrice: "₹300",
      yearlyPrice: "₹3,500",
      monthlyCredits: "300 save credits each month",
      yearlyCredits: "3,600 save credits for the year",
      monthlyCreditCount: 300,
      yearlyCreditCount: 3600,
      saving: "₹100",
      featured: false,
      benefits: [
        "Bulk import supported exports and bookmark files",
        "1 credit per successfully saved item",
        "Collections, tags, favorites, and full-library search",
        "AI summaries when source content is available",
      ],
    },
    {
      name: "Pro",
      monthlyPrice: "₹500",
      yearlyPrice: "₹5,500",
      monthlyCredits: "500 save credits each month",
      yearlyCredits: "6,000 save credits for the year",
      monthlyCreditCount: 500,
      yearlyCreditCount: 6000,
      saving: "₹500",
      featured: true,
      benefits: [
        "Bulk import larger libraries from supported exports and files",
        "1 credit per successfully saved item",
        "Collections, tags, favorites, and full-library search",
        "Detailed AI summaries, topics, and key points when content allows",
        "Transcript search and smart organization when source media is available",
      ],
    },
  ];

  const startCheckout = async (plan: "basic" | "pro") => {
    if (!isAuthenticated || !user) return;
    const checkoutKey = `${plan}-${billingCycle}`;
    setCheckoutBusy(checkoutKey);
    setCheckoutMessage(null);

    try {
      const result = await startKeeperSubscription({ plan, billingCycle, name: user.name, email: user.email });
      if (result === "cancelled") { setCheckoutBusy(null); return; }
      try {
        const billingResponse = await fetch("/api/billing", { cache: "no-store" });
        if (billingResponse.ok) {
          const billing = await billingResponse.json() as { tier?: "free" | "basic" | "pro" };
          if (billing.tier) syncBillingTier(billing.tier);
        }
      } catch (refreshError) {
        console.warn("Payment is verified, but the visible plan badge could not refresh:", refreshError);
      }
      const planLabel = plan === "basic" ? "Basic" : "Pro";
      const message = `Your ${planLabel} plan is authorized. Your 7-day trial is active; the first recurring charge is scheduled after the trial.`;
      setCheckoutMessage({ text: message, error: false });
      addToast("Plan activated", message, "success");
      setCheckoutBusy(null);
    } catch (error) {
      setCheckoutMessage({ text: error instanceof Error ? error.message : "Checkout could not be started.", error: true });
      setCheckoutBusy(null);
    }
  };

  return (
    <section id="pricing" className="keeper-pricing-section">
      <div className="keeper-pricing-heading">
        <span className="keeper-overline">SIMPLE, CLEAR PRICING</span>
        <h2>A plan that fits<br /><em>your library.</em></h2>
        <p>Choose a plan and billing rhythm. Start with a 7-day trial, then your selected amount renews automatically until you cancel.</p>
      </div>
      <div className="keeper-billing-toggle" role="group" aria-label="Choose a billing period">
        <button type="button" aria-pressed={!isYearly} className={!isYearly ? "is-selected" : ""} onClick={() => setBillingCycle("monthly")}>Monthly</button>
        <button type="button" aria-pressed={isYearly} className={isYearly ? "is-selected" : ""} onClick={() => setBillingCycle("yearly")}>Yearly <span>Save up to 8.3%</span></button>
      </div>
      <div className="keeper-pricing-grid">
        {plans.map((plan) => <article key={plan.name} className={`keeper-plan-card${plan.featured ? " keeper-plan-card-featured" : ""}`}>
          <div className="keeper-plan-topline"><span>KEEPER {plan.name.toUpperCase()}</span><span className="keeper-plan-save">{isYearly ? `SAVE ${plan.saving}` : "FLEXIBLE"}</span></div>
          <h3>{plan.name}</h3>
          <p className="keeper-plan-price"><strong>{isYearly ? plan.yearlyPrice : plan.monthlyPrice}</strong><span>/ {isYearly ? "year" : "month"}</span></p>
          <p className="keeper-plan-billing">{isYearly ? <>Then {plan.yearlyPrice} every year · Save {plan.saving} vs monthly</> : <>Then {plan.monthlyPrice} every month</>}</p>
          <p className="keeper-plan-credit-allocation">{isYearly ? plan.yearlyCredits : plan.monthlyCredits}</p>
          {isAuthenticated ? (
            <button type="button" disabled={checkoutBusy !== null} onClick={() => void startCheckout(plan.name.toLowerCase() as "basic" | "pro")} className={`keeper-button keeper-plan-cta${plan.featured ? " keeper-button-gold" : " keeper-button-dark"}`}>
              {checkoutBusy === `${plan.name.toLowerCase()}-${billingCycle}` ? "Opening secure checkout…" : "Start 7-day trial"}<ArrowRight size={15} />
            </button>
          ) : (
            <Link href={`/sign-in?next=${encodeURIComponent("/#pricing")}`} className={`keeper-button keeper-plan-cta${plan.featured ? " keeper-button-gold" : " keeper-button-dark"}`}>Sign in to continue <ArrowRight size={15} /></Link>
          )}
          <ul>{plan.benefits.map((benefit) => <li key={benefit}><Check size={15} />{benefit}</li>)}</ul>
        </article>)}
      </div>
      {checkoutMessage && <p role={checkoutMessage.error ? "alert" : "status"} className="keeper-pricing-status">{checkoutMessage.text}</p>}
      <p className="keeper-pricing-credit-note">A credit is used only when Keeper successfully saves an item. Duplicate or unsupported entries in an import don’t use credits.</p>
      <p className="keeper-pricing-status">Payments are one-time and collected immediately. No free trial, recurring renewal, or automatic charge is active.</p>
    </section>
  );
}

function FAQSection() {
  return (
    <section id="faq" className="keeper-faq-section">
      <div className="keeper-faq-heading"><span className="keeper-overline">A FEW GOOD QUESTIONS</span><h2>Before you <em>begin.</em></h2><p>Still curious? Your library is a good place to start.</p><Link href="/sign-up" className="keeper-text-link">Create your space <ArrowRight size={15} /></Link></div>
      <div className="keeper-faq-list">
        {faqs.map((item) => <details key={item.question} className="keeper-faq-item"><summary>{item.question}<span><ChevronDown size={17} /></span></summary><p>{item.answer}</p></details>)}
      </div>
    </section>
  );
}

function KeeperFooter() {
  return (
    <footer className="keeper-footer">
      <div className="keeper-footer-main">
        <div className="keeper-footer-brand"><Link href="/" className="keeper-wordmark"><KeeperMark light /><span>keeper</span></Link><p>A home for the things you don’t want to lose.</p></div>
        <div className="keeper-footer-links"><span>EXPLORE</span><a href="#how-it-works">How it works</a><a href="#product">The workspace</a><a href="#pricing">Pricing</a><a href="#faq">Questions</a></div>
        <div className="keeper-footer-links"><span>YOUR KEEPER</span><Link href="/sign-in">Sign in</Link><Link href="/sign-up">Create an account</Link><Link href="/app">Open workspace</Link></div>
      </div>
      <div className="keeper-footer-bottom"><span>© {new Date().getFullYear()} Keeper</span><span>Keep what matters close.</span><a href="#top">Back to top ↑</a></div>
    </footer>
  );
}

export function KeeperLanding() {
  const { openAddContent, isAuthenticated, authLoading } = useRecall();

  return (
    <div id="top" className="keeper-site">
      <KeeperNav />
      <main>
        <section className="keeper-hero">
          <div className="keeper-hero-copy">
            <span className="keeper-hero-eyebrow"><i /> A PERSONAL LIBRARY FOR THE OPEN WEB</span>
            <h1>Keep what matters.<br /><em>Find it when it does.</em></h1>
            <p>Keeper brings your saved videos, posts, articles, and notes into one thoughtful library—so a good idea doesn’t disappear into another tab.</p>
            <div className="keeper-hero-actions">
              {!authLoading && (isAuthenticated ? (
                <button type="button" className="keeper-button keeper-button-dark" onClick={() => openAddContent()}>Save your first link <ArrowUpRight size={16} /></button>
              ) : <Link href="/sign-up" className="keeper-button keeper-button-dark">Create your account <ArrowRight size={15} /></Link>)}
              {!authLoading && (isAuthenticated ? (
                <Link href="/app" className="keeper-button keeper-button-quiet">Open your workspace <ArrowRight size={15} /></Link>
              ) : <Link href="/sign-in" className="keeper-button keeper-button-quiet">I have an account <ArrowRight size={15} /></Link>)}
            </div>
            <div className="keeper-hero-note"><span className="keeper-note-icons"><i><CirclePlay size={12} /></i><i><Camera size={12} /></i><i><Globe2 size={12} /></i></span><span>For the links, clips, and thoughts you mean to come back to.</span></div>
          </div>
          <div id="product" className="keeper-hero-product"><ProductPreview /></div>
          <a className="keeper-scroll-cue" href="#how-it-works" aria-label="Scroll to how Keeper works"><span>SCROLL A LITTLE</span><ArrowDown size={14} /></a>
        </section>

        <div className="keeper-editorial-note"><span>LESS COLLECTING.</span><i /><span>MORE REMEMBERING.</span></div>
        <StepSection />
        <SourceSection />
        <SourcesSection />

        <section className="keeper-search-story">
          <div className="keeper-search-story-copy"><span className="keeper-overline">YOUR MEMORY IS ENOUGH</span><h2>Search like you<br /><em>remember.</em></h2><p>Try a topic, a creator, or the detail that stuck with you. Keeper searches across the source context and notes you’ve collected.</p><Link href="/app/search" className="keeper-button keeper-button-light">Find something in your library <ArrowRight size={15} /></Link></div>
          <div className="keeper-search-demo" aria-label="Example of searching saved items">
            <span className="keeper-demo-query"><Search size={15} /> “that React video about re-renders”</span>
            <div className="keeper-demo-answer"><span className="keeper-answer-mark"><Sparkles size={14} /></span><div><span className="keeper-overline">FROM YOUR SAVES</span><p>“10 React Performance Pitfalls…” by Theo Browne. The source notes mention context cascades and profiling render cycles first.</p><a href="#product">React Learning <ArrowUpRight size={12} /></a></div></div>
            <div className="keeper-demo-footnote"><span /> Source-linked answer <span className="keeper-demo-dot" /> Saved context</div>
          </div>
        </section>

        <PricingSection />

        <section className="keeper-closing-cta">
          <KeeperMark />
          <span className="keeper-overline">A GOOD IDEA DESERVES A SECOND LIFE</span>
          <h2>Keep it close.<br /><em>Keep moving.</em></h2>
          <p>Start a library that remembers the details for you.</p>
          <div className="keeper-hero-actions keeper-closing-actions">{!authLoading && (isAuthenticated ? <button type="button" className="keeper-button keeper-button-dark" onClick={() => openAddContent()}>Save something good <ArrowUpRight size={16} /></button> : <Link href="/sign-up" className="keeper-button keeper-button-dark">Create your account <ArrowRight size={15} /></Link>)}{!authLoading && (isAuthenticated ? <Link href="/app" className="keeper-button keeper-button-quiet">Open your workspace <ArrowRight size={15} /></Link> : <Link href="/sign-in" className="keeper-button keeper-button-quiet">I have an account <ArrowRight size={15} /></Link>)}</div>
          <span className="keeper-closing-orbit" aria-hidden="true" />
        </section>
        <FAQSection />
      </main>
      <KeeperFooter />
      <AddContentModal />
    </div>
  );
}
