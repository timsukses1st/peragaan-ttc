"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useProfile } from "@/components/AuthGate";
import { Card, Tombol, Input, AreaTeks, Pilih, Pesan, Modal, Tabel, Td } from "@/components/ui";
import { rupiah, angka } from "@/lib/api";
import { LABEL_METODE, METODE_BAYAR, type MetodeBayar } from "@/lib/api-penjualan";
import {
  apiOtr, LABEL_STATUS_SESI,
  type SesiOtr, type BarisKatalog, type BarisStok, type BarisRekap,
} from "@/lib/api-otr";
import type { LokaRole } from "@/lib/types";

/* =====================================================================
   Layar kasir OTR (jualan keliling).

   Daftar peran di bawah ini DISALIN dari gerbang fungsi database
   (fn_otr_buka_sesi, fn_otr_muat, fn_otr_kembali, fn_otr_tutup), yang
   semuanya memakai fn_has_role('admin','superadmin','gudang','sales').

   Kalau daftar di sini lebih sempit daripada yang diizinkan database,
   ada peran yang berhak tapi tidak pernah bisa sampai ke layarnya, dan
   fiturnya terkubur tanpa ada yang sadar. Itu pernah kejadian di v69
   dengan Log Aktivitas.

   Menyembunyikan menu BUKAN pengaman. Pengamannya tetap dua: penjaga di
   halaman ini, dan RLS plus gerbang peran di database.
   ===================================================================== */
const PERAN_BOLEH: LokaRole[] = ["superadmin", "admin", "gudang", "sales"];

export default function OtrPage() {
  /* Pembungkus tipis, SENGAJA tidak memanggil useProfile().

     AuthGate adalah penyedia konteks profil dan letaknya DI DALAM
     AppShell. Komponen yang merender <AppShell> berada di atas
     penyedianya, jadi useProfile() di sini akan selalu mengembalikan
     null tanpa peringatan apa pun. */
  return (
    <AppShell>
      <IsiOtr />
    </AppShell>
  );
}

