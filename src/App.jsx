import { useState, useEffect, useRef } from "react";

//const MODEL = "claude-sonnet-4-20250514";
const MODEL = "claude-haiku-4-5-20251001";

// ─── utils ────────────────────────────────────────────────────────
const fmtDate = d => d.toISOString().split("T")[0];
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }; // kept for future use

// ─── In-memory cache (persists across tab switches) ───────────────
const CACHE = new Map();
const cacheGet = k => CACHE.get(k) ?? null;
const cacheSet = (k, v) => CACHE.set(k, v);

// ─── design tokens ────────────────────────────────────────────────
const C = {
  pine:"#1a3a2a", forest:"#2d5a3d", sage:"#7a9e7e", mist:"#c8d8cc",
  cream:"#f5f0e8", stone:"#6b7280", sky:"#4a9eca", fire:"#e85d04",
  gold:"#f59e0b", white:"#ffffff", red:"#ef4444", green:"#22c55e",
  dark:"#0f2018",
};

// ─── styles ───────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Source+Sans+3:wght@300;400;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Source Sans 3',sans-serif;background:${C.pine};color:${C.cream};min-height:100vh;}
  .app-shell{max-width:1100px;margin:0 auto;padding:0 16px 60px;}

  /* header */
  .app-header{padding:32px 0 20px;display:flex;align-items:flex-end;gap:16px;border-bottom:1px solid rgba(200,216,204,.2);margin-bottom:28px;}
  .logo-icon{font-size:2.8rem;line-height:1;}
  .app-title{font-family:'Playfair Display',serif;}
  .app-title h1{font-size:clamp(1.6rem,4vw,2.4rem);font-weight:900;color:${C.mist};line-height:1;}
  .app-title p{font-size:.85rem;color:${C.sage};letter-spacing:.08em;text-transform:uppercase;margin-top:4px;}

  /* search panel */
  .search-panel{background:rgba(255,255,255,.05);border:1px solid rgba(200,216,204,.15);border-radius:16px;padding:24px;margin-bottom:28px;backdrop-filter:blur(6px);}
  .search-panel h2{font-family:'Playfair Display',serif;font-size:1.1rem;color:${C.mist};margin-bottom:18px;display:flex;align-items:center;gap:8px;}
  .field-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-bottom:16px;}
  .field label{display:block;font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:${C.sage};margin-bottom:5px;}
  .field input,.field select{width:100%;background:rgba(255,255,255,.08);border:1px solid rgba(200,216,204,.2);border-radius:8px;padding:9px 12px;color:${C.cream};font-family:inherit;font-size:.9rem;outline:none;transition:border-color .2s;-webkit-appearance:none;}
  .field input::placeholder{color:${C.stone};}
  .field input:focus,.field select:focus{border-color:${C.sage};}
  .field select option{background:${C.pine};}
  .search-bottom{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
  .search-bottom .btn-search{min-width:140px;}

  /* location */
  .loc-wrap{position:relative;}
  .suggestions-dropdown{position:absolute;top:calc(100% + 4px);left:0;right:0;background:#1b3828;border:1px solid rgba(122,158,126,.4);border-radius:10px;z-index:200;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.55);}
  .suggestion-item{padding:10px 14px;cursor:pointer;font-size:.88rem;color:${C.mist};display:flex;align-items:flex-start;gap:10px;transition:background .15s;border-bottom:1px solid rgba(255,255,255,.05);}
  .suggestion-item:last-child{border-bottom:none;}
  .suggestion-item:hover,.suggestion-item.hi{background:rgba(122,158,126,.2);}
  .sug-icon{font-size:1.1rem;flex-shrink:0;margin-top:1px;}
  .sug-sub{font-size:.73rem;color:${C.stone};margin-top:1px;}

  /* chips */
  .date-shortcuts{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:16px;}
  .chip{padding:5px 12px;border-radius:20px;font-size:.78rem;font-weight:600;cursor:pointer;border:1px solid transparent;transition:all .2s;background:none;}
  .chip-outline{border-color:rgba(200,216,204,.3);color:${C.mist};}
  .chip-outline:hover,.chip-active{background:${C.forest};border-color:${C.sage};color:${C.white};}

  /* search btn */
  .btn-search{background:${C.fire};color:white;border:none;border-radius:10px;padding:11px 28px;font-size:.95rem;font-weight:700;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:opacity .2s,transform .1s;}
  .btn-search:hover{opacity:.9;transform:translateY(-1px);}
  .btn-search:disabled{opacity:.5;cursor:default;transform:none;}

  /* tabs */
  .tab-bar{display:flex;gap:4px;margin-bottom:20px;background:rgba(0,0,0,.2);border-radius:12px;padding:4px;}
  .tab-btn{flex:1;padding:10px 6px;border:none;border-radius:9px;background:transparent;color:${C.sage};font-family:inherit;font-size:.85rem;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;}
  .tab-btn:hover{color:${C.mist};}
  .tab-btn.active{background:${C.forest};color:${C.white};}

  /* results */
  .results-area{min-height:200px;}

  /* ── SKELETON LOADER ── */
  .skeleton-scene{padding:12px 0 28px;}
  .sk-header{display:flex;align-items:center;gap:12px;margin-bottom:28px;}
  .sk-avatar{width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,.06);flex-shrink:0;animation:shimmer 1.6s ease-in-out infinite;}
  .sk-lines{flex:1;display:flex;flex-direction:column;gap:8px;}
  .sk-line{border-radius:6px;background:rgba(255,255,255,.06);animation:shimmer 1.6s ease-in-out infinite;}
  .sk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;}
  .sk-card{background:rgba(255,255,255,.04);border:1px solid rgba(200,216,204,.07);border-radius:14px;padding:20px;display:flex;flex-direction:column;gap:10px;}
  .sk-badge{height:20px;width:100px;border-radius:20px;background:rgba(255,255,255,.06);animation:shimmer 1.6s ease-in-out infinite;}
  .sk-title{height:22px;border-radius:6px;background:rgba(255,255,255,.08);animation:shimmer 1.6s ease-in-out infinite;}
  .sk-meta{display:flex;gap:8px;}
  .sk-meta-pill{height:16px;width:60px;border-radius:10px;background:rgba(255,255,255,.05);animation:shimmer 1.6s ease-in-out infinite;}
  .sk-body{display:flex;flex-direction:column;gap:6px;}
  .sk-text{height:12px;border-radius:4px;background:rgba(255,255,255,.05);animation:shimmer 1.6s ease-in-out infinite;}
  .sk-dots{display:flex;gap:5px;margin-top:4px;}
  .sk-dot{width:26px;height:26px;border-radius:6px;background:rgba(255,255,255,.06);animation:shimmer 1.6s ease-in-out infinite;}
  @keyframes shimmer{0%{opacity:.4;}50%{opacity:.85;}100%{opacity:.4;}}

  /* loading stage indicator */
  .load-stage{display:flex;align-items:center;gap:10px;padding:14px 18px;background:rgba(122,158,126,.08);border:1px solid rgba(122,158,126,.15);border-radius:10px;margin-bottom:20px;font-size:.85rem;color:${C.sage};}
  .load-stage .ls-icon{font-size:1.2rem;animation:pulse 1.4s ease-in-out infinite;}
  @keyframes pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.15);}}
  .load-dots{display:flex;gap:4px;margin-left:auto;}
  .load-dot{width:6px;height:6px;border-radius:50%;background:${C.sage};animation:bounce-dot .9s ease-in-out infinite;}
  .load-dot:nth-child(2){animation-delay:.18s;}
  .load-dot:nth-child(3){animation-delay:.36s;}
  @keyframes bounce-dot{0%,100%{transform:translateY(0);opacity:.4;}50%{transform:translateY(-5px);opacity:1;}}

  /* empty state */
  .empty-state{text-align:center;padding:56px 20px;color:${C.stone};}
  .empty-state .big-icon{font-size:3rem;margin-bottom:12px;}
  .empty-state p{font-size:.9rem;max-width:320px;margin:0 auto;line-height:1.6;}

  /* cards */
  .card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;}
  .result-card{background:rgba(255,255,255,.06);border:1px solid rgba(200,216,204,.12);border-radius:14px;padding:20px;transition:border-color .2s,transform .2s;}
  .result-card:hover{border-color:rgba(122,158,126,.4);transform:translateY(-2px);}
  .card-badge{display:inline-block;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;padding:3px 10px;border-radius:20px;margin-bottom:10px;}
  .badge-rec{background:rgba(74,158,202,.25);color:${C.sky};}
  .badge-trail{background:rgba(122,158,126,.25);color:${C.sage};}
  .card-title{font-family:'Playfair Display',serif;font-size:1.05rem;color:${C.mist};margin-bottom:6px;line-height:1.3;}
  .card-meta{font-size:.8rem;color:${C.stone};margin-bottom:10px;display:flex;flex-wrap:wrap;gap:8px;}
  .card-meta span{display:flex;align-items:center;gap:4px;}
  .card-body{font-size:.85rem;color:rgba(245,240,232,.75);line-height:1.65;}
  .card-link{display:inline-flex;align-items:center;gap:5px;margin-top:12px;font-size:.8rem;font-weight:600;color:${C.sky};text-decoration:none;border-bottom:1px dashed rgba(74,158,202,.4);transition:color .2s;}
  .card-link:hover{color:${C.mist};}

  /* avail dots */
  .card-availability{display:flex;gap:4px;flex-wrap:wrap;margin-top:10px;}
  .avail-dot{width:28px;height:28px;border-radius:6px;font-size:.65rem;font-weight:700;display:flex;align-items:center;justify-content:center;color:white;}
  .avail-open{background:${C.green};}
  .avail-few{background:${C.gold};}
  .avail-full{background:rgba(255,255,255,.15);color:${C.stone};}

  /* trail status */
  .status-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}
  .status-pill{font-size:.72rem;font-weight:700;padding:3px 9px;border-radius:20px;display:inline-flex;align-items:center;gap:3px;}
  .s-open{background:rgba(34,197,94,.18);color:${C.green};border:1px solid rgba(34,197,94,.3);}
  .s-caution{background:rgba(245,158,11,.18);color:${C.gold};border:1px solid rgba(245,158,11,.3);}
  .s-closed{background:rgba(239,68,68,.18);color:${C.red};border:1px solid rgba(239,68,68,.3);}
  .s-unknown{background:rgba(107,114,128,.18);color:${C.stone};border:1px solid rgba(107,114,128,.25);}

  /* stars */
  .stars{color:${C.gold};letter-spacing:-1px;}

  /* filter bar */
  .filter-bar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center;}
  .filter-label{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:${C.stone};}

  .stream-cursor{display:inline-block;width:2px;height:1em;background:${C.sage};animation:blink 1s step-end infinite;vertical-align:text-bottom;margin-left:2px;}
  @keyframes blink{50%{opacity:0;}}
  .disp-links{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px;}

  /* dispersed explainer */
  .explainer-box{background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.22);border-radius:14px;padding:20px 22px;margin-bottom:20px;}
  .explainer-box h3{font-family:'Playfair Display',serif;font-size:1.05rem;color:${C.gold};margin-bottom:10px;display:flex;align-items:center;gap:8px;}
  .explainer-intro{font-size:.85rem;color:rgba(245,240,232,.78);margin-bottom:16px;line-height:1.65;}
  .explainer-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;}
  .explainer-rule{background:rgba(255,255,255,.04);border-radius:10px;padding:12px 14px;}
  .rule-icon{font-size:1.3rem;margin-bottom:5px;}
  .rule-title{font-size:.8rem;font-weight:700;color:${C.mist};margin-bottom:3px;}
  .rule-desc{font-size:.75rem;color:${C.stone};line-height:1.5;}

  @keyframes spin{to{transform:rotate(360deg);}}
  .spin-inline{display:inline-block;animation:spin .8s linear infinite;}

  @media(max-width:768px){
    .app-shell{padding:0 12px 48px;}
    .app-header{padding:20px 0 16px;gap:10px;}
    .logo-icon{font-size:2.2rem;}
    .app-title h1{font-size:1.5rem;}
    .search-panel{padding:16px;}
    .field-grid{grid-template-columns:1fr 1fr;}
    .date-shortcuts{gap:5px;}
    .chip{padding:4px 10px;font-size:.73rem;}
    .tab-bar{gap:2px;}
    .tab-btn{padding:9px 4px;font-size:.78rem;gap:4px;}
    .card-grid,.sk-grid{grid-template-columns:1fr;}
    .filter-bar{gap:6px;}
  }

  @media(max-width:480px){
    .app-header{flex-direction:row;align-items:center;}
    .field-grid{grid-template-columns:1fr;}
    .tab-btn span.label{display:none;}
    .tab-btn{font-size:.82rem;padding:9px 8px;}
    .search-panel h2{font-size:1rem;}
    .btn-search{width:100%;justify-content:center;padding:12px;}
    .date-shortcuts{gap:4px;}
    .chip{padding:4px 9px;font-size:.71rem;}
    .card-grid,.sk-grid{grid-template-columns:1fr;}
    .result-card{padding:16px;}
    .card-title{font-size:1rem;}
    .explainer-grid{grid-template-columns:1fr 1fr;}
    .disp-links{flex-direction:column;gap:8px;}
    .filter-bar{gap:5px;}
    .status-row{gap:5px;}
    .suggestions-dropdown{font-size:.84rem;}
  }
