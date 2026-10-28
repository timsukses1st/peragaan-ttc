"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useProfile } from "./AuthGate";
import { VERSI, VERSI_TANGGAL, VERSI_ISI } from "@/lib/versi";
import { apiKeuangan, type RingkasTagihan } from "@/lib/api-keuangan";
import type { LokaRole } from "@/lib/types";

/* Ikon garis sederhana, ditulis langsung sebagai SVG supaya tidak
   perlu menambah pustaka ikon (dan tidak menambah ukuran unduhan). */
const ikon = (d: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.6"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const IkonDashboard = ikon(
  <>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </>
);

const IkonMasterData = ikon(
  <>
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
    <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
  </>
);

const IkonProduksi = ikon(
  <>
    <path d="M3 20h18" />
    <path d="M5 20V9l5 3.5V9l5 3.5V9l4 2.5V20" />
    <path d="M9 20v-3.5h3V20" />
  </>
);

const IkonInventory = ikon(
  <>
    <path d="M3 8l9-4 9 4v8l-9 4-9-4V8z" />
    <path d="M3 8l9 4 9-4" />
    <path d="M12 12v8" />
  </>
);

const IkonPenjualan = ikon(
  <>
    <path d="M3 6h2l2.2 10.2a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.6L20 9H6" />
    <circle cx="10" cy="20" r="1.2" />
    <circle cx="17" cy="20" r="1.2" />
  </>
);

/* Gerobak keliling. Sengaja dibuat beda jelas dari ikon Penjualan yang
   bentuknya keranjang belanja, karena dua menu itu bertetangga dan
   sama-sama soal jualan. */
const IkonOtr = ikon(
  <>
    <rect x="2.5" y="7" width="12" height="8" rx="1.5" />
    <path d="M14.5 10h3l3 3v2h-6z" />
    <circle cx="7" cy="18" r="1.8" />
    <circle cx="17" cy="18" r="1.8" />
  </>
);

const IkonWaste = ikon(
  <>
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7l1 12a2 2 0 0 0 2 1.8h6A2 2 0 0 0 17 19L18 7" />
    <path d="M10 11v6M14 11v6" />
  </>
);

const IkonKeuangan = ikon(
  <>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 12h.01M18 12h.01" />
  </>
);

const IkonAnalitik = ikon(
  <>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </>
);

const IkonPengguna = ikon(
  <>
    <path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" />
    <circle cx="9.5" cy="7.5" r="3.5" />
    <path d="M17 11h4M19 9v4" />
  </>
);

const IkonLaporanHpp = ikon(
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h4" />
  </>
);

const IkonPromo = ikon(
  <>
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2a2 2 0 0 1-.6-1.4V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l7.4 7.4a2 2 0 0 1 0 2.8z" />
    <circle cx="7.5" cy="7.5" r="1.2" />
  </>
);

const IkonPengaturan = ikon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7.1 19.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 13.6H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 7.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </>
);

const IkonLog = ikon(
  <>
    <path d="M12 8v4l3 2" />
    <circle cx="12" cy="12" r="9" />
  </>
);

const IkonEkspor = ikon(
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </>
);

