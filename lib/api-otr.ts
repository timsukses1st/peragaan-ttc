"use client";

import { supabase } from "./supabase";
import type { MetodeBayar } from "./api-penjualan";

/* =====================================================================
   OTR: jualan keliling.

   Alurnya tiga langkah, dan ketiganya harus utuh supaya angkanya bisa
   dipertanggungjawabkan:

     1. BUKA SESI   satu sesi untuk satu kali keliling
     2. MUAT        roti pindah dari gudang produksi ke gudang OTR
     3. JUALAN      tiap penjualan memotong stok OTR, bukan stok produksi
     4. TUTUP SESI  sisa yang tidak laku dikembalikan ke gudang produksi

   Aturan yang dijaga database:

       dimuat = terjual + dikembalikan + selisih

   Selisih boleh ada (roti jatuh, hilang, dimakan), tapi WAJIB ada
   catatannya waktu sesi ditutup.

   Semua perpindahan stok dikerjakan fungsi database, bukan di sini.
   Tabel stock_movements memang cuma punya izin SELECT, jadi layar tidak
   bisa menulis stok walaupun kodenya salah.
   ===================================================================== */

/** Nama kanal penjualan yang dipakai OTR. Harus ada di Master Data, tab Kanal. */
const NAMA_KANAL_OTR = "OTR";

export type StatusSesi = "muat" | "jualan" | "selesai" | "batal";

export const LABEL_STATUS_SESI: Record<StatusSesi, string> = {
  muat: "Sedang dimuat",
  jualan: "Sedang jualan",
  selesai: "Selesai",
  batal: "Dibatalkan",
};

export type SesiOtr = {
  id: string;
  kode: string;
  tanggal: string;
  penjual_id: string | null;
  status: StatusSesi;
  dibuka_at: string;
  ditutup_at: string | null;
  catatan: string | null;
};

/** Satu baris di layar kasir. Harga sudah termasuk potongan promo. */
export type BarisKatalog = {
  product_id: string;
  sku: string;
  name: string;
  unit: string;
  foto_url: string | null;
  stok: number;
  harga_kotor: number | null;
  potongan: number;
  harga_bersih: number | null;
};

export type BarisStok = {
  product_id: string;
  sku: string;
  name: string;
  unit: string;
  stok: number;
};

export type BarisRekap = {
  sesi_id: string;
  kode: string;
  tanggal: string;
  status: StatusSesi;
  product_id: string;
  sku: string;
  name: string;
  unit: string;
  dimuat: number;
  terjual: number;
  dikembalikan: number;
  sisa: number;
};

export type Item = { product_id: string; qty: number };

