(()=>{var K=(M,S)=>()=>(S||M((S={exports:{}}).exports,S),S.exports);var X=K(()=>{(function(){"use strict";console.log("%c[Rewind v2.2] \u{1F680} Content Script Active on "+window.location.href,"background: #00ff66; color: #000; font-weight: bold; padding: 2px 8px; border-radius: 4px;");let x=[],c={autoSeek:!1,trackShorts:!0,showInPagePrompt:!0},A=window.location.href;try{chrome.storage.local.get({history:[],autoSeek:!1,trackShorts:!0,showInPagePrompt:!0},e=>{x=e.history||[],c.autoSeek=!!e.autoSeek,c.trackShorts=e.trackShorts!==!1,c.showInPagePrompt=e.showInPagePrompt!==!1,console.log("[Rewind v2.2] \u{1F4E6} Storage loaded. Stored videos count:",x.length),B()})}catch(e){console.error("[Rewind v2.2] Storage initialization error:",e)}chrome.storage.onChanged.addListener((e,t)=>{t==="local"&&(e.history&&(x=e.history.newValue||[]),e.autoSeek!==void 0&&(c.autoSeek=!!e.autoSeek.newValue),e.trackShorts!==void 0&&(c.trackShorts=!!e.trackShorts.newValue),e.showInPagePrompt!==void 0&&(c.showInPagePrompt=!!e.showInPagePrompt.newValue))});function u(e){try{if(window.location.hostname.includes("youtube.com")){let r=e?e.closest(".html5-video-player, #movie_player"):document.querySelector(".html5-video-player, #movie_player");return!!(r&&(r.classList.contains("ad-showing")||r.classList.contains("ad-interrupting")))}if(e&&e.closest(".ad-showing, .vjs-ad-playing, .ima-ad-container, .jw-flag-ads"))return!0}catch{}return!1}function k(e){try{let t=window.location.hostname,r=window.location.pathname;if(t.includes("youtube.com")&&(e.closest("ytd-video-preview, ytd-inline-preview-player, ytd-thumbnail-overlay-inline-playback-renderer, #inline-preview-player, ytd-miniplayer")||["/","/home","/feed","/explore","/trending","/subscriptions"].includes(r)&&!e.closest("ytd-watch-flexy, #movie_player"))||(t.includes("twitter.com")||t.includes("x.com"))&&!r.includes("/status/")&&e.paused)return!0}catch{}return!1}function d(e=document){let t=[];try{if(!e)return t;e.querySelectorAll&&t.push(...Array.from(e.querySelectorAll("video")));let r=e.querySelectorAll?e.querySelectorAll("*"):[];for(let n=0;n<r.length;n++){let i=r[n];i.shadowRoot&&t.push(...d(i.shadowRoot))}}catch{}return t}function L(e){if(!e||e.srcObject||e.hasAttribute("loop")&&e.muted&&e.autoplay&&!e.controls&&(!e.duration||e.duration<20))return!1;let t=e.clientWidth||e.videoWidth||0,r=e.clientHeight||e.videoHeight||0;return!(t>0&&t<60&&r>0&&r<60)}function R(e=d().filter(L)){if(!e||e.length===0)return null;if(e.length===1)return e[0];let t=e.map(r=>{let n=0;!r.paused&&!r.ended&&(n+=100),!r.muted&&r.volume>0&&(n+=40),r.duration&&isFinite(r.duration)&&r.duration>30&&(n+=30);let i=r.clientWidth||r.videoWidth||0,o=r.clientHeight||r.videoHeight||0;return n+=Math.min(50,Math.floor(i*o/1e4)),r.controls&&(n+=20),{video:r,score:n}});return t.sort((r,n)=>n.score-r.score),t[0].video}function U(e){for(let t of e){let r=document.querySelector(t),n=r&&(r.getAttribute("content")||r.content);if(n&&n.trim())return n.trim()}return null}function V(){try{if(navigator.mediaSession&&navigator.mediaSession.metadata&&navigator.mediaSession.metadata.title){let t=navigator.mediaSession.metadata.title.trim();if(t&&!t.toLowerCase().includes("unknown"))return t}}catch{}if(window.location.hostname.includes("youtube.com")){let t=document.querySelector("#container > h1 > yt-formatted-string")||document.querySelector("h1.title.style-scope.ytd-video-primary-info-renderer")||document.querySelector("ytd-watch-metadata #title h1");if(t&&t.textContent.trim())return t.textContent.trim()}if(window.location.hostname.includes("twitch.tv")){let t=document.querySelector('[data-a-target="stream-title"]');if(t&&t.textContent.trim())return t.textContent.trim();if(document.title&&document.title.trim()!=="Twitch")return document.title.trim().replace(/\s*[-–—]\s*Twitch$/i,"").trim()}let e=U(['meta[property="og:title"]','meta[name="twitter:title"]']);return e&&!e.toLowerCase().includes("twitch")?e:document.title&&document.title.trim()?document.title.trim().replace(/\s*[\|\-–—]\s*(YouTube|Amazon|Prime Video|Hotstar|Disney\+?|Hulu|HBO|Crunchyroll|Twitch|Funimation|Aniwatch|Anikai).*$/i,"").trim()||document.title.trim():window.location.hostname.replace(/^www\./,"")}function C(e){try{if(navigator.mediaSession&&navigator.mediaSession.metadata&&navigator.mediaSession.metadata.artwork){let n=navigator.mediaSession.metadata.artwork;if(Array.isArray(n)&&n.length>0){let i=n[n.length-1];if(i&&i.src)return i.src}}}catch{}let t=e||window.location.href;if(t.includes("youtube.com")||t.includes("youtu.be")){let n=_(t);if(n)return`https://img.youtube.com/vi/${n}/mqdefault.jpg`}let r=U(['meta[property="og:image"]','meta[name="twitter:image"]','meta[name="twitter:image:src"]']);if(!r)return null;try{return new URL(r,window.location.href).href}catch{return null}}function I(e){if(isNaN(e)||e<0)return"0:00";let t=Math.floor(e/3600),r=Math.floor(e%3600/60),n=Math.floor(e%60);return t>0?`${t}:${String(r).padStart(2,"0")}:${String(n).padStart(2,"0")}`:`${r}:${String(n).padStart(2,"0")}`}function _(e){if(!e)return null;try{let t=new URL(e,window.location.href);if(t.hostname.includes("youtube.com")){if(t.pathname.startsWith("/watch"))return t.searchParams.get("v");if(t.pathname.startsWith("/shorts/")||t.pathname.startsWith("/embed/"))return t.pathname.split("/")[2]}if(t.hostname.includes("youtu.be"))return t.pathname.substring(1).split("/")[0]}catch{}return null}function E(e){try{let t=window.location.hostname,r=window.location.pathname;if(t.includes("youtube.com")){let o=_(window.location.href);if(o)return`https://www.youtube.com/watch?v=${o}`}if(window!==window.top&&document.referrer&&document.referrer.startsWith("http"))try{let o=new URL(document.referrer);if(!o.hostname.includes("doubleclick")&&!o.hostname.includes("googleads"))return o.href.split("#")[0]}catch{}if(t.includes("twitter.com")||t.includes("x.com")){if(r.includes("/status/"))return window.location.href.split("?")[0];let o=e&&e.closest("article");if(o){let l=Array.from(o.querySelectorAll("a")).find(a=>a.href.includes("/status/"));if(l)return l.href.split("?")[0]}}let n=new URL(window.location.href);return n.hash="",["rewind-resume","token","expires","auth","signature","sig","session_id","sessionId","sid","utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid"].forEach(o=>{n.searchParams.delete(o)}),t.includes("youtube.com")||n.searchParams.delete("t"),n.href}catch{return window.location.href}}function N(e,t){if(!e||!t)return!1;if(e===t)return!0;try{let r=_(e),n=_(t);if(r&&n)return r===n;let i=new URL(e),o=new URL(t),l=a=>a.replace("twitter.com","x.com").replace(/^www\./,"");return l(i.hostname)!==l(o.hostname)?!1:i.pathname===o.pathname&&i.pathname.length>1}catch{return!1}}function m(e,t=!1){if(!e){console.warn("[Rewind v2.2] \u26A0\uFE0F Save aborted: No video element provided");return}if(!L(e)){console.warn("[Rewind v2.2] \u26A0\uFE0F Save aborted: Video element is not primary (dimensions < 60px)");return}if(k(e)){console.warn("[Rewind v2.2] \u26A0\uFE0F Save aborted: Video identified as feed/hover preview");return}if(u(e)){console.warn("[Rewind v2.2] \u26A0\uFE0F Save aborted: Commercial/Ad is active");return}let r=Math.floor(e.currentTime||0),n=e.duration&&isFinite(e.duration)?Math.floor(e.duration):null;if(!c.trackShorts&&n&&n<5){console.warn(`[Rewind v2.2] \u26A0\uFE0F Save aborted: duration ${n}s < 5s and trackShorts is disabled`);return}if(r<1&&!t){console.warn(`[Rewind v2.2] \u26A0\uFE0F Save aborted: playhead at start (${r}s < 1s)`);return}n>86400&&(n=null);let i=n===null,o=t?100:n?Math.min(100,Math.round(r/n*100)):null,l=E(e);A=l;let a={id:Date.now(),title:V(),url:l,timestamp:t&&n?n:r,formattedTime:I(r),duration:n,progress:o,isLive:i,completed:!!t,thumbnail:C(l),favicon:`https://www.google.com/s2/favicons?sz=32&domain=${new URL(l).hostname}`,savedAt:Date.now(),pinned:!1,note:""};console.log("[Rewind v2.2] \u{1F4BE} Saving playback:",a.title,`${a.timestamp}s`,a.url);try{chrome.storage.local.get({history:[]},y=>{let s=y.history||[],b=s.find(h=>N(h.url,l));b&&(a.pinned=b.pinned||!1,a.note=b.note||""),s=s.filter(h=>!N(h.url,l)),s.unshift(a),s.length>50&&(s=s.slice(0,50)),x=s,chrome.storage.local.set({history:s,lastEntry:a},()=>{console.log("[Rewind v2.2] \u2705 Saved to storage! Count:",s.length)});try{chrome.runtime.sendMessage({type:"FORCE_SYNC",entry:a}).catch(()=>{})}catch{}})}catch(y){console.error("[Rewind v2.2] Storage error:",y)}}function f(e,t,r=!0){if(!e)return;if(console.log(`[Rewind] Performing seek to ${t}s (autoPlay: ${r})`),u(e)){console.log("[Rewind] Ad is active \u2014 deferring seek until ad ends...");let o=setInterval(()=>{u(e)||(clearInterval(o),f(e,t,r))},500);setTimeout(()=>clearInterval(o),45e3);return}let n=()=>{e.currentTime=t,r&&e.paused&&e.play().catch(()=>{})};e.readyState>=1?n():e.addEventListener("loadedmetadata",n,{once:!0});let i=()=>{Math.abs(e.currentTime-t)<=2&&(console.log("[Rewind] \u2705 Seek successfully verified at",e.currentTime),e.removeEventListener("seeked",i))};e.addEventListener("seeked",i),setTimeout(()=>e.removeEventListener("seeked",i),8e3)}function B(){try{let e=window.location.hash;if(e&&e.includes("rewind-resume=")){let t=e.match(/rewind-resume=([0-9]+)/);if(t&&t[1]){let r=parseInt(t[1],10);!isNaN(r)&&r>0&&F(n=>{f(n,r,!0),history.replaceState(null,"",window.location.pathname+window.location.search)})}}}catch{}}function F(e,t=20){let r=0,n=setInterval(()=>{r++;let i=R();i?(clearInterval(n),e(i)):r>=t&&clearInterval(n)},400)}let w=null;function P(){w&&w.parentNode&&w.parentNode.removeChild(w),w=null}function q(e,t){if(!e||!t||t.timestamp<2||c.showInPagePrompt===!1||e.currentTime>=t.timestamp-2)return;P();let r=document.createElement("div");r.id="rewind-in-page-prompt",r.style.position="fixed",r.style.bottom="24px",r.style.right="24px",r.style.zIndex="2147483647",r.style.transition="all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",r.style.transform="translateY(30px)",r.style.opacity="0";let n=r.attachShadow({mode:"open"}),i=t.thumbnail||C(t.url)||"https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&auto=format&fit=crop",o=t.duration?` / ${I(t.duration)}`:"",l=`${I(t.timestamp)}${o}`,a=(t.title||"Current Video").replace(/"/g,"&quot;");n.innerHTML=`
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .flow-container {
          background: #070c08;
          border: 2px solid #00ff66;
          border-radius: 12px;
          box-shadow: 0 12px 36px rgba(0, 255, 102, 0.3), 0 4px 16px rgba(0, 0, 0, 0.9);
          padding: 12px 14px;
          width: 350px;
          color: #ffffff;
          position: relative;
          user-select: none;
        }
        .header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .header-title-box {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #00ff66;
          box-shadow: 0 0 8px #00ff66;
          animation: pulse 2s infinite ease-in-out;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        .header-label {
          font-size: 13px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.02em;
        }
        .close-btn {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 1.5px solid #ffffff;
          background: transparent;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 11px;
          font-weight: bold;
          line-height: 1;
          transition: all 0.15s;
        }
        .close-btn:hover {
          background: #e51152;
          border-color: #e51152;
        }
        .body-row {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .thumb-box {
          width: 120px;
          aspect-ratio: 16 / 9;
          border-radius: 8px;
          overflow: hidden;
          position: relative;
          flex-shrink: 0;
          background: #111111;
          border: 1px solid #16241a;
        }
        .thumb-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .badge-169 {
          position: absolute;
          top: 4px;
          left: 4px;
          background: rgba(0,0,0,0.85);
          color: #ffffff;
          font-size: 8px;
          font-weight: 800;
          padding: 2px 4px;
          border-radius: 3px;
        }
        .info-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }
        .video-title {
          font-size: 11px;
          font-weight: 700;
          color: #e0e0e0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .saved-label {
          font-size: 9px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: 0.05em;
        }
        .saved-time {
          font-size: 16px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: -0.02em;
          margin-bottom: 4px;
        }
        .btn-resume {
          background: #00ff66;
          color: #000000;
          font-size: 11px;
          font-weight: 900;
          padding: 6px 10px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          transition: transform 0.1s, background 0.15s;
        }
        .btn-resume:hover {
          background: #33ff88;
          transform: translateY(-1px);
        }
        .btn-startover {
          background: #101014;
          color: #ffffff;
          border: 1.5px solid #ffffff;
          font-size: 10px;
          font-weight: 800;
          padding: 5px 10px;
          border-radius: 6px;
          cursor: pointer;
          text-align: center;
          text-transform: uppercase;
          transition: all 0.15s;
        }
        .btn-startover:hover {
          background: #202028;
          border-color: #e51152;
          color: #e51152;
        }
        .timer-track {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          background: rgba(255,255,255,0.1);
          width: 100%;
          border-radius: 0 0 12px 12px;
          overflow: hidden;
        }
        .timer-fill {
          height: 100%;
          background: #00ff66;
          width: 100%;
          transform-origin: left;
          transition: transform 8s linear;
        }
      </style>
      <div class="flow-container" id="promptContainer">
        <div class="header-row">
          <div class="header-title-box">
            <span class="pulse-dot"></span>
            <span class="header-label">Active Tab Card</span>
          </div>
          <button class="close-btn" id="closeBtn" title="Dismiss">\u2715</button>
        </div>
        <div class="body-row">
          <div class="thumb-box">
            <img class="thumb-img" src="${i}" alt="" />
            <span class="badge-169">16:9</span>
          </div>
          <div class="info-col">
            <div class="video-title" title="${a}">${a}</div>
            <div class="saved-label">SAVED:</div>
            <div class="saved-time">${l}</div>
            <button class="btn-resume" id="resumeBtn">RESUME AT ${I(t.timestamp)}</button>
            <button class="btn-startover" id="startOverBtn">START OVER</button>
          </div>
        </div>
        <div class="timer-track">
          <div class="timer-fill" id="timerFill"></div>
        </div>
      </div>
    `,(document.fullscreenElement||document.body||document.documentElement).appendChild(r),w=r,requestAnimationFrame(()=>{r.style.transform="translateY(0)",r.style.opacity="1"});let s=n.getElementById("timerFill");requestAnimationFrame(()=>{s&&(s.style.transform="scaleX(0)")});let b=setTimeout(()=>{T()},8e3),h=n.getElementById("promptContainer");h.addEventListener("mouseenter",()=>{clearTimeout(b),s&&(s.style.transition="none")}),h.addEventListener("mouseleave",()=>{b=setTimeout(()=>T(),4e3),s&&(s.style.transition="transform 4s linear",s.style.transform="scaleX(0)")});function T(){r.style.transform="translateY(30px)",r.style.opacity="0",setTimeout(()=>P(),350)}n.getElementById("resumeBtn").addEventListener("click",v=>{v.stopPropagation();let Y=n.getElementById("resumeBtn");Y.textContent="RESUMING... \u2705",f(e,t.timestamp,!0),setTimeout(()=>T(),600)}),n.getElementById("startOverBtn").addEventListener("click",v=>{v.stopPropagation(),f(e,0,!0),t.timestamp=0,t.progress=0,t.completed=!1,chrome.storage.local.set({history:x}),T()}),n.getElementById("closeBtn").addEventListener("click",v=>{v.stopPropagation(),T()})}let O=new WeakSet;function H(e){if(!e||O.has(e))return;if(!L(e)){console.log("[Rewind v2.2] \u23ED Skipped video element: Dimensions < 60px");return}if(k(e)){console.log("[Rewind v2.2] \u23ED Skipped video element: Feed preview player");return}O.add(e),console.log("[Rewind v2.2] \u{1F3A5} Attached tracker to video element! Current time:",e.currentTime);let t=!1,r=null;function n(){if(e._rewindPrompted||e._rewindResumed||u(e)||k(e))return;let i=E(e);chrome.storage.local.get({history:[],showInPagePrompt:!0,autoSeek:!1},o=>{if(e._rewindPrompted||e._rewindResumed||o.showInPagePrompt===!1)return;let a=(o.history||[]).find(y=>N(y.url,i));if(!(!a||a.timestamp<2)&&!a.completed&&!(a.duration&&a.timestamp>=a.duration-15)&&!(e.currentTime>=a.timestamp-5)){if(o.autoSeek){e._rewindResumed=!0,f(e,a.timestamp,!0);return}e._rewindPrompted=!0,console.log("[Rewind v2.2] \u{1F3AF} Showing Google Flow Resume Card for:",a.title,"at",a.timestamp),q(e,a)}})}e.addEventListener("play",()=>{console.log("[Rewind v2.2] \u25B6 Video play event at",e.currentTime),!(u(e)||k(e))&&n()}),e.addEventListener("pause",()=>{console.log("[Rewind v2.2] \u23F8 Video pause event fired at",e.currentTime),!e.ended&&m(e)}),e.addEventListener("ended",()=>{console.log("[Rewind v2.2] \u23F9 Video ended event"),!u(e)&&m(e,!0)}),e.addEventListener("timeupdate",()=>{e.paused||e.ended||u(e)||r||(r=setTimeout(()=>{r=null,!e.paused&&!e.ended&&e.currentTime>1&&m(e)},15e3))}),e.addEventListener("loadstart",()=>{let i=e.currentSrc||e.src||"";e._lastKnownSrc&&e._lastKnownSrc!==i&&(console.log("[Rewind v2.2] \u{1F504} Video source dynamically replaced on existing element:",i),!e.paused&&e.currentTime>2&&m(e),e._rewindPrompted=!1,e._rewindResumed=!1),e._lastKnownSrc=i,setTimeout(n,400)}),e.addEventListener("emptied",()=>{e._rewindPrompted=!1,e._rewindResumed=!1}),e.addEventListener("loadedmetadata",n),e.addEventListener("canplay",n),setTimeout(n,400),setTimeout(n,1200),setTimeout(n,2500)}function p(){let e=d();e.length>0&&console.log(`[Rewind v2.2] \u{1F50D} Found ${e.length} <video> element(s) (including Shadow DOM)`),e.forEach(H)}function $(){P(),d().forEach(e=>{!e.paused&&e.currentTime>2&&m(e)})}function g(){A=E(),P(),d().forEach(e=>{e._rewindPrompted=!1,e._rewindResumed=!1}),p(),setTimeout(p,500),setTimeout(p,1500)}window.addEventListener("yt-navigate-start",$),window.addEventListener("yt-navigate-finish",g),window.addEventListener("yt-page-data-updated",g),window.addEventListener("popstate",g),window.addEventListener("hashchange",g);let z=history.pushState,W=history.replaceState;history.pushState=function(...e){$();let t=z.apply(this,e);return setTimeout(g,50),t},history.replaceState=function(...e){let t=W.apply(this,e);return setTimeout(()=>{A=E()},50),t};let D=window.location.href;if(setInterval(()=>{window.location.href!==D&&(D=window.location.href,g())},1e3),new MutationObserver(()=>{p()}).observe(document.documentElement,{childList:!0,subtree:!0}),window.addEventListener("beforeunload",()=>{d().forEach(e=>{e.currentTime>2&&m(e)})}),document.addEventListener("visibilitychange",()=>{document.visibilityState==="hidden"&&d().forEach(e=>{e.currentTime>2&&m(e)})}),p(),setTimeout(p,1e3),setTimeout(p,3e3),chrome.runtime.onMessage.addListener((e,t,r)=>{if(e.type==="GET_ACTIVE_VIDEO_INFO"){let n=R();if(n){let i=E(n);r({hasVideo:!0,title:V(),url:i,currentTime:Math.floor(n.currentTime||0),duration:n.duration&&isFinite(n.duration)?Math.floor(n.duration):null,thumbnail:C(i),isLive:!n.duration||!isFinite(n.duration)||n.duration>86400,isAd:u(n)})}else r({hasVideo:!1,url:window.location.href});return!0}if(e.type==="SEEK_CURRENT_VIDEO"&&typeof e.timestamp=="number"){let n=R();return n?(f(n,e.timestamp,!0),r({success:!0})):r({success:!1,error:"NO_VIDEO_FOUND"}),!0}if(e.type==="RESET_CURRENT_VIDEO"){let n=R();return n&&(f(n,0,!0),r({success:!0})),!0}}),window.location.hostname.includes("rewind-player.vercel.app")){let e=()=>{let t=document.getElementById("neural-sync-pulse");return t&&t.dataset.token?(chrome.runtime.sendMessage({type:"AUTH_TOKEN_UPDATE",token:t.dataset.token}).catch(()=>{}),!0):!1};if(!e()){let t=setInterval(()=>{e()&&clearInterval(t)},2e3);setTimeout(()=>clearInterval(t),1e4)}window.addEventListener("message",t=>{t.origin==="https://rewind-player.vercel.app"&&t.data?.type==="REWIND_AUTH_SUCCESS"&&t.data?.token&&chrome.runtime.sendMessage({type:"AUTH_TOKEN_UPDATE",token:t.data.token}).catch(()=>{})}),window.postMessage({type:"REWIND_EXTENSION_READY"},"*")}chrome.runtime.onMessage.addListener(e=>{e.type==="REWIND_PROXY_BROADCAST"&&e.entry&&window.location.hostname.includes("rewind-player.vercel.app")&&window.postMessage({type:"REWIND_PROXY_SYNC",entry:e.entry},"*")})})()});X();})();
//# sourceMappingURL=content.js.map
