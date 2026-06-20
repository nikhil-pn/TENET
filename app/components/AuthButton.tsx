"use client";
import React, { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { cloudEnabled } from "@/lib/supabase";
import {
  onAuthChange,
  signInWithGitHub,
  signInWithGoogle,
  signOut,
} from "@/lib/cloud/auth";
import styles from "./AuthButton.module.css";

interface AuthButtonProps {
  /** Called whenever the signed-in user changes (login, logout, refresh). */
  onUserChange?: (user: User | null) => void;
}

/**
 * Sign-in / account control. Renders nothing when the cloud isn't configured
 * (local-first default), so the UI is unchanged until Supabase env vars exist.
 */
const AuthButton = ({ onUserChange }: AuthButtonProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!cloudEnabled) return;
    const unsub = onAuthChange((u) => {
      setUser(u);
      onUserChange?.(u);
    });
    return unsub;
    // onUserChange is stable from the parent; re-subscribing on every render
    // would tear down the Supabase listener needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cloudEnabled) return null;

  if (!user) {
    return (
      <div className={styles.wrap}>
        <button
          className={styles.signIn}
          onClick={() => signInWithGitHub()}
          aria-label="Sign in with GitHub"
        >
          Sign in with GitHub
        </button>
        <button
          className={styles.signInAlt}
          onClick={() => signInWithGoogle()}
          aria-label="Sign in with Google"
        >
          Google
        </button>
      </div>
    );
  }

  const meta = user.user_metadata ?? {};
  const avatar: string | undefined = meta.avatar_url;
  const name: string = meta.user_name || meta.full_name || user.email || "Account";

  return (
    <div className={styles.wrap}>
      <button
        className={styles.account}
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Account menu"
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.avatar} src={avatar} alt="" />
        ) : (
          <span className={styles.avatarFallback}>{name[0]?.toUpperCase()}</span>
        )}
      </button>
      {menuOpen && (
        <div className={styles.menu} role="menu">
          <span className={styles.menuName}>{name}</span>
          <button
            className={styles.signOut}
            onClick={() => {
              setMenuOpen(false);
              signOut();
            }}
            role="menuitem"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export default AuthButton;