function IsiOtr() {
  const { profile } = useProfile();

  /* SEMUA hook berdiri di atas penjaga peran. Kalau ditaruh di bawahnya,
     peran yang ditolak memanggil hook lebih sedikit daripada peran yang
     diizinkan, dan React melarang jumlah hook berubah antar-render. */
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const [kanal, setKanal] = useState<string | null>(null);
  const [sesi, setSesi] = useState<SesiOtr | null>(null);
  const [katalog, setKatalog] = useState<BarisKatalog[]>([]);
  const [riwayat, setRiwayat] = useState<SesiOtr[]>([]);

  const [keranjang, setKeranjang] = useState<Record<string, number>>({});
  const [cari, setCari] = useState("");
  const [tampilSemua, setTampilSemua] = useState(false);
  const [dialog, setDialog] = useState<"muat" | "tutup" | "bayar" | null>(null);

  const muatUlang = useCallback(async (diamkanPesan = false) => {
    try {
      if (!diamkanPesan) setGalat(null);
      const idKanal = await apiOtr.kanalOtr();
      setKanal(idKanal);
      const [s, k, r] = await Promise.all([
        apiOtr.sesiAktif(),
        apiOtr.katalog(idKanal),
        apiOtr.daftarSesi(10),
      ]);
      setSesi(s);
      setKatalog(k);
      setRiwayat(r);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => { muatUlang(); }, [muatUlang]);

  const petaKatalog = useMemo(
    () => new Map(katalog.map((b) => [b.product_id, b])), [katalog]);

  const isiKeranjang = useMemo(
    () => Object.entries(keranjang)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => ({ baris: petaKatalog.get(id), qty: q }))
      .filter((x): x is { baris: BarisKatalog; qty: number } => Boolean(x.baris)),
    [keranjang, petaKatalog]);

  const totalKeranjang = useMemo(
    () => isiKeranjang.reduce((s, x) => s + (x.baris.harga_bersih ?? 0) * x.qty, 0),
    [isiKeranjang]);

  const jumlahBarang = useMemo(
    () => isiKeranjang.reduce((s, x) => s + x.qty, 0), [isiKeranjang]);

  const terlihat = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return katalog.filter((b) => {
      if (!tampilSemua && b.stok <= 0) return false;
      if (!kata) return true;
      return b.name.toLowerCase().includes(kata) || b.sku.toLowerCase().includes(kata);
    });
  }, [katalog, cari, tampilSemua]);

  const adaStokOtr = useMemo(() => katalog.some((b) => b.stok > 0), [katalog]);

  function ubahQty(id: string, qty: number) {
    const baris = petaKatalog.get(id);
    if (!baris) return;
    const batas = Math.max(0, Math.floor(baris.stok));
    const aman = Math.max(0, Math.min(Math.floor(qty), batas));
    setKeranjang((k) => {
      const baru = { ...k };
      if (aman <= 0) delete baru[id]; else baru[id] = aman;
      return baru;
    });
  }

  async function jalankan(kerja: () => Promise<void>, sukses?: string) {
    setSibuk(true);
    setGalat(null);
    setPesan(null);
    try {
      await kerja();
      if (sukses) setPesan(sukses);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally {
      setSibuk(false);
    }
  }

  // ---- penjaga peran, semua hook sudah dipanggil di atas ----
  if (profile && !PERAN_BOLEH.includes(profile.role)) {
    return (
      <Card>
        <h1 className="text-lg font-semibold mb-1">Kasir OTR</h1>
        <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
          Halaman ini khusus peran Superadmin, Admin, Gudang, dan Sales.
          Peran Anda sekarang {profile.role}.
        </p>
      </Card>
    );
  }

  if (memuat) {
    return <Card><span style={{ color: "var(--ink-muted)" }}>Memuat...</span></Card>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold">Kasir OTR</h1>
          <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
            Jualan keliling. Stok diambil dari gudang produksi, sisanya dikembalikan
            waktu sesi ditutup.
          </p>
        </div>
        {sesi && (
          <div className="flex gap-2">
            <Tombol onClick={() => setDialog("muat")} disabled={sibuk}>Muat Stok</Tombol>
            <Tombol tipe="bahaya" onClick={() => setDialog("tutup")} disabled={sibuk}>
              Tutup Sesi
            </Tombol>
          </div>
        )}
      </div>

      {galat && <Pesan tipe="galat">{galat}</Pesan>}
      {pesan && <Pesan tipe="sukses">{pesan}</Pesan>}

      {!sesi ? (
        <TanpaSesi
          sibuk={sibuk}
          riwayat={riwayat}
          onBuka={(catatan) => jalankan(async () => {
            await apiOtr.bukaSesi(profile?.id ?? null, catatan);
            await muatUlang(true);
          }, "Sesi OTR dibuka. Langkah berikutnya: Muat Stok.")}
        />
      ) : (
        <>
          <KartuSesi sesi={sesi} />

          {!adaStokOtr && (
            <Pesan tipe="peringatan">
              Gudang OTR masih kosong. Tekan <strong>Muat Stok</strong> dulu untuk
              memindahkan roti dari gudang produksi.
            </Pesan>
          )}

          <div className="flex gap-4 items-start max-md:flex-col">
            <div className="flex-1 min-w-0 flex flex-col gap-3">
              <div className="flex gap-3 items-end flex-wrap">
                <div className="flex-1 min-w-0">
                  <Input label="Cari produk" value={cari} onChange={setCari}
                         placeholder="Nama atau SKU" />
                </div>
                <label className="text-sm flex items-center gap-2 sentuh">
                  <input type="checkbox" checked={tampilSemua}
                         onChange={(e) => setTampilSemua(e.target.checked)} />
                  <span style={{ color: "var(--ink-secondary)" }}>
                    Tampilkan yang stoknya habis
                  </span>
                </label>
              </div>

              {terlihat.length === 0 ? (
                <Card>
                  <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
                    {katalog.length === 0
                      ? "Belum ada produk aktif."
                      : "Tidak ada produk yang cocok. Hapus kata pencarian, atau centang Tampilkan yang stoknya habis."}
                  </span>
                </Card>
              ) : (
                <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2 max-lg:grid-cols-3">
                  {terlihat.map((b) => (
                    <KartuProduk
                      key={b.product_id}
                      baris={b}
                      diKeranjang={keranjang[b.product_id] ?? 0}
                      onTambah={() => ubahQty(b.product_id, (keranjang[b.product_id] ?? 0) + 1)}
                    />
                  ))}
                </div>
              )}
            </div>

            <Keranjang
              isi={isiKeranjang}
              total={totalKeranjang}
              jumlah={jumlahBarang}
              sibuk={sibuk}
              onUbah={ubahQty}
              onKosongkan={() => setKeranjang({})}
              onBayar={() => setDialog("bayar")}
            />
          </div>
        </>
      )}

      {dialog === "muat" && sesi && (
        <DialogMuat
          sibuk={sibuk}
          onTutup={() => setDialog(null)}
          onSimpan={(items) => jalankan(async () => {
            await apiOtr.muat(sesi.id, items);
            /* Begitu ada yang dimuat, sesinya otomatis masuk tahap jualan.
               Tombol "Mulai Jualan" terpisah cuma menambah satu langkah
               yang jawabannya selalu sama. Muat tambahan di tengah sesi
               tetap boleh, jadi tidak ada yang hilang. */
            if (sesi.status === "muat") await apiOtr.mulaiJualan(sesi.id);
            await muatUlang(true);
            setDialog(null);
          }, "Stok sudah dipindah ke gudang OTR.")}
        />
      )}

      {dialog === "tutup" && sesi && (
        <DialogTutup
          sesiId={sesi.id}
          sibuk={sibuk}
          onTutup={() => setDialog(null)}
          onSimpan={(items, catatan) => jalankan(async () => {
            await apiOtr.tutup(sesi.id, items, catatan);
            setKeranjang({});
            await muatUlang(true);
            setDialog(null);
          }, "Sesi ditutup. Sisa roti sudah dikembalikan ke gudang produksi.")}
        />
      )}

      {dialog === "bayar" && sesi && kanal && (
        <DialogBayar
          isi={isiKeranjang}
          total={totalKeranjang}
          sibuk={sibuk}
          onTutup={() => setDialog(null)}
          onSimpan={(metode, catatan) => jalankan(async () => {
            await apiOtr.simpanJualan(
              sesi.id, kanal, metode,
              isiKeranjang.map((x) => ({
                product_id: x.baris.product_id,
                qty: x.qty,
                harga_kotor: x.baris.harga_kotor ?? 0,
              })),
              catatan,
            );
            setKeranjang({});
            setDialog(null);
            if (kanal) setKatalog(await apiOtr.katalog(kanal));
          }, `Penjualan ${rupiah(totalKeranjang)} tersimpan.`)}
        />
      )}
    </div>
  );
}

