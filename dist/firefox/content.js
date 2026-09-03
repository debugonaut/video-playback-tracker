(()=>{var H=(N,b)=>()=>(b||N((b={exports:{}}).exports,b),b.exports);var W=H(()=>{(function(){"use strict";console.log("%c[Rewind v2.2] \u{1F680} Content Script Active on "+window.location.href,"background: #00ff66; color: #000; font-weight: bold; padding: 2px 8px; border-radius: 4px;");let v=[],c={autoSeek:!1,trackShorts:!0,showInPagePrompt:!0},P=window.location.href;try{chrome.storage.local.get({history:[],autoSeek:!1,trackShorts:!0,showInPagePrompt:!0},e=>{v=e.history||[],c.autoSeek=!!e.autoSeek,c.trackShorts=e.trackShorts!==!1,c.showInPagePrompt=e.showInPagePrompt!==!1,console.log("[Rewind v2.2] \u{1F4E6} Storage loaded. Stored videos count:",v.length),$()})}catch(e){console.error("[Rewind v2.2] Storage initialization error:",e)}chrome.storage.onChanged.addListener((e,t)=>{t==="local"&&(e.history&&(v=e.history.newValue||[]),e.autoSeek!==void 0&&(c.autoSeek=!!e.autoSeek.newValue),e.trackShorts!==void 0&&(c.trackShorts=!!e.trackShorts.newValue),e.showInPagePrompt!==void 0&&(c.showInPagePrompt=!!e.showInPagePrompt.newValue))});function u(e){try{if(window.location.hostname.includes("youtube.com")){let n=e?e.closest(".html5-video-player, #movie_player"):document.querySelector(".html5-video-player, #movie_player");return!!(n&&(n.classList.contains("ad-showing")||n.classList.contains("ad-interrupting")))}if(e&&e.closest(".ad-showing, .vjs-ad-playing, .ima-ad-container, .jw-flag-ads"))return!0}catch{}return!1}function k(e){try{let t=window.location.hostname,n=window.location.pathname;if(t.includes("youtube.com")&&(e.closest("ytd-video-preview, ytd-inline-preview-player, ytd-thumbnail-overlay-inline-playback-renderer, #inline-preview-player, ytd-miniplayer")||["/","/home","/feed","/explore","/trending","/subscriptions"].includes(n)&&!e.closest("ytd-watch-flexy, #movie_player"))||(t.includes("twitter.com")||t.includes("x.com"))&&!n.includes("/status/")&&e.paused)return!0}catch{}return!1}function p(e){if(!e)return!1;let t=e.clientWidth||e.videoWidth||0,n=e.clientHeight||e.videoHeight||0;return!(t>0&&t<60&&n>0&&n<60)}function C(e){for(let t of e){let n=document.querySelector(t),r=n&&(n.getAttribute("content")||n.content);if(r&&r.trim())return r.trim()}return null}function M(){if(window.location.hostname.includes("youtube.com")){let t=document.querySelector("#container > h1 > yt-formatted-string")||document.querySelector("h1.title.style-scope.ytd-video-primary-info-renderer")||document.querySelector("ytd-watch-metadata #title h1");if(t&&t.textContent.trim())return t.textContent.trim()}if(window.location.hostname.includes("twitch.tv")){let t=document.querySelector('[data-a-target="stream-title"]');if(t&&t.textContent.trim())return t.textContent.trim();if(document.title&&document.title.trim()!=="Twitch")return document.title.trim().replace(/\s*[-–—]\s*Twitch$/i,"").trim()}let e=C(['meta[property="og:title"]','meta[name="twitter:title"]']);return e&&!e.toLowerCase().includes("twitch")?e:document.title&&document.title.trim()?document.title.trim().replace(/\s*[\|\-–—]\s*(YouTube|Amazon|Prime Video|Hotstar|Disney\+?|Hulu|HBO|Crunchyroll|Twitch|Funimation|Aniwatch|Anikai).*$/i,"").trim()||document.title.trim():window.location.hostname.replace(/^www\./,"")}function L(e){let t=e||window.location.href;if(t.includes("youtube.com")||t.includes("youtu.be")){let r=A(t);if(r)return`https://img.youtube.com/vi/${r}/mqdefault.jpg`}let n=C(['meta[property="og:image"]','meta[name="twitter:image"]','meta[name="twitter:image:src"]']);if(!n)return null;try{return new URL(n,window.location.href).href}catch{return null}}function R(e){if(isNaN(e)||e<0)return"0:00";let t=Math.floor(e/3600),n=Math.floor(e%3600/60),r=Math.floor(e%60);return t>0?`${t}:${String(n).padStart(2,"0")}:${String(r).padStart(2,"0")}`:`${n}:${String(r).padStart(2,"0")}`}function A(e){if(!e)return null;try{let t=new URL(e,window.location.href);if(t.hostname.includes("youtube.com")){if(t.pathname.startsWith("/watch"))return t.searchParams.get("v");if(t.pathname.startsWith("/shorts/")||t.pathname.startsWith("/embed/"))return t.pathname.split("/")[2]}if(t.hostname.includes("youtu.be"))return t.pathname.substring(1).split("/")[0]}catch{}return null}function x(e){try{let t=window.location.hostname,n=window.location.pathname;if(t.includes("youtube.com")){let o=A(window.location.href);if(o)return`https://www.youtube.com/watch?v=${o}`}if(window!==window.top&&document.referrer&&document.referrer.startsWith("http"))try{let o=new URL(document.referrer);if(!o.hostname.includes("doubleclick")&&!o.hostname.includes("googleads"))return o.href.split("#")[0]}catch{}if(t.includes("twitter.com")||t.includes("x.com")){if(n.includes("/status/"))return window.location.href.split("?")[0];let o=e&&e.closest("article");if(o){let i=Array.from(o.querySelectorAll("a")).find(l=>l.href.includes("/status/"));if(i)return i.href.split("?")[0]}}let r=new URL(window.location.href);return r.hash="",r.searchParams.delete("rewind-resume"),r.href}catch{return window.location.href}}function _(e,t){if(!e||!t)return!1;if(e===t)return!0;try{let n=A(e),r=A(t);if(n&&r)return n===r;let o=new URL(e),i=new URL(t),l=a=>a.replace("twitter.com","x.com").replace(/^www\./,"");return l(o.hostname)!==l(i.hostname)?!1:o.pathname===i.pathname&&o.pathname.length>1}catch{return!1}}function h(e,t=!1){if(!e){console.warn("[Rewind v2.2] \u26A0\uFE0F Save aborted: No video element provided");return}if(!p(e)){console.warn("[Rewind v2.2] \u26A0\uFE0F Save aborted: Video element is not primary (dimensions < 60px)");return}if(k(e)){console.warn("[Rewind v2.2] \u26A0\uFE0F Save aborted: Video identified as feed/hover preview");return}if(u(e)){console.warn("[Rewind v2.2] \u26A0\uFE0F Save aborted: Commercial/Ad is active");return}let n=Math.floor(e.currentTime||0),r=e.duration&&isFinite(e.duration)?Math.floor(e.duration):null;if(!c.trackShorts&&r&&r<5){console.warn(`[Rewind v2.2] \u26A0\uFE0F Save aborted: duration ${r}s < 5s and trackShorts is disabled`);return}if(n<1&&!t){console.warn(`[Rewind v2.2] \u26A0\uFE0F Save aborted: playhead at start (${n}s < 1s)`);return}r>86400&&(r=null);let o=r===null,i=t?100:r?Math.min(100,Math.round(n/r*100)):null,l=x(e);P=l;let a={id:Date.now(),title:M(),url:l,timestamp:t&&r?r:n,formattedTime:R(n),duration:r,progress:i,isLive:o,completed:!!t,thumbnail:L(l),favicon:`https://www.google.com/s2/favicons?sz=32&domain=${new URL(l).hostname}`,savedAt:Date.now(),pinned:!1,note:""};console.log("[Rewind v2.2] \u{1F4BE} Saving playback:",a.title,`${a.timestamp}s`,a.url);try{chrome.storage.local.get({history:[]},g=>{let s=g.history||[],y=s.find(m=>_(m.url,l));y&&(a.pinned=y.pinned||!1,a.note=y.note||""),s=s.filter(m=>!_(m.url,l)),s.unshift(a),s.length>50&&(s=s.slice(0,50)),v=s,chrome.storage.local.set({history:s,lastEntry:a},()=>{console.log("[Rewind v2.2] \u2705 Saved to storage! Count:",s.length)});try{chrome.runtime.sendMessage({type:"FORCE_SYNC",entry:a}).catch(()=>{})}catch{}})}catch(g){console.error("[Rewind v2.2] Storage error:",g)}}function d(e,t,n=!0){if(!e)return;if(console.log(`[Rewind] Performing seek to ${t}s (autoPlay: ${n})`),u(e)){console.log("[Rewind] Ad is active \u2014 deferring seek until ad ends...");let i=setInterval(()=>{u(e)||(clearInterval(i),d(e,t,n))},500);setTimeout(()=>clearInterval(i),45e3);return}let r=()=>{e.currentTime=t,n&&e.paused&&e.play().catch(()=>{})};e.readyState>=1?r():e.addEventListener("loadedmetadata",r,{once:!0});let o=()=>{Math.abs(e.currentTime-t)<=2&&(console.log("[Rewind] \u2705 Seek successfully verified at",e.currentTime),e.removeEventListener("seeked",o))};e.addEventListener("seeked",o),setTimeout(()=>e.removeEventListener("seeked",o),8e3)}function $(){try{let e=window.location.hash;if(e&&e.includes("rewind-resume=")){let t=e.match(/rewind-resume=([0-9]+)/);if(t&&t[1]){let n=parseInt(t[1],10);!isNaN(n)&&n>0&&O(r=>{d(r,n,!0),history.replaceState(null,"",window.location.pathname+window.location.search)})}}}catch{}}function O(e,t=20){let n=0,r=setInterval(()=>{n++;let o=Array.from(document.querySelectorAll("video")).filter(p);o.length>0?(clearInterval(r),e(o[0])):n>=t&&clearInterval(r)},400)}let w=null;function I(){w&&w.parentNode&&w.parentNode.removeChild(w),w=null}function D(e,t){if(!e||!t||t.timestamp<2||c.showInPagePrompt===!1||e.currentTime>=t.timestamp-2)return;I();let n=document.createElement("div");n.id="rewind-in-page-prompt",n.style.position="fixed",n.style.bottom="24px",n.style.right="24px",n.style.zIndex="2147483647",n.style.transition="all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",n.style.transform="translateY(30px)",n.style.opacity="0";let r=n.attachShadow({mode:"open"}),o=t.thumbnail||L(t.url)||"https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&auto=format&fit=crop",i=t.duration?` / ${R(t.duration)}`:"",l=`${R(t.timestamp)}${i}`,a=(t.title||"Current Video").replace(/"/g,"&quot;");r.innerHTML=`
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
            <img class="thumb-img" src="${o}" alt="" />
            <span class="badge-169">16:9</span>
          </div>
          <div class="info-col">
            <div class="video-title" title="${a}">${a}</div>
            <div class="saved-label">SAVED:</div>
            <div class="saved-time">${l}</div>
            <button class="btn-resume" id="resumeBtn">RESUME AT ${R(t.timestamp)}</button>
            <button class="btn-startover" id="startOverBtn">START OVER</button>
          </div>
        </div>
        <div class="timer-track">
          <div class="timer-fill" id="timerFill"></div>
        </div>
      </div>
    `,(document.fullscreenElement||document.body||document.documentElement).appendChild(n),w=n,requestAnimationFrame(()=>{n.style.transform="translateY(0)",n.style.opacity="1"});let s=r.getElementById("timerFill");requestAnimationFrame(()=>{s&&(s.style.transform="scaleX(0)")});let y=setTimeout(()=>{E()},8e3),m=r.getElementById("promptContainer");m.addEventListener("mouseenter",()=>{clearTimeout(y),s&&(s.style.transition="none")}),m.addEventListener("mouseleave",()=>{y=setTimeout(()=>E(),4e3),s&&(s.style.transition="transform 4s linear",s.style.transform="scaleX(0)")});function E(){n.style.transform="translateY(30px)",n.style.opacity="0",setTimeout(()=>I(),350)}r.getElementById("resumeBtn").addEventListener("click",T=>{T.stopPropagation();let z=r.getElementById("resumeBtn");z.textContent="RESUMING... \u2705",d(e,t.timestamp,!0),setTimeout(()=>E(),600)}),r.getElementById("startOverBtn").addEventListener("click",T=>{T.stopPropagation(),d(e,0,!0),t.timestamp=0,t.progress=0,t.completed=!1,chrome.storage.local.set({history:v}),E()}),r.getElementById("closeBtn").addEventListener("click",T=>{T.stopPropagation(),E()})}let U=new WeakSet;function q(e){if(!e||U.has(e))return;if(!p(e)){console.log("[Rewind v2.2] \u23ED Skipped video element: Dimensions < 60px");return}if(k(e)){console.log("[Rewind v2.2] \u23ED Skipped video element: Feed preview player");return}U.add(e),console.log("[Rewind v2.2] \u{1F3A5} Attached tracker to video element! Current time:",e.currentTime);let t=!1,n=null;function r(){if(e._rewindPrompted||e._rewindResumed||u(e)||k(e))return;let o=x(e);chrome.storage.local.get({history:[],showInPagePrompt:!0,autoSeek:!1},i=>{if(e._rewindPrompted||e._rewindResumed||i.showInPagePrompt===!1)return;let a=(i.history||[]).find(g=>_(g.url,o));if(!(!a||a.timestamp<2)&&!a.completed&&!(a.duration&&a.timestamp>=a.duration-15)&&!(e.currentTime>=a.timestamp-5)){if(i.autoSeek){e._rewindResumed=!0,d(e,a.timestamp,!0);return}e._rewindPrompted=!0,console.log("[Rewind v2.2] \u{1F3AF} Showing Google Flow Resume Card for:",a.title,"at",a.timestamp),D(e,a)}})}e.addEventListener("play",()=>{console.log("[Rewind v2.2] \u25B6 Video play event at",e.currentTime),!(u(e)||k(e))&&r()}),e.addEventListener("pause",()=>{console.log("[Rewind v2.2] \u23F8 Video pause event fired at",e.currentTime),!e.ended&&h(e)}),e.addEventListener("ended",()=>{console.log("[Rewind v2.2] \u23F9 Video ended event"),!u(e)&&h(e,!0)}),e.addEventListener("timeupdate",()=>{e.paused||e.ended||u(e)||n||(n=setTimeout(()=>{n=null,!e.paused&&!e.ended&&e.currentTime>1&&h(e)},15e3))}),e.addEventListener("loadedmetadata",r),e.addEventListener("canplay",r),setTimeout(r,400),setTimeout(r,1200),setTimeout(r,2500)}function f(){let e=document.querySelectorAll("video");e.length>0&&console.log(`[Rewind v2.2] \u{1F50D} Found ${e.length} <video> element(s) on page`),e.forEach(q)}function V(){I(),document.querySelectorAll("video").forEach(e=>{!e.paused&&e.currentTime>2&&h(e)})}function S(){P=x(),I(),document.querySelectorAll("video").forEach(e=>{e._rewindPrompted=!1,e._rewindResumed=!1}),f(),setTimeout(f,500),setTimeout(f,1500)}window.addEventListener("yt-navigate-start",V),window.addEventListener("yt-navigate-finish",S),window.addEventListener("yt-page-data-updated",S),window.addEventListener("popstate",S),window.addEventListener("hashchange",S);let B=history.pushState,F=history.replaceState;if(history.pushState=function(...e){V();let t=B.apply(this,e);return setTimeout(S,50),t},history.replaceState=function(...e){let t=F.apply(this,e);return setTimeout(()=>{P=x()},50),t},new MutationObserver(()=>{f()}).observe(document.documentElement,{childList:!0,subtree:!0}),window.addEventListener("beforeunload",()=>{document.querySelectorAll("video").forEach(e=>{e.currentTime>2&&h(e)})}),document.addEventListener("visibilitychange",()=>{document.visibilityState==="hidden"&&document.querySelectorAll("video").forEach(e=>{e.currentTime>2&&h(e)})}),f(),setTimeout(f,1e3),setTimeout(f,3e3),chrome.runtime.onMessage.addListener((e,t,n)=>{if(e.type==="GET_ACTIVE_VIDEO_INFO"){let r=Array.from(document.querySelectorAll("video")).filter(p),o=r.find(i=>!i.paused)||r[0];if(o){let i=x(o);n({hasVideo:!0,title:M(),url:i,currentTime:Math.floor(o.currentTime||0),duration:o.duration&&isFinite(o.duration)?Math.floor(o.duration):null,thumbnail:L(i),isLive:!o.duration||!isFinite(o.duration),isAd:u(o)})}else n({hasVideo:!1,url:window.location.href});return!0}if(e.type==="SEEK_CURRENT_VIDEO"&&typeof e.timestamp=="number"){let r=Array.from(document.querySelectorAll("video")).filter(p),o=r.find(i=>!i.paused)||r[0];return o?(d(o,e.timestamp,!0),n({success:!0})):n({success:!1,error:"NO_VIDEO_FOUND"}),!0}if(e.type==="RESET_CURRENT_VIDEO"){let r=Array.from(document.querySelectorAll("video")).filter(p),o=r.find(i=>!i.paused)||r[0];return o&&(d(o,0,!0),n({success:!0})),!0}}),window.location.hostname.includes("rewind-player.vercel.app")){let e=()=>{let t=document.getElementById("neural-sync-pulse");return t&&t.dataset.token?(chrome.runtime.sendMessage({type:"AUTH_TOKEN_UPDATE",token:t.dataset.token}).catch(()=>{}),!0):!1};if(!e()){let t=setInterval(()=>{e()&&clearInterval(t)},2e3);setTimeout(()=>clearInterval(t),1e4)}window.addEventListener("message",t=>{t.origin==="https://rewind-player.vercel.app"&&t.data?.type==="REWIND_AUTH_SUCCESS"&&t.data?.token&&chrome.runtime.sendMessage({type:"AUTH_TOKEN_UPDATE",token:t.data.token}).catch(()=>{})}),window.postMessage({type:"REWIND_EXTENSION_READY"},"*")}chrome.runtime.onMessage.addListener(e=>{e.type==="REWIND_PROXY_BROADCAST"&&e.entry&&window.location.hostname.includes("rewind-player.vercel.app")&&window.postMessage({type:"REWIND_PROXY_SYNC",entry:e.entry},"*")})})()});W();})();
//# sourceMappingURL=content.js.map
