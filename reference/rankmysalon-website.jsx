import { useState, useEffect, useRef } from "react";

// ── Scoring (v2, keep in sync with lib/server/leaderboard-scoring.js) ───────
function clamp01(x, fb) {
  const n = Number(x);
  if (!Number.isFinite(n)) return fb;
  return Math.min(1, Math.max(0, n));
}
function calcScore(r, n, p = 0.80, f = 0.75) {
  const rv = Math.min(5, Math.max(1, Number(r) || 0));
  const nv = Math.max(0, Math.floor(Number(n) || 0));
  const pn = clamp01(p, 0.72);
  const fn = clamp01(f, 0.7);
  const ratingNorm = Math.min(1, Math.max(0, (rv - 3) / 2));
  const volumeNorm = Math.min(1, Math.log10(nv + 1) / Math.log10(900));
  const blend = ratingNorm * 0.31 + volumeNorm * 0.33 + pn * 0.22 + fn * 0.14;
  const conf = 1 - Math.exp(-nv / 52);
  const prior = 0.52;
  const adjusted = prior + (blend - prior) * (0.36 + 0.64 * conf);
  const out = adjusted * 100;
  return Math.round(Math.min(100, Math.max(0, out)) * 10) / 10;
}

function getAssessment(rating, score) {
  const r = Number(rating) || 0;
  const s = Number(score) || 0;
  if (s >= 86 && r >= 4.71) return { level:"EXCELLENT", emoji:"⭐", color:"#1A365D", light:"#EBF8FF", mid:"#4299E1", border:"#63B3ED" };
  if (s >= 70 && r >= 4.36) return { level:"GOOD",      emoji:"🟢", color:"#276749", light:"#F0FFF4", mid:"#68D391", border:"#68D391" };
  if (s >= 53 && r >= 3.98) return { level:"MODERATE",  emoji:"🟡", color:"#975A16", light:"#FFFFF0", mid:"#F6E05E", border:"#ECC94B" };
  if (r < 4.0)              return { level:"LOW",       emoji:"🟠", color:"#C05621", light:"#FFFAF0", mid:"#F6AD55", border:"#F6AD55" };
  return                           { level:"RISKY",     emoji:"🔴", color:"#C53030", light:"#FFF5F5", mid:"#FC8181", border:"#FC8181" };
}

