// Data Store for Rumah Tahfidz & Pesantren Modern Portofolio

export const INSTITUTION = {
  name: "Rumah Tahfidz Al-Qur'an & Pesantren Modern",
  shortName: "Rumah Tahfidz",
  tagline: "Mencetak Generasi Qur'ani yang Mutqin, Berkarakter, dan Berwawasan Global",
  logoHeader: "/assets/images/logo-header-RTM.png",
  logoFooter: "/assets/images/logo-footer-RTM.png",
  favicon: "/assets/images/favicon-RTM.png",
  mudir: "KH. Dr. Muhammad Zaki Al-Hafizh, M.A.",
  mudirTitle: "Pimpinan & Pengasuh Rumah Tahfidz",
  mudirQuote: "Menghafal Al-Qur'an bukan sekadar mengingat lafaz demi lafaz, melainkan menanamkan nilai-nilai samawi ke dalam sanubari, sehingga setiap tarikan nafas dan tindakan santri senantiasa memancarkan kemuliaan adab dan keluhuran akhlak.",
  mudirPhoto: "/assets/images/mudir.jpg",
  heroImage: "/assets/images/hero-santri.jpg",
  campusImage: "/assets/images/campus.jpg",
  address: "Jl. Peradaban Qur'ani No. 99, Ciburial, Dago Atas, Bandung, Jawa Barat 40198",
  phone: "+62 812-3456-7890",
  whatsappPPDB: "6281234567890",
  whatsappDonasi: "6281298765432",
  email: "info@rumahtahfidz.sch.id",
  legalitas: {
    kemenag: "Kemenag RI No. Kd.10.04/PP.00.7/3492/2018",
    kemendikbud: "NPSN 69982341 (Akreditasi A Unggul)",
    bwi: "SK Nazhir Wakaf BWI No. 3.3.00281/2021",
    foundation: "SK Kemenkumham RI No. AHU-0014289.AH.01.04.Tahun 2016"
  },
  bankAccounts: [
    {
      bank: "Bank Syariah Indonesia (BSI)",
      accountNumber: "7123 4567 89",
      accountName: "Yayasan Cahaya Hati Bening",
      branch: "KCP Dago Bandung",
      code: "451"
    },
    {
      bank: "Bank Muamalat",
      accountNumber: "108 0099 881",
      accountName: "Wakaf Pembangunan Rumah Tahfidz",
      branch: "Bandung Utama",
      code: "147"
    }
  ],
  stats: {
    santriAktif: "850+",
    asatidzBersanad: "42",
    alumniMutqin: "1.280+",
    hafizh30Juz: "640+",
    akreditasi: "A (Unggul)"
  }
};

