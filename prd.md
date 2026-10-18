Product Requirement Document (PRD)
Website Profil Lembaga Pendidikan / Pesantren & CMS Admin Dashboard

(Dilengkapi Modul Wakaf & Donasi Online)

1. Ringkasan Proyek (Executive Summary)

Proyek ini bertujuan membangun Website Portofolio / Profil Lembaga (Yayasan / Pesantren) modern, responsif, dan informatif untuk memperkenalkan lembaga kepada calon santri/siswa, wali santri, masyarakat umum, serta muhsinin/donatur.

Website ini dilengkapi modul Wakaf & Donasi Terpadu (mendukung donasi instan tanpa harus login/registrasi, maupun donatur terdaftar) serta Dashboard Admin (CMS) terpusat untuk mengelola profil, konten akademik, berita, galeri, hingga campaign dan laporan keuangan wakaf/donasi.

2. Sasaran Pengguna (Target Audience & Personas)
Calon Wali Santri & Santri/Siswa: Mencari informasi jenjang pendidikan (formal/non-formal), kurikulum/silabus, fasilitas, biaya, dan tata cara pendaftaran.
Muhsinin / Donatur / Wakif (Masyarakat Umum): Berpartisipasi dalam program wakaf (pembangunan gedung, pembebasan lahan, sarana air bersih, dll.) dan donasi rutin (infaq santri yatim, operasional asatidz, buka puasa bersama). Bisa berdonasi cepat sebagai Guest atau mendaftar untuk memantau riwayat donasi.
Masyarakat Umum & Mitra Lembaga: Mencari profil lembaga, legalitas, kegiatan sosial, berita terbaru, dan kontak/kunjungan.
Administrator & Bendahara/Pengelola Program (Admin): Mengelola artikel/berita, silabus program, galeri foto/video, membuat campaign wakaf/donasi, memvalidasi transaksi, dan menerbitkan laporan penyaluran dana.
3. Struktur Navigasi & Halaman Publik (Frontend)
Navbar:
├── Menu Navigasi Utama:
│   ├── Home
│   ├── Akademik (Dropdown)
│   │   ├── Formal
│   │   │   ├── SMP
│   │   │   ├── SMA
│   │   │   └── Mahasantri
│   │   └── Non-Formal
│   │       ├── TPA
│   │       ├── Ngaji Online
│   │       └── Halaqoh Ibu
│   ├── Visit (Galeri & Kunjungan)
│   ├── About
│   └── News (Artikel & Berita)
│
└── Action Buttons (Branch Kanan Navbar):
    ├── 1. [Icon + Donasi] (Primary CTA Button - Status Coming Soon)
    └── 2. [Icon + Masuk] (Secondary / Outline Button - LMS Portal)
3.1. Spesifikasi Tombol Aksi di Navbar (Branch Action Buttons)
Tombol "Donasi" (Primary CTA - Status Coming Soon):
Komponen & Ikon: Memiliki ikon pendukung di sebelah teks (leading icon), seperti ikon HeartHandshake / HandHeart (misal: Lucide Icons) untuk memperjelas aksi filantropi/sedekah.
Tampilan: Tombol solid dengan warna kontras/aksen utama lembaga (Primary Brand Color).
Tindakan (Behavior): Menampilkan modal / pop-up JavaScript interaktif elegan yang menyatakan bahwa portal layanan Wakaf & Donasi sedang dipersiapkan (Coming Soon), dilengkapi info rekening transfer manual yayasan serta tombol konfirmasi via WhatsApp.
Tombol "Masuk" / "Login" (Secondary Button / LMS Projection):
Komponen & Ikon: Memiliki ikon pendukung di sebelah teks (leading icon), seperti ikon LogIn / GraduationCap (misal: Lucide Icons) yang merepresentasikan gerbang portal pendidikan.
Tampilan: Desain outline / secondary button yang rapi dan elegan, disandingkan dengan tombol donasi.
Tujuan Proyeksi: Gerbang masuk autentikasi Learning Management System (LMS) untuk santri, wali santri, dan pengajar/asatidz di masa mendatang.
Status Saat Ini (Coming Soon Behavior):
Saat tombol diklik, sistem menampilkan modal elegan / pop-up interaktif: "Portal Akademik & LMS Segera Hadir" (Coming Soon) dengan deskripsi ringkas modul yang sedang dipersiapkan.
Memastikan layout dan kesiapan integrasi SSO / URL portal login LMS di masa depan tanpa mengubah struktur UI navbar.
4. Rincian Fitur Halaman Publik
4.1. Halaman Home (Fokus Branding Rumah Tahfidz)