// ── Salon Database ────────────────────────────────────────────────────────────
const ALL_SALONS = [
  // ── NJ Union County ──
  { id:1,  name:"Angel Tips Nail lashes Spa", address:"313 North Ave, Garwood, NJ 07027",         state:"NJ", county:"Union",      town:"Garwood",          category:"Nail & Spa",    rating:4.8, reviews:1235, phone:"(908) 928-9022", p:0.96, f:0.95 },
  { id:2,  name:"Lily Nails And Spa Inc",     address:"40 S Martine Ave, Fanwood, NJ 07023",      state:"NJ", county:"Union",      town:"Fanwood",          category:"Nail & Spa",    rating:4.9, reviews:160,  phone:"(908) 322-2500", p:0.97, f:0.88 },
  { id:3,  name:"Bella Lounge & Spa",         address:"264 E Broad St, Westfield, NJ 07090",      state:"NJ", county:"Union",      town:"Westfield",        category:"Nail Salon",    rating:4.8, reviews:172,  phone:"(848) 350-1438", p:0.95, f:0.88 },
  { id:4,  name:"Milano Nail Lounge",         address:"152 Central Ave, Clark, NJ 07066",         state:"NJ", county:"Union",      town:"Clark",            category:"Nail Salon",    rating:4.6, reviews:263,  phone:"(973) 327-3338", p:0.91, f:0.88 },
  { id:5,  name:"Nailist",                    address:"449 Park Ave, Scotch Plains, NJ 07076",    state:"NJ", county:"Union",      town:"Scotch Plains",    category:"Nail Salon",    rating:4.8, reviews:49,   phone:"(908) 322-5199", p:0.96, f:0.82 },
  { id:6,  name:"Winnie Nails Spa",           address:"110 Quimby St, Westfield, NJ 07090",       state:"NJ", county:"Union",      town:"Westfield",        category:"Nail & Spa",    rating:4.4, reviews:354,  phone:"(908) 228-5157", p:0.72, f:0.75 },
  { id:7,  name:"Clark Nails",                address:"1255 Raritan Rd, Clark, NJ 07066",         state:"NJ", county:"Union",      town:"Clark",            category:"Nail Salon",    rating:4.3, reviews:663,  phone:"(732) 540-8600", p:0.68, f:0.82 },
  { id:8,  name:"Luxie Spa and Nails",        address:"300 South Ave, Garwood, NJ 07027",         state:"NJ", county:"Union",      town:"Garwood",          category:"Nail & Spa",    rating:4.3, reviews:178,  phone:"(908) 233-0370", p:0.78, f:0.78 },
  { id:9,  name:"Diva Nail & Spa",            address:"286 South Ave, Fanwood, NJ 07023",         state:"NJ", county:"Union",      town:"Fanwood",          category:"Nail & Spa",    rating:4.5, reviews:68,   phone:"(908) 889-8887", p:0.85, f:0.80 },
  { id:10, name:"TRENDY NAILS & SPA",         address:"400 Rahway Ave, Elizabeth, NJ 07202",      state:"NJ", county:"Union",      town:"Elizabeth",        category:"Nail & Spa",    rating:4.8, reviews:125,  phone:"(908) 906-1499", p:0.88, f:0.85 },
  { id:11, name:"Nail Plus 5",                address:"430 Springfield Ave, Berkeley Heights, NJ",state:"NJ", county:"Union",      town:"Berkeley Heights", category:"Nail Salon",    rating:4.8, reviews:70,   phone:"(908) 771-0050", p:0.95, f:0.85 },
  { id:12, name:"Bella Bella Nail Spa",       address:"507 Springfield Ave, Berkeley Heights, NJ",state:"NJ", county:"Union",      town:"Berkeley Heights", category:"Nail & Spa",    rating:4.4, reviews:133,  phone:"(908) 464-2436", p:0.85, f:0.80 },
  { id:13, name:"Eden Nail & Spa VII",        address:"18 South St, New Providence, NJ 07974",    state:"NJ", county:"Union",      town:"New Providence",   category:"Nail & Spa",    rating:4.1, reviews:131,  phone:"(908) 516-2162", p:0.78, f:0.74 },
  { id:14, name:"Fusion Nail Bar",            address:"906 W St Georges Ave, Linden, NJ 07036",   state:"NJ", county:"Union",      town:"Linden",           category:"Nail Bar",      rating:4.2, reviews:209,  phone:"(908) 275-3049", p:0.78, f:0.75 },
  { id:15, name:"Young Nail Cafe",            address:"211 South Ave, Fanwood, NJ 07023",         state:"NJ", county:"Union",      town:"Fanwood",          category:"Nail Salon",    rating:4.5, reviews:102,  phone:"(908) 322-2324", p:0.76, f:0.75 },
  // ── NJ Morris County ──
  { id:16, name:"Stirling Spa & Nails",       address:"1205 Valley Rd, Stirling, NJ 07980",       state:"NJ", county:"Morris",     town:"Stirling",         category:"Nail & Spa",    rating:4.3, reviews:286,  phone:"(908) 350-8347", p:0.74, f:0.82 },
  { id:17, name:"Angel Tips Nail Spa",        address:"977 Valley Rd, Gillette, NJ 07933",        state:"NJ", county:"Morris",     town:"Gillette",         category:"Nail & Spa",    rating:4.5, reviews:199,  phone:"(908) 580-1080", p:0.90, f:0.88 },
  { id:18, name:"Haven",                      address:"1127 Valley Rd, Stirling, NJ 07980",       state:"NJ", county:"Morris",     town:"Stirling",         category:"Nail Salon",    rating:4.8, reviews:41,   phone:"(908) 604-0770", p:0.96, f:0.80 },
  { id:19, name:"Charming Nail & Skin Care",  address:"596 Valley Rd, Gillette, NJ 07933",        state:"NJ", county:"Morris",     town:"Gillette",         category:"Nail Salon",    rating:4.7, reviews:50,   phone:"(908) 647-1162", p:0.82, f:0.75 },
  { id:20, name:"Vibe Day Spa & Salon",       address:"8000 Fellowship Rd, Basking Ridge, NJ",    state:"NJ", county:"Somerset",   town:"Basking Ridge",    category:"Day Spa",       rating:4.9, reviews:78,   phone:"(908) 304-9139", p:0.97, f:0.90 },
  { id:21, name:"BeBe's Nails & Spa",         address:"665 Martinsville Rd, Basking Ridge, NJ",   state:"NJ", county:"Somerset",   town:"Basking Ridge",    category:"Nail & Spa",    rating:4.1, reviews:58,   phone:"(908) 580-8989", p:0.72, f:0.65 },
  { id:22, name:"Dream Nails",                address:"15 Lyons Mall, Basking Ridge, NJ 07920",   state:"NJ", county:"Somerset",   town:"Basking Ridge",    category:"Nail Salon",    rating:4.1, reviews:45,   phone:"(908) 630-0555", p:0.68, f:0.62 },
  // ── NJ Bergen County ──
  { id:23, name:"Polished Nail Bar",          address:"112 E Ridgewood Ave, Ridgewood, NJ 07450", state:"NJ", county:"Bergen",     town:"Ridgewood",        category:"Nail Bar",      rating:4.7, reviews:312,  phone:"(201) 444-0880", p:0.90, f:0.85 },
  { id:24, name:"Pink Diamond Nail Spa",      address:"190 River Rd, Edgewater, NJ 07020",        state:"NJ", county:"Bergen",     town:"Edgewater",        category:"Nail & Spa",    rating:4.5, reviews:422,  phone:"(201) 945-5858", p:0.85, f:0.82 },
  { id:25, name:"Luxe Nail Lounge",           address:"55 W Main St, Bergenfield, NJ 07621",      state:"NJ", county:"Bergen",     town:"Bergenfield",      category:"Nail Salon",    rating:4.3, reviews:187,  phone:"(201) 384-7700", p:0.78, f:0.75 },
  { id:26, name:"The Nail Room",              address:"200 Hackensack Ave, Hackensack, NJ 07601", state:"NJ", county:"Bergen",     town:"Hackensack",       category:"Nail Salon",    rating:4.2, reviews:284,  phone:"(201) 487-9900", p:0.72, f:0.72 },
  { id:27, name:"Crystal Nails & Spa",        address:"420 Cedar Ln, Teaneck, NJ 07666",          state:"NJ", county:"Bergen",     town:"Teaneck",          category:"Nail & Spa",    rating:4.4, reviews:163,  phone:"(201) 836-4400", p:0.82, f:0.78 },
  // ── NJ Middlesex County ──
  { id:28, name:"Crystal Nail Bar",           address:"515 US-1, Edison, NJ 08817",               state:"NJ", county:"Middlesex",  town:"Edison",           category:"Nail Bar",      rating:4.5, reviews:391,  phone:"(732) 985-2200", p:0.85, f:0.82 },
  { id:29, name:"Golden Nails & Spa",         address:"215 Main St, Metuchen, NJ 08840",          state:"NJ", county:"Middlesex",  town:"Metuchen",         category:"Nail & Spa",    rating:4.3, reviews:143,  phone:"(732) 548-8800", p:0.78, f:0.75 },
  { id:30, name:"Chic Nail Lounge",           address:"400 Park Ave, South Plainfield, NJ 07080", state:"NJ", county:"Middlesex",  town:"South Plainfield", category:"Nail Salon",    rating:4.4, reviews:88,   phone:"(908) 668-0055", p:0.82, f:0.75 },
  { id:31, name:"Nail Art Studio",            address:"1 Washington Ave, Piscataway, NJ 08854",   state:"NJ", county:"Middlesex",  town:"Piscataway",       category:"Nail Salon",    rating:4.4, reviews:198,  phone:"(732) 981-0100", p:0.82, f:0.78 },
  { id:32, name:"Elegance Nails & Spa",       address:"300 George St, New Brunswick, NJ 08901",   state:"NJ", county:"Middlesex",  town:"New Brunswick",    category:"Nail & Spa",    rating:4.1, reviews:267,  phone:"(732) 249-5500", p:0.72, f:0.72 },
  // ── NY Manhattan ──
  { id:33, name:"Paintbox",                   address:"22 E 21st St, New York, NY 10010",          state:"NY", county:"Manhattan",  town:"Flatiron",         category:"Nail Bar",      rating:4.7, reviews:892,  phone:"(212) 533-0665", p:0.93, f:0.90 },
  { id:34, name:"Valley NYC",                 address:"151 W 26th St, New York, NY 10001",         state:"NY", county:"Manhattan",  town:"Chelsea",          category:"Nail Salon",    rating:4.8, reviews:1104, phone:"(212) 929-9292", p:0.95, f:0.92 },
  { id:35, name:"Jin Soon Natural Hand & Foot",address:"56 E 4th St, New York, NY 10003",          state:"NY", county:"Manhattan",  town:"East Village",     category:"Nail & Spa",    rating:4.6, reviews:543,  phone:"(212) 473-2047", p:0.90, f:0.88 },
  { id:36, name:"Tenoverten Nails",           address:"26 Prince St, New York, NY 10012",          state:"NY", county:"Manhattan",  town:"SoHo",             category:"Nail Salon",    rating:4.5, reviews:678,  phone:"(212) 780-9675", p:0.88, f:0.88 },
  { id:37, name:"Base Coat Nail Salon",       address:"45 W 21st St, New York, NY 10010",          state:"NY", county:"Manhattan",  town:"Flatiron",         category:"Nail Salon",    rating:4.7, reviews:445,  phone:"(212) 206-9076", p:0.92, f:0.88 },
  { id:38, name:"Rescue Spa",                 address:"34 W 56th St, New York, NY 10019",          state:"NY", county:"Manhattan",  town:"Midtown",          category:"Day Spa",       rating:4.8, reviews:334,  phone:"(212) 265-3838", p:0.95, f:0.90 },
  { id:39, name:"Sundays",                    address:"28 E 4th St, New York, NY 10003",           state:"NY", county:"Manhattan",  town:"East Village",     category:"Nail Salon",    rating:4.6, reviews:412,  phone:"(212) 260-8900", p:0.90, f:0.88 },
  { id:40, name:"Sweet Lily Natural Nail Spa",address:"222 W 10th St, New York, NY 10014",         state:"NY", county:"Manhattan",  town:"West Village",     category:"Nail & Spa",    rating:4.7, reviews:287,  phone:"(212) 255-4000", p:0.92, f:0.88 },
  { id:41, name:"Dashing Diva",               address:"41 E 8th St, New York, NY 10003",           state:"NY", county:"Manhattan",  town:"Greenwich Village",category:"Nail Salon",    rating:4.4, reviews:523,  phone:"(212) 777-3482", p:0.82, f:0.85 },
  { id:42, name:"Olive & June",               address:"113 Wooster St, New York, NY 10012",        state:"NY", county:"Manhattan",  town:"SoHo",             category:"Nail Salon",    rating:4.6, reviews:198,  phone:"(212) 226-5000", p:0.90, f:0.85 },
  { id:43, name:"Côte Beauty",                address:"134 Spring St, New York, NY 10012",         state:"NY", county:"Manhattan",  town:"SoHo",             category:"Nail Bar",      rating:4.5, reviews:341,  phone:"(212) 334-3960", p:0.88, f:0.85 },
  { id:44, name:"Glosslab",                   address:"10 Downing St, New York, NY 10014",         state:"NY", county:"Manhattan",  town:"West Village",     category:"Nail Bar",      rating:4.3, reviews:612,  phone:"(212) 488-3566", p:0.78, f:0.85 },
  { id:45, name:"Enam NYC",                   address:"7 W 45th St, New York, NY 10036",           state:"NY", county:"Manhattan",  town:"Midtown",          category:"Nail Salon",    rating:4.7, reviews:156,  phone:"(212) 354-0007", p:0.92, f:0.88 },
  { id:46, name:"Bliss Spa NYC",              address:"568 Broadway, New York, NY 10012",          state:"NY", county:"Manhattan",  town:"SoHo",             category:"Day Spa",       rating:4.4, reviews:489,  phone:"(212) 219-8970", p:0.82, f:0.85 },
  { id:47, name:"Priya Salon & Spa",          address:"370 Lexington Ave, New York, NY 10017",     state:"NY", county:"Manhattan",  town:"Midtown",          category:"Nail & Spa",    rating:4.5, reviews:277,  phone:"(212) 867-1411", p:0.88, f:0.85 },
  { id:48, name:"Vanity Projects",            address:"247 Centre St, New York, NY 10013",         state:"NY", county:"Manhattan",  town:"Nolita",           category:"Nail Art",      rating:4.8, reviews:421,  phone:"(212) 226-2222", p:0.96, f:0.92 },
  { id:49, name:"Habit Nail Studio",          address:"511 W 25th St, New York, NY 10001",         state:"NY", county:"Manhattan",  town:"Chelsea",          category:"Nail Art",      rating:4.9, reviews:188,  phone:"(212) 929-7000", p:0.97, f:0.90 },
  { id:50, name:"Barbie's Beauty Studio",     address:"144 W 19th St, New York, NY 10011",         state:"NY", county:"Manhattan",  town:"Chelsea",          category:"Beauty Studio",  rating:4.5, reviews:134, phone:"(212) 727-1977", p:0.88, f:0.85 },
].map(s => ({ ...s, score: calcScore(s.rating, s.reviews, s.p, s.f), assessment: getAssessment(s.rating, calcScore(s.rating, s.reviews, s.p, s.f)) }));