function lempar(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export const apiOtr = {
  /* -------------------------------------------------------------------
     Kanal OTR.

     Dicari berdasarkan NAMA, bukan id yang ditanam di kode. Id yang
     ditanam di kode akan ikut mati kalau suatu hari database dipindah
     atau kanalnya dibuat ulang, dan matinya diam-diam.

     Konsekuensinya: kalau kanalnya diganti nama, fitur ini berhenti.
     Itu disengaja, dan pesannya menyebutkan persis apa yang harus
     dibetulkan, bukan "terjadi kesalahan".
     ------------------------------------------------------------------- */
  async kanalOtr(): Promise<string> {
    const { data, error } = await supabase
      .from("channels").select("id, name")
      .eq("name", NAMA_KANAL_OTR).eq("is_active", true).maybeSingle();
    lempar(error);
    const id = (data as { id: string } | null)?.id;
    if (!id) {
      throw new Error(
        `Kanal penjualan bernama "${NAMA_KANAL_OTR}" tidak ditemukan atau sedang ` +
        `nonaktif. Buka Master Data, tab Kanal, lalu pastikan ada kanal aktif ` +
        `bernama persis "${NAMA_KANAL_OTR}".`,
      );
    }
    return id;
  },

  /** Sesi yang belum ditutup. Database menjamin paling banyak satu. */
  async sesiAktif(): Promise<SesiOtr | null> {
    const { data, error } = await supabase
      .from("sesi_otr")
      .select("id, kode, tanggal, penjual_id, status, dibuka_at, ditutup_at, catatan")
      .in("status", ["muat", "jualan"])
      .maybeSingle();
    lempar(error);
    return (data ?? null) as SesiOtr | null;
  },

  async daftarSesi(batas = 20): Promise<SesiOtr[]> {
    const { data, error } = await supabase
      .from("sesi_otr")
      .select("id, kode, tanggal, penjual_id, status, dibuka_at, ditutup_at, catatan")
      .order("dibuka_at", { ascending: false })
      .limit(batas);
    lempar(error);
    return (data ?? []) as SesiOtr[];
  },

  async bukaSesi(penjualId?: string | null, catatan?: string | null): Promise<string> {
    const { data, error } = await supabase.rpc("fn_otr_buka_sesi", {
      p_penjual_id: penjualId ?? null,
      p_catatan: catatan?.trim() || null,
    });
    lempar(error);
    return data as string;
  },

  /** Sesi berpindah dari "sedang dimuat" ke "sedang jualan". */
  async mulaiJualan(sesiId: string) {
    const { error } = await supabase
      .from("sesi_otr").update({ status: "jualan" }).eq("id", sesiId);
    lempar(error);
  },

  async muat(sesiId: string, items: Item[]) {
    const isi = items.filter((x) => x.qty > 0);
    if (isi.length === 0) throw new Error("Belum ada jumlah yang diisi.");
    const { error } = await supabase.rpc("fn_otr_muat", {
      p_sesi_id: sesiId, p_items: isi,
    });
    lempar(error);
  },

  async kembali(sesiId: string, items: Item[]) {
    const isi = items.filter((x) => x.qty > 0);
    if (isi.length === 0) throw new Error("Belum ada jumlah yang diisi.");
    const { error } = await supabase.rpc("fn_otr_kembali", {
      p_sesi_id: sesiId, p_items: isi,
    });
    lempar(error);
  },

  /** Mengembalikan sisa sekaligus menutup sesi, dalam satu panggilan. */
  async tutup(sesiId: string, items: Item[], catatan?: string | null) {
    const { error } = await supabase.rpc("fn_otr_tutup", {
      p_sesi_id: sesiId,
      p_items: items.filter((x) => x.qty > 0),
      p_catatan: catatan?.trim() || null,
    });
    lempar(error);
  },

  /** Isi layar kasir: stok OTR dan harga yang benar-benar akan ditagih. */
  async katalog(channelId: string, tanggal?: string): Promise<BarisKatalog[]> {
    const { data, error } = await supabase.rpc("fn_otr_katalog", {
      p_channel_id: channelId,
      ...(tanggal ? { p_tanggal: tanggal } : {}),
    });
    lempar(error);
    return ((data ?? []) as BarisKatalog[]).map((b) => ({
      ...b,
      stok: Number(b.stok ?? 0),
      harga_kotor: b.harga_kotor === null ? null : Number(b.harga_kotor),
      potongan: Number(b.potongan ?? 0),
      harga_bersih: b.harga_bersih === null ? null : Number(b.harga_bersih),
    }));
  },

  /** Stok gudang produksi, dipakai layar Muat supaya tidak memuat melebihi isi gudang. */
  async stokProduksi(): Promise<BarisStok[]> {
    const { data, error } = await supabase
      .from("v_stok_per_lokasi")
      .select("product_id, sku, name, unit, stok")
      .eq("lokasi", "produksi")
      .order("name");
    lempar(error);
    return ((data ?? []) as BarisStok[]).map((b) => ({ ...b, stok: Number(b.stok ?? 0) }));
  },

  async rekapSesi(sesiId: string): Promise<BarisRekap[]> {
    const { data, error } = await supabase
      .from("v_sesi_otr_rekap").select("*").eq("sesi_id", sesiId).order("name");
    lempar(error);
    return ((data ?? []) as BarisRekap[]).map((b) => ({
      ...b,
      dimuat: Number(b.dimuat ?? 0),
      terjual: Number(b.terjual ?? 0),
      dikembalikan: Number(b.dikembalikan ?? 0),
      sisa: Number(b.sisa ?? 0),
    }));
  },

  /* -------------------------------------------------------------------
     Simpan satu penjualan OTR.

     HARGA DIKIRIM DARI LAYAR, dan itu disengaja. Di penjualan biasa harga
     dikosongkan supaya database yang menentukan, tapi di kasir keliling
     uangnya sudah berpindah tangan sebelum tombol Simpan ditekan. Yang
     tercatat harus angka yang tadi ditagih, bukan angka yang kebetulan
     berlaku beberapa detik kemudian kalau ada yang mengubah harga.

     Angka yang dikirim adalah harga KOTOR. Potongan promo tetap dihitung
     database lewat trigger, dan layar sudah menghitung potongan yang sama
     lewat fn_otr_katalog, jadi dua-duanya pasti sepakat.

     Kalau salah satu barisnya gagal, kepala transaksinya dibatalkan lewat
     fn_hapus_penjualan, pola yang sama dengan apiPenjualan.simpanTransaksi.
     Tanpa itu, yang tertinggal adalah nota kosong tanpa isi.
     ------------------------------------------------------------------- */
  async simpanJualan(
    sesiId: string,
    channelId: string,
    metode: MetodeBayar,
    isi: { product_id: string; qty: number; harga_kotor: number }[],
    catatan?: string | null,
  ): Promise<string> {
    if (isi.length === 0) throw new Error("Keranjang masih kosong.");
    for (const x of isi) {
      if (!(x.qty > 0)) throw new Error("Jumlah tiap produk harus lebih dari nol.");
      if (!(x.harga_kotor >= 0)) throw new Error("Harga produk belum diatur, tidak bisa dijual.");
    }

    const hariIni = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

    const { data, error } = await supabase.from("sales_transactions").insert({
      trx_date: hariIni,
      channel_id: channelId,
      outlet_name: null,
      /* Jualan keliling dibayar di tempat, jadi tidak pernah tempo atau DP.
         Kalau suatu hari ada yang ngutang, itu dicatat lewat menu Penjualan
         biasa, bukan di sini, karena piutang butuh jatuh tempo dan penagih. */
      payment_status: "cash",
      metode_bayar: metode,
      due_date: null,
      dp_amount: 0,
      cashback_persen: 0,
      cashback_alasan: null,
      note: catatan?.trim() || null,
      sesi_otr_id: sesiId,
    }).select("id").single();
    lempar(error);

    const id = (data as { id: string }).id;

    const { error: galatIsi } = await supabase.from("sales_items").insert(
      isi.map((x) => ({
        transaction_id: id,
        product_id: x.product_id,
        qty: x.qty,
        unit_price_gross: x.harga_kotor,
      })),
    );

    if (galatIsi) {
      const { error: galatBatal } = await supabase
        .rpc("fn_hapus_penjualan", { p_id: id });
      if (galatBatal) {
        throw new Error(
          `${galatIsi.message} Nota kosongnya gagal dibatalkan otomatis ` +
          `(${galatBatal.message}). Minta Superadmin menghapusnya lewat ` +
          `menu Penjualan.`,
        );
      }
      throw new Error(galatIsi.message);
    }

    return id;
  },

  /** Nota yang sudah tercatat di sesi ini, terbaru di atas. */
  async notaSesi(sesiId: string) {
    const { data, error } = await supabase
      .from("sales_transactions")
      .select("id, trx_date, metode_bayar, note, created_at, sales_items(qty, subtotal_net, products(name))")
      .eq("sesi_otr_id", sesiId)
      .order("created_at", { ascending: false })
      .limit(100);
    lempar(error);
    return (data ?? []) as unknown as {
      id: string; trx_date: string; metode_bayar: MetodeBayar | null;
      note: string | null; created_at: string;
      sales_items: { qty: number; subtotal_net: number; products: { name: string } | null }[];
    }[];
  },
};