export const PROGRAMS = [
  // A. Formal Programs
  {
    id: "smp",
    category: "formal",
    name: "SMP Tahfidz Al-Qur'an",
    shortTitle: "SMP Tahfidz",
    headline: "Pendidikan Menengah Terpadu: Mutqin 15 Juz & Unggul Sains-Teknologi",
    durationClaim: "3 Tahun (Boarding / Asrama Penuh)",
    badge: "Formal Terakreditasi A",
    summary: "Mengintegrasikan kurikulum nasional Kemendikbud dengan kurikulum tahfidz mutqin 15 juz, adab islami, serta penguasaan bahasa Arab dan Inggris aktif.",
    image: "/assets/images/halaqoh.jpg",
    stats: {
      durasi: "3 Tahun (6 Semester)",
      targetHafalan: "15 Juz Mutqin (Plus Itqan)",
      rasioUstadz: "1 Asatidz : 12 Santri",
      ijazah: "Ijazah Formal SMP & Syahadah Tahfidz"
    },
    about: {
      materi: [
        "Tahfidz & Tahsin Al-Qur'an bersanad metode Sabaq, Sabqi, dan Manzil",
        "Kurikulum Nasional Kemendikbud (Matematika, IPA, IPS, Bahasa Inggris, Informatika)",
        "Dirasah Islamiyah (Fiqih Ibadah, Aqidah Akhlak, Bahasa Arab, Hadits Arba'in)",
        "Pengembangan Kepemimpinan & Sunnah Skills (Memanah, Renang, Beladiri)"
      ],
      target: "Lulusan SD/MI sederajat putra & putri berusia 12-14 tahun yang memiliki komitmen kuat menghafal Al-Qur'an dan menuntut ilmu dalam lingkungan asrama.",
      metode: "Sistem Asrama Penuh (Full Boarding School) dengan pendampingan musyrif 24 jam, halaqoh subuh & petang, serta pembelajaran bilingual.",
      biaya: "Investasi pendidikan mencakup asrama ber-AC, makan 3x sehari bergizi, buku/kitab, seragam lengkap, serta layanan kesehatan."
    },
    whyQuran: {
      problems: [
        "Anak usia remaja rentan terpengaruh kecanduan gadget dan degradasi moral lingkungan luar.",
        "Sekolah umum seringkali tidak menyediakan waktu cukup untuk mendalami tahfidz dan adab.",
        "Orang tua kesulitan memantau konsistensi ibadah shalat dan hafalan di rumah."
      ],
      solutions: [
        "Lingkungan asrama asri bebas distraksi negatif dengan pembinaan disiplin ibadah harian.",
        "Kurikulum seimbang: santri berprestasi akademik tanpa mengorbankan target hafalan Al-Qur'an.",
        "Sistem Mutaba'ah santri terpantau rapi dengan laporan perkembangan hafalan mingguan."
      ]
    },
    pillars: [
      {
        title: "Asatidz Bersanad",
        desc: "Dibimbing langsung oleh para penghafal Al-Qur'an 30 juz pemegang sanad muttashil riwayat Hafsh 'an 'Ashim.",
        icon: "award"
      },
      {
        title: "Metode Talaqqi Intensif",
        desc: "Koreksi makharijul huruf dan tajwid secara personal setiap hari sebelum santri menambah hafalan baru (ziyadah).",
        icon: "book-open"
      },
      {
        title: "Integrasi Sains Modern",
        desc: "Laboratorium komputer dan IPA modern untuk menunjang pencapaian nilai akademik tinggi pada jenjang formal.",
        icon: "cpu"
      },
      {
        title: "Pembinaan Karakter & Adab",
        desc: "Penerapan adab santri harian berbasis kitab Taisirul Khalaq dan Ta'limul Muta'allim.",
        icon: "heart"
      }
    ],
    curriculumPhases: [
      {
        phase: 1,
        title: "Fase 1: Tahsin & Pondasi Adab (Semester 1 - 2)",
        desc: "Fokus pada standardisasi bacaan (Tahsinul Qira'ah), tajwid aplikatif Jazariyah, pembiasaan shalat berjamaah, dan ziyadah 5 Juz pertama.",
        topics: [
          "Standardisasi Makharijul Huruf & Sifatul Huruf",
          "Ziyadah Juz 30, Juz 29, dan Juz 1-3 (5 Juz Mutqin)",
          "Dasar Percakapan Bahasa Arab & Adab Tholabul 'Ilmi",
          "Matematika Dasar & Sains Terpadu"
        ]
      },
      {
        phase: 2,
        title: "Fase 2: Akselerasi Ziyadah & Penguatan Dirasah (Semester 3 - 4)",
        desc: "Peningkatan kapasitas memori hafalan santri hingga mencapai 10 Juz, pendalaman fiqih praktis, dan sains terapan.",
        topics: [
          "Ziyadah Juz 4 sampai Juz 8 (Target akumulatif 10 Juz)",
          "Muraja'ah Sabqi harian minimal 1/2 juz per sesi",
          "Kaidah Nahwu-Shorof dasar & Hadits Pilihan",
          "Proyek Sains & Praktikum Laboratorium Komputer"
        ]
      },
      {
        phase: 3,
        title: "Fase 3: Itqan, Tasmi' Akbar & Sukses Asesmen Formal (Semester 5 - 6)",
        desc: "Penyempurnaan 15 Juz, ujian Tasmi' sekali duduk di hadapan dewan asatidz, serta persiapan Ujian Nasional / Asesmen jenjang SMA.",
        topics: [
          "Ziyadah Juz 9-10 (Genap 15 Juz Mutqin)",
          "Ujian Tasmi' 5 Juz & 10 Juz Sekali Duduk",
          "Tryout Intensif & Penguatan Mapel Kelulusan SMP",
          "Wisuda Tahfidz & Pengambilan Syahadah Sanad"
        ]
      }
    ],
    batches: [
      {
        name: "Gelombang 1 - TA 2026/2027",
        period: "1 Okt - 28 Des 2026",
        quota: "40 Santri Putra & 30 Santri Putri",
        remaining: "Tersisa 6 Kursi",
        status: "open",
        dates: "Tes Observasi: 3 Januari 2027"
      },
      {
        name: "Gelombang 2 (Reguler)",
        period: "2 Jan - 15 Maret 2027",
        quota: "20 Santri",
        remaining: "Segera Dibuka",
        status: "upcoming",
        dates: "Tes Observasi: 20 Maret 2027"
      }
    ],
    pricing: {
      registrationFee: "Rp 350.000",
      uangPangkal: "Rp 16.500.000",
      monthlyFee: "Rp 1.850.000",
      facilitiesIncluded: [
        "Asrama ber-AC, ranjang kayu jati & kasur busa orthopedik",
        "Makan 3x sehari menu gizi seimbang + buah & susu",
        "Seragam lengkap 4 stel, almamater & mushaf Al-Qur'an wakaf",
        "Kitab dirasah islamiyah & modul silabus lengkap",
        "Fasilitas laundry & klinik kesehatan santri"
      ]
    },
    testimonials: [
      {
        name: "Drs. H. Bambang Sugiarto, M.Si.",
        role: "Wali Santri SMP (Kelas IX)",
        avatar: "BS",
        quote: "Alhamdulillah, perubahan karakter anak saya sangat nyata. Bukan hanya hafal 15 juz dengan bacaan merdu, adabnya kepada orang tua dan kemandirian hidupnya luar biasa santun."
      },
      {
        name: "Muhammad Rayhan (15 th)",
        role: "Santri SMP Tahfidz Al-Hikmah",
        avatar: "MR",
        quote: "Belajar di Al-Hikmah seru dan tidak membosankan. Asatidz membimbing dengan sabar saat muraja'ah, dan kami punya waktu olahraga panahan serta futsal yang asik."
      }
    ],
    faqs: [
      {
        q: "Apakah calon santri wajib sudah punya hafalan sebelum mendaftar?",
        a: "Tidak wajib. Yang diujikan saat seleksi adalah kemampuan dasar membaca Al-Qur'an (kelancaran makharijul huruf & hukum tajwid dasar), motivasi anak, serta kesiapan tinggal di asrama."
      },
      {
        q: "Bagaimana legalitas ijazah formal SMP Al-Hikmah?",
        a: "SMP Al-Hikmah berizin resmi Kemendikbud dengan Akreditasi A. Lulusan berhak mengikuti ujian formal negara dan dapat melanjutkan ke SMA/SMK/MA negeri maupun swasta favorit."
      },
      {
        q: "Bagaimana sistem kunjungan orang tua ke asrama?",
        a: "Orang tua diizinkan menjenguk santri dua pekan sekali pada hari Ahad sesuai jam kunjungan santri (pukul 08.00 - 17.00 WIB) untuk menjaga ketenangan konsentrasi hafalan santri."
      }
    ]
  },
  {
    id: "sma",
    category: "formal",
    name: "SMA Tahfidz Sains & Dirasah Islamiyah",
    shortTitle: "SMA Tahfidz",
    headline: "Mencetak Calon Ulama Cendekiawan: Mutqin 30 Juz & Tembus PTN/Timur Tengah",
    durationClaim: "3 Tahun (Boarding Intensif)",
    badge: "Formal Terakreditasi A",
    summary: "Program unggulan tingkat menengah atas yang memadukan target tuntas 30 Juz Mutqin, penguasaan kitab turots, sains modern, dan persiapan tembus beasiswa perguruan tinggi terkemuka.",
    image: "/assets/images/campus.jpg",
    stats: {
      durasi: "3 Tahun (Boarding)",
      targetHafalan: "30 Juz Mutqin (Khatam)",
      rasioUstadz: "1 Asatidz : 10 Santri",
      ijazah: "Ijazah Formal SMA & Sanad Tahfidz 30 Juz"
    },
    about: {
      materi: [
        "Khatam Tahfidz 30 Juz Al-Qur'an dengan penguatan muraja'ah Itqan 1 juz per hari",
        "Dirasah Syar'iyyah mendalam: Ushul Fiqih, Tafsir Ibnu Katsir, Hadits Shahih, Balaghah",
        "Kurikulum Sains & Matematika Lanjutan untuk persiapan UTBK-SNBT",
        "Bilingual Academy: Bahasa Arab Fasih & TOEFL Preparation"
      ],
      target: "Lulusan SMP/MTs sederajat yang telah memiliki dasar hafalan minimal 3-5 Juz dan bertekad menyelesaikan hafalan 30 Juz mutqin.",
      metode: "Sistem Boarding Intensif dengan halaqoh takhassus, kelas olimpiade sains, serta bimbingan intensif persiapan beasiswa Timur Tengah & PTN.",
      biaya: "Transparan dan mencakup seluruh kebutuhan asrama, bimbingan UTBK, kitab kuning, serta sertifikasi tahfidz."
    },
    whyQuran: {
      problems: [
        "Siswa SMA sering harus mengorbankan hafalan Al-Qur'an demi mengejar nilai ujian sekolah umum.",
        "Banyak siswa ingin kuliah di Al-Azhar Kairo atau Madinah tapi bingung persiapan seleksinya.",
        "Kebutuhan figur generasi muda yang paham agama sekaligus cakap dalam ilmu pengetahuan modern."
      ],
      solutions: [
        "Jadwal terintegrasi harmonis sehingga waktu ziyadah subuh dan malam tidak berbenturan dengan mapel sains.",
        "Memiliki program khusus pembinaan mu'adalah dan jalur tes Kemenag ke Al-Azhar Mesir & Universitas Islam Madinah.",
        "Didikan kepemimpinan dakwah dan riset ilmiah melahirkan santri berpikiran solutif."
      ]
    },
    pillars: [
      {
        title: "Target Tuntas 30 Juz",
        desc: "Kurikulum muraja'ah terukur memastikan santri menyelesaikan 30 juz dan diuji Tasmi' kubro.",
        icon: "check-circle"
      },
      {
        title: "Kemitraan Luar Negeri",
        desc: "Jejaring bimbingan ke universitas di Mesir, Arab Saudi, Turki, dan PTN ternama di Indonesia.",
        icon: "globe"
      },
      {
        title: "Kajian Kitab Turots",
        desc: "Mengkaji literatur ulama klasik dalam aqidah, fiqih mazhab Syafi'i, dan ushul fiqih.",
        icon: "book"
      },
      {
        title: "Sukses Kampus Impian",
        desc: "Intensive training UTBK-SNBT bersama tutor profesional berpengalaman.",
        icon: "trending-up"
      }
    ],
    curriculumPhases: [
      {
        phase: 1,
        title: "Fase 1: Akselerasi Ziyadah & Matan Tajwid (Kelas X)",
        desc: "Penuntasan hafalan hingga 15-20 Juz serta penyetoran hafalan Matan Al-Jazariyah dan Tuhfatul Athfal.",
        topics: [
          "Ziyadah Hafalan Intensif 5-10 Juz baru",
          "Matan Al-Jazariyah & Tuhfatul Athfal",
          "Fisika, Kimia, Biologi & Matematika Tingkat Lanjut",
          "Muhadhoroh 3 Bahasa (Arab, Inggris, Indonesia)"
        ]
      },
      {
        phase: 2,
        title: "Fase 2: Khatam 30 Juz & Penguatan Turots (Kelas XI)",
        desc: "Pencapaian khatam 30 Juz, pembiasaan tasmi' per 5 juz, serta kajian ushul fiqih dan hadits ahkam.",
        topics: [
          "Penuntasan Juz 21 sampai Juz 30 (Khatam 30 Juz)",
          "Siklus Muraja'ah Kubro 1-2 Juz per hari",
          "Kajian Fiqih Fathul Qarib & Ushul Fiqih Al-Waraqat",
          "Persiapan TOEFL & TOAFL Internasional"
        ]
      },
      {
        phase: 3,
        title: "Fase 3: Tasmi' 30 Juz, Pengambilan Sanad & Sukses Kampus (Kelas XII)",
        desc: "Tasmi' 30 Juz sekali duduk / beberapa hari berturut-turut, pengambilan syahadah sanad, dan pemantapan UTBK.",
        topics: [
          "Tasmi' Akbar 30 Juz Terbuka",
          "Ujian Syahadah Sanad Muttashil",
          "Super Intensive Camp UTBK-SNBT & Mu'adalah Kemenag",
          "Pengabdian Santri & Khidmah Dakwah Masyarakat"
        ]
      }
    ],
    batches: [
      {
        name: "Gelombang 1 - TA 2026/2027",
        period: "1 Okt - 28 Des 2026",
        quota: "35 Santri Putra & 25 Santri Putri",
        remaining: "Tersisa 4 Kursi",
        status: "open",
        dates: "Tes Seleksi: 4 Januari 2027"
      },
      {
        name: "Gelombang 2 (Reguler)",
        period: "2 Jan - 15 Maret 2027",
        quota: "15 Santri",
        remaining: "Segera Dibuka",
        status: "upcoming",
        dates: "Tes Seleksi: 21 Maret 2027"
      }
    ],
    pricing: {
      registrationFee: "Rp 350.000",
      uangPangkal: "Rp 17.500.000",
      monthlyFee: "Rp 1.950.000",
      facilitiesIncluded: [
        "Asrama ber-AC, ranjang kayu jati & kasur orthopedik",
        "Makan 3x sehari bergizi + suplemen kesehatan tahfidz",
        "Seragam almamater resmi, jubah seragam, mushaf eksklusif",
        "Bimbel intensif UTBK & buku panduan seleksi PTN/LN",
        "Akses laboratorium riset & perpustakaan digital"
      ]
    },
    testimonials: [
      {
        name: "Ahmad Fadhil, Lc. (Alumni 2023)",
        role: "Mahasiswa Universitas Al-Azhar Kairo",
        avatar: "AF",
        quote: "Bekal hafalan 30 juz mutqin dan bahasa Arab aktif dari SMA Al-Hikmah membuat saya sangat percaya diri saat mengikuti seleksi Kemenag hingga kuliah di Kairo saat ini."
      },
      {
        name: "Hj. Rina Kusuma Dewi, S.E.",
        role: "Wali Santriwati SMA",
        avatar: "RK",
        quote: "Putri kami berhasil menyelesaikan 30 juz di kelas 11 dan tetap meraih juara olimpiade biologi. Keseimbangan dunia dan akhirat yang nyata!"
      }
    ],
    faqs: [
      {
        q: "Berapa minimal hafalan awal untuk masuk SMA Tahfidz?",
        a: "Disarankan memiliki hafalan minimal 3 Juz. Namun bagi calon santri dengan kualitas bacaan sangat baik dan daya hafal cepat, tes komitmen akan dipertimbangkan tersendiri."
      },
      {
        q: "Apakah lulusan SMA Al-Hikmah berkesempatan masuk PTN ternama?",
        a: "Sangat berpeluang. Alumni kami banyak diterima di ITB, Unpad, UI, UGM melalui jalur prestasi hafizh Qur'an (SNBP Prestasi) maupun jalur tes SNBT."
      }
    ]
  },
  {
    id: "mahasantri",
    category: "formal",
    name: "Mahasantri Aly (Ma'had Aly Dirasah Islamiyah & Qira'at)",
    shortTitle: "Mahasantri Aly",
    headline: "Kaderisasi Ulama Huffadz & Pakar Qira'at Bersanad Muttashil",
    durationClaim: "2 Tahun (Beasiswa Penuh & Subsidi)",
    badge: "Pendidikan Tinggi Pesantren",
    summary: "Program kaderisasi ulama muda dan asatidz huffadz spesialis ilmu Al-Qur'an, Qira'at Sab'ah / 'Asyrah, serta metodologi fatwa dan dakwah kontemporer.",
    image: "/assets/images/wisuda.jpg",
    stats: {
      durasi: "2 Tahun (4 Semester)",
      targetHafalan: "Itqan 30 Juz & Qira'at Sab'ah",
      rasioUstadz: "1 Syaikh : 8 Mahasantri",
      ijazah: "Syahadah Sanad Qira'at & Ijazah Ma'had Aly"
    },
    about: {
      materi: [
        "Itqan 30 Juz Al-Qur'an bil-Ghaib tanpa salah harakat",
        "Studi Qira'at Sab'ah (Thariq Asy-Syathibiyyah) & 'Asyrah",
        "Rasm Utsmani, Dhabth, Fawaashil, dan I'jazul Qur'an",
        "Fiqih Mu'amalat, Kaidah Fiqhiyyah, dan Metode Bahtsul Masa'il"
      ],
      target: "Lulusan SMA/MA/Pondok Pesantren usia 18-24 tahun yang telah hafal 30 Juz Al-Qur'an dan memiliki kemampuan membaca kitab gundul (kuning).",
      metode: "Talaqqi musyafahah langsung dari syaikh muqri' bersanad, halaqoh ba'da subuh dan ashar, serta pengabdian mengajar santri.",
      biaya: "Tersedia program beasiswa penuh (Full Scholarship) untuk mahasantri berprestasi yang lolos seleksi ketat."
    },
    whyQuran: {
      problems: [
        "Banyak penghafal 30 juz yang hafalannya belum mutqin dan belum memahami variasi qira'at yang shahih.",
        "Kekurangan kader asatidz bersanad yang siap memimpin lembaga tahfidz di berbagai pelosok nusantara.",
        "Tantangan liberalisme pemikiran yang membutuhkan ulama berargumen kuat berbasis nash dan ushul."
      ],
      solutions: [
        "Fasilitas talaqqi intensif bersama Syaikh bertaraf internasional untuk mematangkan itqan dan sanad.",
        "Kurikulum manajemen lembaga tahfidz agar mahasantri siap menjadi mudir dan penggerak dakwah.",
        "Fokus mencetak kader huffadz yang berilmu mendalam, rendah hati, dan beradab."
      ]
    },
    pillars: [
      {
        title: "Sanad 'Aali Muttashil",
        desc: "Sanad qira'at muttashil yang tersambung hingga Rasulullah Shallallahu 'Alaihi Wasallam.",
        icon: "shield-check"
      },
      {
        title: "Beasiswa Penuh",
        desc: "Bebas biaya asrama, makan, dan pendidikan bagi mahasantri yang lulus seleksi muqobalah.",
        icon: "gift"
      },
      {
        title: "Kaderisasi Pengasuh",
        desc: "Praktik langsung mengelola halaqoh dan membimbing santri junior sebagai bekal masa depan.",
        icon: "users"
      },
      {
        title: "Karya Tulis Ilmiah",
        desc: "Kewajiban menyusun riset tahqiq manuskrip atau karya tulis ilmiah seputar ilmu Al-Qur'an.",
        icon: "file-text"
      }
    ],
    curriculumPhases: [
      {
        phase: 1,
        title: "Fase 1: Tashih Itqan & Matan Asy-Syathibiyyah (Semester 1)",
        desc: "Pengujian ulang hafalan 30 juz dari awal, hafalan Matan Asy-Syathibiyyah dalam Qira'at Sab'ah.",
        topics: [
          "Setoran Tasmi' 30 Juz Mutqin Ulang",
          "Hafalan Matan Hirz Al-Amani (Asy-Syathibiyyah)",
          "Ushul Qira'at Sab'ah & Perbandingan Rawi",
          "Kajian Tafsir Ayat Ahkam"
        ]
      },
      {
        phase: 2,
        title: "Fase 2: Jam'ul Qira'at Sab'ah (Semester 2 - 3)",
        desc: "Setoran bacaan Al-Qur'an 30 Juz dengan metode Jam' (menggabungkan tujuh qira'at) di hadapan Syaikh Muqri'.",
        topics: [
          "Talaqqi Jam'ul Qira'at Sab'ah Bil-Ghaib",
          "Dirasah Fiqih Muqaran (Perbandingan Mazhab)",
          "Ilmu Rasm Al-Mushaf & Tarikh Al-Qur'an",
          "Praktik Mengajar Halaqoh SMP & SMA"
        ]
      },
      {
        phase: 3,
        title: "Fase 3: Pengambilan Sanad & Pengabdian Dakwah (Semester 4)",
        desc: "Ujian komprehensif, penganugerahan Ijazah Sanad Qira'at, serta penempatan tugas dakwah ke daerah binaan.",
        topics: [
          "Munaqosyah Sanad Qira'at",
          "Penyusunan Riset Akhir (Bahtsul 'Ilmi)",
          "Pelatihan Manajemen Rumah Tahfidz",
          "Pelepasan Kafilah Dakwah Nusantara"
        ]
      }
    ],
    batches: [
      {
        name: "Batch Kader Huffadz Angkatan VII",
        period: "1 Nov 2026 - 15 Jan 2027",
        quota: "15 Mahasantri Khusus",
        remaining: "Tersisa 3 Kuota Beasiswa",
        status: "open",
        dates: "Muqobalah Online/Offline: 20 Januari 2027"
      }
    ],
    pricing: {
      registrationFee: "Rp 200.000 (Biaya Seleksi Administrasi)",
      uangPangkal: "Rp 0 (Beasiswa Penuh Pesantren)",
      monthlyFee: "Rp 0 (Ditanggung Wakaf & CSR Lembaga)",
      facilitiesIncluded: [
        "Tempat tinggal asrama mahasantri khusus takhassus",
        "Tunjangan konsumsi bulanan penuh",
        "Akses kitab rujukan maktabah qira'at",
        "Syahadah sanad resmi bertaraf internasional"
      ]
    },
    testimonials: [
      {
        name: "Ustadz Hilman Firdaus, Al-Hafizh",
        role: "Alumni Mahasantri Aly - Kini Mudir RTQ Cianjur",
        avatar: "HF",
        quote: "Pendidikan di Mahasantri Aly Al-Hikmah mengubah cara pandang saya tentang Al-Qur'an. Sanad yang saya terima menjadi amanah besar yang kini saya salurkan ke ratusan santri di daerah."
      }
    ],
    faqs: [
      {
        q: "Siapa saja yang berhak mendaftar beasiswa Mahasantri Aly?",
        a: "Pemuda muslim usia 18-24 tahun yang sudah mutqin 30 juz, belum menikah, dan bersedia menandatangani komitmen pengabdian 1 tahun pasca kelulusan."
      }
    ]
  },

  // B. Non-Formal Programs
  {
    id: "tpa",
    category: "non_formal",
    name: "TPA Al-Qur'an Anak (Taman Pendidikan Al-Qur'an)",
    shortTitle: "TPA Anak",
    headline: "Membangun Cinta Al-Qur'an Sejak Dini dengan Metode Ceria & Menyenangkan",
    durationClaim: "Kelas Sore (Senin - Kamis, 15.30 - 17.15 WIB)",
    badge: "Non-Formal Unggulan",
    summary: "Program belajar Al-Qur'an untuk anak usia 4-12 tahun dengan pendekatan metode Yanbu'a/Ummi yang interaktif, dongeng islami, hafalan juz 30, serta penanaman adab harian.",
    image: "/assets/images/halaqoh.jpg",
    stats: {
      durasi: "Tingkat Jilid 1 - 6 (Berkala)",
      targetHafalan: "Juz 30 & Doa Harian",
      rasioUstadz: "1 Ustadzah : 8 Santri Cilik",
      ijazah: "Sertifikat Khotmil Qur'an & Syahadah Juz 30"
    },
    about: {
      materi: [
        "Metode Cepat & Tepat Membaca Al-Qur'an Tartil (Jilid 1-6)",
        "Tahfidz Juz 'Amma (Juz 30) dengan irama murottal ramah anak",
        "Hafalan Doa-doa harian, hadits adab & bacaan shalat fardhu",
        "Kisah teladan 25 Nabi, sahabat nabi & dongeng moral islami"
      ],
      target: "Anak-anak usia 4 hingga 12 tahun (TK sampai SD) dari masyarakat sekitar dan umum yang ingin fasih membaca Al-Qur'an sejak dini.",
      metode: "Tatap muka sore hari dengan sistem privat klasikal: tiap anak maju setoran individu kepada ustadzah, diselingi aktivitas ice breaking edukatif.",
      biaya: "Biaya sangat terjangkau dengan fasilitas modul jilid, kartu prestasi santri, dan seragam TPA ceria."
    },
    whyQuran: {
      problems: [
        "Anak-anak zaman sekarang lebih akrab dengan layar HP dan game daripada melantunkan ayat Al-Qur'an.",
        "Orang tua bekerja lelah dan tidak sempat mendampingi mengaji secara rutin setiap sore.",
        "Anak sering bosan jika metode belajar mengaji terasa kaku dan monoton."
      ],
      solutions: [
        "Metode belajar riang gembira dengan nyanyian huruf hijaiyah, stiker apresiasi, dan kartu prestasi.",
        "Jadwal sore yang teratur membantu anak memiliki rutinitas positif sepulang sekolah formal.",
        "Guru-guru ustadzah penyayang anak yang tersertifikasi metode membaca Al-Qur'an anak."
      ]
    },
    pillars: [
      {
        title: "Metode Ceria Ramah Anak",
        desc: "Belajar tanpa paksaan dengan pendekatan afektif yang menumbuhkan rasa rindu mengaji.",
        icon: "smile"
      },
      {
        title: "Guru Pengajar Tersertifikasi",
        desc: "Seluruh ustadzah telah lulus uji syahadah metode pengajaran Al-Qur'an anak.",
        icon: "check-circle"
      },
      {
        title: "Buku Prestasi Terpantau",
        desc: "Orang tua dapat memantau jilid dan halaman capaian anak setiap hari via buku penghubung.",
        icon: "book"
      },
      {
        title: "Pentas Seni & Munaqosyah",
        desc: "Wisuda berkala dan ajang penampilan hafalan di hadapan para orang tua.",
        icon: "star"
      }
    ],
    curriculumPhases: [
      {
        phase: 1,
        title: "Fase 1: Pengenalan Huruf & Makhraj Ceria (Jilid 1 - 3)",
        desc: "Anak mengenal bentuk huruf hijaiyah tunggal dan bersambung, harakat dasar, dan adab menyayangi mushaf.",
        topics: [
          "Pengenalan Huruf Hijaiyah Alif sampai Ya",
          "Harakat Fathah, Kasrah, Dhammah & Mad Thobi'i",
          "Hafalan Surat An-Naas sampai Al-Kafirun",
          "Doa Sebelum Makan & Doa Sebelum Tidur"
        ]
      },
      {
        phase: 2,
        title: "Fase 2: Kelancaran Membaca & Hukum Tajwid (Jilid 4 - 6)",
        desc: "Penguasaan tanwin, sukun, tasydid, dengung ghunnah, serta panjang pendek bacaan Al-Qur'an.",
        topics: [
          "Nun Sukun, Tanwin & Mim Sukun",
          "Tanda Wakaf & Cara Berhenti yang Tepat",
          "Hafalan Surat Al-Kautsar sampai Adh-Dhuha",
          "Praktik Wudhu Sempurna & Shalat Berjamaah"
        ]
      },
      {
        phase: 3,
        title: "Fase 3: Masuk Al-Qur'an Besar & Munaqosyah Juz 30 (Al-Qur'an Class)",
        desc: "Tadarrus mandiri membaca Al-Qur'an 30 Juz secara tartil dan penuntasan hafalan seluruh Juz 30.",
        topics: [
          "Tadarrus Al-Qur'an Juz 1 - 30",
          "Ujian Munaqosyah Juz 30",
          "Wisuda Khotmil Qur'an & Pentas Anak Sholeh"
        ]
      }
    ],
    batches: [
      {
        name: "Semester Genap 2026/2027",
        period: "Pendaftaran Buka Setiap Awal Bulan",
        quota: "50 Santri Cilik",
        remaining: "Tersisa 12 Kursi",
        status: "open",
        dates: "Mulai Belajar: Senin Pertama Bulan Depan"
      }
    ],
    pricing: {
      registrationFee: "Rp 100.000",
      uangPangkal: "Rp 450.000 (Termasuk Seragam + Tas + Paket Modul)",
      monthlyFee: "Rp 150.000 / bulan",
      facilitiesIncluded: [
        "Ruang kelas berkarpet bersih ber-AC",
        "Paket buku jilid & kartu setoran hafalan",
        "Snack sehat berkala pada hari Kamis ceria",
        "Sertifikat kelulusan per jilid"
      ]
    },
    testimonials: [
      {
        name: "Ibu Desy Ratnasari",
        role: "Bunda dari Kenzi (6 th)",
        avatar: "DR",
        quote: "Dulu anak saya malas kalau disuruh mengaji. Sejak masuk TPA Al-Hikmah, jam 3 sore sudah siap pakai peci dan tasnya sendiri. Senang sekali melihatnya ceria."
      }
    ],
    faqs: [
      {
        q: "Mulai usia berapa anak bisa didaftarkan ke TPA?",
        a: "Minimal usia 4 tahun (sudah toilet trained dan mampu berkomunikasi dengan pengajar)."
      }
    ]
  },
  {
    id: "online",
    category: "non_formal",
    name: "Ngaji Online Bersanad (Global E-Tahfidz & Tahsin)",
    shortTitle: "Ngaji Online",
    headline: "Belajar Al-Qur'an Interaktif Privat & Semi-Privat dari Mana Saja di Seluruh Dunia",
    durationClaim: "Jadwal Fleksibel (Pagi / Siang / Malam via Zoom)",
    badge: "Fleksibel & Bersanad",
    summary: "Solusi bagi profesional, mahasiswa, ekspatriat, dan siapa saja yang ingin memperbaiki bacaan Al-Qur'an serta menghafal bersama asatidz bersanad tanpa kendala jarak.",
    image: "/assets/images/hero-santri.jpg",
    stats: {
      durasi: "Paket 3 Bulan (24 Sesi)",
      targetHafalan: "Sesuai Target Personal (Tahsin/Tahfidz)",
      rasioUstadz: "1 Asatidz : 1 Santri (Privat) / 4 (Kelompok)",
      ijazah: "E-Certificate & Syahadah Sanad Online"
    },
    about: {
      materi: [
        "Tahsinul Qira'ah: Koreksi detail artikulasi huruf secara visual melalui kamera HD",
        "Tajwid Teoritis & Praktis interaktif dengan slide digital",
        "Tahfidz & Muraja'ah terjadwal dengan sistem rekam audio",
        "Kajian makna ayat & adab qari' Al-Qur'an"
      ],
      target: "Remaja, dewasa, profesional, ibu rumah tangga, dan WNI perantauan di seluruh dunia yang ingin bimbingan talaqqi berkualitas.",
      metode: "Video conference Zoom/Google Meet dengan jadwal yang disepakati bersama pengajar. Dilengkapi rekaman evaluasi tiap sesi.",
      biaya: "Pilihan paket fleksibel per bulan atau paket program intensif dengan bimbingan asatidz lulusan Timur Tengah dan LIPIA."
    },
    whyQuran: {
      problems: [
        "Kesibukan kerja dan rutinitas kantor membuat sulit menghadiri kelas tatap muka fisik.",
        "Malu belajar dari nol jika harus bergabung di kelas umum yang ramai.",
        "WNI di luar negeri kesulitan menemukan guru mengaji yang fasih dan bersanad."
      ],
      solutions: [
        "Jadwal privat 1-on-1 yang bisa disesuaikan waktu luang peserta (termasuk weekend).",
        "Kelas tertutup yang menjaga privasi dan kenyamanan psikologis peserta.",
        "Peserta kami tersebar di Indonesia, Malaysia, Jepang, Australia, hingga Eropa."
      ]
    },
    pillars: [
      {
        title: "Privat 1-on-1 Eksklusif",
        desc: "Fokus penuh 45-60 menit bersama ustadz/ustadzah tanpa gangguan peserta lain.",
        icon: "user"
      },
      {
        title: "Jadwal Bebas Pilih",
        desc: "Pilihan slot waktu subuh, sore, atau malam hari setelah jam pulang kantor.",
        icon: "clock"
      },
      {
        title: "Feedback Audio Analitis",
        desc: "Ustadz memberikan rekaman catatan koreksi makhraj yang dapat diputar ulang kapan saja.",
        icon: "headphones"
      },
      {
        title: "Sanad Mutashil",
        desc: "Peluang mengambil syahadah sanad qira'at bagi peserta yang berhasil menuntaskan setoran.",
        icon: "award"
      }
    ],
    curriculumPhases: [
      {
        phase: 1,
        title: "Level 1: Diagnostik & Pembenahan Makhorijul Huruf (Bulan 1)",
        desc: "Asesmen kemampuan awal, latihan letak organ suara lidah, bibir, kerongkongan, dan rongga hidung.",
        topics: [
          "Asesmen Bacaan Al-Fatihah & Diagnostik Lahn (Kesalahan)",
          "Artikulasi 28 Huruf Hijaiyah dalam Keadaan Berharakat & Sukun",
          "Karakteristik Hams, Jahr, Syiddah, dan Qalqalah"
        ]
      },
      {
        phase: 2,
        title: "Level 2: Sifatul Huruf & Hukum Ahkam (Bulan 2)",
        desc: "Praktik membaca ayat-ayat Al-Qur'an Juz 1-5 dengan kaidah mad dan waqaf ibtida' yang sempurna.",
        topics: [
          "Kaidah Tafkhim & Tarqiq (Tebal & Tipis) pada Huruf Ra dan Lam Jalalah",
          "Hukum Mad Far'i & Kadar Panjang Ketukan",
          "Kaidah Waqaf & Ibtida' (Tanda Berhenti dan Memulai Bacaan)"
        ]
      },
      {
        phase: 3,
        title: "Level 3: Talaqqi Ziyadah & Sertifikasi Syahadah (Bulan 3)",
        desc: "Setoran hafalan atau tadarrus intensif juz pilihan hingga ujian kelayakan syahadah tahsin/tahfidz.",
        topics: [
          "Talaqqi Ziyadah / Muraja'ah Sesuai Target Peserta",
          "Ujian Lisan Akhir Program Bersama Dewan Asatidz",
          "Penerbitan E-Syahadah & Sanad Riwayat Hafsh"
        ]
      }
    ],
    batches: [
      {
        name: "Batch Fleksibel - Pendaftaran Dibuka Setiap Minggu",
        period: "Aktif Sepanjang Tahun",
        quota: "Slot Privat Terbatas 20 Peserta / Bulan",
        remaining: "Tersisa 5 Slot Ustadz & 4 Slot Ustadzah",
        status: "open",
        dates: "Langsung Mulai setelah Konfirmasi Jadwal"
      }
    ],
    pricing: {
      registrationFee: "Rp 50.000",
      uangPangkal: "Rp 0",
      monthlyFee: "Mulai Rp 450.000 / bulan (8x Sesi Pertemuan Privat)",
      facilitiesIncluded: [
        "Akses ruang temu Zoom Pro berdurasi penuh",
        "E-Modul PDF Tajwid Bergambar & Audio Contoh Bacaan",
        "Grup WhatsApp pendampingan langsung bersama ustadz pembimbing",
        "E-Sertifikat resmi terverifikasi QR Code"
      ]
    },
    testimonials: [
      {
        name: "Ir. Hendra Wijaya (42 th)",
        role: "Senior Software Engineer - Singapura",
        avatar: "HW",
        quote: "Tinggal di luar negeri sempat membuat saya bingung mencari guru mengaji. Alhamdulillah lewat Ngaji Online Al-Hikmah, saya bisa talaqqi rutin setiap jam 8 malam. Sangat fleksibel dan teliti sekali koreksinya."
      }
    ],
    faqs: [
      {
        q: "Bagaimana jika saya berhalangan hadir pada jadwal yang sudah disepakati?",
        a: "Peserta dapat menjadwal ulang (reschedule) maksimal 6 jam sebelum sesi dimulai dengan konfirmasi kepada admin/asatidz."
      }
    ]
  },
  {
    id: "halaqoh-ibu",
    category: "non_formal",
    name: "Halaqoh Ibu & Muslimah (Madrasah Ummahat Al-Qur'an)",
    shortTitle: "Halaqoh Ibu",
    headline: "Mencetak Ibu Qur'ani: Pendidik Pertama Generasi Rabbani & Rumah Tangga Berkah",
    durationClaim: "Pertemuan Sepekan Sekali (Tersedia Kelas Pagi & Weekend)",
    badge: "Komunitas Muslimah Berkah",
    summary: "Ruang belajar tahsin, tahfidz juz 30, serta fiqih wanita dan parenting islami khusus bagi para muslimah dan ibu rumah tangga dalam suasana ukhuwah yang hangat dan suportif.",
    image: "/assets/images/halaqoh.jpg",
    stats: {
      durasi: "Program Berkelanjutan",
      targetHafalan: "Tahsin Bersanad & Juz 30",
      rasioUstadz: "1 Ustadzah : 10 Peserta",
      ijazah: "Sertifikat Tahsin Ummahat & Syahadah Juz 'Amma"
    },
    about: {
      materi: [
        "Tahsinul Qur'an dari dasar hingga fasih tilawah bertajwid",
        "Hafalan Juz 30 & surat-surat pilihan (Al-Kahfi, Al-Mulk, As-Sajdah, Yasin)",
        "Fiqih Ibadah Wanita: Thaharah, haid, shalat, dan zakat",
        "Parenting Qur'ani: Kiat mendidik anak cinta Al-Qur'an di rumah"
      ],
      target: "Para ibu rumah tangga, muslimah karir, mahasiswi, dan calon ibu yang bertekad memperindah bacaan Al-Qur'an dan mempererat ukhuwah islamiyah.",
      metode: "Tatap muka di aula khusus muslimah yang nyaman atau kelas online hybrid, dipandu oleh ustadzah lulusan tahfidz bersanad.",
      biaya: "Infaq bulanan terjangkau yang juga dialokasikan untuk sedekah santri tahfidz yatim."
    },
    whyQuran: {
      problems: [
        "Para ibu sering merasa malu memperbaiki bacaan Al-Qur'an karena merasa sudah berumur.",
        "Ingin mengajarkan anak mengaji di rumah tetapi khawatir bacaan sendiri belum tepat tajwidnya.",
        "Kebutuhan lingkungan pergaulan muslimah yang positif, saling menyemangati dalam ketaatan."
      ],
      solutions: [
        "Suasana belajar sangat ramah, hangat, dan tanpa celaan; semua saling mendukung.",
        "Ibu diajarkan teknik mudah mengoreksi tajwid anak balita dan anak usia sekolah di rumah.",
        "Menjadi oase hati dan wadah bertukar ilmu seputar keluarga sakinah."
      ]
    },
    pillars: [
      {
        title: "Ukhuwah Hangat & Nyaman",
        desc: "Lingkungan belajar eksklusif wanita yang bebas rasa canggung dan penuh kasih sayang.",
        icon: "heart"
      },
      {
        title: "Tahsin Bertahap & Sabar",
        desc: "Ustadzah mengulang materi dengan tempo yang ramah bagi peserta dewasa.",
        icon: "smile"
      },
      {
        title: "Kajian Parenting Islami",
        desc: "Dilengkapi materi parenting nabawiyah setiap pertemuan pekan ke-4 bulanan.",
        icon: "book-open"
      },
      {
        title: "Dua Pilihan: Offline & Hybrid",
        desc: "Pilihan hadir langsung di masjid pesantren atau menyimak via streaming interaktif.",
        icon: "video"
      }
    ],
    curriculumPhases: [
      {
        phase: 1,
        title: "Tingkat 1: Fondasi Tartil & Surat-Surat Pendek (3 Bulan Pertama)",
        desc: "Memperbaiki bacaan surat Al-Fatihah dan sepuluh surat terakhir Al-Qur'an agar sah dan sempurna dalam shalat fardhu.",
        topics: [
          "Tashih Al-Fatihah Kalimah demi Kalimah",
          "Panjang Pendek Bacaan (Mad Thobi'i & Mad Far'i)",
          "Hafalan Surat An-Naas sampai Al-Ma'un",
          "Kajian Fiqih Bersuci (Thaharah) Wanita"
        ]
      },
      {
        phase: 2,
        title: "Tingkat 2: Penuntasan Juz 30 & Surat Pilihan (3 Bulan Kedua)",
        desc: "Menyempurnakan hafalan Juz 'Amma dan melancarkan surat Al-Mulk sebagai pelindung siksa kubur.",
        topics: [
          "Talaqqi Surat An-Naba sampai Al-Fajr",
          "Keutamaan & Hafalan Surat Al-Mulk",
          "Fiqih Mendidik Anak Berakhlak Qur'ani",
          "Kajian Dzikir Pagi Petang Al-Ma'tsurat"
        ]
      },
      {
        phase: 3,
        title: "Tingkat 3: Talaqqi Surat Al-Baqarah & Syahadah (Lanjutan)",
        desc: "Tadarrus juz 1 sampai khatam dengan pengawasan tajwid ketat serta pembekalan menjadi guru mengaji keluarga.",
        topics: [
          "Tadarrus Surat Al-Baqarah",
          "Gharibul Qur'an (Bacaan Khusus dalam Al-Qur'an)",
          "Wisuda Tahsin Ummahat & Penyerahan Piagam Syahadah"
        ]
      }
    ],
    batches: [
      {
        name: "Angkatan Ummahat Nurul Qur'an 2026",
        period: "Setiap Hari Sabtu (09.00 - 11.00 WIB)",
        quota: "30 Peserta per Kelas",
        remaining: "Tersisa 7 Kursi",
        status: "open",
        dates: "Pertemuan Perdana: Sabtu Pertama Bulan Depan"
      }
    ],
    pricing: {
      registrationFee: "Rp 50.000",
      uangPangkal: "Rp 150.000 (Mushaf Khusus Ummahat + Buku Dzikir)",
      monthlyFee: "Rp 120.000 / bulan",
      facilitiesIncluded: [
        "Ruang pertemuan nyaman berkarpet empuk di Masjid Pesantren",
        "Modul materi tahsin & jurnal mutaba'ah harian",
        "Konsumsi ringan & teh hangat pada setiap pertemuan",
        "Sertifikat apresiasi kelulusan program"
      ]
    },
    testimonials: [
      {
        name: "Ibu Hj. Faridah Hanum (48 th)",
        role: "Peserta Halaqoh Ibu Angkatan ke-4",
        avatar: "FH",
        quote: "Alhamdulillah di usia hampir 50 tahun, saya akhirnya bisa membaca Al-Qur'an dengan tartil dan percaya diri. Ustadzahnya sangat sabar dan teman-teman halaqohnya seperti saudara sendiri."
      }
    ],
    faqs: [
      {
        q: "Apakah boleh membawa anak balita saat kelas berlangsung?",
        a: "Boleh. Pesantren menyediakan ruang bermain (kids corner) ramah anak yang berdampingan dengan aula kajian halaqoh."
      }
    ]
  }
];

