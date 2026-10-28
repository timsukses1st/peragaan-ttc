/* =====================================================================
   Penanda versi build.

   Alasan ini ada: deploy lewat upload GitHub web bisa gagal diam-diam.
   Kalau build Vercel merah, Vercel TETAP menyajikan deploy hijau yang
   lama, jadi situsnya kelihatan normal padahal isinya versi kemarin.
   Tidak ada tanda apa pun di layar, dan yang kelihatan cuma "fiturnya
   kok belum ada".

   Dengan penanda ini, siapa pun bisa memastikan sendiri versi mana yang
   sedang tayang: lihat pojok kiri bawah, cocokkan dengan versi yang
   tertulis di catatan rilis. Kalau tidak cocok, berarti deploy-nya belum
   naik, bukan fiturnya yang hilang.

   ATURAN: setiap kali mengirim ZIP baru, NOMOR DAN TANGGAL DI BAWAH INI
   WAJIB DIUBAH. Kalau lupa diubah, penanda ini malah menyesatkan.
   ===================================================================== */

export const VERSI = "v80";
export const VERSI_TANGGAL = "28 Oktober 2026";
export const VERSI_ISI = "Menu baru Kasir OTR untuk jualan keliling, dipakai peran Superadmin, Admin, Gudang, dan Sales. Alurnya empat langkah: buka sesi, muat roti dari gudang produksi ke gudang OTR, jualan lewat layar kasir bergambar, lalu tutup sesi dan sisa yang tidak laku kembali ke gudang produksi. Aturan yang dijaga database: dimuat sama dengan terjual ditambah dikembalikan ditambah selisih, dan selisih wajib diberi catatan. Harga di layar kasir dihitung dengan rumus yang sama persis dengan trigger penyimpanan, termasuk potongan promo, jadi angka yang ditagih dan angka yang tercatat tidak mungkin berbeda. Stok OTR dijaga tidak bisa minus. Tampilan PC dan HP sama-sama digarap: di HP keranjang menempel di kaki layar.";
