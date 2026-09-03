(()=>{var H=(M,b)=>()=>(b||M((b={exports:{}}).exports,b),b.exports);var Y=H(()=>{(function(){"use strict";let m=[],d={autoSeek:!1,trackShorts:!1,showInPagePrompt:!0},L=window.location.href,l=null;chrome.storage.local.get({history:[],autoSeek:!1,trackShorts:!1,showInPagePrompt:!0},t=>{m=t.history||[],d.autoSeek=!!t.autoSeek,d.trackShorts=!!t.trackShorts,d.showInPagePrompt=t.showInPagePrompt!==!1,O()}),chrome.storage.onChanged.addListener((t,e)=>{e==="local"&&(t.history&&(m=t.history.newValue||[]),t.autoSeek!==void 0&&(d.autoSeek=!!t.autoSeek.newValue),t.trackShorts!==void 0&&(d.trackShorts=!!t.trackShorts.newValue),t.showInPagePrompt!==void 0&&(d.showInPagePrompt=!!t.showInPagePrompt.newValue))});function p(t){try{if(window.location.hostname.includes("youtube.com")){if(document.querySelector(".ad-showing, .ad-interrupting, ytd-player.ad-showing, .ytp-ad-player-overlay")||t&&t.closest(".ad-showing, .ad-interrupting"))return!0;let n=document.querySelector(".video-ads.ytp-ad-module");if(n&&n.childElementCount>0)return!0}if(document.querySelector('.ima-ad-container, .vjs-ad-playing, [id*="ad-container"]:not(:empty), .jw-flag-ads')||t&&t.closest(".ima-ad-container, .vjs-ad-playing, .jw-flag-ads"))return!0}catch{}return!1}function R(t){try{let e=window.location.hostname,n=window.location.pathname;if(e.includes("youtube.com")&&(t.closest("ytd-video-preview, ytd-inline-preview-player, ytd-thumbnail-overlay-inline-playback-renderer, #inline-preview-player, ytd-miniplayer")||["/","/home","/feed","/explore","/trending","/subscriptions"].includes(n)&&!t.closest("ytd-watch-flexy, #movie_player"))||(e.includes("twitter.com")||e.includes("x.com"))&&!n.includes("/status/")&&t.paused)return!0}catch{}return!1}function w(t){if(!t)return!1;let e=t.clientWidth||t.videoWidth||0,n=t.clientHeight||t.videoHeight||0;return!(e>0&&e<220&&n>0&&n<140)}function _(t){for(let e of t){let n=document.querySelector(e),r=n&&(n.getAttribute("content")||n.content);if(r&&r.trim())return r.trim()}return null}function C(){if(window.location.hostname.includes("youtube.com")){let e=document.querySelector("#container > h1 > yt-formatted-string")||document.querySelector("h1.title.style-scope.ytd-video-primary-info-renderer")||document.querySelector("ytd-watch-metadata #title h1");if(e&&e.textContent.trim())return e.textContent.trim()}if(window.location.hostname.includes("twitch.tv")){let e=document.querySelector('[data-a-target="stream-title"]');if(e&&e.textContent.trim())return e.textContent.trim();if(document.title&&document.title.trim()!=="Twitch")return document.title.trim().replace(/\s*[-–—]\s*Twitch$/i,"").trim()}let t=_(['meta[property="og:title"]','meta[name="twitter:title"]']);return t&&!t.toLowerCase().includes("twitch")?t:document.title&&document.title.trim()?document.title.trim().replace(/\s*[\|\-–—]\s*(YouTube|Amazon|Prime Video|Hotstar|Disney\+?|Hulu|HBO|Crunchyroll|Twitch|Funimation|Aniwatch|Anikai).*$/i,"").trim()||document.title.trim():window.location.hostname.replace(/^www\./,"")}function N(t){let e=t||window.location.href;if(e.includes("youtube.com")||e.includes("youtu.be")){let r=k(e);if(r)return`https://img.youtube.com/vi/${r}/mqdefault.jpg`}let n=_(['meta[property="og:image"]','meta[name="twitter:image"]','meta[name="twitter:image:src"]']);if(!n)return null;try{return new URL(n,window.location.href).href}catch{return null}}function T(t){if(isNaN(t)||t<0)return"0:00";let e=Math.floor(t/3600),n=Math.floor(t%3600/60),r=Math.floor(t%60);return e>0?`${e}:${String(n).padStart(2,"0")}:${String(r).padStart(2,"0")}`:`${n}:${String(r).padStart(2,"0")}`}function k(t){if(!t)return null;try{let e=new URL(t,window.location.href);if(e.hostname.includes("youtube.com")){if(e.pathname.startsWith("/watch"))return e.searchParams.get("v");if(e.pathname.startsWith("/shorts/")||e.pathname.startsWith("/embed/"))return e.pathname.split("/")[2]}if(e.hostname.includes("youtu.be"))return e.pathname.substring(1).split("/")[0]}catch{}return null}function y(t){try{let e=window.location.hostname,n=window.location.pathname;if(e.includes("youtube.com")){let i=k(window.location.href);if(i)return`https://www.youtube.com/watch?v=${i}`}if(window!==window.top&&document.referrer&&document.referrer.startsWith("http"))try{let i=new URL(document.referrer);if(!i.hostname.includes("doubleclick")&&!i.hostname.includes("googleads"))return i.href.split("#")[0]}catch{}if(e.includes("twitter.com")||e.includes("x.com")){if(n.includes("/status/"))return window.location.href.split("?")[0];let i=t&&t.closest("article");if(i){let o=Array.from(i.querySelectorAll("a")).find(s=>s.href.includes("/status/"));if(o)return o.href.split("?")[0]}}let r=new URL(window.location.href);return r.hash="",r.searchParams.delete("rewind-resume"),r.href}catch{return window.location.href}}function I(t,e){if(!t||!e)return!1;if(t===e)return!0;try{let n=k(t),r=k(e);if(n&&r)return n===r;let i=new URL(t),o=new URL(e),s=u=>u.replace("twitter.com","x.com").replace(/^www\./,"");return s(i.hostname)!==s(o.hostname)?!1:i.pathname===o.pathname&&i.pathname.length>1}catch{return!1}}function A(t,e=!1){if(!t||!w(t)||R(t)||p(t))return;let n=Math.floor(t.currentTime||0),r=t.duration&&isFinite(t.duration)?Math.floor(t.duration):null;if(!d.trackShorts&&r&&r<60||n<5&&!e)return;r>86400&&(r=null);let i=r===null,o=e?100:r?Math.min(100,Math.round(n/r*100)):null,s=y(t);L=s;let u={id:Date.now(),title:C(),url:s,timestamp:e&&r?r:n,formattedTime:T(n),duration:r,progress:o,isLive:i,completed:!!e,thumbnail:N(s),favicon:`https://www.google.com/s2/favicons?sz=32&domain=${new URL(s).hostname}`,savedAt:Date.now(),pinned:!1,note:""};try{let c=[...m],a=c.find(f=>I(f.url,s));a&&(u.pinned=a.pinned||!1,u.note=a.note||""),c=c.filter(f=>!I(f.url,s)),c.unshift(u),c.length>50&&(c=c.slice(0,50)),m=c,chrome.storage.local.set({history:c,lastEntry:u});try{chrome.runtime.sendMessage({type:"FORCE_SYNC",entry:u}).catch(()=>{})}catch{}}catch{}}function h(t,e,n=!0){if(!t)return;if(console.log(`[Rewind] Performing seek to ${e}s (autoPlay: ${n})`),p(t)){console.log("[Rewind] Ad is active \u2014 deferring seek until ad ends...");let o=setInterval(()=>{p(t)||(clearInterval(o),h(t,e,n))},500);setTimeout(()=>clearInterval(o),45e3);return}let r=()=>{t.currentTime=e,n&&t.paused&&t.play().catch(()=>{})};t.readyState>=1?r():t.addEventListener("loadedmetadata",r,{once:!0});let i=()=>{Math.abs(t.currentTime-e)<=2&&(console.log("[Rewind] \u2705 Seek successfully verified at",t.currentTime),t.removeEventListener("seeked",i))};t.addEventListener("seeked",i),setTimeout(()=>t.removeEventListener("seeked",i),8e3)}function O(){try{let t=window.location.hash;if(t&&t.includes("rewind-resume=")){let e=t.match(/rewind-resume=([0-9]+)/);if(e&&e[1]){let n=parseInt(e[1],10);!isNaN(n)&&n>0&&B(r=>{h(r,n,!0),history.replaceState(null,"",window.location.pathname+window.location.search)})}}}catch{}}function B(t,e=20){let n=0,r=setInterval(()=>{n++;let i=Array.from(document.querySelectorAll("video")).filter(w);i.length>0?(clearInterval(r),t(i[0])):n>=e&&clearInterval(r)},400)}let g=null;function P(){g&&g.parentNode&&g.parentNode.removeChild(g),g=null}function D(t,e){if(!t||!e||e.timestamp<=5||d.showInPagePrompt===!1||t.currentTime>=e.timestamp)return;P();let n=document.createElement("div");n.id="rewind-in-page-prompt",n.style.position="fixed",n.style.bottom="24px",n.style.right="24px",n.style.zIndex="2147483647",n.style.transition="all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",n.style.transform="translateY(30px)",n.style.opacity="0";let r=n.attachShadow({mode:"open"}),i=e.thumbnail||N(e.url)||"https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&auto=format&fit=crop",o=e.duration?` / ${T(e.duration)}`:"",s=`${T(e.timestamp)}${o}`,u=(e.title||"Current Video").replace(/"/g,"&quot;");r.innerHTML=`
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
            <div class="video-title" title="${u}">${u}</div>
            <div class="saved-label">SAVED:</div>
            <div class="saved-time">${s}</div>
            <button class="btn-resume" id="resumeBtn">RESUME AT ${T(e.timestamp)}</button>
            <button class="btn-startover" id="startOverBtn">START OVER</button>
          </div>
        </div>
        <div class="timer-track">
          <div class="timer-fill" id="timerFill"></div>
        </div>
      </div>
    `,(document.fullscreenElement||document.body||document.documentElement).appendChild(n),g=n,requestAnimationFrame(()=>{n.style.transform="translateY(0)",n.style.opacity="1"});let a=r.getElementById("timerFill");requestAnimationFrame(()=>{a&&(a.style.transform="scaleX(0)")});let f=setTimeout(()=>{E()},8e3),V=r.getElementById("promptContainer");V.addEventListener("mouseenter",()=>{clearTimeout(f),a&&(a.style.transition="none")}),V.addEventListener("mouseleave",()=>{f=setTimeout(()=>E(),4e3),a&&(a.style.transition="transform 4s linear",a.style.transform="scaleX(0)")});function E(){n.style.transform="translateY(30px)",n.style.opacity="0",setTimeout(()=>P(),350)}r.getElementById("resumeBtn").addEventListener("click",S=>{S.stopPropagation();let z=r.getElementById("resumeBtn");z.textContent="RESUMING... \u2705",h(t,e.timestamp,!0),setTimeout(()=>E(),600)}),r.getElementById("startOverBtn").addEventListener("click",S=>{S.stopPropagation(),h(t,0,!0),e.timestamp=0,e.progress=0,e.completed=!1,chrome.storage.local.set({history:m}),E()}),r.getElementById("closeBtn").addEventListener("click",S=>{S.stopPropagation(),E()})}function $(t){let e=null,n=!1,r=!1;function i(){if(r||n||d.autoSeek||d.showInPagePrompt===!1||t.currentTime>=5||p(t)||R(t))return;let c=y(t),a=m.find(f=>I(f.url,c));a&&a.timestamp>5&&(r=!0,D(t,a))}let o=()=>{if(!p(t)&&!R(t)){if(d.autoSeek&&!n&&t.currentTime<5){let c=y(t),a=m.find(f=>I(f.url,c));a&&a.timestamp>5&&!a.completed&&(n=!0,h(t,a.timestamp,!0))}else i();e||(e=setInterval(()=>{!t.paused&&!t.ended&&A(t)},3e4))}},s=()=>{t.ended||A(t)},u=()=>{if(e&&clearInterval(e),p(t)){console.log("[Rewind] Ad finished \u2014 waiting for main content stream to start.");return}A(t,!0)};return t.addEventListener("play",o),t.addEventListener("pause",s),t.addEventListener("ended",u),t.addEventListener("loadedmetadata",i),t.addEventListener("canplay",i),t.readyState>=1&&setTimeout(i,500),{flush:()=>{e&&clearInterval(e),!t.paused&&!t.ended&&t.currentTime>5&&A(t)},destroy:()=>{P(),e&&clearInterval(e),t.removeEventListener("play",o),t.removeEventListener("pause",s),t.removeEventListener("ended",u),t.removeEventListener("loadedmetadata",i),t.removeEventListener("canplay",i)}}}function U(){P(),l&&l.flush()}function x(){L=y(),l&&(l.destroy(),l=null),v()}window.addEventListener("yt-navigate-start",U),window.addEventListener("yt-navigate-finish",x),window.addEventListener("yt-page-data-updated",x),window.addEventListener("popstate",x),window.addEventListener("hashchange",x);let q=history.pushState,F=history.replaceState;history.pushState=function(...t){U();let e=q.apply(this,t);return setTimeout(x,50),e},history.replaceState=function(...t){let e=F.apply(this,t);return setTimeout(()=>{L=y()},50),e};function v(){let t=Array.from(document.querySelectorAll("video")).filter(w);if(t.length===0)return;let e=t.find(n=>!n.paused&&!n.muted)||t.find(n=>!n.paused)||t[0];e&&(!l||l.video!==e)&&(l&&l.destroy(),l=$(e),l.video=e)}if(new MutationObserver(()=>{v()}).observe(document.documentElement,{childList:!0,subtree:!0}),window.addEventListener("beforeunload",()=>{l&&l.flush()}),document.addEventListener("visibilitychange",()=>{document.visibilityState==="hidden"&&l&&l.flush()}),v(),setTimeout(v,1500),setTimeout(v,4e3),chrome.runtime.onMessage.addListener((t,e,n)=>{if(t.type==="GET_ACTIVE_VIDEO_INFO"){let r=Array.from(document.querySelectorAll("video")).filter(w),i=r.find(o=>!o.paused)||r[0];if(i){let o=y(i);n({hasVideo:!0,title:C(),url:o,currentTime:Math.floor(i.currentTime||0),duration:i.duration&&isFinite(i.duration)?Math.floor(i.duration):null,thumbnail:N(o),isLive:!i.duration||!isFinite(i.duration),isAd:p(i)})}else n({hasVideo:!1,url:window.location.href});return!0}if(t.type==="SEEK_CURRENT_VIDEO"&&typeof t.timestamp=="number"){let r=Array.from(document.querySelectorAll("video")).filter(w),i=r.find(o=>!o.paused)||r[0];return i?(h(i,t.timestamp,!0),n({success:!0})):n({success:!1,error:"NO_VIDEO_FOUND"}),!0}if(t.type==="RESET_CURRENT_VIDEO"){let r=Array.from(document.querySelectorAll("video")).filter(w),i=r.find(o=>!o.paused)||r[0];return i&&(h(i,0,!0),n({success:!0})),!0}}),window.location.hostname.includes("rewind-player.vercel.app")){let t=()=>{let e=document.getElementById("neural-sync-pulse");return e&&e.dataset.token?(chrome.runtime.sendMessage({type:"AUTH_TOKEN_UPDATE",token:e.dataset.token}).catch(()=>{}),!0):!1};if(!t()){let e=setInterval(()=>{t()&&clearInterval(e)},2e3);setTimeout(()=>clearInterval(e),1e4)}window.addEventListener("message",e=>{e.origin==="https://rewind-player.vercel.app"&&e.data?.type==="REWIND_AUTH_SUCCESS"&&e.data?.token&&chrome.runtime.sendMessage({type:"AUTH_TOKEN_UPDATE",token:e.data.token}).catch(()=>{})}),window.postMessage({type:"REWIND_EXTENSION_READY"},"*")}chrome.runtime.onMessage.addListener(t=>{t.type==="REWIND_PROXY_BROADCAST"&&t.entry&&window.location.hostname.includes("rewind-player.vercel.app")&&window.postMessage({type:"REWIND_PROXY_SYNC",entry:t.entry},"*")})})()});Y();})();
//# sourceMappingURL=content.js.map
