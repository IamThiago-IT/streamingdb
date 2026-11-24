"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { setPasswordAction } from "@/app/[lang]/profile/actions";

const inputClass =
  "w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint";
const labelClass =
  "mb-1 block text-sm font-medium text-ink-muted";

export default function ChangePasswordForm({
  mode,
  strings,
}: {
  mode: "change" | "set";
  strings: {
    passwordMismatch: string;
    passwordMin: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    changePasswordError: string;
    savePasswordError: string;
    passwordSaved: string;
    savePending: string;
    changePassword: string;
    setPassword: string;
  };
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError(strings.passwordMismatch);
      return;
    }

    setPending(true);
    try {
      if (mode === "change") {
        const { error: changeError } = await authClient.changePassword({
          currentPassword,
          newPassword,
        });
        if (changeError) {
          setError(changeError.message ?? strings.changePasswordError);
          return;
        }
      } else {
        await setPasswordAction(newPassword);
      }
      setSuccess(strings.passwordSaved);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError(strings.savePasswordError);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === "change" && (
        <div>
          <label className={labelClass}>{strings.currentPassword}</label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
            className={inputClass}
          />
        </div>
      )}
      <div>
        <label className={labelClass}>{strings.newPassword}</label>
        <input
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="••••••••"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-ink-faint">{strings.passwordMin}</p>
      </div>
      <div>
        <label className={labelClass}>{strings.confirmPassword}</label>
        <input
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          className={inputClass}
        />
      </div>
      {error && <p className="text-sm text-rise">{error}</p>}
      {success && <p className="text-sm text-fall">{success}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? strings.savePending : mode === "change" ? strings.changePassword : strings.setPassword}
      </button>
    </form>
  );
}