export const GALLERIES = [
  {
    id: "g1",
    title: "Suasana Halaqoh Subuh di Masjid Jamie Al-Hikmah",
    category: "kegiatan_santri",
    image: "/assets/images/hero-santri.jpg",
    caption: "Santri khusyuk menyetorkan hafalan Al-Qur'an kepada asatidz bersanad diiringi hangatnya mentari pagi."
  },
  {
    id: "g2",
    title: "Panorama Kawasan Kampus & Asrama Pesantren",
    category: "gedung",
    image: "/assets/images/campus.jpg",
    caption: "Lingkungan kampus yang asri, hijau, dan kondusif seluas 4 hektar di kawasan sejuk Dago Atas Bandung."
  },
  {
    id: "g3",
    title: "Momen Khidmat Wisuda Akbar Tahfidz 30 Juz",
    category: "event",
    image: "/assets/images/wisuda.jpg",
    caption: "Penganugerahan selempang kehormatan dan syahadah sanad kepada para wisudawan/wisudawati penghafal 30 juz mutqin."
  },
  {
    id: "g4",
    title: "Bimbingan Talaqqi Musyafahah Ustadz Bersanad",
    category: "kegiatan_santri",
    image: "/assets/images/halaqoh.jpg",
    caption: "Interaksi edukatif penuh cinta antara guru dan santri demi memastikan kesempurnaan makharijul huruf."
  },
  {
    id: "g5",
    title: "Latihan Sunnah Panahan (Archery) Santri",
    category: "ekstrakurikuler",
    image: "/assets/images/archery.jpg",
    caption: "Melatih fokus, ketenangan mental, dan kebugaran jasmani santri melalui olahraga memanah sesuai sunnah Rasulullah."
  },
  {
    id: "g6",
    title: "Fasilitas Kamar Asrama Nyaman & Maktabah Buku",
    category: "gedung",
    image: "/assets/images/dormitory.jpg",
    caption: "Asrama tertata rapi ber-AC dengan ranjang kayu jati kokoh dan akses perpustakaan mini di setiap lantai."
  },
  {
    id: "g7",
    title: "Musabaqah Hifdzil Qur'an (MHQ) Nasional",
    category: "event",
    image: "/assets/images/wisuda.jpg",
    caption: "Delegasi santri Al-Hikmah memborong piala kejuaraan pada kompetisi tahfidz Al-Qur'an tingkat nasional."
  },
  {
    id: "g8",
    title: "Kunjungan & Silaturahmi Syekh dari Timur Tengah",
    category: "event",
    image: "/assets/images/mudir.jpg",
    caption: "Kunjungan kehormatan ulama Al-Azhar Kairo dan pengujian sanad bacaan santri takhassus."
  }
];

