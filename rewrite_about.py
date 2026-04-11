import re

with open("landing-page/public/about.html", "r", encoding="utf-8") as f:
    html = f.read()

# I will write the complete updated DOM here.
new_html = """<!DOCTYPE html>
<html lang="en" class="dark scroll-smooth cursor-none">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>DevLog - Cyber-Rewind</title>
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..900&display=swap" rel="stylesheet">
  
  <!-- Icons -->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
  
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- Custom Styling -->
  <style>
    body {
      font-family: 'Space Grotesk', sans-serif;
      background-color: #000;
      color: #fff;
      overflow-x: hidden;
    }
    
    @media (min-width: 1024px) {
      body, a, button { cursor: none !important; }
    }

    .neo-border { border: 4px solid #fff; }
    
    .neo-shadow { box-shadow: 12px 12px 0px 0px #e51152; }
    .neo-shadow:hover { transform: translate(6px, 6px); box-shadow: 6px 6px 0px 0px #e51152; }
    
    .neo-shadow-graph { box-shadow: 12px 12px 0px 0px #f7e600; }

    .marker-box {
      background-color: #e51152;
      color: white;
      padding: 2px 8px;
      font-weight: 900;
      text-transform: uppercase;
      font-size: 0.8rem;
    }
    
    .cyber-gradient {
      background: linear-gradient(135deg, #e51152 0%, #f7e600 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* Bug Cards Code Blocks */
    .code-bad {
      background-color: #31080f;
      border-left: 4px solid #e51152;
      color: #ff99a8;
      font-family: monospace;
      padding: 1rem;
      margin-bottom: 0.5rem;
    }
    .code-good {
      background-color: #0d2a14;
      border-left: 4px solid #00f763;
      color: #8affb1;
      font-family: monospace;
      padding: 1rem;
    }

    /* SVG Flow Animation */
    .svg-flow-line line {
      stroke-dasharray: 8 6;
      animation: dash-flow 1s linear infinite;
    }
    @keyframes dash-flow {
      to { stroke-dashoffset: -14; }
    }

    /* Vertical Progress Nav */
    .progress-nav {
      position: fixed;
      left: 2rem;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      z-index: 40;
    }
    .progress-dot {
      width: 12px;
      height: 12px;
      border: 2px solid #555;
      background: transparent;
      border-radius: 50%;
      transition: all 0.3s ease;
      position: relative;
    }
    .progress-dot::after {
      content: attr(data-label);
      position: absolute;
      left: 20px;
      top: -4px;
      font-family: monospace;
      font-size: 0.75rem;
      font-weight: 900;
      color: #555;
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s ease;
    }
    .progress-dot.active {
      border-color: #e51152;
      background: #e51152;
      box-shadow: 0 0 10px #e51152;
    }
    .progress-dot.active::after {
      color: #e51152;
      opacity: 1;
    }
    
    .progress-line-bg {
      position: absolute;
      left: 5px;
      top: 10px;
      bottom: 10px;
      width: 2px;
      background: #333;
      z-index: -2;
    }
    .progress-line-fill {
      position: absolute;
      left: 5px;
      top: 10px;
      width: 2px;
      height: 0%;
      background: #e51152;
      z-index: -1;
      /* removed transition to allow instant JS mapping to scroll */
    }

    /* Staggered Scroll Reveal Animations */
    .reveal-up {
      opacity: 0;
      transform: translateY(40px);
      transition: opacity 0.6s ease-out, transform 0.6s ease-out;
    }
    .reveal-left {
      opacity: 0;
      transform: translateX(-40px);
      transition: opacity 0.6s ease-out, transform 0.6s ease-out;
    }
    .reveal-active {
      opacity: 1;
      transform: translate(0,0);
    }
    
    /* Reveal delays for grid nodes */
    .stagger-0 { transition-delay: 0ms; }
    .stagger-1 { transition-delay: 150ms; }
    .stagger-2 { transition-delay: 300ms; }
    .stagger-3 { transition-delay: 450ms; }
    
    /* Bug Card Thud / Pulse */
    @keyframes entry-thud {
      0% { transform: scale(0.97); }
      50% { transform: scale(1.01); }
      100% { transform: scale(1); }
    }
    .bug-card.reveal-active {
      animation: entry-thud 0.4s ease-out forwards;
    }
    
    /* CRT Scanline Flicker */
    @media (min-width: 1024px) {
      .scanline-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 3px);
        opacity: 0;
        z-index: 10;
      }
      .bug-card.reveal-active .scanline-overlay {
        animation: crt-flicker 0.4s linear forwards;
      }
      @keyframes crt-flicker {
        0% { opacity: 0.4; }
        20% { opacity: 0.1; }
        40% { opacity: 0.5; }
        60% { opacity: 0.2; }
        80% { opacity: 0.4; }
        100% { opacity: 0; }
      }
    }

    /* Glitch Effect */
    .glitch { position: relative; }
    .glitch.glitch-anim::before, .glitch.glitch-anim::after {
      content: attr(data-text);
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
    }
    .glitch.glitch-anim::before {
      color: #e51152;
      z-index: -1;
      animation: glitch-anim-1 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
    }
    .glitch.glitch-anim::after {
      color: #f7e600;
      z-index: -2;
      animation: glitch-anim-2 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
    }
    @keyframes glitch-anim-1 {
      0% { clip-path: inset(20% 0 80% 0); transform: translate(-2px, 1px); }
      20% { clip-path: inset(60% 0 10% 0); transform: translate(2px, -1px); }
      40% { clip-path: inset(40% 0 50% 0); transform: translate(-2px, 2px); }
      60% { clip-path: inset(80% 0 5% 0); transform: translate(2px, -2px); }
      80% { clip-path: inset(10% 0 70% 0); transform: translate(-2px, 1px); }
      100% { clip-path: inset(100% 0 0 0); transform: translate(0,0); }
    }
    @keyframes glitch-anim-2 {
      0% { clip-path: inset(10% 0 60% 0); transform: translate(2px, -1px); }
      20% { clip-path: inset(30% 0 20% 0); transform: translate(-2px, 1px); }
      40% { clip-path: inset(70% 0 10% 0); transform: translate(2px, -2px); }
      60% { clip-path: inset(20% 0 50% 0); transform: translate(-2px, 2px); }
      80% { clip-path: inset(90% 0 5% 0); transform: translate(2px, -1px); }
      100% { clip-path: inset(100% 0 0 0); transform: translate(0,0); }
    }

    /* Sequential List Entry */
    .seq-list li {
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.4s ease-out, transform 0.4s ease-out;
    }
    .reveal-active .seq-list li {
      opacity: 1;
      transform: translateY(0);
    }

    /* Custom Cursor Container */
    #cursor-triangle {
      position: fixed;
      top: 0; left: 0;
      width: 14px; height: 14px;
      pointer-events: none;
      z-index: 9999;
      transform: translate(-50%, -50%);
    }
    #cursor-triangle svg {
      width: 100%; height: 100%;
      fill: #e51152;
    }
    #cursor-ring {
      position: fixed;
      top: 0; left: 0;
      width: 32px; height: 32px;
      border: 2px solid #f7e600;
      border-radius: 50%;
      pointer-events: none;
      z-index: 9998;
      transform: translate(-50%, -50%);
      transition: width 0.2s, height 0.2s, border-color 0.2s;
    }
    #cursor-ring.hover {
      width: 48px; height: 48px;
      border-color: #e51152;
    }

    /* Hide progress nav on mobile */
    @media (max-width: 1024px) {
      .progress-nav { display: none; }
      #cursor-triangle, #cursor-ring { display: none; }
    }
  </style>
</head>
<body class="selection:bg-[#e51152] selection:text-white">

  <div id="cursor-triangle">
    <svg viewBox="0 0 24 24"><path d="M2.5 2L10 22L13 14L22 10.5L2.5 2Z"/></svg>
  </div>
  <div id="cursor-ring"></div>

  <!-- Header -->
  <header class="w-full border-b-4 border-white p-6 md:p-8 flex items-center justify-between sticky top-0 bg-black z-50 transition-all hover:bg-black/90">
    <a href="/" class="text-2xl font-black italic tracking-tighter uppercase flex items-center gap-2">
      <span class="material-symbols-outlined text-[#e51152] text-3xl">fast_rewind</span>
      REWIND
    </a>
    <div class="flex items-center gap-4">
      <span class="bg-[#f7e600] text-black font-black px-3 py-1 text-xs uppercase italic hidden md:block">SYS_DOCS: PUBLIC_READ</span>
      <a href="/" class="border-2 border-white px-4 py-2 font-black uppercase text-sm hover:bg-white hover:text-black transition-colors">GO_BACK</a>
    </div>
  </header>

  <!-- Section Progress Indicator (Left Side) -->
  <nav class="progress-nav" id="progressNav">
    <div class="progress-line-bg"></div>
    <div class="progress-line-fill" id="progressFill"></div>
    <a href="#s01" class="progress-dot" data-label="01_IDEA"></a>
    <a href="#s02" class="progress-dot" data-label="02_ARCH"></a>
    <a href="#s03" class="progress-dot" data-label="03_BLD"></a>
    <a href="#s04" class="progress-dot" data-label="04_AUTH"></a>
    <a href="#s05" class="progress-dot" data-label="05_SYNC"></a>
    <a href="#s06" class="progress-dot" data-label="06_BUGS"></a>
    <a href="#s07" class="progress-dot" data-label="07_UI"></a>
    <a href="#s08" class="progress-dot" data-label="08_NEXT"></a>
  </nav>

  <main class="max-w-4xl mx-auto mt-16 px-6 relative z-10 pb-32">

    <!-- Title Section -->
    <div class="mb-32 reveal-up">
      <div class="inline-block bg-[#e51152] text-white px-4 py-1 font-black text-xl mb-4 italic uppercase tracking-widest">A Full DevLog</div>
      <h1 class="text-6xl md:text-[6rem] font-black uppercase tracking-tighter leading-none mb-8">From Frustration To <br><span class="cyber-gradient underline decoration-[#fff] decoration-8 underline-offset-8">Firefox Approval.</span></h1>
    </div>

    <!-- STAT CALLOUTS -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-32">
      <div class="border-4 border-white p-6 bg-[#111] text-center neo-shadow reveal-up stagger-0">
        <div class="text-4xl md:text-5xl font-mono font-black text-[#f7e600] mb-2 stat-counter" data-target="5000" data-suffix="+">0</div>
        <div class="text-sm font-bold text-gray-400 uppercase tracking-widest">Lines of Code</div>
      </div>
      <div class="border-4 border-white p-6 bg-[#111] text-center neo-shadow reveal-up stagger-1">
        <div class="text-4xl md:text-5xl font-mono font-black text-[#f7e600] mb-2 stat-counter" data-target="2">0</div>
        <div class="text-sm font-bold text-gray-400 uppercase tracking-widest">Target Browsers</div>
      </div>
      <div class="border-4 border-white p-6 bg-[#111] text-center neo-shadow reveal-up stagger-2">
        <div class="text-4xl md:text-5xl font-mono font-black text-[#e51152] mb-2 stat-counter" data-target="30" data-suffix="s">0</div>
        <div class="text-sm font-bold text-gray-400 uppercase tracking-widest">Sync Interval</div>
      </div>
      <div class="border-4 border-white p-6 bg-[#111] text-center neo-shadow reveal-up stagger-3">
        <div class="text-4xl md:text-5xl font-mono font-black text-[#e51152] mb-2 stat-counter" data-target="4">0</div>
        <div class="text-sm font-bold text-gray-400 uppercase tracking-widest">Critical Bugs</div>
      </div>
    </div>

    <div class="space-y-40">
      
      <!-- Section 1 -->
      <section id="s01" class="section-block isolate" data-index="0">
        <h2 class="glitch reveal-left text-4xl font-black uppercase tracking-tighter border-b-4 border-white pb-4 mb-8 flex items-center gap-4" data-text="01. The Idea">
          <span class="material-symbols-outlined text-[#e51152] text-4xl">lightbulb</span> 01. The Idea
        </h2>
        <p class="reveal-up text-xl md:text-2xl font-bold text-gray-300 leading-snug mb-6">
          It started with a simple frustration. Some streaming platforms remember where you left off. Others don't. And none of them talk to each other.
        </p>
        <p class="reveal-up text-lg text-gray-400 mb-6 border-l-4 border-[#f7e600] pl-6 py-2">
          If you watch something on Netflix, pause halfway through a YouTube documentary, then catch up on a Crunchyroll episode — you're on your own. You're left remembering timestamps in your head, or worse, scrubbing through videos trying to find where you were.
        </p>
        <p class="reveal-up text-xl font-bold bg-[#111] p-6 neo-border neo-shadow transition-all text-white border-white">
          I wanted one place. A single dashboard where every video I'd ever watched — regardless of platform — showed up with a timestamp and a direct link back. Click it, and you're right where you left off.
        </p>
        <p class="reveal-up text-lg text-gray-400 mt-6 italic">That was the whole idea. It sounds simple. It wasn't.</p>
      </section>

      <!-- Section 2 / Architecture Visual -->
      <section id="s02" class="section-block isolate" data-index="1">
        <h2 class="glitch reveal-left text-4xl font-black uppercase tracking-tighter border-b-4 border-white pb-4 mb-8 flex items-center gap-4" data-text="02. Figuring Out The Architecture">
          <span class="material-symbols-outlined text-[#e51152] text-4xl">architecture</span> 02. Figuring Out The Architecture
        </h2>
        <p class="reveal-up text-lg text-gray-300 mb-12">
          The first real question was: how do you even capture a timestamp from a website you don't own? You can't just ask Netflix to give you that data. So the answer was a browser extension — a piece of code that runs inside the browser itself, with access to the page's DOM and all the media elements on it.
        </p>
        
        <div class="reveal-up w-full bg-[#111] p-8 md:p-12 neo-border neo-shadow-graph transition-all mb-8">
          <h3 class="text-2xl font-black uppercase text-[#f7e600] mb-12">Architecture Flow <span class="bg-[#e51152] text-white px-2 py-1 text-sm float-right hidden sm:block">DIAG_v1.0</span></h3>
          <div class="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0 text-center font-black relative">
            <div class="border-4 border-white p-6 bg-black w-full md:w-1/3 text-white z-10 relative">
              Extension<br><span class="text-xs text-gray-400 font-mono block mt-2">DATA_EXTRACTOR</span>
            </div>
            
            <!-- Animated SVG Arrow -->
            <div class="hidden md:flex flex-1 items-center justify-center -mx-4 z-0">
               <svg class="svg-flow-line" width="100%" height="24" preserveAspectRatio="none">
                 <line x1="0" y1="12" x2="100%" y2="12" stroke="#f7e600" stroke-width="3" />
                 <polygon points="100%,12 90%,6 90%,18" fill="#f7e600" />
               </svg>
            </div>
            <span class="material-symbols-outlined text-4xl text-[#f7e600] md:hidden rotate-90 my-2">arrow_forward</span>
            
            <div class="border-4 border-[#e51152] p-6 bg-[#e51152] w-full md:w-1/3 text-white z-10 relative">
              Pipeline<br><span class="text-xs text-[#ffb3c6] font-mono block mt-2">FIREBASE_SYNC</span>
            </div>
            
            <!-- Animated SVG Arrow -->
            <div class="hidden md:flex flex-1 items-center justify-center -mx-4 z-0">
               <svg class="svg-flow-line" width="100%" height="24" preserveAspectRatio="none">
                 <line x1="0" y1="12" x2="100%" y2="12" stroke="#f7e600" stroke-width="3" />
                 <polygon points="100%,12 90%,6 90%,18" fill="#f7e600" />
               </svg>
            </div>
            <span class="material-symbols-outlined text-4xl text-[#f7e600] md:hidden rotate-90 my-2">arrow_forward</span>
            
            <div class="border-4 border-white p-6 bg-black w-full md:w-1/3 text-white z-10 relative">
              Dashboard<br><span class="text-xs text-gray-400 font-mono block mt-2">UI_CLIENT</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3 -->
      <section id="s03" class="section-block isolate" data-index="2">
        <h2 class="glitch reveal-left text-4xl font-black uppercase tracking-tighter border-b-4 border-white pb-4 mb-8 flex items-center gap-4" data-text="03. Building The Extension">
          <span class="material-symbols-outlined text-[#e51152] text-4xl">code_blocks</span> 03. Building The Extension
        </h2>
        
        <h3 class="reveal-up text-2xl font-black uppercase mt-12 mb-4 text-[#f7e600]">The SPA Problem</h3>
        <p class="reveal-up text-lg text-gray-300 mb-6">
          The first wall I hit was the nature of modern streaming sites. Netflix and YouTube are Single Page Applications — they don't reload the page when you navigate between videos. They tear down the DOM and rebuild it dynamically. That means the classic <code class="bg-[#333] px-2 py-0.5 text-sm text-white">window.onload</code> listener you'd use to detect a new page? Completely useless here.
        </p>
        <p class="reveal-up text-lg text-gray-300 mb-6">
          The solution was the <span class="marker-box tracking-widest">MutationObserver API</span>. Instead of waiting for a page load, it binds directly to the root of the document and watches for any structural changes in the DOM tree — in real time. The moment a video element appears or gets swapped out, the extension knows about it.
        </p>

        <h3 class="reveal-up text-2xl font-black uppercase mt-12 mb-4 text-[#f7e600]">Catching Every Exit</h3>
        <div class="reveal-up bg-[#1a1a1a] p-8 border-l-8 border-[#e51152]">
          <p class="text-xl font-black uppercase text-white mb-4">Two class-A redundancies built for tab-closures:</p>
          <ul class="list-none space-y-4 text-gray-300 text-lg">
            <li class="flex items-start gap-4"><span class="material-symbols-outlined text-[#f7e600] mt-1 text-3xl">sync</span> <span>A <strong>periodic sync loop</strong> that fires every 30 seconds while a video is playing.</span></li>
            <li class="flex items-start gap-4"><span class="material-symbols-outlined text-[#f7e600] mt-1 text-3xl">webhook</span> <span>A <strong>beforeunload hook</strong> — a final save triggered milliseconds before the browser destroys the tab.</span></li>
          </ul>
        </div>
      </section>

      <!-- Section 4 -->
      <section id="s04" class="section-block isolate" data-index="3">
        <div class="reveal-up bg-[#e51152] text-white p-8 md:p-12 neo-border neo-shadow relative mt-20 isolate">
          <div class="absolute top-0 right-0 bg-black text-[#f7e600] px-4 py-2 font-black text-sm border-b-4 border-l-4 border-white hidden md:block">HIGH CLEARANCE AREA</div>
          <h2 class="glitch text-4xl font-black uppercase tracking-tighter mb-8 flex items-center gap-4" data-text="04. Neural Sync">
            <span class="material-symbols-outlined text-white text-4xl">vpn_key</span> 04. Neural Sync
          </h2>
          <p class="text-xl font-bold mb-6 text-white/90">
            Browser extensions are sandboxed. They have no access to your session cookies or HttpOnly tokens from the website. Asking users to log in separately inside the popup creates friction and runs into CORS issues with OAuth flows.
          </p>
          <ol class="seq-list list-decimal pl-6 space-y-4 text-lg font-medium text-white/80 mt-8">
            <li style="transition-delay: 200ms;">Log into the web dashboard normally via Firebase Auth.</li>
            <li style="transition-delay: 400ms;">Dashboard mounts a hidden div on the page with your embedded token.</li>
            <li style="transition-delay: 600ms;">Extension polls the DOM every 2 seconds looking for it.</li>
            <li style="transition-delay: 800ms;">Extension retrieves the token, terminates polling, and secures the background worker.</li>
          </ol>
          <div class="mt-12 bg-black text-white p-6 font-black text-2xl tracking-tighter uppercase text-center border-4 border-white shadow-[8px_8px_0px_0px_white]">
            Zero logins. Zero popups. Completely frictionless.
          </div>
        </div>
      </section>

      <!-- Section 5 -->
      <section id="s05" class="section-block isolate" data-index="4">
        <h2 class="glitch reveal-left text-4xl font-black uppercase tracking-tighter border-b-4 border-white pb-4 mb-8 flex items-center gap-4" data-text="05. The Dual Bucket System">
          <span class="material-symbols-outlined text-[#e51152] text-4xl">hub</span> 05. The Dual Bucket System
        </h2>
        <p class="reveal-up text-lg text-gray-300 mb-6 font-medium">
          The extension capturing data and the dashboard displaying it are two completely separate systems. If the extension tries to write directly to a secure Firestore database from an unstable environment, you get dropped data and auth failures.
        </p>
        <p class="reveal-up text-lg text-gray-300 mb-10 font-medium border-l-4 border-[#333] pl-6 py-2">
          Instead, it fires payloads into a temporary, loosely permissioned buffer bucket. Think of it as a dropbox. When you open the web dashboard — where you're fully authenticated — it listens to that buffer, cleans the record, moves it to permanent history, and deletes the original.
        </p>
        <p class="reveal-up text-3xl font-black uppercase text-[#e51152] bg-[#111] p-6 text-center border-2 border-[#e51152]">The extension is the messenger. The dashboard is the gatekeeper.</p>
      </section>

      <!-- Section 6: BUGS -->
      <section id="s06" class="section-block isolate" data-index="5">
        <h2 class="glitch reveal-left text-4xl md:text-5xl font-black uppercase tracking-tighter border-b-4 border-white pb-4 mb-16 flex items-center gap-4 text-[#f7e600]" data-text="06. The Bugs That Nearly Broke Everything">
          <span class="material-symbols-outlined text-5xl">bug_report</span> 06. The Bugs That Nearly Broke Everything
        </h2>
        
        <div class="grid grid-cols-1 gap-16">
          
          <!-- BUG CARD 1 -->
          <div class="reveal-up bug-card stagger-0 border-4 border-white bg-black p-8 relative overflow-hidden isolate">
            <div class="scanline-overlay"></div>
            <div class="absolute -top-5 -left-1 z-20 bg-[#e51152] text-white px-4 py-2 font-black uppercase text-sm border-4 border-white flex items-center gap-2 tracking-widest">
              <span class="material-symbols-outlined text-lg">warning</span> BUG REPORT #1
            </div>
            <h3 class="text-3xl font-black uppercase text-white mt-4 mb-4 tracking-tighter relative z-20">The Ghost Deletion</h3>
            <p class="text-lg text-gray-400 mb-8 max-w-2xl relative z-20">
              Deleted items came back on page refresh. The root cause was a JavaScript object spread ordering issue. The payload spread was silently overwriting the true Firestore string document ID with an internal numeric timestamp ID.
            </p>
            <div class="code-bad relative z-20">
              <span class="text-xs font-black uppercase tracking-widest text-[#e51152] block mb-2 opacity-50">// THE INFECTION</span>
              const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            </div>
            <div class="code-good relative z-20">
              <span class="text-xs font-black uppercase tracking-widest text-[#00f763] block mb-2 opacity-50">// THE ANTIDOTE</span>
              const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            </div>
          </div>

          <!-- BUG CARD 2 -->
          <div class="reveal-up bug-card stagger-1 border-4 border-white bg-black p-8 relative overflow-hidden isolate">
            <div class="scanline-overlay"></div>
            <div class="absolute -top-5 -left-1 z-20 bg-[#f7e600] text-black px-4 py-2 font-black uppercase text-sm border-4 border-white flex items-center gap-2 tracking-widest">
              <span class="material-symbols-outlined text-lg opacity-80">warning</span> BUG REPORT #2
            </div>
            <h3 class="text-3xl font-black uppercase text-white mt-4 mb-4 tracking-tighter relative z-20">The Firefox Blackout</h3>
            <p class="text-lg text-gray-400 mb-6 max-w-2xl relative z-20">
              Firefox Manifest V2 strictly enforces CSP. Firebase relies on WebSockets, but Firefox silently blocked everything. We injected a strict <code class="bg-[#333] px-2 text-white">connect-src</code> whitelist in the manifest to tear down the firewall.
            </p>
          </div>

          <!-- BUG CARD 3 -->
          <div class="reveal-up bug-card stagger-2 border-4 border-white bg-black p-8 relative overflow-hidden isolate">
             <div class="scanline-overlay"></div>
            <div class="absolute -top-5 -left-1 z-20 bg-[#555] text-white px-4 py-2 font-black uppercase text-sm border-4 border-white flex items-center gap-2 tracking-widest">
              <span class="material-symbols-outlined text-lg text-[#f7e600]">warning</span> BUG REPORT #3
            </div>
            <h3 class="text-3xl font-black uppercase text-white mt-4 mb-4 tracking-tighter relative z-20">Top-Rank Refusal</h3>
            <p class="text-lg text-gray-400 mb-6 max-w-2xl relative z-20">
               Firestore's descending sort puts strings above numbers. Because manual entries were ISO strings and automated traces were Epoch integers, "Modern Family" (manual) was mathematically forced above thousands of newer traces forever.
            </p>
            <div class="bg-[#1a1a1a] p-4 font-mono text-[#f7e600] border-2 border-[#333] relative z-20">
              > System wide standardization implemented: Date.now() strictly enforced.
            </div>
          </div>
        </div>
      </section>

      <!-- Section 7 -->
      <section id="s07" class="section-block isolate" data-index="6">
        <div class="flex flex-col lg:flex-row gap-12">
          <div class="reveal-up flex-1">
            <h2 class="glitch text-3xl font-black uppercase tracking-tighter border-b-4 border-white pb-4 mb-6 text-white flex items-center gap-3" data-text="07. The Dashboard">
              <span class="material-symbols-outlined text-[#e51152] text-4xl">dashboard</span> 07. The Dashboard
            </h2>
            <p class="text-gray-300 text-lg leading-relaxed font-medium">
              Built with React, Vite, and Framer Motion. The design language is strictly Neo-Brutalism: hard borders, heavy shadows, stark contrast, and spring-physics animations that give the interface real physical weight. It is not a sterile SaaS tool. It has personality.
            </p>
          </div>
          <div class="reveal-up flex-1 stagger-1">
            <h2 class="glitch text-3xl font-black uppercase tracking-tighter border-b-4 border-[#e51152] pb-4 mb-6 text-[#e51152] flex items-center gap-3" data-text="08. Manifest Split">
              <span class="material-symbols-outlined text-white text-4xl">extension</span> 08. Manifest Split
            </h2>
            <p class="text-gray-300 text-lg leading-relaxed font-medium">
              Chrome (Manifest V3) and Firefox (Manifest V2) utilize entirely different security models. Maintaining two manifest files with shared core logic was non-negotiable. Both are bound natively through build scripts to handle structural deployment variances.
            </p>
          </div>
        </div>
      </section>

      <!-- Section Outro -->
      <section id="s08" class="section-block isolate" data-index="7">
        <div class="reveal-up text-center bg-white text-black p-12 neo-border neo-shadow">
          <h2 class="glitch text-5xl md:text-6xl font-black uppercase tracking-tighter mb-6" data-text="What's Next.">What's Next.</h2>
          <p class="text-xl font-bold max-w-2xl mx-auto mb-10 text-gray-800">
            Client-side filtering, domain blacklists, CSV/JSON offline backups, and predictive pre-fetching built on view habits.
          </p>
        </div>
      </section>
      
    </div>

  </main>

  <!-- The Final Poster Statement -->
  <div id="poster-sec" class="w-full bg-[#e51152] py-24 flex items-center justify-center mt-32 border-t-8 border-b-8 border-white min-h-[500px]">
    <h1 id="typewriter-h1" class="text-5xl md:text-[7rem] font-black uppercase tracking-tighter text-center leading-none px-6 drop-shadow-[0_10px_0_rgba(0,0,0,1)]">
        <span id="line1" class="text-white"></span><br>
        <span id="line2" class="text-[#f7e600]"></span>
        <span id="cursor-blink" class="opacity-0 transition-opacity duration-200">█</span>
    </h1>
  </div>

  <script>
    document.addEventListener("DOMContentLoaded", () => {
      
      // 1. Custom Cursor Functionality
      if(window.innerWidth > 1024) {
        const cTri = document.getElementById('cursor-triangle');
        const cRing = document.getElementById('cursor-ring');
        let mouseX = window.innerWidth/2;
        let mouseY = window.innerHeight/2;
        let ringX = mouseX;
        let ringY = mouseY;
        
        window.addEventListener('mousemove', (e) => {
          mouseX = e.clientX;
          mouseY = e.clientY;
          cTri.style.left = `${mouseX}px`;
          cTri.style.top = `${mouseY}px`;
        });
        
        const loop = () => {
          ringX += (mouseX - ringX) * 0.15;
          ringY += (mouseY - ringY) * 0.15;
          cRing.style.left = `${ringX}px`;
          cRing.style.top = `${ringY}px`;
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
        
        const clickables = document.querySelectorAll('a, button, .progress-dot');
        clickables.forEach(c => {
          c.addEventListener('mouseenter', () => cRing.classList.add('hover'));
          c.addEventListener('mouseleave', () => cRing.classList.remove('hover'));
        });
      }

      // Intersection Observer setups
      const defaultOptions = { rootMargin: "0px 0px -10% 0px", threshold: 0.1 };

      // 3 & 5. Staggered Reveals & Neural Sync
      const reveals = document.querySelectorAll(".reveal-up, .reveal-left");
      const revealObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-active");
            obs.unobserve(entry.target);
          }
        });
      }, defaultOptions);
      reveals.forEach(r => revealObserver.observe(r));

      // 8. Glitch Headings
      const glitchObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target;
            el.classList.add("glitch-anim");
            setTimeout(() => el.classList.remove("glitch-anim"), 300);
            obs.unobserve(el);
          }
        });
      }, defaultOptions);
      document.querySelectorAll(".glitch").forEach(g => glitchObserver.observe(g));

      // 2. Stat Counters
      const counters = document.querySelectorAll('.stat-counter');
      const countObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if(entry.isIntersecting) {
            const el = entry.target;
            const target = +el.getAttribute('data-target');
            const suffix = el.getAttribute('data-suffix') || "";
            const duration = 1200;
            let startTs = null;
            
            const easeOutQuart = t => 1 - (--t)*t*t*t;
            
            const step = (ts) => {
              if(!startTs) startTs = ts;
              const progress = Math.min((ts - startTs) / duration, 1);
              const val = Math.floor(easeOutQuart(progress) * target);
              el.textContent = val + (progress === 1 ? suffix : '');
              if(progress < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
            obs.unobserve(el);
          }
        })
      });
      counters.forEach(c => countObserver.observe(c));

      // 9. Typewriter Poster Line
      const posterSec = document.getElementById('poster-sec');
      const line1 = document.getElementById('line1');
      const line2 = document.getElementById('line2');
      const cursorBlink = document.getElementById('cursor-blink');
      
      const txt1 = "BUILT BY HAND.";
      const txt2 = "FIXED BY STUBBORNNESS.";
      
      const typeWriter = (text, elem, cb) => {
        let i = 0;
        const intr = setInterval(() => {
          elem.textContent += text.charAt(i);
          i++;
          if(i >= text.length) {
            clearInterval(intr);
            if(cb) cb();
          }
        }, 40);
      }

      const typeObserver = new IntersectionObserver((entries, obs) => {
        if(entries[0].isIntersecting) {
          cursorBlink.style.opacity = 1;
          typeWriter(txt1, line1, () => {
             typeWriter(txt2, line2, () => {
                // blink forever
                setInterval(() => {
                  cursorBlink.style.opacity = cursorBlink.style.opacity == 1 ? 0 : 1;
                }, 500);
             });
          });
          obs.unobserve(posterSec);
        }
      }, { threshold: 0.5 });
      typeObserver.observe(posterSec);

      // 7. Scroll Progress Fill & Dots
      const sections = document.querySelectorAll(".section-block");
      const navDots = document.querySelectorAll(".progress-dot");
      const fillBar = document.getElementById("progressFill");
      
      window.addEventListener("scroll", () => {
        let current = "";
        sections.forEach(sec => {
          const sectionTop = sec.offsetTop;
          if (pageYOffset >= (sectionTop - 300)) current = sec.getAttribute("id");
        });
        navDots.forEach(dot => {
          dot.classList.remove("active");
          if (dot.getAttribute("href") === "#" + current) dot.classList.add("active");
        });

        if(window.innerWidth > 1024 && fillBar) {
          const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
          const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
          const scrolled = (winScroll / height) * 100;
          fillBar.style.height = scrolled + "%";
        }
      });

      // 10. Smooth Anchor Scroll
      document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
          e.preventDefault();
          const targetId = this.getAttribute('href');
          const targetNode = document.querySelector(targetId);
          if(targetNode) {
            const topOffset = targetNode.getBoundingClientRect().top + window.scrollY - 100;
            window.scrollTo({ top: topOffset, behavior: "smooth" });
          }
        });
      });

    });
  </script>
</body>
</html>
"""

with open("landing-page/public/about.html", "w", encoding="utf-8") as f:
    f.write(new_html)