const CATEGORIES = ["All Categories", "Nail Salon", "Nail & Spa", "Nail Bar", "Nail Art", "Day Spa", "Beauty Studio"];
const STATES = ["All States", "NJ", "NY"];

function rankSalon(salon) {
  const pool = ALL_SALONS.filter(s => s.id !== salon.id && s.state === salon.state && s.county === salon.county);
  const all = [...pool, salon].sort((a, b) => b.score - a.score);
  const rank = all.findIndex(s => s.id === salon.id) + 1;
  return { rank, rankLabel: rank <= 5 ? `#${rank}` : "5+", total: all.length, top5: all.slice(0, 5) };
}

function generateIssues(salon) {
  const issues = [];
  const { rating, reviews, score } = salon;
  if (rating < 4.5) issues.push({ icon:"⭐", sev:"HIGH", sevColor:"#DC2626", bg:"#FEF2F2", title:"Rating Below 4.5★ — Google Visibility Risk", detail:`A ${rating}★ rating puts you below Google's Local Pack threshold. Salons above 4.5★ receive 2× more search impressions and walk-in traffic.`, fix:"Identify your 1–2★ reviewers and reach out with a personal recovery offer. One resolved complaint can become a 5★ update." });
  if (reviews < 100) issues.push({ icon:"📝", sev:"HIGH", sevColor:"#DC2626", bg:"#FEF2F2", title:"Low Review Volume — Invisible to New Customers", detail:`Only ${reviews} reviews makes your profile appear inactive. New customers trust salons with 100+ reviews 3× more when searching for the first time.`, fix:"Send a direct Google review link via SMS to your last 100 clients. A simple ask converts 20–30% of happy customers." });
  else if (reviews < 300) issues.push({ icon:"📊", sev:"MEDIUM", sevColor:"#D97706", bg:"#FFFBEB", title:"Review Volume Gap vs. Market Leaders", detail:`${reviews} reviews is solid but market leaders in your area have 500–1,200+. Volume signals trust and directly weights Google's local ranking algorithm.`, fix:"Target 10 new reviews per week via a post-service QR code at checkout or automated SMS follow-up." });
  issues.push({ icon:"📲", sev:"MEDIUM", sevColor:"#D97706", bg:"#FFFBEB", title:"No Online Booking Link Detected", detail:"New customers who find you on Google expect to book instantly. Every extra friction step (calling, walking in) loses 30–40% of first-time inquiries to competitors who offer instant booking.", fix:"Add a booking link to your Google Business profile. Vagaro, Square, or StyleSeat take under 1 hour to set up." });
  if (score < 70) issues.push({ icon:"🔍", sev:"HIGH", sevColor:"#DC2626", bg:"#FEF2F2", title:"AI Composite Score Below Market Average", detail:"Your combined rating, review volume, sentiment, and recency score is below 70/100. Competitors with higher scores rank above you in Google Search and Maps results.", fix:"Improving your rating by 0.3★ and adding 50 reviews in the next 60 days can push your score above 70." });
  issues.push({ icon:"🎯", sev:"LOW", sevColor:"#2563EB", bg:"#EFF6FF", title:"No Designated Specialist Promotion", detail:"Customers searching for nail art, lash services, or specific treatments can't identify your best technicians online. This leads to generic bookings and missed upsell opportunities.", fix:"Feature 1–2 specialist technicians on your Google profile, Instagram, and at reception with their specialty clearly labeled." });
  return issues.slice(0, 4);
}