`;

function StyleTag() { return <style dangerouslySetInnerHTML={{ __html: STYLES }} />; }

// ─── API helpers ──────────────────────────────────────────────────
async function callClaude(sys, usr) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: MODEL, max_tokens: 2000, system: sys, messages: [{ role: "user", content: usr }] }),
  });
  const data = await res.json();
  const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
  // Strip only the fence markers, preserve the JSON content between them
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(cleaned); } catch { return null; }
}

async function streamClaude({ sys, usr, onChunk, onDone, onError }) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: MODEL, max_tokens: 2200, stream: true, system: sys, messages: [{ role: "user", content: usr }] }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop();
      for (const l of lines) {
        if (!l.startsWith("data: ")) continue;
        const j = l.slice(6).trim();
        if (j === "[DONE]") break;
        try { const ev = JSON.parse(j); if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") onChunk(ev.delta.text); } catch {}
      }
    }
    onDone();
  } catch (e) { onError(e.message); }
}

// ─── Comprehensive destinations: US & Canadian national parks, state parks, PNW cities ─
const DESTINATIONS = [
  // ── US NATIONAL PARKS ──────────────────────────────────────────
  { label:"Acadia, ME",                   sublabel:"Acadia National Park",                       type:"park" },
  { label:"Arches, UT",                   sublabel:"Arches National Park",                       type:"park" },
  { label:"Badlands, SD",                 sublabel:"Badlands National Park",                     type:"park" },
  { label:"Big Bend, TX",                 sublabel:"Big Bend National Park",                     type:"park" },
  { label:"Biscayne, FL",                 sublabel:"Biscayne National Park",                     type:"park" },
  { label:"Black Canyon of the Gunnison, CO", sublabel:"Black Canyon NP — dramatic gorge",       type:"park" },
  { label:"Bryce Canyon, UT",             sublabel:"Bryce Canyon National Park",                 type:"park" },
  { label:"Canyonlands, UT",              sublabel:"Canyonlands National Park",                  type:"park" },
  { label:"Capitol Reef, UT",             sublabel:"Capitol Reef National Park",                 type:"park" },
  { label:"Carlsbad Caverns, NM",         sublabel:"Carlsbad Caverns National Park",             type:"park" },
  { label:"Channel Islands, CA",          sublabel:"Channel Islands National Park",              type:"park" },
  { label:"Congaree, SC",                 sublabel:"Congaree National Park",                     type:"park" },
  { label:"Crater Lake, OR",              sublabel:"Crater Lake National Park",                  type:"park" },
  { label:"Cuyahoga Valley, OH",          sublabel:"Cuyahoga Valley National Park",              type:"park" },
  { label:"Death Valley, CA",             sublabel:"Death Valley National Park",                 type:"park" },
  { label:"Denali, AK",                   sublabel:"Denali National Park & Preserve",            type:"park" },
  { label:"Dry Tortugas, FL",             sublabel:"Dry Tortugas National Park",                 type:"park" },
  { label:"Everglades, FL",               sublabel:"Everglades National Park",                   type:"park" },
  { label:"Gates of the Arctic, AK",      sublabel:"Gates of the Arctic National Park",          type:"park" },
  { label:"Gateway Arch, MO",             sublabel:"Gateway Arch National Park",                 type:"park" },
  { label:"Glacier, MT",                  sublabel:"Glacier National Park",                      type:"park" },
  { label:"Glacier Bay, AK",              sublabel:"Glacier Bay National Park",                  type:"park" },
  { label:"Grand Canyon, AZ",             sublabel:"Grand Canyon National Park",                 type:"park" },
  { label:"Grand Teton, WY",              sublabel:"Grand Teton National Park",                  type:"park" },
  { label:"Great Basin, NV",              sublabel:"Great Basin National Park",                  type:"park" },
  { label:"Great Sand Dunes, CO",         sublabel:"Great Sand Dunes National Park",             type:"park" },
  { label:"Great Smoky Mountains, TN",    sublabel:"Great Smoky Mountains National Park",        type:"park" },
  { label:"Guadalupe Mountains, TX",      sublabel:"Guadalupe Mountains National Park",          type:"park" },
  { label:"Haleakala, HI",               sublabel:"Haleakalā National Park — Maui",             type:"park" },
  { label:"Hawaii Volcanoes, HI",         sublabel:"Hawaii Volcanoes National Park",             type:"park" },
  { label:"Hot Springs, AR",              sublabel:"Hot Springs National Park",                  type:"park" },
  { label:"Indiana Dunes, IN",            sublabel:"Indiana Dunes National Park",                type:"park" },
  { label:"Isle Royale, MI",              sublabel:"Isle Royale National Park",                  type:"park" },
  { label:"Joshua Tree, CA",              sublabel:"Joshua Tree National Park",                  type:"park" },
  { label:"Katmai, AK",                   sublabel:"Katmai National Park — brown bears",         type:"park" },
  { label:"Kenai Fjords, AK",             sublabel:"Kenai Fjords National Park",                 type:"park" },
  { label:"Kings Canyon, CA",             sublabel:"Kings Canyon National Park",                 type:"park" },
  { label:"Kobuk Valley, AK",             sublabel:"Kobuk Valley National Park",                 type:"park" },
  { label:"Lake Clark, AK",               sublabel:"Lake Clark National Park",                   type:"park" },
  { label:"Lassen Volcanic, CA",          sublabel:"Lassen Volcanic National Park",              type:"park" },
  { label:"Mammoth Cave, KY",             sublabel:"Mammoth Cave National Park",                 type:"park" },
  { label:"Mesa Verde, CO",               sublabel:"Mesa Verde National Park",                   type:"park" },
  { label:"Mt Rainier, WA",               sublabel:"Mount Rainier National Park",                type:"park" },
  { label:"Mount Rainier, WA",            sublabel:"Mount Rainier National Park",                type:"park" },
  { label:"New River Gorge, WV",          sublabel:"New River Gorge National Park",              type:"park" },
  { label:"North Cascades, WA",           sublabel:"North Cascades National Park",               type:"park" },
  { label:"Olympic, WA",                  sublabel:"Olympic National Park",                      type:"park" },
  { label:"Olympic Peninsula, WA",        sublabel:"Olympic National Park & Forest",             type:"park" },
  { label:"Petrified Forest, AZ",         sublabel:"Petrified Forest National Park",             type:"park" },
  { label:"Pinnacles, CA",                sublabel:"Pinnacles National Park",                    type:"park" },
  { label:"Redwood, CA",                  sublabel:"Redwood National & State Parks",             type:"park" },
  { label:"Rocky Mountain, CO",           sublabel:"Rocky Mountain National Park",               type:"park" },
  { label:"Saguaro, AZ",                  sublabel:"Saguaro National Park",                      type:"park" },
  { label:"Sequoia, CA",                  sublabel:"Sequoia National Park",                      type:"park" },
  { label:"Shenandoah, VA",               sublabel:"Shenandoah National Park",                   type:"park" },
  { label:"Theodore Roosevelt, ND",       sublabel:"Theodore Roosevelt National Park",           type:"park" },
  { label:"Virgin Islands, VI",           sublabel:"Virgin Islands National Park",               type:"park" },
  { label:"Voyageurs, MN",                sublabel:"Voyageurs National Park",                    type:"park" },
  { label:"White Sands, NM",              sublabel:"White Sands National Park",                  type:"park" },
  { label:"Wind Cave, SD",                sublabel:"Wind Cave National Park",                    type:"park" },
  { label:"Wrangell-St. Elias, AK",       sublabel:"Wrangell-St. Elias National Park",          type:"park" },
  { label:"Yellowstone, WY",              sublabel:"Yellowstone National Park",                  type:"park" },
  { label:"Yosemite, CA",                 sublabel:"Yosemite National Park",                     type:"park" },
  { label:"Zion, UT",                     sublabel:"Zion National Park",                         type:"park" },
  { label:"Boundary Waters, MN",          sublabel:"BWCAW — canoe & portage country",            type:"park" },
  { label:"Mt Whitney, CA",               sublabel:"Highest peak in lower 48 — Inyo NF",        type:"park" },
  { label:"Mt St Helens, WA",             sublabel:"Mt St Helens National Volcanic Monument",    type:"park" },
  { label:"Stehekin, WA",                 sublabel:"North Cascades NP — no roads in",            type:"park" },

  // ── CANADIAN NATIONAL PARKS ────────────────────────────────────
  { label:"Banff, AB",                    sublabel:"Banff National Park — Canadian Rockies",     type:"park" },
  { label:"Jasper, AB",                   sublabel:"Jasper National Park — Canadian Rockies",    type:"park" },
  { label:"Yoho, BC",                     sublabel:"Yoho National Park — BC Rockies",            type:"park" },
  { label:"Kootenay, BC",                 sublabel:"Kootenay National Park",                     type:"park" },
  { label:"Waterton Lakes, AB",           sublabel:"Waterton Lakes NP — border with Glacier NP", type:"park" },
  { label:"Pacific Rim, BC",              sublabel:"Pacific Rim National Park Reserve",          type:"park" },
  { label:"Gulf Islands, BC",             sublabel:"Gulf Islands National Park Reserve",         type:"park" },
  { label:"Revelstoke, BC",               sublabel:"Mount Revelstoke National Park",             type:"park" },
  { label:"Glacier, BC",                  sublabel:"Glacier National Park — BC",                 type:"park" },
  { label:"Fundy, NB",                    sublabel:"Fundy National Park — highest tides",        type:"park" },
  { label:"Cape Breton Highlands, NS",    sublabel:"Cape Breton Highlands National Park",        type:"park" },
  { label:"Prince Edward Island, PEI",    sublabel:"Prince Edward Island National Park",         type:"park" },
  { label:"Kejimkujik, NS",               sublabel:"Kejimkujik National Park",                   type:"park" },
  { label:"Kouchibouguac, NB",            sublabel:"Kouchibouguac National Park",                type:"park" },
  { label:"Gros Morne, NL",               sublabel:"Gros Morne National Park — Newfoundland",    type:"park" },
  { label:"Terra Nova, NL",               sublabel:"Terra Nova National Park",                   type:"park" },
  { label:"Forillon, QC",                 sublabel:"Forillon National Park — Gaspé Peninsula",   type:"park" },
  { label:"La Mauricie, QC",              sublabel:"La Mauricie National Park",                  type:"park" },
  { label:"Mingan Archipelago, QC",       sublabel:"Mingan Archipelago National Park Reserve",   type:"park" },
  { label:"Georgian Bay Islands, ON",     sublabel:"Georgian Bay Islands National Park",         type:"park" },
  { label:"Bruce Peninsula, ON",          sublabel:"Bruce Peninsula National Park",              type:"park" },
  { label:"Point Pelee, ON",              sublabel:"Point Pelee National Park — bird migration", type:"park" },
  { label:"Pukaskwa, ON",                 sublabel:"Pukaskwa National Park — Lake Superior",     type:"park" },
  { label:"Riding Mountain, MB",          sublabel:"Riding Mountain National Park",              type:"park" },
  { label:"Prince Albert, SK",            sublabel:"Prince Albert National Park",                type:"park" },
  { label:"Elk Island, AB",               sublabel:"Elk Island National Park — bison herds",     type:"park" },
  { label:"Wood Buffalo, AB",             sublabel:"Wood Buffalo National Park — largest in Canada", type:"park" },
  { label:"Nahanni, NT",                  sublabel:"Nahanni National Park Reserve",              type:"park" },
  { label:"Ivvavik, YT",                  sublabel:"Ivvavik National Park — Yukon Arctic",       type:"park" },
  { label:"Kluane, YT",                   sublabel:"Kluane National Park — St. Elias Mountains", type:"park" },
  { label:"Gwaii Haanas, BC",             sublabel:"Gwaii Haanas National Park Reserve",         type:"park" },
  { label:"Haida Gwaii, BC",              sublabel:"Gwaii Haanas — Queen Charlotte Islands",     type:"park" },
  { label:"Auyuittuq, NU",                sublabel:"Auyuittuq National Park — Baffin Island",    type:"park" },
  { label:"Quttinirpaaq, NU",             sublabel:"Quttinirpaaq National Park — high Arctic",   type:"park" },
  { label:"Sirmilik, NU",                 sublabel:"Sirmilik National Park",                     type:"park" },

  // ── MAJOR US STATE PARKS ───────────────────────────────────────
  { label:"Anza-Borrego, CA",             sublabel:"Anza-Borrego Desert State Park — CA",        type:"park" },
  { label:"Julia Pfeiffer Burns, CA",     sublabel:"Julia Pfeiffer Burns State Park — Big Sur",  type:"park" },
  { label:"Humboldt Redwoods, CA",        sublabel:"Humboldt Redwoods State Park",               type:"park" },
  { label:"Custer State Park, SD",        sublabel:"Custer State Park — Black Hills",            type:"park" },
  { label:"Adirondacks, NY",              sublabel:"Adirondack Park — 6M acres",                 type:"park" },
  { label:"Catskills, NY",                sublabel:"Catskill Park — Hudson Valley",               type:"park" },
  { label:"Baxter State Park, ME",        sublabel:"Baxter State Park — Mt Katahdin",            type:"park" },
  { label:"Palomar Mountain, CA",         sublabel:"Palomar Mountain State Park",                type:"park" },
  { label:"Silver Falls, OR",             sublabel:"Silver Falls State Park — waterfall trail",  type:"park" },
  { label:"Moran State Park, WA",         sublabel:"Moran State Park — Orcas Island",            type:"park" },
  { label:"Deception Pass, WA",           sublabel:"Deception Pass State Park",                  type:"park" },
  { label:"Ecola State Park, OR",         sublabel:"Ecola State Park — coastal headlands",       type:"park" },
  { label:"Smith Rock, OR",               sublabel:"Smith Rock State Park — rock climbing",      type:"park" },
  { label:"Valley of Fire, NV",           sublabel:"Valley of Fire State Park",                  type:"park" },
  { label:"Goblin Valley, UT",            sublabel:"Goblin Valley State Park",                   type:"park" },
  { label:"Palo Duro Canyon, TX",         sublabel:"Palo Duro Canyon State Park — Texas Grand Canyon", type:"park" },
  { label:"Matthiessen, IL",              sublabel:"Matthiessen State Park — canyons & waterfalls", type:"park" },
  { label:"Ricketts Glen, PA",            sublabel:"Ricketts Glen State Park — 22 waterfalls",   type:"park" },
  { label:"Watkins Glen, NY",             sublabel:"Watkins Glen State Park — gorge trail",      type:"park" },
  { label:"Cloudland Canyon, GA",         sublabel:"Cloudland Canyon State Park",                type:"park" },
  { label:"Cheaha, AL",                   sublabel:"Cheaha State Park — highest point in AL",    type:"park" },
  { label:"Starved Rock, IL",             sublabel:"Starved Rock State Park — canyon waterfalls", type:"park" },
  { label:"Minnehaha, MN",                sublabel:"Minnehaha Regional Park — falls",            type:"park" },
  { label:"Tahquamenon Falls, MI",        sublabel:"Tahquamenon Falls State Park",               type:"park" },
  { label:"Itasca, MN",                   sublabel:"Itasca State Park — Mississippi headwaters", type:"park" },
  { label:"Natural Bridge, VA",           sublabel:"Natural Bridge State Park",                  type:"park" },
  { label:"Hanging Rock, NC",             sublabel:"Hanging Rock State Park",                    type:"park" },
  { label:"Cumberland Gap, KY",           sublabel:"Cumberland Gap National Historical Park",    type:"park" },

  // ── PNW MOUNTAINS & VOLCANOES ─────────────────────────────────
  { label:"Mt Baker, WA",                 sublabel:"Mt Baker-Snoqualmie National Forest",        type:"forest" },
  { label:"Mount Baker, WA",              sublabel:"Mt Baker-Snoqualmie National Forest",        type:"forest" },
  { label:"Mt Baker-Snoqualmie, WA",      sublabel:"Mt Baker-Snoqualmie National Forest",        type:"forest" },
  { label:"Mt Hood, OR",                  sublabel:"Mt Hood National Forest",                    type:"forest" },
  { label:"Mount Hood, OR",               sublabel:"Mt Hood National Forest",                    type:"forest" },
  { label:"Mt Adams, WA",                 sublabel:"Gifford Pinchot National Forest",            type:"forest" },
  { label:"Mt Jefferson, OR",             sublabel:"Mt Jefferson Wilderness — Willamette NF",    type:"forest" },
  { label:"Three Sisters, OR",            sublabel:"Three Sisters Wilderness — Deschutes NF",    type:"forest" },
  { label:"Glacier Peak, WA",             sublabel:"Glacier Peak Wilderness — Okanogan NF",      type:"forest" },
  { label:"Enchantments, WA",             sublabel:"Alpine Lakes Wilderness — Okanogan NF",      type:"forest" },
  { label:"Snoqualmie Pass, WA",          sublabel:"Mt Baker-Snoqualmie NF — I-90 corridor",     type:"forest" },
  { label:"Stevens Pass, WA",             sublabel:"Mt Baker-Snoqualmie NF — Hwy 2 corridor",    type:"forest" },
  { label:"Okanogan-Wenatchee, WA",       sublabel:"Okanogan-Wenatchee National Forest",         type:"forest" },
  { label:"Mt Shasta, CA",                sublabel:"Shasta-Trinity National Forest",             type:"forest" },

  // ── PNW MAJOR CITIES & TOWNS ──────────────────────────────────
  { label:"Seattle, WA",                  sublabel:"Gateway to Cascades, Olympics & Islands",    type:"city" },
  { label:"Portland, OR",                 sublabel:"Gateway to Mt Hood, Columbia Gorge & coast", type:"city" },
  { label:"Vancouver, BC",                sublabel:"Gateway to North Shore mountains & BC parks", type:"city" },
  { label:"Victoria, BC",                 sublabel:"Vancouver Island — gateway to Pacific Rim",  type:"city" },
  { label:"Olympia, WA",                  sublabel:"Capital city — Olympic Peninsula gateway",   type:"city" },
  { label:"Tacoma, WA",                   sublabel:"Near Mt Rainier NP & Puget Sound",           type:"city" },
  { label:"Bellingham, WA",               sublabel:"Gateway to Mt Baker & North Cascades",       type:"city" },
  { label:"Everett, WA",                  sublabel:"Snohomish County — Cascades access",         type:"city" },
  { label:"Spokane, WA",                  sublabel:"Eastern WA — gateway to Idaho wilderness",   type:"city" },
  { label:"Wenatchee, WA",                sublabel:"Apple capital — Cascades & Columbia River",  type:"city" },
  { label:"Yakima, WA",                   sublabel:"Eastern Cascades & wine country",            type:"city" },
  { label:"Leavenworth, WA",              sublabel:"Wenatchee NF & Cascades — Bavarian village", type:"city" },
  { label:"Winthrop, WA",                 sublabel:"Methow Valley — Okanogan NF & cross-country skiing", type:"city" },
  { label:"Twisp, WA",                    sublabel:"Methow Valley — Okanogan-Wenatchee NF",      type:"city" },
  { label:"Enumclaw, WA",                 sublabel:"Eastern gateway to Mt Rainier NP",           type:"city" },
  { label:"Ashford, WA",                  sublabel:"Southwest entrance to Mt Rainier NP",        type:"city" },
  { label:"Packwood, WA",                 sublabel:"Gifford Pinchot NF & Rainier gateway",       type:"city" },
  { label:"Eatonville, WA",               sublabel:"Near Mt Rainier NP — Nisqually entrance",    type:"city" },
  { label:"Port Angeles, WA",             sublabel:"Olympic NP north entrance & Hurricane Ridge", type:"city" },
  { label:"Port Townsend, WA",            sublabel:"Olympic Peninsula — Victorian seaport",      type:"city" },
  { label:"Sequim, WA",                   sublabel:"Olympic Peninsula — rain shadow valley",     type:"city" },
  { label:"Aberdeen, WA",                 sublabel:"Grays Harbor — Quinault Rainforest access",  type:"city" },
  { label:"Long Beach, WA",               sublabel:"Long Beach Peninsula — Pacific coast",       type:"city" },
  { label:"Friday Harbor, WA",            sublabel:"San Juan Island — whale watching & hiking",  type:"city" },
  { label:"Anacortes, WA",                sublabel:"San Juan Islands ferry hub — Cascades",      type:"city" },
  { label:"Mount Vernon, WA",             sublabel:"Skagit Valley — North Cascades gateway",     type:"city" },
  { label:"Sedro-Woolley, WA",            sublabel:"North Cascades NP west entrance",            type:"city" },
  { label:"Concrete, WA",                 sublabel:"Upper Skagit Valley — Baker Lake area",      type:"city" },
  { label:"Index, WA",                    sublabel:"Sky Valley — climbing & hiking hub",         type:"city" },
  { label:"Gold Bar, WA",                 sublabel:"Wallace Falls & Index rock climbing",        type:"city" },
  { label:"Bend, OR",                     sublabel:"Central Oregon — Cascade Range",             type:"city" },
  { label:"Medford, OR",                  sublabel:"Rogue Valley — Crater Lake & Cascades",      type:"city" },
  { label:"Ashland, OR",                  sublabel:"Near Cascade-Siskiyou NM & Mt Ashland",      type:"city" },
  { label:"Eugene, OR",                   sublabel:"Willamette Valley — McKenzie River & Cascades", type:"city" },
  { label:"Bend, OR",                     sublabel:"Central Oregon — Deschutes NF & Cascades",   type:"city" },
  { label:"Sisters, OR",                  sublabel:"Three Sisters Wilderness gateway — Deschutes NF", type:"city" },
  { label:"Cascade Locks, OR",            sublabel:"Columbia River Gorge — Bridge of the Gods",  type:"city" },
  { label:"Hood River, OR",               sublabel:"Columbia River Gorge & Mt Hood",             type:"city" },
  { label:"The Dalles, OR",               sublabel:"East Columbia Gorge — Deschutes River",      type:"city" },
  { label:"Astoria, OR",                  sublabel:"Columbia River mouth — Clatsop State Forest", type:"city" },
  { label:"Cannon Beach, OR",             sublabel:"Oregon coast — Ecola State Park",            type:"city" },
  { label:"Lincoln City, OR",             sublabel:"Oregon central coast — Siuslaw NF",          type:"city" },
  { label:"Newport, OR",                  sublabel:"Oregon coast — Siuslaw National Forest",     type:"city" },
  { label:"Coos Bay, OR",                 sublabel:"Oregon south coast — Oregon Dunes NRA",      type:"city" },
  { label:"Grants Pass, OR",              sublabel:"Rogue River — Siskiyou NF & whitewater",     type:"city" },
  { label:"Kelowna, BC",                  sublabel:"Okanagan Valley — Provincial parks & wine",  type:"city" },
  { label:"Penticton, BC",                sublabel:"South Okanagan — biking & hiking trails",    type:"city" },
  { label:"Kamloops, BC",                 sublabel:"Thompson Valley — Sun Peaks & provincial parks", type:"city" },
  { label:"Prince George, BC",            sublabel:"Central BC — gateway to northern wilderness", type:"city" },
  { label:"Prince Rupert, BC",            sublabel:"North BC coast — Skeena country",            type:"city" },
  { label:"Tofino, BC",                   sublabel:"Pacific Rim NP Reserve — surf & rainforest", type:"city" },
  { label:"Ucluelet, BC",                 sublabel:"Pacific Rim NP Reserve — Wild Pacific Trail", type:"city" },
  { label:"Whistler, BC",                 sublabel:"Garibaldi Provincial Park — world-class trails", type:"city" },
  { label:"Squamish, BC",                 sublabel:"Sea-to-Sky corridor — Stawamus Chief",       type:"city" },
  { label:"Pemberton, BC",                sublabel:"Lillooet Lake & Joffre Lakes Provincial Park", type:"city" },
  { label:"Revelstoke, BC",               sublabel:"Mt Revelstoke NP & Glacier NP",              type:"city" },
  { label:"Golden, BC",                   sublabel:"Yoho & Kootenay NPs — Canadian Rockies",     type:"city" },
  { label:"Fernie, BC",                   sublabel:"Elk Valley — Mt Fernie Provincial Park",     type:"city" },
  { label:"Nelson, BC",                   sublabel:"Kootenay Lake — Kokanee Glacier PP",         type:"city" },

  // ── OTHER MAJOR US DESTINATIONS ───────────────────────────────
  { label:"Moab, UT",                     sublabel:"Red rock country — Arches & Canyonlands",    type:"city" },
  { label:"Sedona, AZ",                   sublabel:"Red rock formations & trails",               type:"city" },
  { label:"Asheville, NC",                sublabel:"Blue Ridge Mountains gateway",               type:"city" },
  { label:"Flagstaff, AZ",                sublabel:"Gateway to Grand Canyon & Coconino NF",      type:"city" },
  { label:"Bozeman, MT",                  sublabel:"Near Yellowstone & Gallatin NF",             type:"city" },
  { label:"Jackson, WY",                  sublabel:"Gateway to Grand Teton & Yellowstone",       type:"city" },
  { label:"Lake Tahoe, CA",               sublabel:"Sierra Nevada alpine lake",                  type:"region" },
  { label:"Big Sur, CA",                  sublabel:"Coastal redwoods & Pacific views",           type:"region" },
  { label:"White Mountains, NH",          sublabel:"White Mountain National Forest",             type:"forest" },
  { label:"Deschutes, OR",                sublabel:"Deschutes National Forest",                  type:"forest" },
  { label:"Pike-San Isabel, CO",          sublabel:"Pike & San Isabel National Forests",         type:"forest" },
  { label:"Coconino, AZ",                 sublabel:"Coconino National Forest",                   type:"forest" },
  { label:"Chattahoochee, GA",            sublabel:"Chattahoochee-Oconee National Forest",       type:"forest" },
  { label:"Black Hills, SD",              sublabel:"Black Hills National Forest",                type:"forest" },
  { label:"Ouray, CO",                    sublabel:"Colorado's 'Switzerland of America'",        type:"city" },
  { label:"Whitefish, MT",                sublabel:"Near Glacier NP & Flathead NF",              type:"city" },
  { label:"Durango, CO",                  sublabel:"San Juan Mountains gateway",                 type:"city" },
  { label:"Estes Park, CO",               sublabel:"Gateway to Rocky Mountain NP",               type:"city" },
  { label:"Mammoth Lakes, CA",            sublabel:"Sierra Nevada — Inyo NF",                    type:"city" },
  { label:"Bishop, CA",                   sublabel:"Eastern Sierra & John Muir Wilderness",      type:"city" },
  { label:"Taos, NM",                     sublabel:"Carson NF & Wheeler Peak",                   type:"city" },
  { label:"Santa Fe, NM",                 sublabel:"Sangre de Cristo Mountains — Santa Fe NF",   type:"city" },
  { label:"Stowe, VT",                    sublabel:"Green Mountains & Long Trail",               type:"city" },
  { label:"Heber City, UT",               sublabel:"Uinta-Wasatch-Cache NF gateway",             type:"city" },
  { label:"Crested Butte, CO",            sublabel:"Gunnison NF & Elk Mountains",                type:"city" },
  { label:"Frank Church Wilderness, ID",  sublabel:"Largest lower-48 wilderness area",           type:"forest" },
  { label:"Ozark, MO",                    sublabel:"Ozark National Scenic Riverways",            type:"region" },
  { label:"Pisgah, NC",                   sublabel:"Pisgah National Forest",                     type:"forest" },
  { label:"Sawtooth, ID",                 sublabel:"Sawtooth National Recreation Area",          type:"park" },
  { label:"Sun Valley, ID",               sublabel:"Sawtooth NRA & Pioneer Mountains",           type:"city" },
  { label:"Coeur d'Alene, ID",            sublabel:"Northern Idaho — Coeur d'Alene NF",          type:"city" },
  { label:"Missoula, MT",                 sublabel:"Lolo NF — Gateway to Bitterroot & Rattlesnake", type:"city" },
  { label:"Kalispell, MT",                sublabel:"Flathead Valley — gateway to Glacier NP",    type:"city" },
  { label:"Livingston, MT",               sublabel:"Gallatin NF — Yellowstone River gateway",    type:"city" },
];

function fuzzyMatch(q, dest) {
  const s = q.toLowerCase();
  const l = dest.label.toLowerCase();
  const b = dest.sublabel.toLowerCase();
  if (l.startsWith(s)) return 3;
  if (l.includes(s)) return 2;
  if (b.includes(s)) return 1;
  // partial word match
  const words = s.split(/\s+/);
  if (words.every(w => l.includes(w) || b.includes(w))) return 1;
  return 0;
}

// ─── LocationInput ────────────────────────────────────────────────
function LocationInput({ value, onChange }) {
  const [query, setQuery] = useState(value);
  const [suggs, setSuggs]   = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const [hiIdx, setHiIdx]   = useState(-1);
  const wrapRef = useRef(null);

  useEffect(() => { if (value !== query) setQuery(value); }, [value]);

  const getSuggestions = q => {
    if (q.length < 1) return [];
    return DESTINATIONS
      .map(d => ({ ...d, score: fuzzyMatch(q, d) }))
      .filter(d => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  };

  const handleChange = e => {
    const v = e.target.value;
    setQuery(v); onChange(v); setHiIdx(-1);
    const results = getSuggestions(v);
    setSuggs(results);
    setShowDrop(results.length > 0);
  };

  const pick = label => { setQuery(label); onChange(label); setShowDrop(false); setSuggs([]); };

  const handleKeyDown = e => {
    if (!showDrop || !suggs.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHiIdx(i => Math.min(i + 1, suggs.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHiIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === "Enter" && hiIdx >= 0) { e.preventDefault(); pick(suggs[hiIdx].label); }
    else if (e.key === "Escape") setShowDrop(false);
  };

  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const typeIcon = { city:"🏙️", park:"🏞️", forest:"🌲", region:"🗺️" };

  return (
    <div className="loc-wrap" ref={wrapRef}>
      <input
        placeholder="e.g. Yosemite, Bend OR, Olympic Peninsula…"
        value={query} onChange={handleChange} onKeyDown={handleKeyDown}
        onFocus={() => suggs.length > 0 && setShowDrop(true)}
        autoComplete="off"
        style={{ width:"100%", background:"rgba(255,255,255,.08)", border:"1px solid rgba(200,216,204,.2)", borderRadius:8, padding:"9px 12px", color:"#f5f0e8", fontFamily:"inherit", fontSize:".9rem", outline:"none" }}
      />
      {showDrop && suggs.length > 0 && (
        <div className="suggestions-dropdown">
          {suggs.map((s, i) => (
            <div key={i} className={`suggestion-item ${i === hiIdx ? "hi" : ""}`} onMouseDown={() => pick(s.label)}>
              <span className="sug-icon">{typeIcon[s.type] || "📍"}</span>
              <div><div>{s.label}</div><div className="sug-sub">{s.sublabel}</div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton Loaders ─────────────────────────────────────────────
const CAMPSITE_MSGS = ["Checking permit windows…","Scanning available dates…","Querying campground databases…","Almost there…"];
const TRAIL_MSGS    = ["Consulting ranger reports…","Filtering top-rated routes…","Checking road conditions…","Loading trail data…"];
const DISP_MSGS     = ["Scanning Forest Service lands…","Checking fire restrictions…","Reviewing permit requirements…","Gathering dispersed areas…"];

function useCycleMsg(msgs, active, interval = 2200) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setIdx(i => (i + 1) % msgs.length), interval);
    return () => clearInterval(t);
  }, [active]);
  return msgs[idx];
}

function SkeletonCards({ count = 6, msgs }) {
  const msg = useCycleMsg(msgs, true);
  return (
    <div className="skeleton-scene">
      <div className="load-stage">
        <span className="ls-icon">🔍</span>
        <span>{msg}</span>
        <span className="load-dots">
          <span className="load-dot" /><span className="load-dot" /><span className="load-dot" />
        </span>
      </div>
      <div className="sk-grid">
        {Array.from({ length: count }).map((_, i) => (
          <div className="sk-card" key={i} style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="sk-badge" />
            <div className="sk-title" style={{ width: `${60 + Math.random() * 30}%` }} />
            <div className="sk-meta">
              <div className="sk-meta-pill" /><div className="sk-meta-pill" /><div className="sk-meta-pill" />
            </div>
            <div className="sk-body">
              <div className="sk-text" style={{ width: "90%" }} />
              <div className="sk-text" style={{ width: "75%" }} />
              <div className="sk-text" style={{ width: "82%" }} />
            </div>
            {i % 3 === 0 && (
              <div className="sk-dots">
                {Array.from({ length: 7 }).map((_, j) => <div className="sk-dot" key={j} />)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonStream({ msgs }) {
  const msg = useCycleMsg(msgs, true);
  return (
    <div className="skeleton-scene">
      <div className="load-stage">
        <span className="ls-icon">🌲</span>
        <span>{msg}</span>
        <span className="load-dots">
          <span className="load-dot" /><span className="load-dot" /><span className="load-dot" />
        </span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {[85,60,90,70,55,80,65,75,50].map((w, i) => (
          <div key={i} className="sk-text" style={{ width: `${w}%`, height: i % 4 === 0 ? 18 : 12, borderRadius: i % 4 === 0 ? 8 : 4, animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────
function Stars({ rating }) {
  const n = Number(rating); const full = Math.floor(n); const half = n % 1 >= 0.5;
  return (
    <span>
      <span className="stars">{"★".repeat(full)}{half?"½":""}{" ☆".repeat(5-full-(half?1:0))}</span>
      <span style={{ marginLeft:4, color:C.gold, fontWeight:700, fontSize:".85rem" }}>{n.toFixed(1)}</span>
    </span>
  );
}
function StatusPill({ label, status }) {
  const cls = {"Open":"s-open","Open with Caution":"s-caution","Closed":"s-closed"}[status]||"s-unknown";
  const icon = {"Open":"✓","Open with Caution":"⚠","Closed":"✕"}[status]||"?";
  return <span className={`status-pill ${cls}`}>{icon} {label}: {status||"Unknown"}</span>;
}
function AvailDots({ days }) {
  return (
    <div className="card-availability">
      {days.map((d, i) => {
        const cls = ["avail-open","avail-few","avail-full"][Math.floor(Math.random()*3)];
        return <div key={i} className={`avail-dot ${cls}`} title={fmtDate(d)}>{d.getDate()}</div>;
      })}
    </div>
  );
}
function Empty({ icon, text }) {
  return <div className="empty-state"><div className="big-icon">{icon}</div><p>{text}</p></div>;
}

// ─── CampsiteTab ──────────────────────────────────────────────────
function CampsiteTab({ params, triggered }) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!triggered) return;
    const key = `camp:${params.location}:${params.radius}:${params.startDate}:${params.endDate}`;
    const cached = cacheGet(key);
    if (cached) { setSites(cached); setDone(true); return; }
    setSites([]); setDone(false); setLoading(true);
    callClaude(
      `Return ONLY valid JSON — array of 6 campsite objects: name, type ("Developed"|"Group"|"Walk-in"), distance_miles (≤${params.radius}), open_sites (0-30), total_sites, reservation_url (recreation.gov URL), features (array of 3 strings), location_desc (≤20 words). Realistic for ${params.location}.`,
      `Campsites near ${params.location} within ${params.radius} miles, dates ${params.startDate}–${params.endDate}. JSON only.`
    ).then(data => {
      const list = Array.isArray(data) ? data : [];
      cacheSet(key, list);
      setSites(list); setLoading(false); setDone(true);
    });
  }, [triggered]);

  const days = Array.from(
    { length: Math.min(10, Math.max(1, Math.round((new Date(params.endDate)-new Date(params.startDate))/86400000)+1)) },
    (_, i) => addDays(new Date(params.startDate), i)
  );

  if (loading) return <SkeletonCards count={6} msgs={CAMPSITE_MSGS} />;
  if (!done) return <Empty icon="🏕️" text="Search for campsites near your destination" />;
  if (!sites.length) return <Empty icon="😔" text="No campsites found. Try expanding your radius." />;

  return (
    <div className="card-grid">
      {sites.map((s, i) => (
        <div className="result-card" key={i}>
          <span className="card-badge badge-rec">Recreation.gov</span>
          <div className="card-title">{s.name}</div>
          <div className="card-meta">
            <span>📍 {s.distance_miles} mi</span>
            <span>⛺ {s.type}</span>
            <span style={{ color: s.open_sites>5?C.green:s.open_sites>0?C.gold:C.stone }}>
              {s.open_sites>0?`${s.open_sites}/${s.total_sites} open`:"Full"}
            </span>
          </div>
          <div className="card-body">
            <em style={{ color:C.stone, fontSize:".8rem" }}>{s.location_desc}</em><br/><br/>
            {s.features?.join(" · ")}
          </div>
          <div style={{ marginTop:12, fontSize:".75rem", color:C.stone }}>Availability</div>
          <AvailDots days={days} />
          <a className="card-link" href={s.reservation_url} target="_blank" rel="noreferrer">Book on Recreation.gov ↗</a>
        </div>
      ))}
    </div>
  );
}

// ─── Dispersed Explainer (static — cached in module) ─────────────
// This is purely static so no API needed; shown when no explicit areas found
const DISP_RULES = [
  { icon:"📏", title:"Distance from Water & Roads", desc:"Camp ≥200 ft (60m) from streams, lakes, roads, and trails." },
  { icon:"🔥", title:"Fire Restrictions", desc:"Use existing fire rings only. Check for active fire bans before your trip." },
  { icon:"📅", title:"14-Day Stay Limit",  desc:"Max 14 days per location in a 28-day period. Then move ≥25 miles." },
  { icon:"🚗", title:"Vehicle Access",     desc:"Stay on existing two-track roads or pullouts. No off-road driving." },
  { icon:"🗑️", title:"Pack It Out",        desc:"No trash services. Pack out everything — food, waste, and gear." },
  { icon:"🚿", title:"Sanitation",         desc:"Bury waste 6\" deep in a cathole, 200 ft from water and trails." },
  { icon:"🐻", title:"Food Storage",       desc:"Use bear canisters or hang food 10 ft high, 4 ft from trunk." },
  { icon:"📋", title:"No Permit Required", desc:"Most National Forest dispersed camping is free with no reservation." },
];

function DispersedExplainer() {
  return (
    <div className="explainer-box">
      <h3>📖 What is Dispersed Camping?</h3>
      <p className="explainer-intro">
        No designated dispersed camping areas were found for this specific region, but{" "}
        <strong style={{ color:C.mist }}>any National Forest or BLM land without posted restrictions permits dispersed camping</strong>.
        It means camping outside developed campgrounds — no hookups, no facilities, no reservations — while practicing Leave No Trace.
      </p>
      <div className="explainer-grid">
        {DISP_RULES.map((r, i) => (
          <div className="explainer-rule" key={i}>
            <div className="rule-icon">{r.icon}</div>
            <div className="rule-title">{r.title}</div>
            <div className="rule-desc">{r.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Markdown → React renderer ───────────────────────────────────
function MarkdownRenderer({ text, loading }) {
  const lines = text.split("\n");
  const nodes = [];
  let listBuf = [];

  const flushList = () => {
    if (!listBuf.length) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} style={{ margin:"8px 0 12px 0", paddingLeft:20, display:"flex", flexDirection:"column", gap:4 }}>
        {listBuf.map((item, i) => (
          <li key={i} style={{ fontSize:".86rem", color:"rgba(245,240,232,.82)", lineHeight:1.65 }}
              dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
        ))}
      </ul>
    );
    listBuf = [];
  };

  // inline: **bold**, *italic*, `code`, [text](url)
  const inlineFormat = s => s
    .replace(/\*\*(.+?)\*\*/g, "<strong style='color:#c8d8cc'>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code style='background:rgba(255,255,255,.1);padding:1px 5px;border-radius:4px;font-size:.82em'>$1</code>")
    .replace(/\[(.+?)\]\((https?:\/\/[^)]+)\)/g, "<a href='$2' target='_blank' rel='noreferrer' style='color:#4a9eca;border-bottom:1px dashed rgba(74,158,202,.4)'>$1</a>");

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { flushList(); nodes.push(<div key={`sp-${i}`} style={{ height:6 }} />); continue; }

    // H1 / H2 / H3
    const hMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      flushList();
      const lvl = hMatch[1].length;
      const txt = hMatch[2].replace(/[*_]/g, "");
      const sz = lvl === 1 ? "1.1rem" : lvl === 2 ? "1rem" : ".92rem";
      const mt = lvl === 1 ? 20 : 14;
      nodes.push(
        <div key={`h-${i}`} style={{ fontFamily:"'Playfair Display',serif", fontSize:sz, fontWeight:700, color:"#c8d8cc", marginTop:mt, marginBottom:6, paddingBottom:5, borderBottom: lvl<=2 ? "1px solid rgba(200,216,204,.12)":"none" }}
             dangerouslySetInnerHTML={{ __html: inlineFormat(txt) }} />
      );
      continue;
    }

    // bullet list
    const liMatch = line.match(/^[-*•]\s+(.+)/);
    if (liMatch) { listBuf.push(liMatch[1]); continue; }

    // numbered list
    const numMatch = line.match(/^\d+\.\s+(.+)/);
    if (numMatch) { listBuf.push(numMatch[1]); continue; }

    // blockquote
    if (line.startsWith(">")) {
      flushList();
      nodes.push(
        <div key={`bq-${i}`} style={{ borderLeft:"3px solid rgba(122,158,126,.5)", paddingLeft:12, marginBottom:8, fontSize:".85rem", color:"rgba(245,240,232,.65)", fontStyle:"italic" }}
             dangerouslySetInnerHTML={{ __html: inlineFormat(line.slice(1).trim()) }} />
      );
      continue;
    }

    // horizontal rule
    if (/^---+$/.test(line)) { flushList(); nodes.push(<hr key={`hr-${i}`} style={{ border:"none", borderTop:"1px solid rgba(200,216,204,.12)", margin:"12px 0" }} />); continue; }

    // paragraph
    flushList();
    nodes.push(
      <p key={`p-${i}`} style={{ fontSize:".86rem", color:"rgba(245,240,232,.82)", lineHeight:1.72, marginBottom:6 }}
         dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
    );
  }
  flushList();

  return (
    <div style={{ padding:"20px 22px", background:"rgba(0,0,0,.25)", borderRadius:12, border:"1px solid rgba(200,216,204,.1)" }}>
      {nodes}
      {loading && <span className="stream-cursor" />}
    </div>
  );
}

// ─── DispersedTab ─────────────────────────────────────────────────
function DispersedTab({ params, triggered }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (!triggered || ran.current) return;
    ran.current = true;

    const key = `disp:${params.location}:${params.radius}`;
    const cached = cacheGet(key);
    if (cached) { setText(cached.text); setShowExplainer(cached.noExplicit); setDone(true); return; }

    setLoading(true); setText(""); setShowExplainer(false);
    let full = "";
    streamClaude({
      sys: `You are a USDA Forest Service expert. Use clear markdown with ## section headings and bullet points.
