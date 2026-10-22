import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import {
  INSTITUTION,
  PROGRAMS,
  CAMPAIGNS,
  NEWS_ARTICLES
} from '../src/data.js';

// Read .env
const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || '';
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function seed() {
  console.log('🚀 Mulai Seeding Data ke Supabase Cloud (bnaaxskyzwjeaduasgru)...');

  // 1. Seed Users (Super Admin, Editor, Finance)
  console.log('\n1. Seeding Users...');
  const usersToSeed = [
    {
      email: 'admin@rumahtahfidz.sch.id',
      full_name: 'Dr. Muhammad Zaki Al-Hafizh',
      role: 'SUPER_ADMIN',
      role_title: 'Admin',
      password: 'admin123',
      avatar: 'MZ'
    },
    {
      email: 'admin@rtm.sch.id',
      full_name: 'Super Admin RTM',
      role: 'SUPER_ADMIN',
      role_title: 'Admin',
      password: 'admin123',
      avatar: 'SA'
    },
    {
      email: 'editor@rumahtahfidz.sch.id',
      full_name: 'Ustadz H. Ahmad Syakir, Lc.',
      role: 'CONTENT_EDITOR',
      role_title: 'Content',
      password: 'editor123',
      avatar: 'AS'
    },
    {
      email: 'finance@rumahtahfidz.sch.id',
      full_name: 'Hj. Rina Kusuma Dewi, S.E.',
      role: 'FINANCE_ADMIN',
      role_title: 'Finance',
      password: 'finance123',
      avatar: 'RK'
    }
  ];

  const authMap = {};
  for (const u of usersToSeed) {
    const { data: existing } = await supabase.from('users').select('id, email').eq('email', u.email).maybeSingle();
    let userId = existing?.id;
    if (!existing) {
      const { data: inserted, error: insertErr } = await supabase.from('users').insert({
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        is_active: true,
        avatar_url: u.avatar
      }).select().single();
      if (insertErr) console.warn(`User ${u.email} seed error:`, insertErr.message);
      else {
        userId = inserted.id;
        console.log(`✅ User ${u.full_name} (${u.email}) berhasil ditambahkan`);
      }
    } else {
      console.log(`ℹ️ User ${u.email} sudah ada.`);
    }

    if (userId) {
      const salt = 'rtmsalt2026';
      authMap[userId] = {
        role_title: u.role_title,
        avatar: u.avatar
      };
      authMap[u.email.toLowerCase()] = authMap[userId];
    }
  }

  // Save auth metadata in site_settings
  await supabase.from('site_settings').upsert({
    key: 'cms_users_auth',
    value: authMap,
    draft_value: authMap
  });
  console.log('✅ Kredensial staf admin berhasil dikonfigurasi di Supabase!');

  // 2. Seed Academic Programs
  console.log('\n2. Seeding Academic Programs...');
  for (const p of PROGRAMS) {
    const slug = String(p.id || '').toLowerCase();
    const { data: existing } = await supabase.from('academic_programs').select('id').eq('slug', slug);
    if (!existing || existing.length === 0) {
      const { error: progErr } = await supabase.from('academic_programs').insert({
        title: p.name || p.shortTitle || 'Program Tahfidz',
        slug: slug,
        category: p.category || 'formal',
        summary: p.summary || p.shortDescription || p.headline || '',
        description: p.description || p.headline || '',
        eligibility_criteria: p.targetParticipants || p.about?.target || 'Umum',
        duration: p.durationClaim || '1 Tahun',
        schedule_info: p.schedule || '',
        quota: Number(p.quota) || 30,
        is_registration_open: true,
        status: 'PUBLISHED'
      });
      if (progErr) console.warn(`Program ${p.id} error:`, progErr.message);
      else console.log(`✅ Program ${p.name || p.id} ditambahkan`);
    } else {
      console.log(`ℹ️ Program ${slug} sudah ada.`);
    }
  }

  // 3. Seed Articles
  console.log('\n3. Seeding Articles...');
  for (const a of NEWS_ARTICLES) {
    const slug = String(a.id || '').toLowerCase();
    const { data: existing } = await supabase.from('articles').select('id').eq('slug', slug);
    if (!existing || existing.length === 0) {
      const { error: artErr } = await supabase.from('articles').insert({
        title: a.title,
        slug: slug,
        excerpt: a.excerpt || '',
        body_content: a.content || a.excerpt || '',
        category: a.category || 'Berita',
        tags: a.tags || ['Tahfidz', 'RTM'],
        author_name: a.author || 'Tim Media RTM',
        thumbnail_url: a.image || a.thumbnail || '/assets/images/campus.jpg',
        status: 'PUBLISHED',
        published_at: new Date().toISOString()
      });
      if (artErr) console.warn(`Article ${a.id} error:`, artErr.message);
      else console.log(`✅ Artikel "${a.title.slice(0, 30)}..." ditambahkan`);
    } else {
      console.log(`ℹ️ Artikel ${slug} sudah ada.`);
    }
  }

  // 4. Seed Donation Campaigns
  console.log('\n4. Seeding Donation Campaigns...');
  for (const c of CAMPAIGNS) {
    const slug = String(c.id || '').toLowerCase();
    const { data: existing } = await supabase.from('donation_campaigns').select('id').eq('slug', slug);
    if (!existing || existing.length === 0) {
      const { error: campErr } = await supabase.from('donation_campaigns').insert({
        title: c.title,
        slug: slug,
        type: c.type || 'wakaf',
        category_name: c.categoryName || 'Infrastruktur',
        summary: c.summary || c.description || '',
        description: c.description || '',
        cover_image: c.image || '/assets/images/campus.jpg',
        target_amount: Number(c.targetAmount) || 100000000,
        collected_amount: 0,
        donor_count: 0,
        status: 'PUBLISHED'
      });
      if (campErr) console.warn(`Campaign ${c.id} error:`, campErr.message);
      else console.log(`✅ Campaign "${c.title.slice(0, 30)}..." ditambahkan`);
    } else {
      console.log(`ℹ️ Campaign ${slug} sudah ada.`);
    }
  }

  // 5. Seed Site Settings (Profile Lembaga)
  console.log('\n5. Seeding Site Settings...');
  const { error: setErr } = await supabase.from('site_settings').upsert({
    key: 'institution_profile',
    value: INSTITUTION,
    draft_value: INSTITUTION
  });
  if (setErr) console.warn('Site settings error:', setErr.message);
  else console.log('✅ Profil Lembaga (site_settings) berhasil disimpan di Supabase!');

  console.log('\n🎉 SEEDING SELESAI! Database Supabase Anda sekarang terisi data riil.');
}

seed().catch(console.error);
