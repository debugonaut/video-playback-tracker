#!/usr/bin/env node
// Test 1: Validate that every DOM ID referenced in popup.js exists in popup.html
// This catches "buttons that do nothing" bugs caused by mismatched IDs.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'popup.html'), 'utf8');
const jsSrc = fs.readFileSync(path.join(ROOT, 'src', 'popup.js'), 'utf8');

let pass = 0;
let fail = 0;

function test(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${name}`);
    pass++;
  } else {
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
    fail++;
  }
}

console.log('\n═══ TEST 1: DOM ID Wiring ═══');
console.log('Checking that every getElementById() call in popup.js has a matching id in popup.html...\n');

// Extract all $('id') calls from popup.js source (const $ = id => document.getElementById(id))
const dollarCalls = [...jsSrc.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
// Also extract direct getElementById calls
const getByIdCalls = [...jsSrc.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);

const allJsIds = [...new Set([...dollarCalls, ...getByIdCalls])];

// Extract all id="..." from HTML
const htmlIds = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const htmlIdSet = new Set(htmlIds);

console.log(`  Found ${allJsIds.length} IDs referenced in popup.js`);
console.log(`  Found ${htmlIds.length} IDs defined in popup.html\n`);

for (const id of allJsIds) {
  test(`ID "${id}" exists in HTML`, htmlIdSet.has(id), `JS references "${id}" but HTML has no element with that id`);
}

// ═══ TEST 2: Event Handler Assignments ═══
console.log('\n═══ TEST 2: Event Handler Assignments ═══');
console.log('Checking that buttons with onclick handlers in JS are not null...\n');

const onclickAssignments = [...jsSrc.matchAll(/(\w+)\.onclick\s*=/g)].map(m => m[1]);
const addEventCalls = [...jsSrc.matchAll(/(\w+)\.addEventListener\(['"]click['"]/g)].map(m => m[1]);

const allClickTargets = [...new Set([...onclickAssignments, ...addEventCalls])];

// Map variable names to their DOM IDs from the source
const varToId = {};
const assignments = [...jsSrc.matchAll(/const (\w+)\s*=\s*\$\(['"]([^'"]+)['"]\)/g)];
for (const m of assignments) {
  varToId[m[1]] = m[2];
}

for (const varName of allClickTargets) {
  const domId = varToId[varName];
  if (domId) {
    test(`Click handler on "${varName}" (id="${domId}") → element exists`, htmlIdSet.has(domId));
  } else {
    // Could be document.querySelectorAll or other
    test(`Click handler on "${varName}" → (dynamic/query selector, can't verify statically)`, true);
  }
}

// ═══ TEST 3: HTML Structure Balance ═══
console.log('\n═══ TEST 3: HTML Structure Validation ═══\n');

const openDivs = (html.match(/<div[\s>]/g) || []).length;
const closeDivs = (html.match(/<\/div>/g) || []).length;
test(`<div> balance: ${openDivs} opens = ${closeDivs} closes`, openDivs === closeDivs);

const openSections = (html.match(/<section[\s>]/g) || []).length;
const closeSections = (html.match(/<\/section>/g) || []).length;
test(`<section> balance: ${openSections} opens = ${closeSections} closes`, openSections === closeSections);

const openMains = (html.match(/<main[\s>]/g) || []).length;
const closeMains = (html.match(/<\/main>/g) || []).length;
test(`<main> balance: ${openMains} opens = ${closeMains} closes`, openMains === closeMains);

const openNavs = (html.match(/<nav[\s>]/g) || []).length;
const closeNavs = (html.match(/<\/nav>/g) || []).length;
test(`<nav> balance: ${openNavs} opens = ${closeNavs} closes`, openNavs === closeNavs);

// ═══ TEST 4: Tab Navigation Targets ═══
console.log('\n═══ TEST 4: Tab Navigation ═══');
console.log('Checking that every nav button data-tab matches a tab-content div...\n');

const dataTabs = [...html.matchAll(/data-tab="([^"]+)"/g)].map(m => m[1]);
for (const tab of dataTabs) {
  const tabDivId = `tab-${tab}`;
  test(`Nav button [data-tab="${tab}"] → div#${tabDivId} exists`, htmlIdSet.has(tabDivId));
}

// ═══ TEST 5: Manifest Validation ═══
console.log('\n═══ TEST 5: Manifest Files ═══\n');

try {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  test('manifest.json is valid JSON', true);
  test(`manifest.json references popup.html`, manifest.action?.default_popup === 'popup.html');
  test(`manifest.json references background.js as service worker`, manifest.background?.service_worker === 'background.js');
  test(`manifest.json has "storage" permission`, manifest.permissions?.includes('storage'));
  test(`manifest.json has "tabs" permission`, manifest.permissions?.includes('tabs'));
  test(`manifest.json has "identity" permission`, manifest.permissions?.includes('identity'));
  
  // Check that referenced files exist
  const bgFile = manifest.background?.service_worker;
  test(`Service worker file "${bgFile}" exists on disk`, fs.existsSync(path.join(ROOT, bgFile)));
  
  const popupFile = manifest.action?.default_popup;
  test(`Popup file "${popupFile}" exists on disk`, fs.existsSync(path.join(ROOT, popupFile)));
  
  const contentScripts = manifest.content_scripts?.[0]?.js || [];
  for (const cs of contentScripts) {
    test(`Content script "${cs}" exists on disk`, fs.existsSync(path.join(ROOT, cs)));
  }
  
  const icons = manifest.icons || {};
  for (const [size, iconPath] of Object.entries(icons)) {
    test(`Icon ${size}px "${iconPath}" exists on disk`, fs.existsSync(path.join(ROOT, iconPath)));
  }
} catch (e) {
  test('manifest.json is valid JSON', false, e.message);
}

try {
  const ffManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.firefox.json'), 'utf8'));
  test('manifest.firefox.json is valid JSON', true);
  test(`Firefox manifest has browser_action with popup`, !!ffManifest.browser_action?.default_popup);
} catch (e) {
  test('manifest.firefox.json is valid JSON', false, e.message);
}

// ═══ TEST 6: Script Tag in HTML ═══
console.log('\n═══ TEST 6: Script Loading ═══\n');
test(`popup.html loads popup.js`, html.includes('<script src="popup.js">'));
test(`popup.html does NOT load src/popup.js (should use built version)`, !html.includes('src/popup.js'));
test(`popup.html loads popup.css`, html.includes('href="popup.css"'));

// ═══ TEST 7: Critical CSS Classes ═══
console.log('\n═══ TEST 7: Critical CSS Classes ═══\n');
const css = fs.readFileSync(path.join(ROOT, 'popup.css'), 'utf8');

const criticalClasses = ['hidden', 'active', 'tab-content', 'nav-btn', 'inject-btn', 'google-btn', 'auth-box', 'profile-view', 'inject-form'];
for (const cls of criticalClasses) {
  test(`CSS class ".${cls}" defined in popup.css`, css.includes(`.${cls}`));
}

// ═══ Summary ═══
console.log('\n' + '═'.repeat(50));
console.log(`  RESULTS: ${pass} passed, ${fail} failed out of ${pass + fail} tests`);
if (fail > 0) {
  console.log(`  ⚠️  ${fail} FAILURES DETECTED — Fix these before loading the extension`);
} else {
  console.log(`  🎉 ALL TESTS PASSED`);
}
console.log('═'.repeat(50) + '\n');

process.exit(fail > 0 ? 1 : 0);