export const FACILITIES = [
  {
    name: "Masjid Jamie 3 Lantai",
    spec: "Kapasitas 1.500 Jama'ah",
    desc: "Pusat peribadahan dan halaqoh tahfidz dengan arsitektur megah berpendingin udara dan karpet tebal.",
    icon: "building"
  },
  {
    name: "Asrama Modern & Asri",
    spec: "AC & Ranjang Kayu Ergonomis",
    desc: "Kamar tidur bersih dengan sirkulasi udara optimal, lemari pribadi, dan pengawasan musyrif 24 jam.",
    icon: "home"
  },
  {
    name: "Perpustakaan & Maktabah Turots",
    spec: "5.000+ Koleksi Kitab & Buku",
    desc: "Koleksi manuskrip ilmu qira'at, tafsir, ensiklopedia hadits, serta literatur sains dan teknologi modern.",
    icon: "book-open"
  },
  {
    name: "Laboratorium Multimedia & Bahasa",
    spec: "40 Unit PC High-Spec",
    desc: "Fasilitas audio-visual interaktif untuk pembelajaran bilingual (Arab-Inggris) dan materi IT santri.",
    icon: "monitor"
  },
  {
    name: "Lapangan Sunnah & Olahraga",
    spec: "Futsal, Basket & Lapangan Panahan",
    desc: "Sarana kebugaran jasmani santri di ruang terbuka hijau dengan latar perbukitan yang sejuk.",
    icon: "target"
  },
  {
    name: "Klinik Santri Sehat (Poskestren)",
    spec: "Tenaga Medis Siaga 24 Jam",
    desc: "Layanan pertolongan pertama, obat-obatan herbal dan medis modern yang diawasi oleh dokter mitra.",
    icon: "activity"
  }
];

