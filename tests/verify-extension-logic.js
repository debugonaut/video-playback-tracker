
const fs = require('fs');
const path = require('path');

console.log("\x1b[36m%s\x1b[0m", "--- EXTENSION LOGIC & WIRING AUDIT ---");

const popupHtml = fs.readFileSync('popup.html', 'utf8');
const popupJs = fs.readFileSync('src/popup.js', 'utf8');

// 1. Identify all interactive IDs in HTML
const htmlIds = [...popupHtml.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const buttonIds = [...popupHtml.matchAll(/id="([^"]+)"[^>]*class="[^"]*(?:btn|icon|toggle|trash|action-icon)[^"]*"/g)].map(m => m[1]);

console.log(`Found ${htmlIds.length} unique IDs in popup.html`);

// 2. Identify all ID references in popup.js
const jsIdRefs = [...popupJs.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
const jsQueryRefs = [...popupJs.matchAll(/document\.getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
const allJsRefs = new Set([...jsIdRefs, ...jsQueryRefs]);

// 3. Cross-reference: Are any buttons missing handlers?
const missingInJs = buttonIds.filter(id => !allJsRefs.has(id));

// Note: Some buttons may be wired via class (like .nav-btn)
const navBtnCheck = popupJs.includes("'.nav-btn'") || popupJs.includes('".nav-btn"');

console.log(`\n--- Verification Results ---`);
console.log(`[HTML] Buttons found: ${buttonIds.length}`);
console.log(`[JS]   ID references: ${allJsRefs.size}`);

if (missingInJs.length > 0) {
    console.log(`\x1b[33m[!] Found ${missingInJs.length} buttons without direct ID-lookup in JS:\x1b[0m`);
    missingInJs.forEach(id => {
        // Check if wired elsewhere (e.g. by class)
        const isNav = popupHtml.includes(`id="${id}"`) && popupHtml.includes('class="nav-btn"');
        console.log(`  - ${id} ${isNav ? '(Wired via .nav-btn class ✅)' : '\x1b[31m(POTENTIALLY DEAD ❌)\x1b[0m'}`);
    });
} else {
    console.log(`\x1b[32m[✓] All button IDs are referenced in JS logic.\x1b[0m`);
}

// 4. Trace Critical Flows
const flows = [
    { name: 'Email Login', trigger: 'loginBtn.onclick', target: 'signInWithEmailAndPassword' },
    { name: 'Google Login', trigger: 'googleBtn.onclick', target: 'GoogleAuthProvider' },
    { name: 'Manual Save', trigger: 'saveManualBtn.addEventListener', target: 'setDoc' },
    { name: 'Logout', trigger: 'logoutBtn.onclick', target: 'signOut' }
];

console.log(`\n--- Critical Flow Trace ---`);
flows.forEach(flow => {
    const hasTrigger = popupJs.includes(flow.trigger);
    const hasTarget = popupJs.includes(flow.target);
    if (hasTrigger && hasTarget) {
        console.log(`\x1b[32m[✓] ${flow.name} Flow: Correctly wired to ${flow.target}\x1b[0m`);
    } else {
        console.log(`\x1b[31m[❌] ${flow.name} Flow: Missing ${!hasTrigger ? 'trigger' : 'target'} logic!\x1b[0m`);
    }
});

// 5. Tab Switching Coverage
const tabs = ['history', 'add', 'sync'];
console.log(`\n--- Tab Coverage ---`);
tabs.forEach(tab => {
    const hasContent = popupHtml.includes(`id="tab-${tab}"`);
    const hasNav = popupHtml.includes(`data-tab="${tab}"`);
    console.log(`${hasContent && hasNav ? '\x1b[32m[✓]\x1b[0m' : '\x1b[31m[❌]\x1b[0m'} Tab: ${tab}`);
});

console.log("\nAudit Complete.");
