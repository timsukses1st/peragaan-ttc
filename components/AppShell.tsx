"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Sidebar from "./Sidebar";
import AuthGate, { useProfile, PERAN_PRATINJAU } from "./AuthGate";
import DialogUbahSandi from "./DialogUbahSandi";
import PintuCatat from "./PintuCatat";
import { supabase } from "@/lib/supabase";
import { LABEL_PERAN, type Peran } from "@/lib/api-pengguna";
import type { LokaRole } from "@/lib/types";

/** Tombol ganti tema. Pilihan disimpan di browser masing-masing pengguna. */
function TombolTema({ panjang = false }: { panjang?: boolean }) {
  const [gelap, setGelap] = useState(false);

  useEffect(() => {
    setGelap(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function ganti() {
    const baru = !gelap;
    setGelap(baru);
    if (baru) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem("loka-tema", baru ? "dark" : "light");
    } catch {
      // Kalau penyimpanan browser diblokir, tema tetap berganti untuk sesi ini.
    }
  }

  const judul = gelap ? "Ganti ke tema terang" : "Ganti ke tema gelap";

  /* Dua bentuk, satu perilaku. Di topbar PC bentuknya tombol kecil
     bergaris. Di dalam menu HP bentuknya baris penuh selebar menunya,
     supaya seragam dengan baris Ubah Kata Sandi dan Keluar di bawahnya. */
  if (panjang) {
    return (
      <button onClick={ganti} title={judul} aria-label={judul}
              className="sentuh w-full text-left px-3 py-2 text-sm"
              style={{ color: "var(--ink-secondary)" }}>
        {gelap ? "Ganti ke tema terang" : "Ganti ke tema gelap"}
      </button>
    );
  }

  return (
    <button
      onClick={ganti}
      title={judul}
      aria-label={judul}
      className="rounded-lg border px-2.5 py-1 text-xs"
      style={{ borderColor: "var(--border)", color: "var(--ink-secondary)" }}
    >
      {gelap ? "Terang" : "Gelap"}
    </button>
  );
}

/* =====================================================================
   Pengatur ukuran tampilan, HP saja.

   Mencubit untuk memperkecil memang sudah jalan, tapi itu tidak menambah
   isi yang muat: tata letaknya cair, jadi yang didapat cuma versi mungil
   dari isi yang sama ditambah ruang kosong di kanan. Yang ini mengecilkan
   ukuran dasarnya, jadi tata letaknya menghitung ulang dan benar-benar
   memuat lebih banyak baris dan kolom.

   Pilihannya sengaja cuma tiga. Penggeser halus terdengar lebih canggih
   tapi membuat orang mengutak-atik angka yang tidak dia butuhkan, padahal
   yang dicari cuma "agak lebih kecil" atau "jauh lebih kecil".
   ===================================================================== */
const UKURAN = [
  { nilai: "100", label: "100%", ket: "Bawaan" },
  { nilai: "90", label: "90%", ket: "Agak padat" },
  { nilai: "80", label: "80%", ket: "Paling padat" },
] as const;

function PilihUkuran() {
  const [ukuran, setUkuran] = useState("100");

  /* Dibaca dari atribut, bukan dari localStorage, karena skrip di
     app/layout.tsx sudah memasangnya sebelum halaman digambar. Membaca
     atributnya berarti tombolnya pasti sepakat dengan yang terlihat. */
  useEffect(() => {
    setUkuran(document.documentElement.getAttribute("data-ukuran") ?? "100");
  }, []);

  function ganti(n: string) {
    setUkuran(n);
    if (n === "100") document.documentElement.removeAttribute("data-ukuran");
    else document.documentElement.setAttribute("data-ukuran", n);
    try {
      localStorage.setItem("loka-ukuran", n);
    } catch {
      // Penyimpanan diblokir: ukurannya tetap berubah untuk sesi ini saja.
    }
  }

  return (
    <div className="px-3 py-2 border-t" style={{ borderColor: "var(--border)" }}>
      <div className="text-xs mb-1.5" style={{ color: "var(--ink-muted)" }}>
        Ukuran tampilan
      </div>
      <div className="flex gap-1">
        {UKURAN.map((u) => {
          const aktif = ukuran === u.nilai;
          return (
            <button
              key={u.nilai}
              onClick={() => ganti(u.nilai)}
              title={u.ket}
              aria-pressed={aktif}
              className="flex-1 rounded-lg border py-1.5 text-xs"
              style={{
                borderColor: aktif ? "var(--brand)" : "var(--border)",
                background: aktif ? "var(--brand-soft)" : "transparent",
                color: aktif ? "var(--brand)" : "var(--ink-secondary)",
                fontWeight: aktif ? 600 : 400,
              }}
            >
              {u.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* =====================================================================
   "Lihat sebagai" - pratinjau peran.

   Hanya muncul untuk peran ASLI superadmin. Peran lain tidak melihat
   tombol ini sama sekali, dan kalaupun melihatnya pun tidak berguna,
   karena penyamarannya diperiksa ulang di AuthGate memakai peran dari
   database, bukan dari penyimpanan browser.

   Memilih "Superadmin" berarti mematikan pratinjau, bukan menyimpan
   "superadmin" sebagai samaran. Satu keadaan, bukan dua yang artinya
   sama.
   ===================================================================== */
function PilihPeran({ panjang = false }: { panjang?: boolean }) {
  const { profilAsli, peranPratinjau, setPeranPratinjau } = useProfile();

  // Peran asli, bukan peran samaran. Kalau yang dibaca peran samaran,
  // begitu memilih "Sales" tombolnya ikut hilang dan tidak ada jalan pulang.
  if (profilAsli?.role !== "superadmin") return null;

  const nilai: string = peranPratinjau ?? "superadmin";

  function ganti(v: string) {
    setPeranPratinjau(v === "superadmin" ? null : (v as LokaRole));
  }

  const pilihan = PERAN_PRATINJAU.map((p) => (
    <option key={p} value={p}>
      Lihat sebagai: {LABEL_PERAN[p as Peran] ?? p}
    </option>
  ));

  /* Dua bentuk, satu perilaku, sama seperti TombolTema. Di PC tombol
     kecil bergaris di topbar; di menu HP baris penuh selebar menunya. */
  if (panjang) {
    return (
      <div className="px-3 py-2 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="text-xs mb-1.5" style={{ color: "var(--ink-muted)" }}>
          Lihat sebagai
        </div>
        <select
          value={nilai}
          onChange={(e) => ganti(e.target.value)}
          aria-label="Lihat tampilan sebagai peran lain"
          className="sentuh w-full rounded-lg border px-2 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)",
                   color: "var(--ink-secondary)" }}
        >
          {pilihan}
        </select>
      </div>
    );
  }

  return (
    <select
      value={nilai}
      onChange={(e) => ganti(e.target.value)}
      aria-label="Lihat tampilan sebagai peran lain"
      title="Melihat tampilan peran lain tanpa keluar akun. Hak data di database tetap Superadmin."
      className="max-md:hidden rounded-lg border px-2 py-1 text-xs"
      style={{
        borderColor: peranPratinjau ? "var(--status-warning)" : "var(--border)",
        background: peranPratinjau ? "var(--brand-soft)" : "var(--surface)",
        color: peranPratinjau ? "var(--status-warning)" : "var(--ink-secondary)",
        fontWeight: peranPratinjau ? 600 : 400,
      }}
    >
      {pilihan}
    </select>
  );
}

/* =====================================================================
   Pita peringatan selama pratinjau menyala.

   Ada alasan kuat pita ini mencolok dan tidak bisa ditutup: pratinjau
   mengubah menu dan tombol, TIDAK mengubah hak data. Token yang dipakai
   tetap token Superadmin, jadi RLS tetap melihat Superadmin. Layar
   pratinjau bisa menampilkan data yang peran aslinya tidak akan pernah
   dapat, contohnya takaran resep.

   Tanpa pita ini, gampang sekali menyimpulkan "oh ternyata Sales bisa
   lihat resep" padahal yang barusan dilihat adalah hak Superadmin
   dengan tampilan Sales. Kesimpulan salah soal keamanan lebih
   berbahaya daripada tidak punya fiturnya sama sekali.
   ===================================================================== */
function PitaPratinjau() {
  const { peranPratinjau, setPeranPratinjau } = useProfile();
  if (!peranPratinjau) return null;

  const label = LABEL_PERAN[peranPratinjau as Peran] ?? peranPratinjau;

  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b px-6 py-2 text-xs
                 max-md:px-3 max-md:flex-wrap max-md:gap-2"
      style={{ background: "var(--brand-soft)", borderColor: "var(--status-warning)" }}
    >
      <span style={{ color: "var(--status-warning)", fontWeight: 600 }}>
        Mode pratinjau: {label}
      </span>
      <span className="min-w-0" style={{ color: "var(--ink-secondary)" }}>
        Yang berubah cuma menu dan tombol di layar. Hak data Anda tetap Superadmin,
        jadi ini bukan uji keamanan.
      </span>
      <button
        onClick={() => setPeranPratinjau(null)}
        className="sentuh ml-auto shrink-0 rounded-lg border px-2.5 py-1 max-md:ml-0"
        style={{ borderColor: "var(--status-warning)", color: "var(--status-warning)" }}
      >
        Kembali ke Superadmin
      </button>
    </div>
  );
}

/* Garis tiga. Ditaruh di KIRI, bukan kanan, supaya sejajar dengan tepi
   kiri isi halaman dan letaknya terasa sama di semua halaman. */
function IkonMenu() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round"
         aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function IkonTitikTiga() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"
         aria-hidden="true">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

/* =====================================================================
   Menu akun untuk HP.

   Di PC, nama, peran, tema, ubah sandi, dan keluar semuanya berbaris di
   topbar. Di layar 390px lima elemen itu tidak muat, dan topbar lama
   mengandalkan flex-wrap: hasilnya menumpuk jadi tiga baris dan memakan
   sepertiga layar sebelum isi halamannya kelihatan.

   Jadi di HP lima elemen itu dilipat ke satu tombol titik tiga.
   ===================================================================== */
function MenuAkun({ onUbahSandi }: { onUbahSandi: () => void }) {
  const { profile, peranPratinjau } = useProfile();
  const [buka, setBuka] = useState(false);
  const kotak = useRef<HTMLDivElement>(null);

  /* Tertutup kalau disentuh di luar kotaknya atau ditekan Escape. Tanpa
     ini menunya menggantung terbuka sampai halamannya berganti. */
  useEffect(() => {
    if (!buka) return;
    function diLuar(e: MouseEvent) {
      if (kotak.current && !kotak.current.contains(e.target as Node)) setBuka(false);
    }
    function tombol(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setBuka(false);
    }
    document.addEventListener("mousedown", diLuar);
    document.addEventListener("keydown", tombol);
    return () => {
      document.removeEventListener("mousedown", diLuar);
      document.removeEventListener("keydown", tombol);
    };
  }, [buka]);

  return (
    <div className="relative md:hidden" ref={kotak}>
      <button
        onClick={() => setBuka((b) => !b)}
        aria-label="Menu akun"
        aria-expanded={buka}
        className="sentuh flex items-center justify-center rounded-lg border"
        style={{ borderColor: "var(--border)", color: "var(--ink-secondary)" }}
      >
        <IkonTitikTiga />
      </button>

      {buka && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border overflow-hidden z-50"
             style={{ background: "var(--surface)", borderColor: "var(--border)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
          <div className="px-3 py-2 border-b text-sm"
               style={{ borderColor: "var(--border)" }}>
            <div className="font-medium truncate">{profile?.full_name}</div>
            <div className="text-xs"
                 style={{ color: peranPratinjau ? "var(--status-warning)" : "var(--ink-muted)" }}>
              {profile ? LABEL_PERAN[profile.role as Peran] ?? profile.role : ""}
              {peranPratinjau ? " (pratinjau)" : ""}
            </div>
          </div>

          <PilihPeran panjang />

          <PilihUkuran />

          <TombolTema panjang />

          <button onClick={() => { setBuka(false); onUbahSandi(); }}
                  className="sentuh w-full text-left px-3 py-2 text-sm border-t"
                  style={{ borderColor: "var(--border)", color: "var(--ink-secondary)" }}>
            Ubah Kata Sandi
          </button>

          <button onClick={() => supabase.auth.signOut()}
                  className="sentuh w-full text-left px-3 py-2 text-sm border-t"
                  style={{ borderColor: "var(--border)", color: "var(--status-critical)" }}>
            Keluar
          </button>
        </div>
      )}
    </div>
  );
}

function Topbar({ onBukaMenu }: { onBukaMenu: () => void }) {
  // Profil dibaca dari konteks yang sudah dimuat AuthGate, tidak memuat ulang.
  const { profile, peranPratinjau } = useProfile();
  const [bukaSandi, setBukaSandi] = useState(false);

  return (
    <header
      /* Kelas tanpa awalan = seperti sebelum ini, jangan diubah. Tambahan
         HP semuanya berawalan max-md:. flex-nowrap dipasang khusus untuk
         HP karena topbar lama mengandalkan flex-wrap, dan di layar sempit
         itulah yang membuatnya menumpuk jadi tiga baris. */
      className="flex items-center justify-between border-b px-6 py-3 gap-3 flex-wrap
                 max-md:flex-nowrap max-md:px-3 max-md:py-2 max-md:gap-2"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Garis tiga hanya di HP. Di PC sidebar-nya sudah menempel, jadi
            tombol ini tidak ada gunanya dan cuma membingungkan. */}
        <button
          onClick={onBukaMenu}
          aria-label="Buka menu"
          className="sentuh flex items-center justify-center rounded-lg border md:hidden"
          style={{ borderColor: "var(--border)", color: "var(--ink-secondary)" }}
        >
          <IkonMenu />
        </button>
        <div className="text-sm font-medium max-md:truncate">Dashboard Operasional</div>
      </div>

      <div className="flex items-center gap-3 text-sm max-md:gap-2">
        {/* Pintu pencatatan. Sengaja di kepala layar, bukan di sidebar,
            supaya posisinya tetap sama di semua halaman dan tidak ikut
            tergulung waktu daftar menunya panjang.

            Tetap tampil di HP, tidak dilipat ke menu titik tiga, karena
            ini tombol kerja yang paling sering dipakai di lapangan. */}
        <PintuCatat />

        {/* Empat elemen di bawah ini hanya untuk PC. Versi HP-nya ada di
            dalam MenuAkun.

            Dipakai `max-md:hidden`, BUKAN `hidden md:inline`. Keduanya
            sama-sama menyembunyikan di HP, tapi `md:inline` menambahkan
            display:inline di PC padahal dulu elemen-elemen ini tidak
            punya kelas display sama sekali. Dengan max-md:hidden, di PC
            kelasnya benar-benar sama seperti sebelumnya. */}
        {/* "Lihat sebagai". Hanya tampil untuk peran asli superadmin;
            komponennya sendiri yang memutuskan, bukan di sini, supaya
            aturan siapa-boleh-apa cuma ditulis di satu tempat. */}
        <PilihPeran />

        <span className="max-md:hidden" style={{ color: "var(--ink-secondary)" }}>
          {profile?.full_name} &middot;{" "}
          <span style={peranPratinjau
            ? { color: "var(--status-warning)", fontWeight: 600 } : undefined}>
            {profile ? LABEL_PERAN[profile.role as Peran] ?? profile.role : ""}
            {peranPratinjau ? " (pratinjau)" : ""}
          </span>
        </span>
        <span className="max-md:hidden">
          <TombolTema />
        </span>
        <button
          onClick={() => setBukaSandi(true)}
          className="max-md:hidden rounded-lg border px-2.5 py-1 text-xs"
          style={{ borderColor: "var(--border)", color: "var(--ink-secondary)" }}
        >
          Ubah Kata Sandi
        </button>
        <button
          onClick={() => supabase.auth.signOut()}
          className="max-md:hidden rounded-lg border px-2.5 py-1 text-xs"
          style={{ borderColor: "var(--border)" }}
        >
          Keluar
        </button>

        <MenuAkun onUbahSandi={() => setBukaSandi(true)} />
      </div>

      {bukaSandi && <DialogUbahSandi onTutup={() => setBukaSandi(false)} />}
    </header>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [menuBuka, setMenuBuka] = useState(false);

  /* Escape menutup panel menu. Dipasang di sini, bukan di Sidebar, supaya
     Sidebar tetap komponen tampilan saja dan keadaan buka-tutup cuma
     punya satu sumber kebenaran. */
  useEffect(() => {
    if (!menuBuka) return;
    function tombol(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setMenuBuka(false);
    }
    document.addEventListener("keydown", tombol);
    return () => document.removeEventListener("keydown", tombol);
  }, [menuBuka]);

  /* Halaman di belakang dikunci selama panel terbuka.

     Tanpa ini, jari yang menggulung di atas latar gelap justru
     menggulung halaman di belakangnya, jadi waktu panelnya ditutup
     posisi halamannya sudah pindah entah ke mana. */
  useEffect(() => {
    if (!menuBuka) return;
    const semula = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = semula; };
  }, [menuBuka]);

  return (
    <AuthGate>
      <div className="flex min-h-screen">
        <Sidebar buka={menuBuka} onTutup={() => setMenuBuka(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar onBukaMenu={() => setMenuBuka(true)} />
          {/* Pita peringatan pratinjau. Di bawah topbar supaya terbaca
              sebelum isi halaman, dan tidak bisa ditutup supaya tidak
              ada yang lupa sedang memakai mata orang lain. */}
          <PitaPratinjau />
          {/* Padding dikecilkan di HP. 24px kiri-kanan di layar 390px
              berarti 48px hilang, dan itu selebar dua kolom angka. */}
          <main className="flex-1 p-6 max-md:p-4">{children}</main>
        </div>
      </div>
    </AuthGate>
  );
}