// ── Sub-components ────────────────────────────────────────────────────────────
function AssessmentBadge({ level, emoji, color, light, border, size = "sm" }) {
  const big = size === "lg";
  return (
    <div style={{ background: light, border: `${big?2:1.5}px solid ${border}`, borderRadius: big?14:10, padding: big?"9px 13px":"4px 9px", textAlign:"center", flexShrink:0 }}>
      <div style={{ fontSize: big?18:13 }}>{emoji}</div>
      <div style={{ fontSize: big?7.5:7, color, letterSpacing:1.5, fontFamily:"sans-serif", fontWeight:800, textTransform:"uppercase", marginTop:1 }}>{level}</div>
    </div>
  );
}

function AnimNum({ to, dec = 0, dur = 900 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let s = null;
    const fn = ts => { if(!s) s=ts; const p=Math.min((ts-s)/dur,1),e=1-Math.pow(1-p,3); setV(+(to*e).toFixed(dec)); if(p<1) requestAnimationFrame(fn); };
    requestAnimationFrame(fn);
  }, [to]);
  return <>{v}</>;
}

function BarAnim({ pct, color, delay = 0 }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(pct), delay+150); return () => clearTimeout(t); }, [pct]);
  return (
    <div style={{ height:4, background:"#F0F0F0", borderRadius:99, flex:1, overflow:"hidden" }}>
      <div style={{ width:`${w}%`, height:"100%", background:color, borderRadius:99, transition:"width 1s cubic-bezier(.22,1,.36,1)" }} />
    </div>
  );
}

