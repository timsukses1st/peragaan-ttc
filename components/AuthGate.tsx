"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { supabase, envSiap, PESAN_ENV_KOSONG } from "@/lib/supabase";
import DialogUbahSandi from "./DialogUbahSandi";
import type { Profile, LokaRole } from "@/lib/types";

/* =====================================================================
   Pratinjau peran ("Lihat sebagai").

   Gunanya: Superadmin bisa melihat tampilan peran lain tanpa keluar dan
   masuk pakai akun lain. Dipakai waktu membangun layar baru, supaya
   ketahuan menu mana yang muncul dan tombol mana yang hilang.

   CARA KERJANYA: peran di dalam konteks ini disamarkan. Seluruh layar
   membaca peran dari sini (27 tempat di 16 berkas), jadi satu titik
   disamarkan dan semuanya ikut, tanpa satu pun halaman perlu diubah.

   YANG TIDAK DILAKUKANNYA, dan ini penting:
   pratinjau TIDAK mengubah hak data di database. Token yang dipakai
   tetap token Superadmin, jadi RLS tetap melihat Superadmin. Artinya
   layar pratinjau bisa menampilkan data yang peran aslinya TIDAK akan
   pernah dapat, contohnya takaran resep. Jadi ini alat untuk memeriksa
   TAMPILAN, bukan alat untuk menguji keamanan. Menguji keamanan tetap
   harus pakai akun sungguhan.

   Tiga pagar yang dipasang supaya tidak jadi lubang:
   1. Hanya peran asli 'superadmin' yang boleh memakainya. Peran lain
      yang sessionStorage-nya kebetulan terisi (misal browser bergantian
      dipakai) tetap diabaikan, karena yang diperiksa peran asli dari
      database, bukan isi penyimpanan browser.
   2. Superadmin adalah peran tertinggi, jadi setiap pratinjau pasti
      MENURUNKAN hak layar, tidak pernah menaikkan.
   3. Disimpan di sessionStorage, bukan localStorage. Tab ditutup,
      pratinjaunya hilang. Tidak ada orang yang besok pagi kebingungan
      kenapa menunya tinggal separuh.
   ===================================================================== */

const KUNCI_PRATINJAU = "loka-lihat-sebagai";

/** Peran yang boleh dipratinjau. 'belum_diatur' sengaja tidak ada:
 *  layarnya kosong sama sekali dan tidak ada yang bisa dilihat di sana. */
export const PERAN_PRATINJAU: LokaRole[] = [
  "superadmin", "admin", "manajemen", "produksi", "gudang", "sales", "keuangan",
];

type KonteksProfil = {
  /** Profil yang dipakai seluruh layar. Perannya sudah disamarkan
   *  kalau pratinjau sedang nyala. */
  profile: Profile | null;
  /** Profil sebenarnya, tidak pernah disamarkan. Dipakai untuk
   *  menentukan siapa yang boleh memakai tombol pratinjau. */
  profilAsli: Profile | null;
  peranPratinjau: LokaRole | null;
  setPeranPratinjau: (peran: LokaRole | null) => void;
  loading: boolean;
  galat: string | null;
};

const ProfilContext = createContext<KonteksProfil>({
  profile: null, profilAsli: null,
  peranPratinjau: null, setPeranPratinjau: () => {},
  loading: true, galat: null,
});

/** Dipakai komponen lain untuk membaca profil yang sudah dimuat AuthGate. */
export const useProfile = () => useContext(ProfilContext);

