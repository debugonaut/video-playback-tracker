
const fs = require('fs');

console.log("\x1b[36m%s\x1b[0m", "--- LANDING PAGE (App.tsx) LOGIC AUDIT ---");

const appContent = fs.readFileSync('landing-page/src/App.tsx', 'utf8');

const checks = [
    { name: 'Header Login', pattern: /onClick=\{[^}]*setCurrentView\(['"]auth['"]\)/ },
    { name: 'Google Login', pattern: /onClick=\{handleGoogleLogin\}/ },
    { name: 'Email Auth Submit', pattern: /onSubmit=\{handleEmailSubmit\}/ },
    { name: 'Setup Toggle (Chrome)', pattern: /onClick=\{[^}]*setSelectedBrowser\(['"]chrome['"]\)/ },
    { name: 'Setup Toggle (Firefox)', pattern: /onClick=\{[^}]*setSelectedBrowser\(['"]firefox['"]\)/ },
    { name: 'Dashboard Tab: History', pattern: /setActiveTab\(['"]history['"]\)/ },
    { name: 'Dashboard Tab: Analytics', pattern: /setActiveTab\(['"]analytics['"]\)/ },
    { name: 'Dashboard Tab: Entry', pattern: /setActiveTab\(['"]entry['"]\)/ },
    { name: 'Dashboard Logout', pattern: /onClick=\{onLogout\}/ },
    { name: 'Manual Entry Save', pattern: /onSubmit=\{handleAddEntry\}/ },
    { name: 'History Item Delete', pattern: /onClick=\{[^}]*handleDeleteHistoryItem/ },
    { name: 'Clear All History', pattern: /onClick=\{handleClearAllHistory\}/ }
];

console.log("\n--- Functional Handler Verification ---");
checks.forEach(check => {
    const exists = check.pattern.test(appContent);
    console.log(`${exists ? '\x1b[32m[✓]\x1b[0m' : '\x1b[31m[❌]\x1b[0m'} ${check.name}`);
});

// Verify Auth Logic Implementation
console.log("\n--- Auth Logic Tracing ---");
const logicFiles = [
    { label: 'handleGoogleLogin', present: appContent.includes('const handleGoogleLogin = async ()') },
    { label: 'handleEmailSubmit', present: appContent.includes('const handleEmailSubmit = async (e: React.FormEvent)') },
    { label: 'handleAddEntry', present: appContent.includes('const handleAddEntry = async (e: React.FormEvent)') },
    { label: 'Bridge: postMessage', present: appContent.includes('window.postMessage({ type: \'REWIND_AUTH_SUCCESS\'') },
    { label: 'Bridge: location.hash', present: appContent.includes('window.location.hash = `token=${accessToken}`') }
];

logicFiles.forEach(l => {
    console.log(`${l.present ? '\x1b[32m[✓]\x1b[0m' : '\x1b[31m[❌]\x1b[0m'} Core Function: ${l.label}`);
});

console.log("\nAudit Complete.");
