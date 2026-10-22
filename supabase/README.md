# Supabase Cloud Database - Rumah Tahfidz Muslimah (RTM)

Dokumentasi arsitektur, skema tabel, dan konektivitas database cloud Supabase untuk portal Rumah Tahfidz Muslimah.

---

## 1. Identitas Project Supabase

* **Project Name**: Rumah Tahfidz Muslimah
* **Project Reference ID**: `bnaaxskyzwjeaduasgru`
* **URL API**: `https://bnaaxskyzwjeaduasgru.supabase.co`
* **Database Engine**: PostgreSQL 15+ (Hosted on AWS ap-southeast-1, Singapore)
* **Status**: Aktif, Terhubung, & Ter-seeding

---

## 2. Struktur Tabel Database (`public` schema)

Skema database tersimpan di `supabase/migrations/0001_rtm_cms_schema.sql` dengan tabel-tabel utama:

1. **`users`**: Manajemen pengguna admin & hak akses peran (`SUPER_ADMIN`, `CONTENT_EDITOR`, `ACADEMIC_ADMIN`, `FINANCE_ADMIN`).
2. **`academic_programs`**: Daftar program akademik (SMP Tahfidz, SMA Tahfidz, Mahasantri Aly, TPA, Ngaji Online, Halaqoh Ibu).
3. **`program_registrations`**: Formulir pendaftaran calon santri baru (PPDB) yang masuk dari formulir website.
4. **`registration_status_logs`**: Log riwayat perubahan status pendaftaran santri (`SUBMITTED`, `UNDER_REVIEW`, `ACCEPTED`, dsb).
5. **`articles`**: Berita, artikel dakwah, kegiatan santri, dan publikasi CMS dengan dukungan SEO & slug dinamis.
6. **`donation_campaigns`**: Program penggalangan dana wakaf pembangunan & infaq operasional dengan target terukur.
7. **`financial_transactions`**: Riwayat transaksi donasi masuk dan status verifikasi bendahara.
8. **`financial_audit_logs`**: Catatan audit kepatuhan transaksi keuangan yang tidak dapat diubah (*immutable*).
9. **`gallery_albums` & `gallery_items`**: Dokumentasi album foto & video kegiatan santri.
10. **`media_assets`**: Manajemen metadata aset gambar & dokumen.
11. **`site_settings`**: Konfigurasi identitas profil yayasan/pesantren, kontak, dan nomor rekening.
12. **`system_audit_logs`**: Audit trail aktivitas sistem dan aksi administratif.

---

## 3. Integrasi & Data Access Layer

* **Backend Client**: `server/supabase.js` (menggunakan `@supabase/supabase-js` dengan service role/anon key).
* **Frontend Client**: `src/supabase.js` (client langsung untuk browser).
* **Express API Engine**: `server/api.js` (otomatis mengarahkan rute `/api/*` ke Supabase Cloud, dengan fallback lokal jika offline).

---

## 4. Perintah Berguna

* **Uji Koneksi Supabase**:
  ```bash
  node test-supabase-connection.mjs
  ```
* **Uji Server Express dengan Supabase**:
  ```bash
  node test-server-supabase.mjs
  ```
* **Seeding Ulang Data Master**:
  ```bash
  npm run db:seed:supabase
  ```