export const LEADERSHIP = [
  {
    name: "KH. Dr. Muhammad Zaki Al-Hafizh, M.A.",
    role: "Pimpinan & Pengasuh Pondok",
    sanad: "Sanad Hafsh 'an 'Ashim & Qira'at 'Asyrah",
    alumni: "Doktor Tafsir Universitas Al-Azhar Kairo, Mesir",
    image: "/assets/images/mudir.jpg",
    bio: "Berpengalaman lebih dari 20 tahun membina pesantren tahfidz dan aktif sebagai narasumber kajian Al-Qur'an internasional."
  },
  {
    name: "Ustadz H. Ahmad Syakir, Lc., M.Ag.",
    role: "Kepala Bidang Akademik & Kurikulum",
    sanad: "Sanad Matan Al-Jazariyah & Tuhfatul Athfal",
    alumni: "Universitas Islam Madinah (KSA) & Pascasarjana UIN",
    image: "/assets/images/halaqoh.jpg",
    bio: "Pakar metodologi pembelajaran tahfidz mutqin dan kurikulum integrasi sains-islam."
  },
  {
    name: "Ustadzah Hj. Maryam Nabila, S.Th.I., Al-Hafizhah",
    role: "Pengasuh Santriwati & Pembina Ummahat",
    sanad: "Hafizhah 30 Juz Mutqin & Sanad Jazariyah",
    alumni: "Institut Ilmu Al-Qur'an (IIQ) Jakarta",
    image: "/assets/images/halaqoh.jpg",
    bio: "Berfokus pada pembinaan akhlak santriwati dan pembimbing utama halaqoh muslimah."
  }
];

