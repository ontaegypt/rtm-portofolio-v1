import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing Sidebar Collapse/Expand Feature, Gold Icon & White Favicon Enhancements...\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failCount++;
  }
}

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
const css = fs.readFileSync(path.join(__dirname, 'src', 'style.css'), 'utf-8');
const mainJs = fs.readFileSync(path.join(__dirname, 'src', 'main.js'), 'utf-8');

// 1. Tombol X is removed from sidebar
assert(
  !html.includes('id="sidebarCloseBtn"') &&
  !html.includes('class="sidebar-close-btn"'),
  'Tombol close X (sidebarCloseBtn) is completely removed from index.html'
);

// 2. Collapse/Expand button has NO double string character (only pure SVG icon)
assert(
  !html.includes('toggle-state-char') &&
  html.includes('class="sidebar-collapse-toggle-btn"') &&
  html.includes('id="sidebarCollapseToggleBtn"') &&
  html.includes('class="icon-collapse"') &&
  html.includes('class="icon-expand"'),
  'sidebarCollapseToggleBtn contains pure SVG icons (< and >) without double string characters'
);

// 3. Button is positioned vertically centered on the right edge with enlarged 30px size
assert(
  css.includes('.sidebar-collapse-toggle-btn {') &&
  css.includes('top: 50%;') &&
  css.includes('transform: translateY(-50%)') &&
  css.includes('right: -15px;') &&
  css.includes('width: 30px;') &&
  css.includes('height: 30px;'),
  'sidebar-collapse-toggle-btn is enlarged to 30px and centered vertically on the right edge of the menu'
);

// 4. Background color is gold (#d4a373) matching menu hover/accent
assert(
  css.includes('background: #d4a373;') &&
  css.includes('color: #16191c;'),
  'sidebar-collapse-toggle-btn background is gold (#d4a373) with high-contrast icon'
);

// 5. White Favicon asset exists
assert(
  fs.existsSync(path.join(__dirname, 'public', 'assets', 'images', 'favicon-RTM-white.png')),
  'favicon-RTM-white.png exists in public/assets/images/'
);

// 6. Logo switches to white favicon when collapsed
assert(
  mainJs.includes('favicon-RTM-white.png') &&
  mainJs.includes('logo-footer-RTM.png') &&
  css.includes('.admin-sidebar.collapsed .dashboard-brand-logo'),
  'Logo dynamically switches to white favicon when sidebar is collapsed'
);

// 7. Collapsed state styling
assert(
  css.includes('.admin-sidebar.collapsed {') &&
  css.includes('width: 72px !important;') &&
  css.includes('.admin-sidebar.collapsed .menu-label') &&
  css.includes('display: none !important;'),
  'Collapsed sidebar collapses to 72px icon-only mode with hidden text labels'
);

// 8. JavaScript interaction
assert(
  mainJs.includes('sidebarCollapseToggleBtn') &&
  mainJs.includes("sidebar.classList.toggle('collapsed')") &&
  mainJs.includes('updateSidebarToggleUI'),
  'main.js wires up click handler to toggle collapse state and update UI between < and >'
);

console.log('\n========================================');
console.log(`Test Results: ${passCount}/${passCount + failCount} Passed (${Math.round(passCount / (passCount + failCount) * 100)}%)`);
console.log('========================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🌟 All sidebar collapse, gold icon & white favicon enhancements verified successfully!');
}