const MENU: {
  href: string; label: string; ikon: ReactNode; siap: boolean;
  /** Kalau diisi, menu ini cuma muncul untuk peran yang tercantum. */
  peran?: LokaRole[];
}[] = [
  { href: "/",             label: "Dashboard",            ikon: IkonDashboard,  siap: true  },
  { href: "/master-data",  label: "Master Data",          ikon: IkonMasterData, siap: true  },
  { href: "/laporan-hpp",  label: "Laporan HPP",          ikon: IkonLaporanHpp, siap: true  },
  { href: "/produksi",     label: "Produksi",             ikon: IkonProduksi,   siap: true  },
  { href: "/inventory",    label: "Inventory",            ikon: IkonInventory,  siap: true  },
  { href: "/penjualan",    label: "Penjualan",            ikon: IkonPenjualan,  siap: true  },
  /* Daftar perannya DISALIN dari gerbang fungsi database fn_otr_*, yang
     memakai fn_has_role('admin','superadmin','gudang','sales'). Kalau
     daftar di sini lebih sempit, ada peran yang berhak tapi menunya tidak
     pernah muncul, dan fiturnya terkubur tanpa ada yang sadar. */
  { href: "/otr",          label: "Kasir OTR",            ikon: IkonOtr,        siap: true,
    peran: ["superadmin", "admin", "gudang", "sales"] },
  { href: "/waste-retur",  label: "Waste & Retur",        ikon: IkonWaste,      siap: true  },
  { href: "/keuangan",     label: "Keuangan Operasional", ikon: IkonKeuangan,   siap: true  },
  { href: "/promo",        label: "Promo",                ikon: IkonPromo,      siap: true  },
  { href: "/analitik",     label: "Analitik",             ikon: IkonAnalitik,   siap: true  },
  { href: "/ekspor",       label: "Ekspor Data",          ikon: IkonEkspor,     siap: true  },
  /* Log aktivitas BUKAN bagian Kelola Akses.

     Sempat ditaruh di situ, dan itu salah: halaman Kelola Akses menolak
     semua peran selain superadmin, sementara database justru mengizinkan
     admin dan manajemen membaca log. Jadi dua peran yang berhak tidak
     akan pernah bisa sampai ke layarnya. Sekarang menunya berdiri
     sendiri, dan daftar perannya disamakan persis dengan yang sudah
     diizinkan database. */
  { href: "/log",          label: "Log Aktivitas",        ikon: IkonLog,        siap: true,
    peran: ["superadmin", "admin", "manajemen"] },
  { href: "/pengguna",     label: "Kelola Akses",         ikon: IkonPengguna,   siap: true,
    peran: ["superadmin"] },
  { href: "/pengaturan",   label: "Pengaturan",           ikon: IkonPengaturan, siap: true,
    peran: ["superadmin"] },
];