export const NEWS_ARTICLES = [
  {
    id: "art-1",
    title: "Alhamdulillah! 42 Santri Al-Hikmah Diwisuda 30 Juz Mutqin Sekali Duduk",
    category: "Prestasi & Event",
    date: "10 Oktober 2026",
    readTime: "4 Menit",
    image: "/assets/images/wisuda.jpg",
    excerpt: "Sebanyak 42 santri jenjang SMA dan Mahasantri Aly berhasil menuntaskan tasmi' akbar 30 juz Al-Qur'an bil-ghaib di hadapan dewan penguji dan para wali santri yang penuh haru.",
    content: `
      <p>Suasana haru dan penuh syukur menyelimuti Auditorium Utama Pondok Pesantren Al-Hikmah pada Ahad (10/10/2026). Sebanyak 42 santriwan dan santriwati resmi menyandang gelar Hafizh dan Hafizhah 30 Juz setelah sukses menyelesaikan ujian Tasmi' Akbar sekali duduk di hadapan dewan asatidz bersanad.</p>
      
      <p>Pimpinan Pondok Pesantren, KH. Dr. Muhammad Zaki Al-Hafizh, M.A., dalam sambutannya menyampaikan pesan menyentuh hati kepada para wisudawan:</p>
      
      <blockquote class="article-quote">
        "Menjadi hafizh Al-Qur'an bukanlah garis akhir, melainkan awal dari amanah seumur hidup. Hiasilah hafalanmu dengan akhlak yang mulia, berbaktilah kepada orang tua yang telah mendoakanmu di sepertiga malam, dan tebarkanlah manfaat bagi peradaban ummat."
      </blockquote>
      
      <p>Program tasmi' akbar ini merupakan agenda tahunan yang menguji ketahanan dan kekuatan memori santri. Setiap peserta diuji kelancaran membaca Al-Qur'an 30 juz dari surat Al-Fatihah hingga An-Naas tanpa melihat mushaf. Selamat kepada seluruh santri dan para orang tua!</p>
    `,
    tags: ["Wisuda Tahfidz", "Hafizh 30 Juz", "Prestasi", "Al-Hikmah"]
  },
  {
    id: "art-2",
    title: "Penerimaan Peserta Didik Baru (PPDB) TA 2026/2027 Resmi Dibuka",
    category: "Info PPDB",
    date: "1 Oktober 2026",
    readTime: "3 Menit",
    image: "/assets/images/campus.jpg",
    excerpt: "Pondok Pesantren & Rumah Tahfidz Al-Hikmah membuka pendaftaran santri baru untuk jenjang SMP Tahfidz, SMA Tahfidz Sains, dan Mahasantri Aly beasiswa.",
    content: `
      <p>Kabar gembira bagi para orang tua yang mendambakan pendidikan berkualitas untuk putra-putrinya. Pondok Pesantren Al-Hikmah secara resmi membuka Gelombang 1 Penerimaan Peserta Didik Baru (PPDB) untuk Tahun Ajaran 2026/2027.</p>
      
      <p>Tahun ini, kuota penerimaan dibuka untuk jenjang:</p>
      <ul>
        <li><strong>SMP Tahfidz Al-Qur'an:</strong> Kuota 40 Santri Putra & 30 Santri Putri (Target 15 Juz Mutqin).</li>
        <li><strong>SMA Tahfidz Sains:</strong> Kuota 35 Putra & 25 Putri (Target 30 Juz Khatam & Jalur PTN).</li>
        <li><strong>Mahasantri Aly:</strong> Kuota Beasiswa Penuh 15 Mahasantri Takkhasus Qira'at Sab'ah.</li>
      </ul>
      
      <p>Pendaftaran gelombang pertama memberikan keistimewaan potongan biaya seleksi dan prioritas penempatan kamar asrama favorit. Segera lakukan registrasi melalui portal resmi atau kunjungi sekretariat PPDB di kampus kami.</p>
    `,
    tags: ["PPDB 2026", "Pendaftaran Santri", "SMP Tahfidz", "SMA Tahfidz"]
  },
  {
    id: "art-3",
    title: "Tips Menumbuhkan Kecintaan Anak pada Al-Qur'an Sejak Balita",
    category: "Edukasi & Parenting",
    date: "25 September 2026",
    readTime: "5 Menit",
    image: "/assets/images/halaqoh.jpg",
    excerpt: "Ustadzah Hj. Maryam Nabila membagikan 5 kiat praktis nabawiyah agar anak tidak merasa terpaksa saat belajar membaca dan menghafal Al-Qur'an di rumah.",
    content: `
      <p>Banyak orang tua mengeluhkan anak-anak mereka yang sulit diajak mengaji dan lebih asyik menatap layar gawai. Padahal, masa usia emas (golden age) 0-7 tahun adalah waktu terbaik menanamkan kecintaan pada kalamullah.</p>
      
      <p>Berikut adalah 5 kiat dari pengasuh Rumah Tahfidz Al-Hikmah:</p>
      <ol>
        <li><strong>Putar Murottal Saat Hamil & Bayi Tidur:</strong> Rangsang pendengaran anak dengan irama tartil yang merdu secara rutin.</li>
        <li><strong>Orang Tua Menjadi Teladan Pertama:</strong> Anak meniru apa yang dilihat. Jika ayah dan ibu sering membuka mushaf, anak akan ikut penasaran.</li>
        <li><strong>Gunakan Metode Bernyanyi & Ceria:</strong> Jangan gunakan ancaman atau nada tinggi saat anak salah melafalkan makhraj huruf.</li>
        <li><strong>Beri Apresiasi yang Berkesan:</strong> Hadiahkan stiker bintang atau pelukan hangat setiap kali anak berhasil menambah satu ayat baru.</li>
        <li><strong>Pilih Lembaga Belajar yang Tepat:</strong> Pastikan guru mengaji anak memiliki pembawaan yang penyayang dan sabar.</li>
      </ol>
    `,
    tags: ["Parenting Islami", "Tips Tahfidz", "TPA Anak", "Keluarga Sakinah"]
  },
  {
    id: "art-4",
    title: "Mengapa Asatidz Bersanad Begitu Penting dalam Belajar Al-Qur'an?",
    category: "Artikel Keislaman",
    date: "15 September 2026",
    readTime: "4 Menit",
    image: "/assets/images/mudir.jpg",
    excerpt: "Memahami kedudukan sanad keilmuan Al-Qur'an muttashil yang menjadi penjaga orisinalitas bacaan dari zaman Rasulullah SAW hingga hari kiamat.",
    content: `
      <p>Para ulama salafush sholih senantiasa menegaskan: <em>"Al-Isnaadu minad-diin, walau lal-isnaadu laqaala man syaa-a maa syaa-a"</em> (Sanad itu bagian dari agama; jikalau bukan karena sanad, niscaya setiap orang akan berkata sekehendak hatinya).</p>
      
      <p>Belajar Al-Qur'an bukan sekadar membaca tulisan dalam mushaf. Cara melafalkan dengung, kadar ketukan mad, hingga tebal tipisnya lidah hanya bisa dipelajari melalui metode <strong>Talaqqi Musyafahah</strong> (berhadapan langsung dari lisan ke lisan) bersama guru yang memiliki sanad tersambung.</p>
      
      <p>Di Rumah Tahfidz Al-Hikmah, setiap kurikulum tahsin dan tahfidz dijaga ketat oleh asatidz pemegang sanad riwayat Hafsh 'an 'Ashim, memastikan bacaan santri terjaga kemurniannya persis sebagaimana diturunkan Malaikat Jibril kepada Rasulullah SAW.</p>
    `,
    tags: ["Sanad Al-Qur'an", "Tahsin", "Keutamaan Ilmu", "Ulama"]
  }
];