If NO explicitly named dispersed camping areas exist near the location, write "NO_EXPLICIT_DISPERSED" on the very first line.
Cover: (1) which National Forests / BLM districts cover the region, (2) specific dispersed camping areas or where to find them, (3) fire restrictions, (4) required passes/permits from https://www.fs.usda.gov/visit/passes-permits, (5) seasonal closures, (6) water sources and road access.`,
      usr: `Dispersed camping info near ${params.location} within ~${params.radius} miles.`,
      onChunk: c => { full += c; setText(full); if (full.includes("NO_EXPLICIT_DISPERSED")) setShowExplainer(true); },
      onDone: () => { cacheSet(key, { text: full, noExplicit: full.includes("NO_EXPLICIT_DISPERSED") }); setLoading(false); setDone(true); },
      onError: e => { setLoading(false); setText(`Error: ${e}`); },
    });
  }, [triggered]);

  if (loading && !text) return <SkeletonStream msgs={DISP_MSGS} />;
  if (!triggered && !text) return <Empty icon="🌲" text="Search to discover dispersed camping areas and regulations" />;

  const displayText = text.replace(/NO_EXPLICIT_DISPERSED\n?/, "").trim();
  return (
    <div>
      {showExplainer && <DispersedExplainer />}
      <MarkdownRenderer text={displayText} loading={loading} />
      {done && (
        <div className="disp-links">
          <a className="card-link" href="https://www.fs.usda.gov" target="_blank" rel="noreferrer">USDA Forest Service ↗</a>
          <a className="card-link" href="https://www.fs.usda.gov/visit/passes-permits" target="_blank" rel="noreferrer">Passes & Permits ↗</a>
          <a className="card-link" href="https://www.blm.gov/programs/recreation/camping" target="_blank" rel="noreferrer">BLM Camping ↗</a>
        </div>
      )}
    </div>
  );
}

