# Keamanan konfigurasi

Jangan commit `.env.local`, token GitHub/Vercel, atau key `service_role`. Hanya gunakan role anon/publik dengan RLS yang sesuai. Endpoint server aplikasi hanya membaca data yang sudah dipublikasikan.

File yang dipublikasikan: HTML dan aset hasil build di `dist`. API di `api/properties.js` dijalankan di server Vercel dan membaca environment server; source frontend tidak mengandung key atau URL project.

Data listing dan alamat foto bersifat publik. Endpoint website dapat diakses pengunjung tanpa login, sehingga tidak menjamin pencegahan scraping. Aktifkan aturan Vercel Firewall dan monitoring sesuai traffic sebelum membuka kampanye besar. CORS/CSP tidak menggantikan autentikasi, RLS, atau pembatasan traffic.

Jika key berprivilege lebih tinggi pernah terpublikasi, rotasi melalui pemilik project Supabase; menghapusnya dari frontend saja tidak cukup. Proyek ini tidak menggunakan key admin.
