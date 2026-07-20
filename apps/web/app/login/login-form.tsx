"use client";

import { useState } from "react";

function MailIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.75h16v10.5H4z"/><path d="m4.8 7.5 7.2 5 7.2-5"/></svg>;
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z"/><circle cx="12" cy="12" r="2.5"/>{hidden && <path d="m4 4 16 16"/>}</svg>;
}

export default function LoginForm({ error }: { error?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return <form method="post" action="/api/auth/login" className="auth-form" onSubmit={() => setSubmitting(true)}>
    <label className="auth-field" htmlFor="email">
      <span>Email</span>
      <div className="auth-input-wrap">
        <MailIcon />
        <input id="email" name="email" type="email" defaultValue="owner@warsneaks.local" autoComplete="username" inputMode="email" required disabled={submitting} />
      </div>
    </label>

    <label className="auth-field" htmlFor="password">
      <span>Password</span>
      <div className="auth-input-wrap">
        <LockIcon />
        <input id="password" name="password" type={showPassword ? "text" : "password"} placeholder="Masukkan password Anda" autoComplete="current-password" required minLength={8} disabled={submitting} autoFocus />
        <button className="auth-password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={showPassword}>
          <EyeIcon hidden={showPassword} />
        </button>
      </div>
    </label>

    {error && <div className="auth-error" role="alert" aria-live="polite"><span>!</span><p><b>Tidak dapat masuk</b><small>Email atau password belum sesuai. Silakan periksa kembali.</small></p></div>}

    <button className="auth-submit" type="submit" disabled={submitting}>
      {submitting ? <><i className="auth-submit-spinner" /> Memverifikasi…</> : <>Masuk ke Command Center <span>→</span></>}
    </button>
  </form>;
}