// ─── TrailsTab ────────────────────────────────────────────────────
const DIFF_FILTERS = ["All","Easy","Moderate","Hard","Expert"];

function TrailsTab({ params, triggered }) {
  const [trails, setTrails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [diffFilter, setDiffFilter] = useState("All");

  useEffect(() => {
    if (!triggered) return;
    const key = `trails:${params.location}:${params.radius}`;
    const cached = cacheGet(key);
    if (cached) { setTrails(cached); setDone(true); return; }
    setTrails([]); setDone(false); setLoading(true);
    callClaude(
      `Return ONLY valid JSON — array of 8 hiking trail objects. Each: name, difficulty ("Easy"|"Moderate"|"Hard"|"Expert"), distance_miles, elevation_gain_ft, rating (MUST be ≥3.5, one decimal), num_reviews (MUST be ≥500), highlights (3 strings), trailhead_directions (≤30 words), alltrails_slug, distance_from_loc_miles (≤${params.radius}), trail_status ("Open"|"Open with Caution"|"Closed"), road_status ("Open"|"Open with Caution"|"Closed"), status_note (≤20 words). Rating ≥3.5 and reviews ≥500 only. Realistic for ${params.location}.`,
      `Top trails near ${params.location} within ${params.radius} miles. Rating≥3.5, reviews≥500. JSON only.`
    ).then(raw => {
      const list = Array.isArray(raw) ? raw.filter(t => Number(t.rating)>=3.5 && Number(t.num_reviews)>=500) : [];
      cacheSet(key, list);
      setTrails(list); setLoading(false); setDone(true);
    });
  }, [triggered]);

  const diffColor = { Easy:C.green, Moderate:C.gold, Hard:C.fire, Expert:C.red };
  const visible = diffFilter==="All" ? trails : trails.filter(t => t.difficulty===diffFilter);

  if (loading) return <SkeletonCards count={6} msgs={TRAIL_MSGS} />;
  if (!done) return <Empty icon="🥾" text="Search to discover top-rated trails near your destination" />;
  if (!trails.length) return <Empty icon="😔" text="No qualifying trails found (≥3.5★, 500+ reviews). Try expanding your radius." />;

  return (
    <div>
      <div className="filter-bar">
        <span className="filter-label">Difficulty:</span>
        {DIFF_FILTERS.map(f => (
          <button key={f} className={`chip chip-outline ${diffFilter===f?"chip-active":""}`} onClick={() => setDiffFilter(f)}>{f}</button>
        ))}
        <span style={{ marginLeft:"auto", fontSize:".76rem", color:C.stone }}>
          ⭐ ≥3.5 · 💬 ≥500 reviews · {visible.length} shown
        </span>
      </div>
      {visible.length===0 && <p style={{ textAlign:"center", color:C.stone, padding:"24px", fontSize:".88rem" }}>No {diffFilter} trails match. Try "All".</p>}
      <div className="card-grid">
        {visible.map((t, i) => (
          <div className="result-card" key={i}>
            <span className="card-badge badge-trail">AllTrails</span>
            <div className="card-title">{t.name}</div>
            <div className="card-meta">
              <span style={{ color:diffColor[t.difficulty]||C.sage }}>◆ {t.difficulty}</span>
              <span>📏 {t.distance_miles} mi</span>
              <span>↑ {Number(t.elevation_gain_ft).toLocaleString()} ft</span>
              <span>📍 {t.distance_from_loc_miles} mi</span>
            </div>
            <div style={{ marginBottom:10 }}>
              <Stars rating={Number(t.rating)} />
              <span style={{ fontSize:".75rem", color:C.stone, marginLeft:6 }}>({Number(t.num_reviews).toLocaleString()} reviews)</span>
            </div>
            <div className="card-body">
              {t.highlights?.join(" · ")}
              <br/><br/>
              <strong style={{ color:C.stone, fontSize:".78rem" }}>Trailhead: </strong>{t.trailhead_directions}
            </div>
            <div className="status-row">
              <StatusPill label="Trail" status={t.trail_status} />
              <StatusPill label="Road"  status={t.road_status} />
            </div>
            {t.status_note && t.status_note!=="Conditions normal" && (
              <div style={{ fontSize:".75rem", color:C.stone, marginTop:7, fontStyle:"italic" }}>ℹ️ {t.status_note}</div>
            )}
            <a className="card-link" href={`https://www.alltrails.com/trail/us/${t.alltrails_slug||"search"}`} target="_blank" rel="noreferrer">
              View on AllTrails ↗
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────
export default function App() {
  const today = new Date();
  const [location, setLocation]   = useState("");
  const [radius, setRadius]       = useState("50");
  const [startDate, setStartDate] = useState(fmtDate(today));
  const [endDate, setEndDate]     = useState(fmtDate(addDays(today, 2)));
  const [activeTab, setActiveTab] = useState("campsites");
  const [triggered, setTriggered] = useState(false);
  const [searchKey, setSearchKey] = useState(0);
  const [datePreset, setDatePreset] = useState(null);

  const applyPreset = (label, days) => {
    setDatePreset(label); setStartDate(fmtDate(today)); setEndDate(fmtDate(addDays(today, days-1)));
  };
  const handleSearch = () => {
    if (!location.trim()) return;
    setSearchKey(k => k+1); setTriggered(true);
  };

  const params = { location, radius, startDate, endDate };
  const triggerKey = `${searchKey}-${activeTab}`;
  const tabs = [
    { id:"campsites", label:"Campsites",           icon:"🏕️" },
    { id:"dispersed", label:"Dispersed & Permits", icon:"🌲" },
    { id:"trails",    label:"Trails",              icon:"🥾" },
  ];

  return (
    <>
      <StyleTag />
      <div className="app-shell">
        <header className="app-header">
          <div className="logo-icon">🏔️</div>
          <div className="app-title">
            <h1>WildRoute</h1>
            <p>Campsites · Dispersed Camping · Trails</p>
          </div>
        </header>

        <div className="search-panel">
          <h2>🔍 Plan Your Adventure</h2>
          <div className="field-grid">
            <div className="field" style={{ gridColumn:"1 / -1" }}>
              <label>Location / City / Park</label>
              <LocationInput value={location} onChange={setLocation} />
            </div>
            <div className="field">
              <label>Start Date</label>
              <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setDatePreset(null); }} />
            </div>
            <div className="field">
              <label>End Date</label>
              <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setDatePreset(null); }} />
            </div>
            <div className="field">
              <label>Radius (miles)</label>
              <select value={radius} onChange={e => setRadius(e.target.value)}>
                {[10,25,50,100,150,200].map(r => <option key={r} value={r}>{r} miles</option>)}
              </select>
            </div>
          </div>
          <div className="date-shortcuts">
            <span style={{ fontSize:".75rem", color:C.stone, alignSelf:"center", marginRight:4 }}>Quick dates:</span>
            {[{label:"This weekend",days:2},{label:"Next 3 days",days:3},{label:"Next 7 days",days:7},{label:"Next 14 days",days:14}].map(p => (
              <button key={p.label} className={`chip chip-outline ${datePreset===p.label?"chip-active":""}`} onClick={() => applyPreset(p.label, p.days)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="search-bottom">
            <button className="btn-search" onClick={handleSearch} disabled={!location.trim()}>🔎 Search</button>
          </div>
        </div>

        <div className="tab-bar">
          {tabs.map(t => (
            <button key={t.id} className={`tab-btn ${activeTab===t.id?"active":""}`} onClick={() => setActiveTab(t.id)}>
              {t.icon} <span className="label">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="results-area" key={triggerKey}>
          {activeTab==="campsites" && <CampsiteTab  params={params} triggered={triggered} />}
          {activeTab==="dispersed" && <DispersedTab params={params} triggered={triggered} />}
          {activeTab==="trails"    && <TrailsTab    params={params} triggered={triggered} />}
        </div>

        <div style={{ marginTop:48, textAlign:"center", fontSize:".75rem", color:C.stone, lineHeight:1.8 }}>
          Data sourced from Recreation.gov · USDA Forest Service · AllTrails<br/>
          Always verify current conditions with local ranger stations before your trip. 🌿
        </div>
      </div>
    </>
  );
}