Halaman Home dirancang sebagai etalase utama pengenalan identitas dan reputasi Rumah Tahfidz, membangun kepercayaan calon wali santri melalui narasi keunggulan, pencapaian, dan kemudahan informasi pendaftaran.

Urutan section pada Halaman Home:

Hero Section (Brand Positioning):

Headline kuat pengenal brand Rumah Tahfidz & tagline qur'ani yang inspiratif.
Background media (video sinematik / high-res carousel kegiatan santri menghafal Al-Qur'an).
Tombol Call-to-Action (CTA): "Daftar PPDB Sekarang" dan "Pelajari Program".
Quick Highlights: Angka santri aktif, asatidz bersanad, dan alumni penghafal Qur'an.

Section Keunggulan & Mengapa Memilih Kami (Why Choose Us):

Sambutan Singkat Kepala Sekolah / Mudir: Pernyataan resmi dan visi pimpinan lembaga dalam mencetak generasi qur'ani yang mutqin dan berkarakter, disertai foto resmi pimpinan.
USP (Unique Selling Proposition): Poin-poin keunggulan unik Rumah Tahfidz, antara lain:
Metode Tahfidz Mutqin & Teruji: Pendekatan hafalan yang kuat dengan muraja'ah berkala.
Asatidz / Pengajar Bersanad: Dibimbing langsung oleh pengajar yang memiliki sanad keilmuan Al-Qur'an.
Integrasi Adab & Akhlak: Fokus pembinaan karakter islami, kemandirian, dan adab harian.
Kurikulum Terpadu: Harmonisasi kurikulum tahfidz dengan pendidikan formal/pengetahuan umum.
Lingkungan Kondusif & Asri: Suasana belajar dan asrama yang aman, nyaman, dan mendukung konsentrasi menghafal.

Section Program Akademik (Katalog Program Singkat):

Showcase kartu program unggulan yang mengarahkan ke halaman detail & silabus:
Pendidikan Formal: SMP, SMA, dan Mahasantri (fokus ijazah formal + target mutqin hafalan).
Pendidikan Non-Formal: TPA, Ngaji Online, dan Halaqoh Ibu (fleksibel untuk masyarakat luas).
Menampilkan ringkasan singkat target hafalan, usia target, dan tombol "Lihat Silabus & Detail".

Section Prestasi & Testimoni (Social Proof):

Etalase Prestasi Santri: Galeri penghargaan santri (juara Musabaqah Hifdzil Qur'an/MHQ tingkat daerah/nasional, wisudawan 30 juz tercepat, prestasi sains & akademik).
Testimoni Wali Santri & Alumni: Kutipan pengalaman nyata orang tua murid terkait perubahan adab anak, kedisiplinan, serta kualitas bacaan/hafalan Al-Qur'an.

Section Informasi Pendaftaran PPDB (Penerimaan Peserta Didik Baru):

Alur Pendaftaran: Infografis tahapan seleksi santri baru (1. Registrasi Akun/Formulir -> 2. Ujian Observasi & Tes Baca Al-Qur'an -> 3. Wawancara Wali Santri -> 4. Pengumuman Hasil -> 5. Daftar Ulang).
Informasi Biaya (Transparansi Finansial): Ringkasan rincian investasi pendidikan (uang pangkal, fasilitas asrama, buku/kitab, seragam, dan SPP bulanan).
Jadwal & Gelombang Pendaftaran: Tabel timeline periode pendaftaran (Gelombang 1, Gelombang 2), tanggal penting tes seleksi, batas kuota penerimaan, dan tombol langsung ke formulir pendaftaran PPDB.

Footer Lembaga:

Profil singkat yayasan, alamat lengkap, peta interaktif, kontak WhatsApp Center PPDB, tautan media sosial resmi, serta nomor rekening/legalitas lembaga.
4.2. Halaman Akademik

Struktur dibagi menjadi dua kategori utama dengan halaman detail khusus untuk masing-masing program:

A. Program Formal:
SMP
SMA
Mahasantri
B. Program Non-Formal:
TPA (Taman Pendidikan Al-Qur'an)
Ngaji Online
Halaqoh Ibu
Elemen & Komponen pada Halaman Detail Setiap Program

Setiap program (baik formal maupun non-formal) memiliki halaman detail yang komprehensif, interaktif, dan berorientasi konversi dengan 10 blok/section berikut:

Hero / Program Introduction:

Konten: Headline program yang memikat, klaim durasi belajar (misal: "3 Tahun Mutqin 30 Juz" / "Program Intensif 6 Bulan"), benefit utama, tombol CTA utama ("Daftar Sekarang"), dan media visual/video promosi program.
Komponen UI/UX:
Counter / Stats Bar: Menampilkan metrik utama (durasi program, rasio ustadz-santri, target juz/kitab).
Action Buttons: Tombol CTA utama dan tombol Download Action (Download PDF Silabus Lengkap).
Visual Container: Video promosi embed / high-resolution image carousel.

Tentang Program:

Konten: Gambaran mendalam materi yang dipelajari, kriteria target peserta (usia/latar belakang), metode kelas (asrama / tatap muka / hybrid online), serta gambaran estimasi biaya.
Komponen UI/UX:
Tabs / Segmented Control: Memudahkan pengguna berpindah antara tab "Apa yang Dipelajari", "Target Peserta", "Metode Belajar", dan "Gambaran Biaya".
Project Cards: Menampilkan ringkasan poin-poin materi utama.

Kenapa Belajar Al-Qur'an:

Konten: Edukasi mengenai urgensi, keutamaan/manfaat belajar Al-Qur'an, peluang masa depan generasi qur'ani, serta solusi mengatasi kesulitan belajar tahfidz/tajwid.
Komponen UI/UX:
Feature Grid (Problem & Solution Cards): Kartu perbandingan tantangan belajar vs solusi yang ditawarkan lembaga.

Keunggulan Belajar Al-Qur'an di RumahTahfidz:

Konten: Pembeda utama lembaga dari segi:
Pengajar (Asatidz): Lulusan timur tengah & pemegang sanad muttashil.
Kurikulum: Terstandarisasi, terukur, dan adaptif.
Sistem Pembelajaran: Pendampingan talaqqi intensif dan mutaba'ah harian.
Komprehensif: Tidak hanya menghafal, tetapi mencakup tajwid, faham makna, dan adab.
Komponen UI/UX:
Feature Grid: Grid interaktif 4 pilar keunggulan dengan icon visual dan highlight badge.

Runtutan Fase Pembelajaran (Kurikulum Silabus):

Konten: Tahapan peta jalan belajar (learning path) terstruktur dari fase persiapan (tahsin dasar/adab), fase inti (ziyadah hafalan & talaqqi), hingga fase pemantapan materi (muraja'ah mutqin, tasmi' akbar, dan ujian kelulusan).
Komponen UI/UX:
Timeline / Phase-Based Curriculum: Alur horizontal/vertikal visual fase demi fase.
Accordion / Collapsible Panel: Detail modul dan capaian mingguan/bulanan yang bisa dibuka-tutup.
Download Action: Tombol download dokumen PDF silabus resmi per jenjang.

Lokasi, Jadwal, dan Biaya:

Konten: Rincian transparan investasi biaya pendidikan, pilihan jadwal batch/angkatan, jam belajar harian, tanggal resmi mulai kelas, dan syarat kelulusan/sertifikasi.
Komponen UI/UX:
Batch Selector / Schedule Cards: Kartu pilihan batch aktif lengkap dengan badge status kuota (contoh: "Batch 1 - Tersisa 5 Kursi").
Pricing Cards: Rincian tabel biaya transparan (biaya pendaftaran, spp, fasilitas) lengkap dengan catatan opsi beasiswa/angsuran.

Alur Pendaftaran:

Konten: Panduan 4 langkah mudah registrasi santri baru:
Langkah 1: Pengisian formulir pendaftaran online.
Langkah 2: Verifikasi data & jadwal observasi / tes baca Al-Qur'an.
Langkah 3: Konfirmasi kelulusan & pembayaran/daftar ulang kelas.
Langkah 4: Orientasi santri baru & mulai kegiatan belajar.
Komponen UI/UX:
Stepper / Process Timeline: Indikator tahapan visual 4 langkah bernomor dengan icon status.

Testimoni Alumni & Santri:

Konten: Kisah nyata perjalanan belajar, kepuasan terhadap materi pengajaran, dan transformasi karakter/hafalan santri setelah mengikuti program.
Komponen UI/UX:
Testimonial Carousel: Slider interaktif dengan kutipan testimoni, nama santri/wali, foto profil, dan badge program yang diambil.

Formulir Pendaftaran (Direct Enrollment Form):

Konten: Formulir registrasi langsung di halaman program untuk mempermudah calon peserta mendaftar tanpa harus berpindah halaman.
Komponen UI/UX (Form Controls):
Field input: Nama Lengkap, Alamat Email, Nomor Handphone / WhatsApp.
Dropdown / Select: Sumber Informasi (Instagram, Rekomendasi Teman, Website, Banner).
Text Area: Motivasi Mengikuti Program.
Radio Button / Selection Grid: Pilihan Metode Pembayaran (Transfer Bank / Virtual Account / Cicilan).
Tombol Submit interaktif dengan status validasi instan.

FAQ (Frequently Asked Questions):

Konten: Jawaban atas pertanyaan umum seputar program: kontak layanan, navigasi program lanjutan, lokasi kampus/asrama, layanan pendukung, halaman informasi, hingga kebijakan privasi & pengembalian dana.
Komponen UI/UX:
Accordion / Collapsible Panel: Daftar tanya-jawab expandable yang rapi dan mudah dicari.
4.3. Modul Wakaf & Donasi (Status: Coming Soon)

Modul Wakaf & Donasi saat ini diposisikan dengan status Coming Soon (tahap persiapan rilis, sejalan dengan portal LMS), sehingga pengunjung yang mengklik tombol donasi tidak diarahkan ke halaman kosong, melainkan disambut dengan pengalaman interaktif informatif.

A. Perilaku Interaktif Pop-Up (JavaScript Modal Trigger)

Saat pengunjung mengklik tombol [Icon + Donasi] pada navbar atau CTA terkait, antarmuka akan memicu Pop-Up / Modal Interaktif JavaScript modern dengan elemen berikut:

Header & Visual Indikator:
Ikon animasi kebaikan/sedekah disertai badge visual: "Segera Hadir / Coming Soon".
Pesan Informasi:
Pemberitahuan hangat bahwa portal wakaf digital terintegrasi (pembayaran otomatis QRIS, Virtual Account, dan sertifikat wakaf digital) sedang dalam tahap finalisasi sistem dan uji coba keamanan transaksi.
Solusi Donasi Alternatif (Manual Transfer):
Menampilkan nomor rekening resmi bank yayasan (misal: Bank Syariah Indonesia / BSI) atas nama resmi yayasan.
Tombol aksi "Konfirmasi Donasi via WhatsApp" yang langsung membuka chat ke nomor bendahara lembaga dengan format pesan otomatis.
Fitur Notifikasi Peluncuran (Waitlist Lead Capture):
Form input singkat satu baris: Pengunjung dapat memasukkan nomor WhatsApp / Email untuk mendapatkan kabar pertama saat portal donasi online resmi diaktifkan.
Tombol Dismiss / Tutup:
Tombol "Tutup" atau ikon silang (X) dengan animasi fade-out yang halus.
B. Proyeksi Arsitektur Masa Depan (Future Production Blueprint)

Spesifikasi modul di bawah ini dipertahankan sebagai cetak biru teknis saat modul wakaf dan donasi diaktifkan secara penuh pada fase rilis berikutnya:

Katalog Campaign: Filter kategori (Wakaf Sarana, Al-Qur'an, Beasiswa Dhuafa, Operasional) dan progress bar nominal donasi.
Detail Campaign: Dokumentasi foto urgensi proyek, tab kabar progres lapangan, dan daftar doa/nama donatur (opsi "Hamba Allah").
Guest & Registered Donation: Kemudahan donasi cepat tanpa wajib login bagi pengunjung umum, serta tawaran mendaftar untuk merekam riwayat wakaf.
Payment Gateway Terintegrasi: QRIS dinamis dan Virtual Account bank syariah/nasional.
Laporan Penyaluran & Transparansi: Publikasi mutasi penyaluran dana secara akuntabel.
4.4. Halaman Visit (Kunjungan & Galeri)
Galeri Foto & Video:
Filter kategori galeri: Fasilitas Gedung, Kegiatan Santri, Event/Kajian Akbar, Ekstrakurikuler.
Tampilan lightbox responsif resolusi tinggi.
Informasi Fasilitas & Gedung: Daftar sarana (Asrama, Masjid, Kelas Multimedia, Perpustakaan, Lab, Lapangan).
Formulir Kunjungan / Tur Lembaga: Reservasi kunjungan langsung (Waktu, jumlah rombongan, tujuan kunjungan).
Peta Lokasi & Petunjuk Arah: Google Maps interaktif dan informasi rute transportasi.
4.5. Halaman About (Tentang Kami)
Sejarah lembaga, Visi, Misi & Nilai Inti (Core Values).
Profil Pimpinan, Dewan Pembina, dan Pengurus Yayasan.
Legalitas, Izin Operasional Kemenag/Kemendikbud, serta SK Lembaga Nazhir Wakaf resmi.
4.6. Halaman News (Artikel & Berita)
Katalog artikel dengan thumbnail, judul, tanggal, kategori, dan pencarian kata kunci.
Halaman detail artikel dengan format rich-text, tagar, media sosial share button, dan rekomendasi artikel terkait.
5. Spesifikasi Dashboard Admin (CMS & Backoffice)

Dashboard admin dirancang intuitif untuk peran Administrator, Content Editor, dan Bendahara/Finance.

Menu Dashboard Admin:
├── Ringkasan / Analytics (Dashboard Overview)
├── Kelola Tampilan (Appearance & Identity)
├── Kelola Akademik (Formal & Non-Formal + Silabus)
├── Modul Wakaf & Donasi (Baru)
│   ├── Daftar Campaign (CRUD)
│   ├── Kategori Campaign
│   ├── Transaksi & Verifikasi Donasi
│   ├── Update Kabar & Penyaluran Dana
│   ├── Rekening & Integrasi Payment Gateway
│   └── Ekspor Laporan Keuangan
├── Kelola Galeri & Kunjungan
├── Kelola Artikel / Berita (CMS Blog)
└── Manajemen Pengguna & Hak Akses
5.1. Fitur Autentikasi (Auth) & Proteksi Akses /admin

Seluruh akses ke area manajemen (/admin) dilindungi oleh sistem keamanan berbasis autentikasi dan middleware rute.

A. Mekanisme Proteksi Rute (Route Guard & Middleware)
Pencegatan Akses Belum Login (Unauthenticated Access):
Setiap pengguna yang mencoba mengakses URL /admin atau sub-rute administratif apa pun (e.g. /admin/*) tanpa sesi aktif akan otomatis dicegat oleh middleware.
Sistem melakukan redirect paksa ke halaman login: /admin/login dengan menyimpan parameter URL tujuan (misal: ?callbackUrl=/admin/content) agar dapat diteruskan setelah login berhasil.
Keamanan Sesi & Kredensial:
Otentikasi berbasis HTTP-only secure cookie / JWT token yang terlindungi dari serangan XSS dan CSRF.
Proteksi brute-force dengan pembatasan percobaan login (rate limiting, e.g. maksimal 5 kali gagal dalam 15 menit).
Fitur Remember Me dan otomatis Session Timeout jika tidak aktif dalam periode tertentu.
B. Pengalihan Otomatis Sesuai Role (Role-Based Redirection)

Setelah kredensial pengguna berhasil diverifikasi di halaman login /admin/login, sistem membaca atribut role pengguna dan secara cerdas mengarahkannya ke dashboard kerja yang relevan:

Super Admin:
Tujuan Redirect: /admin/dashboard (Ringkasan Eksekutif).
Cakupan Akses: Akses penuh (Full Access) ke semua modul: Analytics global, manajemen akun pengguna & role, pengaturan identitas lembaga, akademik, CMS artikel, donasi, dan pengaturan teknis sistem.
Admin Konten (Content Editor):
Tujuan Redirect: /admin/content (Workspace Konten).
Cakupan Akses: Pengelolaan artikel berita, pengumuman, materi/silabus akademik, dan unggah galeri kegiatan. Tidak memiliki akses ke menu pengaturan finansial/donasi dan manajemen akun user.
Admin Donasi / Bendahara (Finance):
Tujuan Redirect: /admin/finance atau /admin/donations (Workspace Keuangan & Donasi).
Cakupan Akses: Pengelolaan campaign wakaf/donasi, monitoring transaksi masuk, approval bukti transfer bank, input progres penyaluran dana, dan ekspor laporan keuangan.
Penanganan Akses Tanpa Wewenang (403 Forbidden):
Jika pengguna yang sudah login mencoba mengakses rute di luar hak akses rolenya secara paksa melalui URL (misal: Content Editor mencoba membuka /admin/finance atau /admin/users), sistem akan menampilkan notifikasi toast peringatan dan me-redirect kembali ke workspace yang sesuai dengan hak aksesnya.
5.2. Fitur Modul Wakaf & Donasi di CMS Admin
Manajemen Campaign (CRUD):
Tambah/edit program wakaf & donasi: Judul, slug/URL, kategori (Wakaf/Infaq/Zakat/Sedekah).
Pengaturan target nominal (atau opsi "Tanpa Batas / Target Terbuka" untuk infaq rutin).
Batas waktu / periode campaign (bisa diatur unlimited).
Upload cover image, galeri progress, dan deskripsi lengkap (WYSIWYG editor).
Switch status: Draft, Aktif (Published), Selesai (Completed), atau Ditutup.
Manajemen Transaksi Donasi:
Tabel transaksi real-time: ID Transaksi, Nama Donatur, Tipe (Guest / Akun), Program, Nominal, Metode Pembayaran, Tanggal, dan Status (Pending, Success, Expired, Canceled).
Approval/Verifikasi manual untuk donasi via transfer bank (fitur preview bukti struk transfer).
Fitur kirim ulang notifikasi konfirmasi / kwitansi via WhatsApp / Email.
Filter transaksi berdasarkan rentang tanggal, status, dan campaign.
Pengelolaan Update Progres & Laporan Penyaluran:
Menambahkan berita progres berkala pada campaign tertentu (contoh: "Progres Pengecoran Lantai 2 Asrama Tahfidz").
Pengunjung/donatur pada campaign tersebut dapat melihat update ini di tab "Kabar Terbaru".
Catatan pengeluaran & dokumentasi foto penyaluran.
Pengaturan Metode Pembayaran:
Kelola nomor rekening bank manual (Nama Bank, Nomor Rekening, Atas Nama, Logo Bank).
Pengaturan integrasi Payment Gateway (API Key, Server Key, Webhook Endpoint untuk Midtrans/Xendit/Tripay).
Ekspor Laporan Keuangan:
Ekspor rekap donasi masuk dan penyaluran ke format Excel (.xlsx), CSV, atau PDF untuk pelaporan rapat dewan pembina dan audit publik.
5.3. Manajemen Tampilan & Beranda (Site Appearance Settings)
Banner / Slider Manager: Tambah, edit, atur urutan hero banner beranda.
Profil Lembaga & Identitas: Logo yayasan, favicon, nama situs, tagline, dan kontak resmi (WhatsApp, Email, Sosmed).
Testimoni & Mitra: Tambah testimoni donatur, alumni, wali santri, dan logo lembaga mitra.
5.4. Manajemen Akademik & Silabus
Katalog Program: Mengubah deskripsi, keunggulan, dan profil jenjang (SMP, SMA, Mahasantri, TPA, Ngaji Online, Halaqoh Ibu).
Silabus Manager: Upload file kurikulum/silabus (format PDF) dan kelola daftar asatidz.
Status Penerimaan: Saklar (toggle) status buka/tutup pendaftaran untuk masing-masing program.
5.5. Manajemen Galeri & Visit
Unggah Media: Multi-upload foto dan embed link YouTube video kegiatan.
Kategorisasi Media: Mengelompokkan foto ke album (Gedung, Kegiatan, Event).
Log Reservasi Kunjungan: Melihat data tamu yang mengajukan kunjungan fisik beserta status konfirmasi kunjungan.
5.6. Manajemen Artikel / Berita (CMS Blog)
Rich Text Editor: Formatting artikel, upload gambar inline, dan embed video.
Status Publikasi: Draft, publish, dan penjadwalan.
SEO On-Page: Input judul meta, deskripsi meta, dan gambar OG untuk share WhatsApp/media sosial.
6. Skema Data Kunci (Database Entity Highlights)
DATABASE (PostgreSQL / Supabase)
├── [Branch 1] Modul Autentikasi & Akun Staf (/admin)
│   └── USERS (Tabel Pengguna & Manajemen Hak Akses)
│       ├── id : UUID [PK]
│       ├── name : VARCHAR(100)
│       ├── email : VARCHAR(150) [UNIQUE]
│       ├── password_hash : VARCHAR(255)
│       ├── role : ENUM ('superadmin', 'editor', 'finance')
│       ├── last_login_at : TIMESTAMP [NULLABLE]
│       └── created_at / updated_at : TIMESTAMP
│
├── [Branch 2] Modul Akademik & Pendaftaran Santri (PPDB)
│   ├── ACADEMIC_PROGRAMS (Katalog Program Formal & Non-Formal)
│   │   ├── id : UUID [PK]
│   │   ├── name : VARCHAR(100) (e.g. 'SMP', 'SMA', 'Mahasantri', 'TPA', dll.)
│   │   ├── category : ENUM ('formal', 'non_formal')
│   │   ├── slug : VARCHAR(100) [UNIQUE]
│   │   ├── headline : VARCHAR(255)
│   │   ├── duration_claim : VARCHAR(100)
│   │   ├── target_participants : TEXT
│   │   ├── syllabus_pdf_url : VARCHAR(255)
│   │   ├── is_active : BOOLEAN [DEFAULT true]
│   │   │
│   │   ├── ├── [Sub-branch] CURRICULUM_PHASES (Relasi 1:N ke Program)
│   │   │   ├── id : UUID [PK]
│   │   │   ├── program_id : UUID [FK -> ACADEMIC_PROGRAMS.id]
│   │   │   ├── phase_number : INT (e.g. Fase 1, Fase 2, Fase 3)
│   │   │   ├── phase_title : VARCHAR(150)
│   │   │   └── description : TEXT
│   │   │
│   │   └── ├── [Sub-branch] PROGRAM_BATCHES (Jadwal Batch & Biaya, Relasi 1:N ke Program)
│   │       ├── id : UUID [PK]
│   │       ├── program_id : UUID [FK -> ACADEMIC_PROGRAMS.id]
│   │       ├── batch_name : VARCHAR(100) (e.g. 'Gelombang 1 - TA 2026/2027')
│   │       ├── start_date : DATE
│   │       ├── quota : INT
│   │       ├── investment_fee : DECIMAL(12,2)
│   │       └── is_open : BOOLEAN
│   │
│   └── PPDB_REGISTRATIONS (Tabel Leads Formulir Pendaftaran Halaman Program)
│       ├── id : UUID [PK]
│       ├── program_id : UUID [FK -> ACADEMIC_PROGRAMS.id]
│       ├── batch_id : UUID [FK -> PROGRAM_BATCHES.id, NULLABLE]
│       ├── full_name : VARCHAR(150)
│       ├── email : VARCHAR(150)
│       ├── phone_whatsapp : VARCHAR(30)
│       ├── info_source : VARCHAR(100) (Instagram, Rekomendasi, Website, dll.)
│       ├── motivation : TEXT
│       ├── payment_method : VARCHAR(50) (Transfer Bank, VA, Cicilan)
│       ├── status : ENUM ('pending', 'verified', 'accepted', 'rejected')
│       └── created_at : TIMESTAMP
│
├── [Branch 3] Modul Konten Publik & CMS Media
│   ├── ARTICLES (Manajemen Berita & Artikel Edukasi)
│   │   ├── id : UUID [PK]
│   │   ├── author_id : UUID [FK -> USERS.id]
│   │   ├── title : VARCHAR(255)
│   │   ├── slug : VARCHAR(255) [UNIQUE]
│   │   ├── content : TEXT (Rich-Text HTML / Markdown)
│   │   ├── thumbnail_url : VARCHAR(255)
│   │   ├── status : ENUM ('draft', 'published')
│   │   └── published_at : TIMESTAMP [NULLABLE]
│   │
│   ├── GALLERIES (Media Dokumentasi Visit, Fasilitas & Kegiatan)
│   │   ├── id : UUID [PK]
│   │   ├── title : VARCHAR(150)
│   │   ├── category : ENUM ('gedung', 'kegiatan_santri', 'event', 'ekstrakurikuler')
│   │   ├── media_type : ENUM ('photo', 'video')
│   │   ├── media_url : VARCHAR(255)
│   │   └── caption : TEXT [NULLABLE]
│   │
│   └── SITE_SETTINGS (Identitas Situs & Konfigurasi Beranda)
│       ├── id : UUID [PK]
│       ├── key : VARCHAR(100) [UNIQUE] (e.g. 'site_logo', 'hero_slides', 'ppdb_wa_center')
│       └── value : JSONB / TEXT
│
└── [Branch 4] Modul Wakaf & Donasi (Cetak Biru Masa Depan / Fase 2)
    ├── CAMPAIGNS (Katalog Program Penggalangan Dana)
    │   ├── id : UUID [PK]
    │   ├── title : VARCHAR(255)
    │   ├── slug : VARCHAR(255) [UNIQUE]
    │   ├── type : ENUM ('wakaf', 'infaq', 'sedekah')
    │   ├── target_amount : DECIMAL(15,2)
    │   ├── collected_amount : DECIMAL(15,2) [DEFAULT 0]
    │   ├── status : ENUM ('draft', 'active', 'completed', 'closed')
    │   │
    │   └── ├── [Sub-branch] CAMPAIGN_UPDATES (Kabar Penyaluran Lapangan)
    │       ├── id : UUID [PK]
    │       ├── campaign_id : UUID [FK -> CAMPAIGNS.id]
    │       ├── title : VARCHAR(255)
    │       ├── content : TEXT
    │       ├── funds_disbursed : DECIMAL(15,2)
    │       └── created_at : TIMESTAMP
    │
    └── DONATIONS (Rekap Transaksi Donatur Guest & Terdaftar)
        ├── id : UUID [PK]
        ├── invoice_number : VARCHAR(100) [UNIQUE]
        ├── campaign_id : UUID [FK -> CAMPAIGNS.id]
        ├── user_id : UUID [FK -> USERS.id, NULLABLE - for guest]
        ├── donor_name : VARCHAR(150)
        ├── donor_phone : VARCHAR(30)
        ├── donor_email : VARCHAR(150)
        ├── is_anonymous : BOOLEAN [DEFAULT false]
        ├── amount : DECIMAL(12,2)
        ├── payment_method : VARCHAR(50) (QRIS, VA, Transfer Manual)
        ├── payment_status : ENUM ('pending', 'success', 'failed', 'expired')
        └── paid_at : TIMESTAMP [NULLABLE]

7. Kebutuhan Non-Fungsional (Non-Functional Requirements)
Keamanan Finansial (Financial Integrity & Security):
Webhook payment gateway diverifikasi dengan cryptographic signature/secret key.
Idempotency key pada pemrosesan transaksi donasi untuk menghindari pencatatan ganda.
Sanitasi data dan validasi ketat pada upload bukti transfer (hanya format JPG/PNG/PDF, batas maksimal 3MB).
Kemudahan Akses (Frictionless UX):
Alur donasi guest maksimal 3 langkah (Pilih Nominal -> Isi Identitas Singkat -> Bayar/Tampil QRIS/Rekening).
Responsiveness & Mobile-First: Mayoritas donatur mengakses via smartphone saat menerima link WhatsApp, layout donasi wajib sangat ramah layar HP.
Notifikasi Otomatis: Integrasi WhatsApp API (Fonnte/Wablas) atau Email (Resend/SMTP) untuk pengiriman bukti donasi instan.
8. Rekomendasi Tech Stack
Layer	Teknologi yang Disarankan	Alternatif
Frontend Publik	Next.js 14+ (App Router) + Tailwind CSS	Nuxt 3 (Vue) / Astro
Admin Dashboard	Next.js (Shadcn UI + React Table)	Filament PHP (Laravel)
Backend & API	Next.js Server Actions / NestJS	Laravel 11 / Go (Gin)
Database	PostgreSQL (Supabase / Neon)	MySQL 8.0
Payment Gateway	Midtrans / Xendit / Tripay (Mendukung QRIS instan)	Manual Bank Transfer
Media & File Storage	Cloudinary / AWS S3 / Supabase Storage	MinIO / Wasabi
Notifikasi WA / Mail	Fonnte / Wablas (WA) & Resend (Email)	Twilio / SendGrid
9. Rencana Tahapan Pengembangan (Roadmap)
├── Phase 1 (Fokus Utama: Website Portofolio & CMS Admin)
│   ├── Sprint 1 Design UI/UX Frontend Publik
         ├── Step 1 Homepage
         ├── Step 2 Akademik Page
         ├── Step 3 Gallery
         ├── Step 4 About
         └── Step 5 News Page
│   ├── Sprint 2 Sistem Auth (/admin), Dashboard Admin
│   ├── Sprint 3 Server, Database, Integrasi secara keseluruhan
│   └── Sprint 4 Integrasi Form PPDB, Testing, & Go Live
└── Phase 2 (Rencana Masa Depan / Future Releases)
    ├── Aktivasi Engine Wakaf & Donasi (Payment Gateway Otomatis)
    └── Sistem Learning Management System (LMS) untuk Santri
    