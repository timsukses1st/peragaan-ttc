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

export const VERSI = "v79";
export const VERSI_TANGGAL = "28 Oktober 2026";
export const VERSI_ISI = "Fondasi gudang OTR dipasang di database: stok barang jadi sekarang punya lokasi (produksi atau OTR), ada sesi jualan dengan aturan dimuat = terjual + dikembalikan + selisih, dan selisih wajib diberi catatan waktu sesi ditutup. Penjualan yang menempel ke sesi OTR memotong stok OTR, penjualan lain tetap memotong gudang produksi seperti sebelumnya. Di layar ditambah Lihat sebagai di topbar: Superadmin bisa melihat tampilan peran lain tanpa keluar akun, lengkap dengan pita peringatan bahwa yang berubah cuma menu dan tombol, bukan hak data. Sekalian ditutup satu lubang izin: tabel sesi_otr sempat bisa ditulis siapa pun yang login karena RLS-nya belum dinyalakan";