export const PPDB_FLOW = [
  {
    step: 1,
    title: "Registrasi Online",
    desc: "Mengisi formulir pendaftaran santri baru dan mengunggah berkas administrasi (KK & Akta Kelahiran)."
  },
  {
    step: 2,
    title: "Observasi & Tes Baca",
    desc: "Tes kemampuan membaca Al-Qur'an, daya serap memori hafalan, dan psikotes observasi santri."
  },
  {
    step: 3,
    title: "Wawancara Wali Santri",
    desc: "Penyamaan visi pendidikan, komitmen pembinaan anak, dan penjelasan tata tertib asrama pesantren."
  },
  {
    step: 4,
    title: "Pengumuman Kelulusan",
    desc: "Hasil seleksi diumumkan via portal web resmi dan konfirmasi surat keputusan via WhatsApp Center."
  },
  {
    step: 5,
    title: "Daftar Ulang & Orientasi",
    desc: "Penyelesaian administrasi, pengukuran seragam, pembagian asrama, dan masuk awal masa santri baru (Khutbatul 'Arsy)."
  }
];

// ============================================================================
// SPRINT 2: ADMIN CMS BACKOFFICE DATA ENTITIES (PRD Section 5 & 6)
// ============================================================================

export const ADMIN_USERS = [
  {
    id: "usr-1",
    name: "KH. Dr. Muhammad Zaki Al-Hafizh",
    email: "admin@rumahtahfidz.sch.id",
    password: "admin123",
    role: "superadmin", // Full Access
    roleTitle: "Super Administrator",
    avatar: "MZ",
    lastLogin: "Baru saja",
    status: "active"
  },
  {
    id: "usr-2",
    name: "Ustadz H. Ahmad Syakir, Lc.",
    email: "editor@rumahtahfidz.sch.id",
    password: "editor123",
    role: "editor", // Content & Academic
    roleTitle: "Content Editor",
    avatar: "AS",
    lastLogin: "2 jam yang lalu",
    status: "active"
  },
  {
    id: "usr-3",
    name: "Hj. Rina Kusuma Dewi, S.E.",
    email: "finance@rumahtahfidz.sch.id",
    password: "finance123",
    role: "finance", // Donations & Finance
    roleTitle: "Finance / Bendahara",
    avatar: "RK",
    lastLogin: "Kemarin, 16:30",
    status: "active"
  }
];