export default function Sidebar({ buka = false, onTutup }: {
  /** Hanya berlaku di HP. Di md ke atas sidebar selalu tampil menempel. */
  buka?: boolean;
  onTutup?: () => void;
} = {}) {
  const pathname = usePathname();
  const { profile } = useProfile();
  /* Menu tanpa daftar peran terbuka untuk semua. Yang punya daftar cuma
     muncul untuk peran yang tercantum. Menyembunyikan menu bukan pengaman:
     pengamannya tetap penjaga di halamannya dan kebijakan RLS di database. */
  const menu = MENU.filter(
    (m) => !m.peran || (profile?.role ? m.peran.includes(profile.role) : false));

  /* =====================================================================
     Lencana tagihan jatuh tempo.

     Ditaruh di sidebar, bukan cuma di halaman Keuangan, karena peringatan
     yang baru kelihatan setelah orangnya membuka halaman yang tepat bukan
     peringatan: yang lupa menagih justru yang tidak membuka halaman itu.
     Di sidebar, angkanya ikut ke mana pun orangnya pergi.

     Gagal mengambil data DIDIAMKAN. Peran yang memang tidak berhak membaca
     piutang akan dapat daftar kosong, dan sidebar tidak boleh rusak cuma
     gara-gara lencana tambahan.
     ===================================================================== */
  const [tagihan, setTagihan] = useState<RingkasTagihan | null>(null);

  useEffect(() => {
    let batal = false;
    apiKeuangan.ringkasTagihan()
      .then((r) => { if (!batal) setTagihan(r); })
      .catch(() => { if (!batal) setTagihan(null); });
    return () => { batal = true; };
    /* Dihitung ulang tiap pindah halaman, supaya angkanya ikut turun
       begitu pelunasan baru saja dicatat. */
  }, [pathname]);

  const lencana = tagihan && tagihan.lewat > 0
    ? { teks: String(tagihan.lewat), warna: "var(--status-critical)",
        judul: `${tagihan.lewat} tagihan sudah lewat jatuh tempo, paling lama ${tagihan.palingLama} hari` }
    : tagihan && tagihan.dekat > 0
    ? { teks: String(tagihan.dekat), warna: "var(--status-warning)",
        judul: `${tagihan.dekat} tagihan jatuh tempo 3 hari lagi atau kurang` }
    : null;

  /* =====================================================================
     Di HP sidebar jadi panel geser, di PC tetap menempel.

     CARA MENULISNYA: semua tambahan HP pakai awalan `max-md:`, dan kelas
     tanpa awalan dibiarkan APA ADANYA seperti sebelum ini
     (w-60 shrink-0 border-r min-h-screen p-3 flex flex-col). Jadi "PC
     tidak berubah" bisa dibuktikan cuma dengan membaca kelasnya.

     Waktu tertutup, kelasnya `invisible`, bukan cuma digeser ke luar
     layar. Kalau cuma digeser, 13 tautan menu tetap bisa dicapai dengan
     tombol Tab dan tetap dibacakan pembaca layar padahal tidak kelihatan,
     jadi orangnya menekan Tab berkali-kali ke tempat yang tidak ada.
     visibility: hidden mengeluarkannya dari urutan Tab, dan masih bisa
     dianimasikan, tidak seperti display: none.
     ===================================================================== */
  return (
    <>
      {/* Latar gelap, HP saja. Disentuh untuk menutup. */}
      {buka && (
        <div
          onClick={onTutup}
          aria-hidden="true"
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(0,0,0,0.45)" }}
        />
      )}

      <aside
        className={`w-60 shrink-0 border-r min-h-screen p-3 flex flex-col
                    max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50
                    max-md:overflow-y-auto
                    max-md:transition-[transform,visibility] max-md:duration-200
                    ${buka ? "" : "max-md:invisible max-md:-translate-x-full"}`}
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2.5 px-2 py-3">
          <Image src="/logo-loka.png" alt="Loka Bakehouse" width={40} height={40}
                 className="rounded-full shrink-0" priority />
          <div className="min-w-0 max-md:flex-1">
            <div className="wordmark text-lg">LOKA</div>
            <div className="text-[10px] uppercase tracking-[0.18em]"
                 style={{ color: "var(--ink-muted)" }}>
              Bakehouse
            </div>
          </div>
          {/* Tombol tutup di dalam panelnya sendiri. Latar gelap saja tidak
              cukup: di HP lebar 390px panel 240px menyisakan 150px latar,
              dan ibu jari yang memegang HP justru menutupi bagian itu. */}
          <button
            onClick={onTutup}
            aria-label="Tutup menu"
            className="sentuh flex items-center justify-center text-2xl leading-none md:hidden"
            style={{ color: "var(--ink-muted)" }}
          >
            &times;
          </button>
        </div>

      <nav className="mt-3 flex flex-col gap-0.5">
        {menu.map((m) => {
          const aktif = pathname === m.href;
          return (
            <Link
              key={m.href}
              href={m.siap ? m.href : "#"}
              aria-disabled={!m.siap}
              aria-current={aktif ? "page" : undefined}
              /* Menutup panel begitu menunya dipilih. Tanpa ini, di HP
                 halaman barunya terbuka di belakang panel yang masih
                 menutupi layar, dan orangnya harus menutup sendiri. */
              onClick={onTutup}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors max-md:py-2.5"
              style={{
                background: aktif ? "var(--brand-soft)" : "transparent",
                color: aktif ? "var(--brand)" : m.siap ? "var(--ink)" : "var(--ink-muted)",
                fontWeight: aktif ? 600 : 400,
                boxShadow: aktif ? "inset 3px 0 0 var(--brand)" : undefined,
                pointerEvents: m.siap ? "auto" : "none",
                opacity: m.siap ? 1 : 0.65,
              }}
            >
              <span className="shrink-0">{m.ikon}</span>
              <span className="flex-1 leading-tight">{m.label}</span>
              {m.href === "/keuangan" && lencana && (
                <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5 shrink-0"
                      title={lencana.judul}
                      style={{ background: lencana.warna, color: "#fff", minWidth: 18,
                               textAlign: "center" }}>
                  {lencana.teks}
                </span>
              )}
              {!m.siap && (
                <span className="text-[9px] uppercase tracking-wide rounded px-1.5 py-0.5 shrink-0"
                      style={{ color: "var(--ink-muted)", border: "1px solid var(--border)" }}>
                  segera
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Versi build ditaruh di sini supaya bisa dilihat tanpa membuka Vercel.
          Kalau angkanya tidak berubah setelah deploy, berarti build-nya tidak
          naik, bukan fiturnya yang hilang. */}
      <div className="mt-auto px-3 py-2 text-[11px] leading-snug"
           style={{ color: "var(--ink-muted)" }}>
        <div>PT Kahfi Indo Group</div>
        <div className="mt-1 opacity-70" title={VERSI_ISI}>
          {VERSI} &middot; {VERSI_TANGGAL}
        </div>
      </div>
      </aside>
    </>
  );
}
