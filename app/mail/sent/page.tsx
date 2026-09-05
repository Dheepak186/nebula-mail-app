"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type Email = {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
};

export default function SentPage() {
  const router = useRouter();
  const { status } = useSession();

  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  // ---------------------------------------------
  // DARK MODE
  // ---------------------------------------------

  useEffect(() => {
    const savedTheme = localStorage.getItem("nebula-theme");

    if (savedTheme === "dark") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  function toggleDarkMode() {
    setDarkMode((current) => {
      const next = !current;

      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("nebula-theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("nebula-theme", "light");
      }

      return next;
    });
  }

  // ---------------------------------------------
  // LOAD SENT EMAILS
  // ---------------------------------------------

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    async function loadSentEmails() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/gmail/sent", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load sent emails");
        }

        const data = await response.json();

        setEmails(Array.isArray(data.emails) ? data.emails : []);
      } catch (err) {
        console.error(err);
        setError("Unable to load sent emails.");
      } finally {
        setLoading(false);
      }
    }

    loadSentEmails();
  }, [status]);

  // ---------------------------------------------
  // AUTH GUARD
  // ---------------------------------------------

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  // ---------------------------------------------
  // UI HELPERS
  // ---------------------------------------------

  function getRecipientName(recipient: string) {
    if (!recipient) {
      return "Unknown recipient";
    }

    const match = recipient.match(/^"?([^"<]+)"?\s*</);

    if (match?.[1]) {
      return match[1].trim();
    }

    return recipient.split("@")[0] || recipient;
  }

  function getInitials(recipient: string) {
    const name = getRecipientName(recipient);

    const words = name
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }

    return name.slice(0, 2).toUpperCase();
  }

  function getEmailAddress(recipient: string) {
    const match = recipient.match(/<([^>]+)>/);

    if (match?.[1]) {
      return match[1];
    }

    return recipient;
  }

  function getSubject(subject: string) {
    return subject?.trim() || "(No subject)";
  }

  // ---------------------------------------------
  // AUTH LOADING
  // ---------------------------------------------

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />

          <p className="text-gray-500 dark:text-gray-400 text-lg">
            Checking sign-in status...
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------
  // PAGE
  // ---------------------------------------------

  return (
    <div className="h-screen flex bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* =========================================
          LEFT SIDEBAR
      ========================================= */}

      <aside className="w-80 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 p-8 flex flex-col transition-colors duration-200">
        <div className="mb-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl font-bold shadow-sm">
              N
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Nebula Mail
              </h1>

              <p className="text-sm text-gray-500 dark:text-gray-400">
                Smart Gmail workspace
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push("/mail/compose")}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl text-lg font-bold hover:bg-blue-700 transition shadow-sm mb-8"
        >
          + Compose
        </button>

        <nav className="space-y-2">
          <button
            onClick={() => router.push("/mail")}
            className="w-full text-left px-5 py-4 rounded-2xl text-gray-700 dark:text-gray-300 text-lg font-semibold hover:bg-gray-100 dark:hover:bg-slate-800 transition flex items-center gap-3"
          >
            <span className="text-xl">📥</span>
            Inbox
          </button>

          <button
            className="w-full text-left px-5 py-4 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-lg font-semibold flex items-center gap-3"
          >
            <span className="text-xl">📤</span>
            Sent
          </button>
        </nav>

        <div className="mt-auto border-t border-gray-200 dark:border-slate-800 pt-6">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500 mb-2">
            Connected account
          </p>

          <p className="text-sm text-gray-600 dark:text-gray-300">
            Gmail
          </p>

          {/* DARK MODE TOGGLE */}

          <button
            onClick={toggleDarkMode}
            className="mt-5 w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {darkMode ? "Dark Mode" : "Light Mode"}
            </span>

            <span className="text-xl">
              {darkMode ? "🌙" : "☀️"}
            </span>
          </button>
        </div>
      </aside>

      {/* =========================================
          MAIN CONTENT
      ========================================= */}

      <main className="flex-1 bg-gray-50 dark:bg-slate-950 p-8 overflow-y-auto transition-colors duration-200">
        <div className="max-w-5xl mx-auto">
          {/* HEADER */}

          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-1">
                MAILBOX
              </p>

              <h2 className="text-4xl font-bold text-gray-900 dark:text-white">
                Sent
              </h2>

              <p className="text-gray-500 dark:text-gray-400 mt-2">
                Emails sent through your Gmail account
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl px-5 py-3 shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Emails
              </p>

              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {emails.length}
              </p>
            </div>
          </div>

          {/* ERROR */}

          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 p-4 rounded-2xl mb-6">
              <div className="font-semibold">
                Something went wrong
              </div>

              <div className="text-sm mt-1">
                {error}
              </div>
            </div>
          )}

          {/* LOADING */}

          {loading ? (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-10 shadow-sm">
              <div className="flex items-center justify-center gap-3">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />

                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  Loading sent emails...
                </p>
              </div>
            </div>
          ) : emails.length === 0 ? (
            /* EMPTY STATE */

            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-12 shadow-sm text-center">
              <div className="text-5xl mb-4">
                📭
              </div>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                No sent emails found
              </h3>

              <p className="text-gray-500 dark:text-gray-400 mt-2">
                Emails you send will appear here.
              </p>
            </div>
          ) : (
            /* EMAIL LIST */

            <div className="space-y-3">
              {emails.map((email) => (
                <button
                  key={email.id}
                  onClick={() => router.push(`/mail/${email.id}`)}
                  className="w-full text-left bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50/30 dark:hover:bg-slate-800 transition group"
                >
                  <div className="flex items-start gap-4">
                    {/* RECIPIENT AVATAR */}

                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold shrink-0">
                      {getInitials(email.to)}
                    </div>

                    {/* EMAIL CONTENT */}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 dark:text-white truncate">
                            To: {getRecipientName(email.to)}
                          </p>

                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                            {getEmailAddress(email.to)}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {email.date}
                          </span>

                          <span className="text-gray-300 dark:text-gray-600 group-hover:text-blue-600 text-xl transition">
                            →
                          </span>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-full">
                            Sent
                          </span>

                          <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate">
                            {getSubject(email.subject)}
                          </h3>
                        </div>

                        <p className="text-gray-500 dark:text-gray-400 line-clamp-2 leading-6">
                          {email.snippet || "No preview available."}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}