/* ===================================================================== */

function KartuSesi({ sesi }: { sesi: SesiOtr }) {
  return (
    <Card>
      <div className="flex items-center gap-4 flex-wrap text-sm">
        <div>
          <div className="text-xs" style={{ color: "var(--ink-muted)" }}>Sesi</div>
          <div className="font-semibold tabular-nums">{sesi.kode}</div>
        </div>
        <div>
          <div className="text-xs" style={{ color: "var(--ink-muted)" }}>Status</div>
          <div style={{ color: "var(--brand)", fontWeight: 600 }}>
            {LABEL_STATUS_SESI[sesi.status]}
          </div>
        </div>
        <div>
          <div className="text-xs" style={{ color: "var(--ink-muted)" }}>Dibuka</div>
          <div className="tabular-nums">
            {new Date(sesi.dibuka_at).toLocaleString("id-ID", {
              day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          </div>
        </div>
        {sesi.catatan && (
          <div className="min-w-0">
            <div className="text-xs" style={{ color: "var(--ink-muted)" }}>Catatan</div>
            <div className="truncate">{sesi.catatan}</div>
          </div>
        )}
      </div>
    </Card>
  );
}

function TanpaSesi({ sibuk, riwayat, onBuka }: {
  sibuk: boolean; riwayat: SesiOtr[]; onBuka: (catatan: string) => void;
}) {
  const [catatan, setCatatan] = useState("");
  return (
    <>
      <Card>
        <h2 className="font-semibold mb-1">Belum ada sesi yang berjalan</h2>
        <p className="text-sm mb-3" style={{ color: "var(--ink-secondary)" }}>
          Satu sesi untuk satu kali keliling. Buka sesi dulu, muat roti dari gudang
          produksi, baru bisa jualan. Sisa yang tidak laku dikembalikan waktu sesi
          ditutup.
        </p>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-0" style={{ maxWidth: "28rem" }}>
            <Input label="Catatan (boleh dikosongkan)" value={catatan} onChange={setCatatan}
                   placeholder="Misal: rute pasar pagi" />
          </div>
          <Tombol tipe="utama" disabled={sibuk} onClick={() => onBuka(catatan)}>
            Buka Sesi
          </Tombol>
        </div>
      </Card>

      {riwayat.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-2">Sesi terakhir</h2>
          <Tabel head={["Kode", "Tanggal", "Status", "Ditutup", "Catatan"]}
                 kosong="Belum ada sesi.">
            {riwayat.map((s) => (
              <tr key={s.id}>
                <Td>{s.kode}</Td>
                <Td>{new Date(s.tanggal).toLocaleDateString("id-ID",
                  { day: "2-digit", month: "short", year: "numeric" })}</Td>
                <Td>{LABEL_STATUS_SESI[s.status]}</Td>
                <Td>{s.ditutup_at
                  ? new Date(s.ditutup_at).toLocaleString("id-ID",
                      { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                  : "-"}</Td>
                <Td>{s.catatan ?? "-"}</Td>
              </tr>
            ))}
          </Tabel>
        </Card>
      )}
    </>
  );
}

/* Kartu produk. Foto dipasang sebagai latar div, bukan tag gambar, supaya
   tidak perlu mendaftarkan domain gambar di konfigurasi Next dan tidak
   ada tata letak yang melompat waktu gambarnya baru selesai diunduh.
   Selama foto belum ada, yang tampil inisial namanya. */
function KartuProduk({ baris, diKeranjang, onTambah }: {
  baris: BarisKatalog; diKeranjang: number; onTambah: () => void;
}) {
  const habis = baris.stok <= 0;
  const tanpaHarga = baris.harga_bersih === null;
  const penuh = diKeranjang >= Math.floor(baris.stok);
  const mati = habis || tanpaHarga || penuh;

  const inisial = baris.name.split(/\s+/).slice(0, 2)
    .map((k) => k[0] ?? "").join("").toUpperCase();

  return (
    <button
      type="button"
      onClick={onTambah}
      disabled={mati}
      title={tanpaHarga ? "Harga jual belum diatur untuk produk ini"
            : habis ? "Stok OTR habis"
            : penuh ? "Semua stok sudah masuk keranjang" : `Tambah ${baris.name}`}
      className="sentuh rounded-xl border p-2 text-left flex flex-col gap-1.5
                 disabled:opacity-45 relative"
      style={{
        borderColor: diKeranjang > 0 ? "var(--brand)" : "var(--border)",
        background: diKeranjang > 0 ? "var(--brand-soft)" : "var(--surface)",
      }}
    >
      {diKeranjang > 0 && (
        <span className="absolute right-1.5 top-1.5 rounded-full px-1.5 text-xs font-semibold
                         tabular-nums"
              style={{ background: "var(--brand)", color: "var(--ink-on-brand)" }}>
          {diKeranjang}
        </span>
      )}

      <div className="w-full rounded-lg flex items-center justify-center text-base font-semibold"
           style={{
             aspectRatio: "4 / 3",
             background: baris.foto_url ? `center/cover no-repeat url(${JSON.stringify(baris.foto_url)})`
                                        : "var(--surface-sunken)",
             color: "var(--ink-muted)",
           }}>
        {baris.foto_url ? "" : inisial}
      </div>

      <div className="text-sm leading-tight line-clamp-2">{baris.name}</div>

      <div className="text-sm font-semibold tabular-nums">
        {tanpaHarga ? "Harga belum diatur" : rupiah(baris.harga_bersih)}
      </div>

      {baris.potongan > 0 && (
        <div className="text-xs tabular-nums" style={{ color: "var(--ink-muted)" }}>
          <s>{rupiah(baris.harga_kotor)}</s> promo
        </div>
      )}

      <div className="text-xs tabular-nums"
           style={{ color: habis ? "var(--status-critical)" : "var(--ink-muted)" }}>
        Stok OTR {angka(baris.stok)} {baris.unit}
      </div>
    </button>
  );
}

function Keranjang({ isi, total, jumlah, sibuk, onUbah, onKosongkan, onBayar }: {
  isi: { baris: BarisKatalog; qty: number }[];
  total: number; jumlah: number; sibuk: boolean;
  onUbah: (id: string, qty: number) => void;
  onKosongkan: () => void;
  onBayar: () => void;
}) {
  return (
    /* Di PC keranjang menempel di kanan dan ikut menggulung. Di HP dia
       pindah ke bawah grid dan menempel di kaki layar, supaya tombol
       Bayar tidak perlu dicari dengan menggulung 60 produk.

       Dipakai sticky, BUKAN fixed. Fixed menghitung posisinya terhadap
       leluhur terdekat yang punya transform, dan panel menu HP memakai
       transform. Sticky tidak punya masalah itu sama sekali. */
    <div className="w-80 shrink-0 max-md:w-full max-md:sticky max-md:bottom-0 max-md:z-30">
      <Card>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Keranjang</h2>
          {isi.length > 0 && (
            <button onClick={onKosongkan} className="text-xs underline"
                    style={{ color: "var(--ink-muted)" }}>
              Kosongkan
            </button>
          )}
        </div>

        {isi.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            Ketuk produk di sebelah kiri untuk menambahkan.
          </p>
        ) : (
          <div className="flex flex-col gap-2 mb-3 max-h-80 overflow-y-auto max-md:max-h-44">
            {isi.map(({ baris, qty }) => (
              <div key={baris.product_id} className="flex items-center gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="truncate">{baris.name}</div>
                  <div className="text-xs tabular-nums" style={{ color: "var(--ink-muted)" }}>
                    {rupiah(baris.harga_bersih)} x {qty}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onUbah(baris.product_id, qty - 1)}
                          aria-label={`Kurangi ${baris.name}`}
                          className="sentuh rounded-lg border px-2"
                          style={{ borderColor: "var(--border)" }}>-</button>
                  <span className="w-7 text-center tabular-nums">{qty}</span>
                  <button onClick={() => onUbah(baris.product_id, qty + 1)}
                          aria-label={`Tambah ${baris.name}`}
                          disabled={qty >= Math.floor(baris.stok)}
                          className="sentuh rounded-lg border px-2 disabled:opacity-40"
                          style={{ borderColor: "var(--border)" }}>+</button>
                </div>
                <div className="w-20 text-right tabular-nums shrink-0">
                  {rupiah((baris.harga_bersih ?? 0) * qty)}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-2 mb-3"
             style={{ borderColor: "var(--border)" }}>
          <span className="text-sm" style={{ color: "var(--ink-secondary)" }}>
            {jumlah} barang
          </span>
          <span className="text-lg font-semibold tabular-nums">{rupiah(total)}</span>
        </div>

        <Tombol tipe="utama" disabled={isi.length === 0 || sibuk} onClick={onBayar}>
          Bayar
        </Tombol>
      </Card>
    </div>
  );
}

/* ===================================================================== */

function DialogBayar({ isi, total, sibuk, onTutup, onSimpan }: {
  isi: { baris: BarisKatalog; qty: number }[];
  total: number; sibuk: boolean;
  onTutup: () => void;
  onSimpan: (metode: MetodeBayar, catatan: string) => void;
}) {
  const [metode, setMetode] = useState<MetodeBayar>("tunai");
  const [catatan, setCatatan] = useState("");

  return (
    <Modal judul="Pembayaran" onTutup={onTutup}>
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
          {isi.map(({ baris, qty }) => (
            <div key={baris.product_id} className="flex justify-between text-sm gap-3">
              <span className="min-w-0 truncate">{baris.name} x {qty}</span>
              <span className="tabular-nums shrink-0">
                {rupiah((baris.harga_bersih ?? 0) * qty)}
              </span>
            </div>
          ))}
          <div className="flex justify-between border-t mt-2 pt-2 font-semibold"
               style={{ borderColor: "var(--border)" }}>
            <span>Total</span>
            <span className="tabular-nums">{rupiah(total)}</span>
          </div>
        </div>

        <Pilih
          label="Cara bayar"
          value={metode}
          onChange={(v) => setMetode(v as MetodeBayar)}
          options={METODE_BAYAR.map((m) => ({ value: m, label: LABEL_METODE[m] }))}
        />

        <AreaTeks label="Catatan (boleh dikosongkan)" value={catatan} onChange={setCatatan}
                  baris={2} placeholder="Misal: nama pembeli atau lokasi" />

        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
          Jualan keliling selalu dicatat lunas di tempat. Kalau ada yang ngutang,
          catat lewat menu Penjualan biasa, karena piutang butuh jatuh tempo.
        </p>

        <div className="flex gap-2 justify-end">
          <Tombol onClick={onTutup} disabled={sibuk}>Batal</Tombol>
          <Tombol tipe="utama" disabled={sibuk}
                  onClick={() => onSimpan(metode, catatan)}>
            Simpan Penjualan
          </Tombol>
        </div>
      </div>
    </Modal>
  );
}

function DialogMuat({ sibuk, onTutup, onSimpan }: {
  sibuk: boolean;
  onTutup: () => void;
  onSimpan: (items: { product_id: string; qty: number }[]) => void;
}) {
  const [stok, setStok] = useState<BarisStok[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [jumlah, setJumlah] = useState<Record<string, string>>({});
  const [cari, setCari] = useState("");

  useEffect(() => {
    apiOtr.stokProduksi()
      .then(setStok)
      .catch((e) => setGalat(e instanceof Error ? e.message : String(e)));
  }, []);

  const terlihat = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return (stok ?? []).filter((b) => {
      if (b.stok <= 0) return false;
      if (!kata) return true;
      return b.name.toLowerCase().includes(kata) || b.sku.toLowerCase().includes(kata);
    });
  }, [stok, cari]);

  const items = useMemo(
    () => Object.entries(jumlah)
      .map(([product_id, teks]) => ({ product_id, qty: Math.floor(Number(teks) || 0) }))
      .filter((x) => x.qty > 0),
    [jumlah]);

  const totalPcs = items.reduce((s, x) => s + x.qty, 0);

  return (
    <Modal judul="Muat stok ke OTR" onTutup={onTutup} lebar="lebar">
      <div className="flex flex-col gap-3">
        <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
          Roti pindah dari gudang produksi ke gudang OTR. Yang tidak laku nanti
          dikembalikan waktu sesi ditutup, jadi tidak ada yang hilang dari hitungan.
        </p>

        {galat && <Pesan tipe="galat">{galat}</Pesan>}

        <Input label="Cari produk" value={cari} onChange={setCari}
               placeholder="Nama atau SKU" />

        {stok === null ? (
          <span className="text-sm" style={{ color: "var(--ink-muted)" }}>Memuat stok...</span>
        ) : terlihat.length === 0 ? (
          <Pesan tipe="peringatan">
            Tidak ada stok barang jadi di gudang produksi yang cocok. Catat produksi
            dulu di menu Produksi.
          </Pesan>
        ) : (
          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
            {terlihat.map((b) => (
              <div key={b.product_id} className="flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="truncate">{b.name}</div>
                  <div className="text-xs tabular-nums" style={{ color: "var(--ink-muted)" }}>
                    {b.sku} &middot; stok produksi {angka(b.stok)} {b.unit}
                  </div>
                </div>
                <input
                  type="number" min={0} max={Math.floor(b.stok)} inputMode="numeric"
                  aria-label={`Jumlah muat ${b.name}`}
                  value={jumlah[b.product_id] ?? ""}
                  placeholder="0"
                  onChange={(e) => setJumlah((j) => ({ ...j, [b.product_id]: e.target.value }))}
                  className="w-24 shrink-0 rounded-lg border px-3 py-2 text-right tabular-nums"
                  style={{ borderColor: "var(--border)", background: "var(--surface-sunken)",
                           color: "var(--ink)" }}
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-2"
             style={{ borderColor: "var(--border)" }}>
          <span className="text-sm" style={{ color: "var(--ink-secondary)" }}>
            Total dimuat
          </span>
          <span className="font-semibold tabular-nums">{angka(totalPcs)} pcs</span>
        </div>

        <div className="flex gap-2 justify-end">
          <Tombol onClick={onTutup} disabled={sibuk}>Batal</Tombol>
          <Tombol tipe="utama" disabled={sibuk || items.length === 0}
                  onClick={() => onSimpan(items)}>
            Muat ke OTR
          </Tombol>
        </div>
      </div>
    </Modal>
  );
}

function DialogTutup({ sesiId, sibuk, onTutup, onSimpan }: {
  sesiId: string; sibuk: boolean;
  onTutup: () => void;
  onSimpan: (items: { product_id: string; qty: number }[], catatan: string) => void;
}) {
  const [rekap, setRekap] = useState<BarisRekap[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [kembali, setKembali] = useState<Record<string, string>>({});
  const [catatan, setCatatan] = useState("");

  useEffect(() => {
    apiOtr.rekapSesi(sesiId)
      .then((r) => {
        setRekap(r);
        /* Kotak isian diisi duluan dengan sisanya, karena 9 dari 10 kali
           memang semua sisa dikembalikan. Yang jarang terjadi (ada yang
           rusak atau hilang) tinggal dikurangi, dan itu memaksa orangnya
           sadar sedang mencatat selisih. */
        const awal: Record<string, string> = {};
        for (const b of r) if (b.sisa > 0) awal[b.product_id] = String(b.sisa);
        setKembali(awal);
      })
      .catch((e) => setGalat(e instanceof Error ? e.message : String(e)));
  }, [sesiId]);

  const items = useMemo(
    () => Object.entries(kembali)
      .map(([product_id, teks]) => ({ product_id, qty: Math.floor(Number(teks) || 0) }))
      .filter((x) => x.qty > 0),
    [kembali]);

  const petaKembali = useMemo(
    () => new Map(items.map((x) => [x.product_id, x.qty])), [items]);

  const selisih = useMemo(
    () => (rekap ?? []).reduce(
      (s, b) => s + (b.sisa - (petaKembali.get(b.product_id) ?? 0)), 0),
    [rekap, petaKembali]);

  const perluCatatan = selisih !== 0 && catatan.trim() === "";

  return (
    <Modal judul="Tutup sesi OTR" onTutup={onTutup} lebar="lebar">
      <div className="flex flex-col gap-3">
        <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
          Aturannya: <strong>dimuat = terjual + dikembalikan + selisih</strong>.
          Selisih boleh ada, tapi harus ada penjelasannya.
        </p>

        {galat && <Pesan tipe="galat">{galat}</Pesan>}

        {rekap === null ? (
          <span className="text-sm" style={{ color: "var(--ink-muted)" }}>Memuat rekap...</span>
        ) : rekap.length === 0 ? (
          <Pesan tipe="peringatan">
            Sesi ini belum pernah dimuat apa pun, jadi tidak ada yang perlu
            dikembalikan. Tekan Tutup Sesi untuk menyelesaikannya.
          </Pesan>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <Tabel head={["Produk", "Dimuat", "Terjual", "Sisa", "Dikembalikan"]}
                   kananKolom={[1, 2, 3, 4]} kosong="Kosong.">
              {rekap.map((b) => (
                <tr key={b.product_id}>
                  <Td>{b.name}</Td>
                  <Td kanan>{angka(b.dimuat)}</Td>
                  <Td kanan>{angka(b.terjual)}</Td>
                  <Td kanan>{angka(b.sisa)}</Td>
                  <Td kanan>
                    <input
                      type="number" min={0} max={b.sisa} inputMode="numeric"
                      aria-label={`Jumlah dikembalikan ${b.name}`}
                      value={kembali[b.product_id] ?? ""}
                      placeholder="0"
                      onChange={(e) => setKembali((k) =>
                        ({ ...k, [b.product_id]: e.target.value }))}
                      className="w-24 rounded-lg border px-2 py-1 text-right tabular-nums"
                      style={{ borderColor: "var(--border)",
                               background: "var(--surface-sunken)", color: "var(--ink)" }}
                    />
                  </Td>
                </tr>
              ))}
            </Tabel>
          </div>
        )}

        {selisih !== 0 && (
          <Pesan tipe="peringatan">
            Masih ada selisih {angka(selisih)} pcs yang tidak terjual dan tidak
            dikembalikan. Isi catatan di bawah untuk menjelaskannya, misal roti
            rusak, jatuh, atau hilang.
          </Pesan>
        )}

        <AreaTeks
          label={selisih !== 0 ? "Catatan selisih (wajib)" : "Catatan (boleh dikosongkan)"}
          value={catatan} onChange={setCatatan} baris={2}
          placeholder="Misal: 2 pcs jatuh waktu bongkar"
        />

        <div className="flex gap-2 justify-end">
          <Tombol onClick={onTutup} disabled={sibuk}>Batal</Tombol>
          <Tombol tipe="bahaya" disabled={sibuk || perluCatatan}
                  onClick={() => onSimpan(items, catatan)}>
            Tutup Sesi
          </Tombol>
        </div>
      </div>
    </Modal>
  );
}