function Bingkai({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border p-6 flex flex-col gap-3"
           style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        {children}
      </div>
    </div>
  );
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [belumLogin, setBelumLogin] = useState(false);
  const [lama, setLama] = useState(false);
  const [bukaSandi, setBukaSandi] = useState(false);
  const [peranPratinjau, setPeranPratinjauState] = useState<LokaRole | null>(null);
  const router = useRouter();

  const muat = useCallback(async () => {
    if (!envSiap) { setGalat(PESAN_ENV_KOSONG); setLoading(false); return; }
    setLoading(true);
    setGalat(null);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (!data.session) {
        setBelumLogin(true);
        router.replace("/login");
        return;
      }
      setBelumLogin(false);

      const res = await supabase
        .from("profiles")
        .select("id, full_name, role, is_active")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (res.error) throw res.error;

      setProfile((res.data ?? null) as Profile | null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally {
      // Selalu dijalankan, apa pun yang terjadi, supaya layar tidak menggantung.
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    muat();
    if (!envSiap) return;
    const { data: sub } = supabase.auth.onAuthStateChange((peristiwa, sesi) => {
      if (peristiwa === "SIGNED_OUT" || (!sesi && peristiwa !== "INITIAL_SESSION")) {
        router.replace("/login");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [muat, router]);

  // Kalau lebih dari 8 detik masih memuat, beri tahu user, jangan diamkan.
  useEffect(() => {
    if (!loading) { setLama(false); return; }
    const t = setTimeout(() => setLama(true), 8000);
    return () => clearTimeout(t);
  }, [loading]);

  /* Pratinjau yang tersimpan dibaca SETELAH halaman tergambar, bukan
     waktu useState dipanggil. Kalau dibaca di useState, server menggambar
     "tanpa pratinjau" sementara browser menggambar "dengan pratinjau",
     dan React mengeluh soal hydration. */
  useEffect(() => {
    try {
      const tersimpan = sessionStorage.getItem(KUNCI_PRATINJAU);
      if (tersimpan && (PERAN_PRATINJAU as string[]).includes(tersimpan)) {
        setPeranPratinjauState(tersimpan as LokaRole);
      }
    } catch {
      // Penyimpanan browser diblokir: pratinjau tetap jalan untuk sesi ini.
    }
  }, []);

  const setPeranPratinjau = useCallback((peran: LokaRole | null) => {
    setPeranPratinjauState(peran);
    try {
      if (peran) sessionStorage.setItem(KUNCI_PRATINJAU, peran);
      else sessionStorage.removeItem(KUNCI_PRATINJAU);
    } catch {
      // Sama seperti di atas: tidak disimpan, tapi pratinjaunya tetap jalan.
    }
  }, []);

  const nilai = useMemo<KonteksProfil>(() => {
    /* Yang diperiksa peran ASLI dari database, bukan isi sessionStorage.
       Jadi peran selain superadmin tidak bisa menyamar jadi apa pun
       cuma dengan mengisi penyimpanan browser lewat Console. */
    const boleh = profile?.role === "superadmin";
    const samar = boleh ? peranPratinjau : null;
    return {
      profile: samar && profile ? { ...profile, role: samar } : profile,
      profilAsli: profile,
      peranPratinjau: samar,
      setPeranPratinjau,
      loading,
      galat,
    };
  }, [profile, peranPratinjau, setPeranPratinjau, loading, galat]);

  if (loading) {
    return (
      <div className="p-8 text-sm flex flex-col gap-2" style={{ color: "var(--ink-muted)" }}>
        <span>Memuat...</span>
        {lama && (
          <span style={{ color: "var(--status-warning)" }}>
            Masih menunggu jawaban dari Supabase. Cek koneksi internet, atau buka tab Console
            di browser (tekan F12) untuk melihat pesan lengkapnya.
          </span>
        )}
      </div>
    );
  }

  if (galat) {
    return (
      <Bingkai>
        <h2 className="text-lg font-semibold">
          {envSiap ? "Gagal memuat sesi" : "Pengaturan belum lengkap"}
        </h2>
        <p className="text-sm rounded-lg border px-3 py-2 break-words"
           style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)" }}>
          {galat}
        </p>
        <div className="flex gap-2">
          <button onClick={muat}
                  className="rounded-lg px-3 py-2 text-sm font-medium"
                  style={{ background: "var(--brand)", color: "var(--ink-on-brand)" }}>
            Coba lagi
          </button>
          <button onClick={() => router.replace("/login")}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)" }}>
            Ke halaman masuk
          </button>
        </div>
      </Bingkai>
    );
  }

  if (belumLogin) {
    return (
      <Bingkai>
        <h2 className="text-lg font-semibold">Belum masuk</h2>
        <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
          Mengalihkan ke halaman masuk...
        </p>
        <button onClick={() => router.replace("/login")}
                className="rounded-lg px-3 py-2 text-sm font-medium self-start"
                style={{ background: "var(--brand)", color: "var(--ink-on-brand)" }}>
          Buka halaman masuk
        </button>
      </Bingkai>
    );
  }

  if (!profile) {
    return (
      <Bingkai>
        <h2 className="text-lg font-semibold">Akun belum terdaftar di Loka</h2>
        <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
          Akun Anda sudah masuk, tapi belum punya baris di tabel <code>profiles</code>.
          Minta Superadmin menambahkan Anda beserta perannya.
        </p>
        <button onClick={() => supabase.auth.signOut()}
                className="rounded-lg border px-3 py-2 text-sm self-start"
                style={{ borderColor: "var(--border)" }}>
          Keluar
        </button>
      </Bingkai>
    );
  }

  /* Akun sudah terdaftar tapi Superadmin belum menentukan perannya, atau
     aksesnya dicabut. Dihentikan di sini supaya tidak masuk ke layar yang
     datanya pasti kosong dan penuh pesan ditolak.

     Penjaga ini sengaja memeriksa `profile`, yaitu peran ASLI, bukan
     peran pratinjau. Kalau yang diperiksa peran pratinjau, Superadmin
     yang memilih "Lihat sebagai" akan terlempar ke layar ini dan tidak
     punya jalan kembali. */
  if (!profile.is_active || profile.role === "belum_diatur") {
    return (
      <>
        <Bingkai>
          <h2 className="text-lg font-semibold">Menunggu akses dari Superadmin</h2>
          <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
            Akun <strong>{profile.full_name}</strong> sudah terdaftar, tapi belum diberi
            peran. Hubungi Superadmin Loka untuk menentukan bagian mana yang Anda pegang,
            lalu masuk lagi.
          </p>
          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
            Kalau kata sandi Anda dibuatkan orang lain, sebaiknya diganti sekarang
            walaupun aksesnya belum dibuka.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setBukaSandi(true)}
                    className="rounded-lg px-3 py-2 text-sm font-medium"
                    style={{ background: "var(--brand)", color: "var(--ink-on-brand)" }}>
              Ubah Kata Sandi
            </button>
            <button onClick={() => supabase.auth.signOut()}
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--border)" }}>
              Keluar
            </button>
          </div>
        </Bingkai>
        {bukaSandi && <DialogUbahSandi onTutup={() => setBukaSandi(false)} />}
      </>
    );
  }

  return (
    <ProfilContext.Provider value={nilai}>
      {children}
    </ProfilContext.Provider>
  );
}