export const CAMPAIGNS = [
  {
    id: "cmp-1",
    title: "Wakaf Pembebasan Lahan & Perluasan Asrama Santri Tahfidz",
    slug: "wakaf-lahan-asrama",
    type: "wakaf",
    category: "Sarana & Prasarana",
    targetAmount: 500000000,
    collectedAmount: 348500000,
    donorCount: 428,
    status: "active",
    image: "/assets/images/campus.jpg",
    deadline: "31 Desember 2026",
    description: "Pembebasan tanah seluas 1.500 m2 untuk pembangunan gedung asrama santriwan takhassus 30 juz."
  },
  {
    id: "cmp-2",
    title: "Infaq & Kafalah Operasional Asatidz Penghafal Al-Qur'an",
    slug: "infaq-kafalah-asatidz",
    type: "infaq",
    category: "Operasional Dakwah",
    targetAmount: 150000000,
    collectedAmount: 98200000,
    donorCount: 195,
    status: "active",
    image: "/assets/images/halaqoh.jpg",
    deadline: "Terbuka / Rutin",
    description: "Pemberian tunjangan kehormatan, asuransi kesehatan, dan pembinaan berkala bagi 42 asatidz bersanad."
  },
  {
    id: "cmp-3",
    title: "Sedekah Jariyah 1.000 Mushaf Al-Qur'an Rasm Utsmani",
    slug: "sedekah-mushaf-quran",
    type: "sedekah",
    category: "Al-Qur'an & Kitab",
    targetAmount: 85000000,
    collectedAmount: 85000000,
    donorCount: 280,
    status: "completed",
    image: "/assets/images/hero-santri.jpg",
    deadline: "Selesai",
    description: "Pengadaan mushaf tahfidz Al-Qur'an standar Madinah untuk santri baru dan TPA binaan."
  },
  {
    id: "cmp-4",
    title: "Wakaf Sumur Bor & Instalasi Air Bersih Kampus Santri",
    slug: "wakaf-sumur-air-bersih",
    type: "wakaf",
    category: "Sarana Air Bersih",
    targetAmount: 75000000,
    collectedAmount: 42350000,
    donorCount: 114,
    status: "active",
    image: "/assets/images/campus.jpg",
    deadline: "15 November 2026",
    description: "Pengeboran sumur artesis kedalaman 80 meter dan filterisasi air minum higienis santri."
  }
];

export const DONATION_TRANSACTIONS = [
  {
    id: "trx-001",
    invoiceNumber: "INV-202610-001",
    campaignId: "cmp-1",
    campaignTitle: "Wakaf Pembebasan Lahan & Perluasan Asrama",
    donorName: "H. Muhammad Ridwan",
    donorPhone: "081122334455",
    donorEmail: "ridwan.m@gmail.com",
    isAnonymous: false,
    amount: 5000000,
    paymentMethod: "Transfer Manual (BSI)",
    paymentStatus: "success",
    paidAt: "13 Okt 2026, 09:20 WIB",
    receiptUrl: "/assets/images/dormitory.jpg"
  },
  {
    id: "trx-002",
    invoiceNumber: "INV-202610-002",
    campaignId: "cmp-2",
    campaignTitle: "Infaq & Kafalah Operasional Asatidz",
    donorName: "Hamba Allah",
    donorPhone: "081298887766",
    donorEmail: "donatur@gmail.com",
    isAnonymous: true,
    amount: 1500000,
    paymentMethod: "QRIS Dinamis",
    paymentStatus: "success",
    paidAt: "13 Okt 2026, 11:45 WIB",
    receiptUrl: null
  },
  {
    id: "trx-003",
    invoiceNumber: "INV-202610-003",
    campaignId: "cmp-1",
    campaignTitle: "Wakaf Pembebasan Lahan & Perluasan Asrama",
    donorName: "Dra. Hj. Siti Aminah",
    donorPhone: "081377889900",
    donorEmail: "siti.aminah@yahoo.com",
    isAnonymous: false,
    amount: 10000000,
    paymentMethod: "Transfer Manual (BSI)",
    paymentStatus: "pending",
    paidAt: "14 Okt 2026, 14:10 WIB",
    receiptUrl: "/assets/images/mudir.jpg"
  },
  {
    id: "trx-004",
    invoiceNumber: "INV-202610-004",
    campaignId: "cmp-4",
    campaignTitle: "Wakaf Sumur Bor & Instalasi Air Bersih",
    donorName: "Ir. Fajar Nugroho",
    donorPhone: "081544332211",
    donorEmail: "fajar.nugroho@corp.id",
    isAnonymous: false,
    amount: 2500000,
    paymentMethod: "Virtual Account BSI",
    paymentStatus: "success",
    paidAt: "14 Okt 2026, 16:05 WIB",
    receiptUrl: null
  },
  {
    id: "trx-005",
    invoiceNumber: "INV-202610-005",
    campaignId: "cmp-2",
    campaignTitle: "Infaq & Kafalah Operasional Asatidz",
    donorName: "Keluarga Besar Alm. H. Sanusi",
    donorPhone: "085611223344",
    donorEmail: "kel.sanusi@gmail.com",
    isAnonymous: false,
    amount: 3000000,
    paymentMethod: "Transfer Manual (BSI)",
    paymentStatus: "pending",
    paidAt: "15 Okt 2026, 08:30 WIB",
    receiptUrl: "/assets/images/halaqoh.jpg"
  }
];

export const VISIT_RESERVATIONS = [
  {
    id: "res-1",
    groupName: "Majelis Ta'lim Khairul Ummah",
    leaderName: "Ust. Burhanuddin, S.Ag.",
    phone: "081234112233",
    date: "25 Oktober 2026",
    count: 24,
    goal: "Survey Calon Santri & Silaturahmi",
    status: "confirmed"
  },
  {
    id: "res-2",
    groupName: "Rombongan Yayasan Al-Fatih Cirebon",
    leaderName: "H. Dadang Suhendar",
    phone: "081399887711",
    date: "28 Oktober 2026",
    count: 15,
    goal: "Studi Banding Kurikulum Tahfidz Mutqin",
    status: "pending"
  },
  {
    id: "res-3",
    groupName: "Keluarga Calon Santri Surabaya",
    leaderName: "dr. Teguh Wicaksono, Sp.A.",
    phone: "081822334455",
    date: "18 Oktober 2026",
    count: 4,
    goal: "Survey Kamar Asrama SMP Putri",
    status: "confirmed"
  }
];

export const PPDB_LEADS = [
  {
    id: "ppdb-01",
    studentName: "Muhammad Azzam Fatih",
    programId: "smp",
    programName: "SMP Tahfidz Al-Qur'an",
    parentName: "H. Joko Purnomo",
    phone: "081234567890",
    registeredAt: "12 Okt 2026",
    status: "verified"
  },
  {
    id: "ppdb-02",
    studentName: "Aisyah Nur Ramadhani",
    programId: "sma",
    programName: "SMA Tahfidz Sains",
    parentName: "Ibu Dewi Kartika",
    phone: "081388776655",
    registeredAt: "13 Okt 2026",
    status: "pending"
  },
  {
    id: "ppdb-03",
    studentName: "Zaidan Al-Ghifari",
    programId: "mahasantri",
    programName: "Mahasantri Aly Qira'at",
    parentName: "Ust. Mansur",
    phone: "081799001122",
    registeredAt: "14 Okt 2026",
    status: "accepted"
  }
];