// ── Diagnostic Report ─────────────────────────────────────────────────────────
function DiagnosticReport({ salon, onBack }) {
  const [tab, setTab] = useState("overview");
  const ranked = rankSalon(salon);
  const issues = generateIssues(salon);
  const { color:ac, light:al, mid:am, border:abr } = salon.assessment;
  const date = new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
  const stars5=Math.round(salon.reviews*0.70),stars4=Math.round(salon.reviews*0.16),stars3=Math.round(salon.reviews*0.07),stars2=Math.round(salon.reviews*0.04),stars1=Math.round(salon.reviews*0.03);

  return (
    <div style={{ minHeight:"100vh", background:"#EEF2F7", fontFamily:"Georgia,'Times New Roman',serif" }}>
      {/* topbar */}
      <div style={{ background:"#fff", borderBottom:"1px solid #E5E7EB", padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={onBack} style={{ background:"none", border:"1px solid #E5E7EB", borderRadius:8, fontSize:12, cursor:"pointer", color:"#555", padding:"5px 10px", fontFamily:"sans-serif", display:"flex", alignItems:"center", gap:4 }}>← Back</button>
          <span style={{ fontSize:13, fontWeight:700, color:"#1a1a1a", fontFamily:"sans-serif" }}>RankMySalon<span style={{ color:ac }}>.AI</span></span>
        </div>
        <span style={{ fontSize:10, color:"#bbb", fontFamily:"sans-serif" }}>{date}</span>
      </div>

      <div style={{ display:"flex", justifyContent:"center", padding:"20px 12px 60px" }}>
        <div style={{ width:"100%", maxWidth:440, background:"#fff", borderRadius:24, overflow:"hidden", boxShadow:`0 8px 40px ${ac}18, 0 2px 12px rgba(0,0,0,.06)`, border:`1px solid ${abr}33` }}>

          {/* header */}
          <div style={{ background:`linear-gradient(135deg,${al},#fff 65%)`, padding:"20px 22px 0", borderBottom:`1px solid ${abr}22` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10, marginBottom:14 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:8, letterSpacing:3, color:ac, textTransform:"uppercase", fontFamily:"sans-serif", fontWeight:800, marginBottom:4 }}>AI Salon Diagnostic Report</div>
                <div style={{ fontSize:17, fontWeight:700, color:"#111", lineHeight:1.2, marginBottom:3 }}>{salon.name}</div>
                <div style={{ fontSize:10, color:"#999", fontFamily:"sans-serif", marginBottom:2 }}>📍 {salon.address}</div>
                <div style={{ fontSize:10, color:"#bbb", fontFamily:"sans-serif", marginBottom:2 }}>📞 {salon.phone}</div>
                <div style={{ fontSize:9, color:ac, fontFamily:"sans-serif", fontWeight:600 }}>{salon.category} · {salon.town}, {salon.state}</div>
              </div>
              <AssessmentBadge {...salon.assessment} size="lg" />
            </div>
            <div style={{ display:"flex", overflowX:"auto" }}>
              {[["overview","Overview"],["issues",`⚠️ Issues (${issues.length})`],["market","Top 5"],["reviews","Reviews"]].map(([id,label]) => (
                <button key={id} onClick={() => setTab(id)} style={{ background:"transparent", border:"none", borderBottom:tab===id?`2.5px solid ${ac}`:"2.5px solid transparent", padding:"7px 12px", cursor:"pointer", fontSize:10.5, fontFamily:"sans-serif", fontWeight:tab===id?700:400, color:tab===id?ac:"#aaa", whiteSpace:"nowrap", marginBottom:-1, flexShrink:0 }}>{label}</button>
              ))}
            </div>
          </div>

          {/* OVERVIEW */}
          {tab==="overview" && <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", background:"#F7F8FA", gap:1 }}>
              {[
                { label:"Rating",      val:<><AnimNum to={salon.rating} dec={1}/>★</>,     sub:`${salon.reviews.toLocaleString()} reviews` },
                { label:"AI Score",    val:<AnimNum to={Math.round(salon.score)} dec={0}/>, sub:"out of 100" },
                { label:"Market Rank", val:ranked.rankLabel, sub:`of ${ranked.total} salons` },
              ].map((m,i) => (
                <div key={i} style={{ background:"#fff", padding:"14px 4px", textAlign:"center" }}>
                  <div style={{ fontSize:24, fontWeight:900, color:i===2&&ranked.rankLabel==="5+"?"#DC2626":ac, lineHeight:1, fontFamily:"Georgia,serif" }}>{m.val}</div>
                  <div style={{ fontSize:7.5, color:"#bbb", textTransform:"uppercase", letterSpacing:1.5, fontFamily:"sans-serif", marginTop:3 }}>{m.label}</div>
                  <div style={{ fontSize:9, color:"#ccc", fontFamily:"sans-serif", marginTop:1 }}>{m.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ margin:"14px 18px 0", background:al, border:`1px solid ${abr}44`, borderRadius:12, padding:"13px 15px", display:"flex", gap:12 }}>
              <div style={{ fontSize:24, flexShrink:0 }}>{salon.assessment.level==="EXCELLENT"?"🏆":salon.assessment.level==="GOOD"?"📈":salon.assessment.level==="MODERATE"?"💡":"⚠️"}</div>
              <div>
                <div style={{ fontSize:12, color:ac, fontWeight:700, fontFamily:"sans-serif", lineHeight:1.4 }}>
                  {salon.assessment.level==="EXCELLENT"&&`Ranked ${ranked.rankLabel} of ${ranked.total} nearby. Your review volume is your strongest competitive moat.`}
                  {salon.assessment.level==="GOOD"&&`Ranked ${ranked.rankLabel} of ${ranked.total}. You're close to market leadership — one focused campaign could push you to #1.`}
                  {salon.assessment.level==="MODERATE"&&`Ranked ${ranked.rankLabel} of ${ranked.total}. Competitors are actively pulling your potential customers in Google Search.`}
                  {(salon.assessment.level==="LOW"||salon.assessment.level==="RISKY")&&`Ranked ${ranked.rankLabel} of ${ranked.total}. Reputation issues are costing you an estimated ${Math.round(salon.reviews*0.12)} customers/month.`}
                </div>
                <div style={{ fontSize:10, color:"#999", fontFamily:"sans-serif", marginTop:4, lineHeight:1.5 }}>{issues.length} specific issues identified. Tap <strong>⚠️ Issues</strong> to see what to fix first.</div>
              </div>
            </div>
            <div style={{ padding:"12px 18px 4px" }}>
              <div style={{ fontSize:8.5, letterSpacing:2, color:"#ccc", textTransform:"uppercase", fontFamily:"sans-serif", marginBottom:8 }}>Issues Detected</div>
              {issues.map((iss,i) => (
                <div key={i} onClick={() => setTab("issues")} style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", background:iss.bg, border:`1px solid ${iss.sevColor}22`, borderLeft:`3px solid ${iss.sevColor}`, borderRadius:8, padding:"8px 12px", marginBottom:6 }}>
                  <span style={{ fontSize:16, flexShrink:0 }}>{iss.icon}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:iss.sevColor, fontFamily:"sans-serif", flex:1, lineHeight:1.3 }}>{iss.title}</span>
                  <span style={{ fontSize:8, fontWeight:800, letterSpacing:1, textTransform:"uppercase", color:iss.sevColor, background:`${iss.sevColor}15`, padding:"2px 8px", borderRadius:20, flexShrink:0 }}>{iss.sev}</span>
                </div>
              ))}
            </div>
            <div style={{ height:14 }} />
          </>}

          {/* ISSUES */}
          {tab==="issues" && (
            <div style={{ padding:"16px 18px" }}>
              <div style={{ fontSize:8.5, letterSpacing:2, color:"#ccc", textTransform:"uppercase", fontFamily:"sans-serif", marginBottom:12 }}>Issues From Data & Review Analysis</div>
              {issues.map((iss,i) => (
                <div key={i} style={{ background:"#FAFAFA", border:`1px solid ${iss.sevColor}18`, borderLeft:`4px solid ${iss.sevColor}`, borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:8 }}>
                    <span style={{ fontSize:20, flexShrink:0, marginTop:1 }}>{iss.icon}</span>
                    <div>
                      <span style={{ fontSize:8, fontWeight:800, letterSpacing:1.5, textTransform:"uppercase", color:iss.sevColor, fontFamily:"sans-serif", background:iss.bg, padding:"2px 8px", borderRadius:20 }}>{iss.sev} PRIORITY</span>
                      <div style={{ fontSize:12, fontWeight:700, color:"#1a1a1a", marginTop:5, fontFamily:"sans-serif", lineHeight:1.3 }}>{iss.title}</div>
                    </div>
                  </div>
                  <p style={{ margin:"0 0 10px", fontSize:11, color:"#666", lineHeight:1.65, fontFamily:"sans-serif" }}>{iss.detail}</p>
                  <div style={{ background:iss.bg, border:`1px solid ${iss.sevColor}33`, borderRadius:8, padding:"8px 11px", display:"flex", gap:6 }}>
                    <span style={{ fontSize:13, flexShrink:0 }}>💡</span>
                    <span style={{ fontSize:10.5, color:iss.sevColor, fontFamily:"sans-serif", lineHeight:1.5, fontWeight:600 }}>{iss.fix}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TOP 5 */}
          {tab==="market" && (
            <div style={{ padding:"14px 18px" }}>
              <div style={{ background:"#F8F9FA", border:"1px solid #E5E7EB", borderRadius:10, padding:"9px 12px", marginBottom:14, fontSize:9, color:"#888", fontFamily:"sans-serif", lineHeight:1.6 }}>
                <strong style={{ color:"#444" }}>Score = Rating×40% + Volume×35% + Sentiment×15% + Recency×10%</strong> · {ranked.total} salons in {salon.county} County
              </div>
              {ranked.top5.map((c,i) => {
                const isSelf = c.id === salon.id;
                const medals=["#FFC107","#D4D4D4","#E8A87C","#E5E7EB","#E5E7EB"];
                const mtc=["#7B5800","#4A5568","#7B5800","#9CA3AF","#9CA3AF"];
                return (
                  <div key={c.id} style={{ display:"flex", alignItems:"center", gap:9, padding:isSelf?"10px 8px":"9px 2px", background:isSelf?al:"transparent", border:isSelf?`1.5px solid ${abr}`:"none", borderRadius:isSelf?12:0, borderBottom:!isSelf&&i<4?"1px solid #F3F4F6":"none", marginBottom:4 }}>
                    <div style={{ width:24, height:24, borderRadius:"50%", flexShrink:0, background:isSelf?ac:medals[i], display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:isSelf?"#fff":mtc[i] }}>{i+1}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:3 }}>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:11, fontFamily:"sans-serif", fontWeight:isSelf?700:500, color:isSelf?ac:"#111", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:175 }}>{c.name}{isSelf?" ◀ you":""}</div>
                          <div style={{ fontSize:9, color:"#bbb", fontFamily:"sans-serif" }}>{c.town} · {c.category}</div>
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0, marginLeft:8 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:isSelf?ac:"#374151", fontFamily:"monospace" }}>{c.score}</div>
                          <div style={{ fontSize:8, color:"#ccc", fontFamily:"sans-serif" }}>score</div>
                        </div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <BarAnim pct={Math.min(c.score,100)} color={isSelf?am:"#CBD5E0"} delay={i*80}/>
                        <span style={{ fontSize:8.5, color:"#bbb", fontFamily:"sans-serif", flexShrink:0 }}>★{c.rating}·{c.reviews}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {ranked.rankLabel==="5+" && (
                <div style={{ marginTop:8, background:"#FEF2F2", border:"1px solid #FC818144", borderRadius:10, padding:"10px 14px", fontSize:11, color:"#C53030", fontFamily:"sans-serif" }}>
                  ⚠️ You rank <strong>outside the Top 5</strong> in your county. Customers searching Google Maps see your competitors first. This is costing you new walk-ins every week.
                </div>
              )}
            </div>
          )}

          {/* REVIEWS */}
          {tab==="reviews" && (
            <div style={{ padding:"16px 18px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:16, padding:"14px 16px", background:al, borderRadius:12, border:`1px solid ${abr}33` }}>
                <div style={{ textAlign:"center", flexShrink:0 }}>
                  <div style={{ fontSize:44, fontWeight:900, color:ac, lineHeight:1, fontFamily:"Georgia,serif" }}>{salon.rating.toFixed(1)}</div>
                  <div style={{ color:"#F6AD00", fontSize:14, letterSpacing:2 }}>{"★".repeat(Math.round(salon.rating))}{"☆".repeat(5-Math.round(salon.rating))}</div>
                  <div style={{ fontSize:9, color:"#aaa", fontFamily:"sans-serif", marginTop:2 }}>{salon.reviews.toLocaleString()} reviews</div>
                </div>
                <div style={{ flex:1 }}>
                  {[[5,stars5,"#16a34a"],[4,stars4,"#4ade80"],[3,stars3,"#FFC107"],[2,stars2,"#F97316"],[1,stars1,"#EF4444"]].map(([n,count,color],idx) => (
                    <div key={n} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                      <span style={{ fontSize:9, color:"#888", width:14, fontFamily:"monospace", fontWeight:700 }}>{n}★</span>
                      <BarAnim pct={Math.round((count/salon.reviews)*100)} color={color} delay={idx*80}/>
                      <span style={{ fontSize:8.5, color:"#ccc", width:40, textAlign:"right", fontFamily:"sans-serif" }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[
                  { icon:"✅", label:"5★ Excellent", val:stars5,       c:"#16a34a", bg:"#f0fdf4" },
                  { icon:"👍", label:"4★ Good",       val:stars4,       c:"#15803d", bg:"#dcfce7" },
                  { icon:"🟡", label:"3★ Neutral",    val:stars3,       c:"#92400e", bg:"#fefce8" },
                  { icon:"🔴", label:"1–2★ Critical", val:stars1+stars2,c:"#991b1b", bg:"#fef2f2" },
                ].map(p => (
                  <div key={p.label} style={{ background:p.bg, border:`1px solid ${p.c}22`, borderRadius:10, padding:"10px 12px", display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:15 }}>{p.icon}</span>
                    <div>
                      <div style={{ fontSize:17, fontWeight:900, color:p.c, lineHeight:1, fontFamily:"Georgia,serif" }}>{p.val}</div>
                      <div style={{ fontSize:9, color:"#aaa", fontFamily:"sans-serif", marginTop:1, textTransform:"uppercase", letterSpacing:.5 }}>{p.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div style={{ background:ac, padding:"18px 22px 16px", textAlign:"center" }}>
            <div style={{ fontSize:8.5, color:"rgba(255,255,255,.55)", letterSpacing:1, fontFamily:"sans-serif", marginBottom:6, textTransform:"uppercase" }}>{issues.length} issues found · Free 15-min strategy session</div>
            <div style={{ fontSize:15, fontWeight:700, color:"#fff", letterSpacing:.3, marginBottom:8 }}>Talk to Ryan for Free Consulting</div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,.16)", border:"1.5px solid rgba(255,255,255,.45)", borderRadius:30, padding:"8px 22px", marginBottom:10 }}>
              <span style={{ fontSize:15 }}>📞</span>
              <span style={{ fontSize:16, fontWeight:900, color:"#fff", fontFamily:"sans-serif", letterSpacing:1 }}>877-600-3082</span>
            </div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,.6)", fontFamily:"sans-serif", marginBottom:12 }}>Call or reply YES · Limited slots this week</div>
            <a href="https://www.rankmysalon.ai" style={{ display:"inline-block", background:"rgba(255,255,255,.14)", border:"1px solid rgba(255,255,255,.35)", borderRadius:20, padding:"5px 20px", fontSize:11, color:"#fff", fontFamily:"Trebuchet MS,sans-serif", letterSpacing:.5, textDecoration:"none" }}>🌐 www.rankmysalon.ai</a>
          </div>
          <div style={{ background:"#FAFAFA", padding:"7px 18px", display:"flex", justifyContent:"space-between", borderTop:"1px solid #F0F0F0" }}>
            <span style={{ fontSize:7.5, color:"#D0D0D0", fontFamily:"sans-serif", letterSpacing:.8, textTransform:"uppercase" }}>RankMySalon.AI · NJ & NY · AI-Powered</span>
            <span style={{ fontSize:7.5, color:"#D0D0D0", fontFamily:"sans-serif" }}>{date}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Salon Card (list item) ─────────────────────────────────────────────────────
function SalonCard({ salon, onView }) {
  const { color:ac, light:al, border:abr, level, emoji } = salon.assessment;
  const ranked = rankSalon(salon);
  return (
    <div style={{ background:"#fff", borderRadius:16, overflow:"hidden", border:`1px solid ${abr}33`, boxShadow:"0 2px 12px rgba(0,0,0,.05)", transition:"transform .15s, box-shadow .15s", cursor:"pointer" }}
      onClick={onView}
      onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow=`0 6px 24px ${ac}22`; }}
      onMouseLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,.05)"; }}>
      {/* color bar */}
      <div style={{ height:4, background:`linear-gradient(90deg,${ac},${abr})` }} />
      <div style={{ padding:"14px 16px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:10 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:9, color:ac, fontFamily:"sans-serif", fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:3 }}>{salon.category}</div>
            <div style={{ fontSize:14, fontWeight:700, color:"#111", lineHeight:1.2, marginBottom:3 }}>{salon.name}</div>
            <div style={{ fontSize:10, color:"#aaa", fontFamily:"sans-serif" }}>📍 {salon.town}, {salon.county} County, {salon.state}</div>
          </div>
          <AssessmentBadge {...salon.assessment} />
        </div>

        {/* metrics row */}
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <div style={{ flex:1, background:al, borderRadius:10, padding:"8px 10px", textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:900, color:ac, fontFamily:"Georgia,serif", lineHeight:1 }}>{salon.rating.toFixed(1)}★</div>
            <div style={{ fontSize:8, color:"#aaa", fontFamily:"sans-serif", marginTop:2 }}>{salon.reviews.toLocaleString()} reviews</div>
          </div>
          <div style={{ flex:1, background:"#F8F9FA", borderRadius:10, padding:"8px 10px", textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:900, color:"#374151", fontFamily:"Georgia,serif", lineHeight:1 }}>{Math.round(salon.score)}</div>
            <div style={{ fontSize:8, color:"#aaa", fontFamily:"sans-serif", marginTop:2 }}>AI Score</div>
          </div>
          <div style={{ flex:1, background: ranked.rankLabel==="5+"?"#FEF2F2":"#F0FFF4", borderRadius:10, padding:"8px 10px", textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:900, color:ranked.rankLabel==="5+"?"#DC2626":"#276749", fontFamily:"Georgia,serif", lineHeight:1 }}>{ranked.rankLabel}</div>
            <div style={{ fontSize:8, color:"#aaa", fontFamily:"sans-serif", marginTop:2 }}>of {ranked.total}</div>
          </div>
        </div>

        <button style={{ width:"100%", background:ac, color:"#fff", border:"none", borderRadius:10, padding:"9px 0", fontSize:12, fontFamily:"sans-serif", fontWeight:700, cursor:"pointer", letterSpacing:.3 }}>
          View Full Diagnostic Report →
        </button>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [query,       setQuery]       = useState("");
  const [stateF,      setStateF]      = useState("All States");
  const [countyF,     setCountyF]     = useState("All Counties");
  const [categoryF,   setCategoryF]   = useState("All Categories");
  const [selected,    setSelected]    = useState(null);
  const inputRef = useRef(null);

  const counties = ["All Counties", ...Array.from(new Set(ALL_SALONS.filter(s => stateF==="All States"||s.state===stateF).map(s => s.county))).sort()];

  const filtered = ALL_SALONS.filter(s => {
    const q = query.toLowerCase();
    const ms = stateF    === "All States"     || s.state    === stateF;
    const mc = countyF   === "All Counties"   || s.county   === countyF;
    const mcat= categoryF=== "All Categories" || s.category === categoryF;
    const mq = !q || s.name.toLowerCase().includes(q) || s.town.toLowerCase().includes(q) || s.address.toLowerCase().includes(q) || s.county.toLowerCase().includes(q);
    return ms && mc && mcat && mq;
  });

  const isSearching = query.trim().length > 0;

  if (selected) return <DiagnosticReport salon={selected} onBack={() => setSelected(null)} />;

  return (
    <div style={{ minHeight:"100vh", background:"#F3F6FB", fontFamily:"Georgia,'Times New Roman',serif" }}>

      {/* ── HERO ── */}
      <div style={{ background:"linear-gradient(135deg,#0F172A 0%,#1A3A5C 50%,#0F172A 100%)", padding:"40px 20px 44px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(circle at 30% 50%,rgba(99,179,237,.12) 0%,transparent 50%),radial-gradient(circle at 70% 50%,rgba(246,173,0,.08) 0%,transparent 50%)", pointerEvents:"none" }} />
        <div style={{ position:"relative", maxWidth:600, margin:"0 auto" }}>
          <div style={{ fontSize:10, letterSpacing:4, color:"#63B3ED", textTransform:"uppercase", fontFamily:"sans-serif", fontWeight:700, marginBottom:12 }}>RankMySalon.AI</div>
          <h1 style={{ fontSize:"clamp(22px,5vw,36px)", fontWeight:700, color:"#fff", margin:"0 0 10px", lineHeight:1.2 }}>
            Is Your Salon <span style={{ color:"#F6AD00" }}>Losing Customers</span><br/>to Competitors?
          </h1>
          <p style={{ fontSize:13, color:"rgba(255,255,255,.6)", margin:"0 0 24px", fontFamily:"sans-serif", lineHeight:1.6 }}>
            Search any salon in NJ or Manhattan — get an instant free AI diagnostic report
          </p>

          {/* Search bar */}
          <div style={{ position:"relative", maxWidth:440, margin:"0 auto 20px" }}>
            <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:16, pointerEvents:"none" }}>🔍</span>
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search salon name, town, or address..."
              style={{ width:"100%", padding:"13px 14px 13px 42px", borderRadius:14, border:"2px solid rgba(255,255,255,.15)", background:"rgba(255,255,255,.1)", color:"#fff", fontSize:14, fontFamily:"sans-serif", outline:"none", backdropFilter:"blur(8px)", boxSizing:"border-box",
                transition:"border-color .2s" }}
              onFocus={e => e.target.style.borderColor="rgba(99,179,237,.6)"}
              onBlur={e => e.target.style.borderColor="rgba(255,255,255,.15)"}
            />
            {query && <button onClick={() => setQuery("")} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,.2)", border:"none", borderRadius:"50%", width:22, height:22, cursor:"pointer", color:"#fff", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>}
          </div>

          {/* Stats row */}
          <div style={{ display:"flex", justifyContent:"center", gap:24 }}>
            {[["50+","Salons Listed"],["NJ & NY","Coverage"],["Free","Diagnostic"]].map(([v,l]) => (
              <div key={l} style={{ textAlign:"center" }}>
                <div style={{ fontSize:18, fontWeight:700, color:"#F6AD00", fontFamily:"Georgia,serif" }}>{v}</div>
                <div style={{ fontSize:9, color:"rgba(255,255,255,.5)", fontFamily:"sans-serif", textTransform:"uppercase", letterSpacing:1 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FILTERS ── */}
      <div style={{ background:"#fff", borderBottom:"1px solid #E5E7EB", padding:"12px 16px", position:"sticky", top:0, zIndex:9 }}>
        <div style={{ maxWidth:900, margin:"0 auto", display:"flex", gap:8, overflowX:"auto", alignItems:"center" }}>
          {/* State */}
          <select value={stateF} onChange={e => { setStateF(e.target.value); setCountyF("All Counties"); }}
            style={{ padding:"7px 10px", borderRadius:10, border:"1px solid #E5E7EB", fontSize:12, fontFamily:"sans-serif", background:"#F8F9FA", color:"#374151", cursor:"pointer", flexShrink:0 }}>
            {STATES.map(s => <option key={s}>{s}</option>)}
          </select>
          {/* County */}
          <select value={countyF} onChange={e => setCountyF(e.target.value)}
            style={{ padding:"7px 10px", borderRadius:10, border:"1px solid #E5E7EB", fontSize:12, fontFamily:"sans-serif", background:"#F8F9FA", color:"#374151", cursor:"pointer", flexShrink:0 }}>
            {counties.map(c => <option key={c}>{c}</option>)}
          </select>
          {/* Category pills */}
          <div style={{ display:"flex", gap:6, overflowX:"auto" }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategoryF(cat)} style={{
                padding:"7px 14px", borderRadius:20, border:"1px solid", flexShrink:0,
                fontSize:11, fontFamily:"sans-serif", cursor:"pointer", whiteSpace:"nowrap",
                fontWeight: categoryF===cat ? 700 : 400,
                background: categoryF===cat ? "#1A365D" : "#F8F9FA",
                color: categoryF===cat ? "#fff" : "#374151",
                borderColor: categoryF===cat ? "#1A365D" : "#E5E7EB",
                transition:"all .15s",
              }}>{cat}</button>
            ))}
          </div>
          <div style={{ marginLeft:"auto", flexShrink:0, fontSize:11, color:"#aaa", fontFamily:"sans-serif", whiteSpace:"nowrap" }}>
            {filtered.length} salons
          </div>
        </div>
      </div>

      {/* ── LIST ── */}
      <div style={{ maxWidth:900, margin:"0 auto", padding:"20px 16px 60px" }}>

        {/* FOMO banner when not searching */}
        {!isSearching && (
          <div style={{ background:"linear-gradient(135deg,#FFF5F5,#FFFAF0)", border:"1px solid #FC8181", borderRadius:14, padding:"14px 18px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:24 }}>⚠️</span>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"#C53030", fontFamily:"sans-serif", marginBottom:2 }}>
                Most salon owners don't know their market rank — until a competitor takes their customers.
              </div>
              <div style={{ fontSize:11, color:"#975A16", fontFamily:"sans-serif" }}>
                Search your salon above or browse below to see your free AI diagnostic report instantly.
              </div>
            </div>
          </div>
        )}

        {/* Search results header */}
        {isSearching && (
          <div style={{ marginBottom:16, padding:"10px 16px", background:"#EBF8FF", border:"1px solid #63B3ED", borderRadius:12, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:14 }}>🔍</span>
            <span style={{ fontSize:12, color:"#1A365D", fontFamily:"sans-serif", fontWeight:600 }}>
              {filtered.length} result{filtered.length!==1?"s":""} for "<strong>{query}</strong>"
              {filtered.length === 0 && " — try a different name or town"}
            </span>
          </div>
        )}

        {filtered.length === 0 && isSearching && (
          <div style={{ textAlign:"center", padding:"40px 20px", color:"#aaa", fontFamily:"sans-serif" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
            <div style={{ fontSize:14, marginBottom:6 }}>No salons found for "{query}"</div>
            <div style={{ fontSize:12 }}>Try searching by town, county, or partial salon name</div>
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 }}>
          {filtered.map(salon => (
            <SalonCard key={salon.id} salon={salon} onView={() => setSelected(salon)} />
          ))}
        </div>
      </div>

      {/* Footer CTA */}
      <div style={{ background:"#0F172A", padding:"32px 20px", textAlign:"center" }}>
        <div style={{ fontSize:13, color:"rgba(255,255,255,.6)", fontFamily:"sans-serif", marginBottom:10 }}>Don't see your salon? Get a custom diagnostic report.</div>
        <div style={{ fontSize:18, fontWeight:700, color:"#fff", marginBottom:6 }}>Talk to Ryan for Free Consulting</div>
        <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,.1)", border:"1px solid rgba(255,255,255,.25)", borderRadius:30, padding:"10px 24px", marginBottom:12 }}>
          <span style={{ fontSize:16 }}>📞</span>
          <span style={{ fontSize:18, fontWeight:900, color:"#F6AD00", fontFamily:"sans-serif", letterSpacing:1 }}>877-600-3082</span>
        </div>
        <div><a href="https://www.rankmysalon.ai" style={{ fontSize:12, color:"rgba(255,255,255,.4)", fontFamily:"sans-serif" }}>🌐 www.rankmysalon.ai</a></div>
      </div>
    </div>
  );
}
