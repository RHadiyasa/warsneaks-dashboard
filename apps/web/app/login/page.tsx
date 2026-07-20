import LoginForm from "./login-form";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return <main className="auth-page">
    <div className="auth-orb auth-orb-one" aria-hidden="true" />
    <div className="auth-orb auth-orb-two" aria-hidden="true" />

    <section className="auth-shell" aria-label="WarSneaks sign in">
      <aside className="auth-showcase">
        <div className="auth-showcase-glow" aria-hidden="true" />
        <a className="auth-brand" href="/" aria-label="WarSneaks home">
          <span className="auth-logo-mark">W<span /></span>
          <span><b>WarSneaks</b><small>Command Center</small></span>
        </a>

        <div className="auth-story">
          <span className="auth-pill"><i /> Intelligence workspace</span>
          <h1>Keputusan lebih cepat dari satu pusat kendali.</h1>
          <p>Pantau market signal, evidence iklan, dan rekomendasi bisnis tanpa berpindah dashboard.</p>
        </div>

        <div className="auth-preview" aria-hidden="true">
          <div className="auth-preview-head"><span>Market brief</span><b>Live</b></div>
          <div className="auth-preview-score"><strong>3</strong><span>product signals<br/><small>siap ditinjau</small></span></div>
          <div className="auth-preview-bars"><i /><i /><i /></div>
          <div className="auth-preview-foot"><span>DeepSeek insight</span><span>Evidence-backed</span></div>
        </div>

        <p className="auth-showcase-foot"><span>✦</span> Built for focused operators</p>
      </aside>

      <section className="auth-panel">
        <div className="auth-mobile-brand">
          <span className="auth-logo-mark">W<span /></span>
          <b>WarSneaks</b>
        </div>
        <div className="auth-form-head">
          <span className="auth-kicker">Welcome back</span>
          <h2>Masuk ke workspace</h2>
          <p>Lanjutkan dari insight terakhir Anda.</p>
        </div>
        <LoginForm error={error} />
        <div className="auth-trust"><span>⌁</span><p><b>Sesi privat</b><small>Cookie aman dan akses workspace tunggal</small></p></div>
      </section>
    </section>

    <p className="auth-footer">WarSneaks Intelligence · Asia/Jakarta</p>
  </main>;
}
