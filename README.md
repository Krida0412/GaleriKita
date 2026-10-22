# GaleriKita

Katalog properti responsif dengan pencarian, kategori, filter luas/kamar, favorit, pengurutan harga, halaman detail, dan galeri foto layar penuh. Mengikuti tampilan yang telah disetujui, dengan filter tambahan tertutup secara default dan animasi ringan.

## Deploy ke Vercel

1. Import repository `Krida0412/GaleriKita` melalui **Vercel → Add New → Project**.
2. Root Directory: **root repository**, Framework Preset: **Other**. `vercel.json` sudah menentukan Build Command `npm run build`, Output Directory `dist`, dan API Function. Node.js **22.x**.
3. Tambahkan dua **Environment Variables** untuk Production dan Preview:

   | Nama | Nilai |
   | --- | --- |
   | `SUPABASE_URL` | Base URL project Supabase yang telah diberikan, tanpa `/rest/v1/properties` |
   | `SUPABASE_ANON_KEY` | Anon/publik key project tersebut |

   Nilai asli sengaja tidak disimpan di Git. Jangan memberi prefix `PUBLIC_`, `VITE_`, atau `NEXT_PUBLIC_`. Jangan memakai `service_role`.

4. Deploy. Bila environment variable baru ditambahkan setelah deploy, lakukan **Redeploy**.
5. Periksa `/api/properties`: harus mendapat HTTP 200 dan array listing. HTTP 503 berarti environment server belum lengkap; HTTP 502 berarti sumber data belum berhasil dihubungi. Respons error tidak memuat key atau respons internal Supabase.

Situs dan API membutuhkan Vercel Functions. Mengunggah `dist` ke hosting statis saja tidak menjalankan API.

## Pengembangan lokal

Butuh Node.js 22 LTS. Tidak ada dependency runtime npm tambahan.

```sh
npm ci --ignore-scripts
# Salin .env.example ke .env.local dan isi nilainya.
npm run build
npm run dev
```

Buka `http://127.0.0.1:4174`. Server lokal menggunakan handler API dan security headers yang sama. `.env.local` tidak ikut Git atau hasil build.

## Pemeriksaan

```sh
npm run check
```

Mencakup validasi JavaScript, tes API/cache/error/query injection, penguraian luas/filter gabungan, dan pemeriksaan hasil build untuk memastikan tidak ada URL Supabase/key di aset browser. GitHub Actions menjalankan pemeriksaan pada push dan pull request.

## Arsitektur dan batas keamanan

- Browser hanya meminta `GET /api/properties`. URL dan key Supabase dibaca dari environment di server. Tidak ada endpoint proxy bebas, operasi tulis, atau query pengguna yang diteruskan ke Supabase.
- Server menggunakan tabel dan kolom yang ditetapkan, hanya listing aktif, paging internal 500 baris, batas total 5.000 listing/4 MB respons, timeout 10 detik, serta proyeksi data untuk membuang field internal.
- Cache per instance 5 menit, penggabungan request serentak, cache CDN Vercel 5 menit, dan fallback cache server lama maksimal 1 jam ketika sumber bermasalah. Cache memori bersifat per instance, bukan penyimpanan terdistribusi. Browser menyimpan listing selama 5 menit dan mempertahankan data tersimpan saat offline.
- Script/CSS memakai nama file berbasis hash untuk cache immutable. Build tidak membaca environment Supabase. Build sengaja gagal bila menemukan konfigurasi Supabase di output browser.
- Foto Cloudinary memakai varian ukuran 800 px untuk kartu/preview, 160 px untuk thumbnail, dan maksimal 1920 px untuk popup. Foto dibatasi proporsional tanpa pemotongan file sumber; gambar kartu tetap mengikuti crop tata letak. Sumber lain tetap menggunakan URL aslinya.
- CSP membatasi script dan koneksi data ke domain sendiri; proteksi framing, MIME sniffing, referrer, dan permission sensitif dikonfigurasi. Foto HTTPS dari listing tetap berasal dari CDN sumber dan font menggunakan Google Fonts dengan fallback sistem.
- Endpoint listing tetap publik dan bisa dilihat di Network/cURL. Menyembunyikan konfigurasi upstream tidak membuat listing rahasia atau menggantikan RLS Supabase. Key publik yang pernah ada di situs sumber juga tidak menjadi rahasia karena proxy ini.
- Pembatasan scraping/rate limit lintas instance perlu aturan Vercel Firewall/penyimpanan rate limit tersendiri sesuai traffic; tidak mengandalkan rate limit memori yang mudah terlewati. Tidak ada klaim audit penetrasi atau uji beban skala besar.
- Filter/favorit tersimpan per browser. Tautan detail masih berbasis hash sesuai versi yang disetujui; halaman detail belum menghasilkan metadata SEO terpisah per properti.

Kode APK percobaan, credential lokal, file tool build, screenshot pribadi, serta riwayat Sites tidak termasuk repository ini.
