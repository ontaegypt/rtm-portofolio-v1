import assert from 'node:assert';
import fs from 'node:fs';
import { Readable } from 'node:stream';

console.log('🧪 Testing Live Program Renaming & Media Library WordPress Sync...\n');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

async function asyncTest(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

const mainJs = fs.readFileSync('src/main.js', 'utf-8');
const indexHtml = fs.readFileSync('index.html', 'utf-8');
const serverApiJs = fs.readFileSync('server/api.js', 'utf-8');

// Test 1: Navigation elements have proper IDs in index.html
test('index.html contains container IDs for dynamic navigation rendering', () => {
  assert(indexHtml.includes('id="navbarAcademicDropdown"'), 'Missing #navbarAcademicDropdown');
  assert(indexHtml.includes('id="mobileAcademicSubmenu"'), 'Missing #mobileAcademicSubmenu');
  assert(indexHtml.includes('id="footerProgramLinksList"'), 'Missing #footerProgramLinksList');
});

// Test 2: renderPublicNavigationPrograms is exported in src/main.js
test('src/main.js exports and defines renderPublicNavigationPrograms', () => {
  assert(mainJs.includes('export function renderPublicNavigationPrograms()'), 'Missing renderPublicNavigationPrograms export');
  assert(mainJs.includes('navbarAcademicDropdown'), 'renderPublicNavigationPrograms must target navbarAcademicDropdown');
  assert(mainJs.includes('mobileAcademicSubmenu'), 'renderPublicNavigationPrograms must target mobileAcademicSubmenu');
  assert(mainJs.includes('footerProgramLinksList'), 'renderPublicNavigationPrograms must target footerProgramLinksList');
});

// Test 3: normalizeProgram prioritizes updated name and shortTitle
test('normalizeProgram prioritizes edited name and derives shortTitle from new name', () => {
  assert(mainJs.includes('const progName = p.name || p.title || (staticProg ? staticProg.name : \'Program Tahfidz\');'), 'progName priority missing');
  assert(mainJs.includes('const progShortTitle = p.shortTitle || (p.name && p.name !== staticProg?.name ? p.name : (staticProg ? staticProg.shortTitle : (p.title || \'Program\')));'), 'progShortTitle priority missing');
});

// Test 4: Body parser guard in server/api.js to prevent stream.not.readable (404/500 errors)
test('server/api.js guards against double stream reading', () => {
  assert(serverApiJs.includes('if (req.body !== undefined) return next();'), 'Guard for req.body undefined missing in server/api.js');
});

// Test 5: Live API Test: POST /api/media and PUT /api/programs/:id via apiApp
await asyncTest('Live apiApp test: POST /api/media and PUT /api/programs/:id execute with 200/201', async () => {
  const { apiApp } = await import('./server/api.js');

  function request(method, url, body) {
    return new Promise((resolve) => {
      const jsonStr = body ? JSON.stringify(body) : '';
      const req = body ? Readable.from([Buffer.from(jsonStr)]) : Readable.from([]);
      req.method = method;
      req.url = url;
      req.originalUrl = url;
      req.headers = {
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(jsonStr))
      };

      const res = {
        statusCode: 200,
        headers: {},
        setHeader(k, v) { this.headers[k] = v; },
        getHeader(k) { return this.headers[k]; },
        status(c) { this.statusCode = c; return this; },
        json(d) {
          resolve({ status: this.statusCode, body: d });
        },
        end(chunk) {
          resolve({ status: this.statusCode, body: chunk });
        }
      };

      apiApp(req, res, (err) => {
        if (err) resolve({ status: 500, error: err.message });
        else resolve({ status: 404, notHandled: true });
      });
    });
  }

  // A. Upload photo to media library
  const mediaRes = await request('POST', '/api/media', {
    file_name: 'santri-tahfidz-prestasi.jpg',
    data_url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    mime_type: 'image/jpeg',
    file_size: 150000,
    alt_text: 'Santri Tahfidz Berprestasi',
    caption: 'Foto Santri Peraih Medali Emas',
    album_name: 'Pustaka Foto'
  });
  assert.strictEqual(mediaRes.status, 201, `POST /api/media returned status ${mediaRes.status}`);
  assert.strictEqual(mediaRes.body.success, true, 'POST /api/media body.success should be true');
  assert(mediaRes.body.data.file_url, 'Uploaded file should have a URL');

  // B. Rename an existing program
  const updatedProgramName = 'SMP Tahfidz Modern Perubahan Al-Quran';
  const progRes = await request('PUT', '/api/programs/smp', {
    name: updatedProgramName,
    title: updatedProgramName,
    headline: 'Mencetak Generasi Huffazh Berakhlak Al-Quran',
    duration: '3 Tahun'
  });
  assert.strictEqual(progRes.status, 200, `PUT /api/programs/smp returned status ${progRes.status}`);
  assert.strictEqual(progRes.body.success, true, 'PUT /api/programs/smp body.success should be true');

  // C. Verify GET /api/programs returns the updated program name
  const getProgsRes = await request('GET', '/api/programs');
  assert.strictEqual(getProgsRes.status, 200, 'GET /api/programs returned 200');
  const smpProgram = getProgsRes.body.data.find(p => p.id === 'smp' || p.slug === 'smp');
  assert(smpProgram, 'SMP program must exist in database');
  assert.strictEqual(smpProgram.name, updatedProgramName, `Program name should be "${updatedProgramName}" in DB, but got "${smpProgram.name}"`);
});

console.log('\n========================================');
console.log(`Results: ${passed}/${total} Tests Passed (${Math.round((passed / total) * 100)}%)`);
console.log('========================================');

if (passed === total) {
  console.log('🌟 All Live Program Renaming & Media Library Sync Tests Passed Successfully!');
} else {
  process.exit(1);
}
