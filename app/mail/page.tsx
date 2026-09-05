"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AssistantPanel from "@/components/AssistantPanel";

type Email = {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
};

export default function MailPage() {
  const router = useRouter();
  const { status } = useSession();

  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [sender, setSender] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [readStatus, setReadStatus] = useState("all");

  const filtersActiveRef = useRef(false);
  const lastVersionRef = useRef<number | null>(null);

  // ---------------------------------------------
  // LOAD INBOX
  // ---------------------------------------------

  async function loadInbox(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;

    try {
      if (!silent) {
        setLoading(true);
      }

      setError("");

      const response = await fetch("/api/gmail/inbox", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load inbox");
      }

      const data = await response.json();

      const inboxEmails = Array.isArray(data.emails)
        ? data.emails
        : Array.isArray(data.messages)
          ? data.messages
          : [];

      setEmails(inboxEmails);
    } catch (error) {
      console.error("Inbox load failed:", error);

      if (!silent) {
        setError("Failed to load emails");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  // ---------------------------------------------
  // INITIAL LOAD
  // ---------------------------------------------

  useEffect(() => {
    if (status === "authenticated") {
      loadInbox();
    }
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
  // REALTIME SYNC
  // ---------------------------------------------

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let cancelled = false;

    async function checkSyncStatus() {
      try {
        const response = await fetch("/api/gmail/sync-status", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = await response.json();
        const version = data.version ?? null;

        if (version === null) return;

        if (lastVersionRef.current === null) {
          lastVersionRef.current = version;
          return;
        }

        if (version !== lastVersionRef.current) {
          lastVersionRef.current = version;

          if (!filtersActiveRef.current && !cancelled) {
            loadInbox({ silent: true });
          }
        }
      } catch (error) {
        console.error("Sync status check failed:", error);
      }
    }

    const interval = setInterval(checkSyncStatus, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status]);

  // ---------------------------------------------
  // BUILD GMAIL FILTER QUERY
  // ---------------------------------------------

  function buildFilterQuery() {
    const filters: string[] = [];

    if (search.trim()) {
      filters.push(search.trim());
    }

    if (sender.trim()) {
      if (sender.includes("@")) {
        filters.push(`from:${sender.trim()}`);
      } else {
        filters.push(sender.trim());
      }
    }

    if (fromDate) {
      const date = new Date(`${fromDate}T00:00:00`);

      date.setDate(date.getDate() - 1);

      const previousDate = date
        .toISOString()
        .split("T")[0]
        .replaceAll("-", "/");

      filters.push(`after:${previousDate}`);
    }

    if (toDate) {
      const date = new Date(`${toDate}T00:00:00`);

      date.setDate(date.getDate() + 1);

      const nextDate = date
        .toISOString()
        .split("T")[0]
        .replaceAll("-", "/");

      filters.push(`before:${nextDate}`);
    }

    if (readStatus === "read") {
      filters.push("is:read");
    }

    if (readStatus === "unread") {
      filters.push("is:unread");
    }

    return filters.join(" ");
  }

  // ---------------------------------------------
  // APPLY FILTERS
  // ---------------------------------------------

  async function handleSearch() {
    const query = buildFilterQuery();

    if (!query) {
      filtersActiveRef.current = false;
      await loadInbox();
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/gmail/search?q=${encodeURIComponent(query)}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();

      setEmails(data.emails || []);
      filtersActiveRef.current = true;
    } catch (error) {
      console.error(error);
      setError("Failed to search emails");
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------
  // AI SEARCH
  // ---------------------------------------------

  async function handleAssistantSearch(query: string) {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/gmail/search?q=${encodeURIComponent(query)}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();

      setEmails(data.emails || []);
      setSearch(query);
      filtersActiveRef.current = true;
    } catch (error) {
      console.error(error);
      setError("Failed to search emails");
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------
  // AI COMPOSE
  // ---------------------------------------------

  function handleAssistantCompose(data: {
    to: string;
    subject: string;
    body: string;
  }) {
    const params = new URLSearchParams();

    if (data.to) {
      params.set("to", data.to);
    }

    if (data.subject) {
      params.set("subject", data.subject);
    }

    if (data.body) {
      params.set("body", data.body);
    }

    router.push(`/mail/compose?${params.toString()}`);
  }

  // ---------------------------------------------
  // AI OPEN EMAIL
  // ---------------------------------------------

  function handleAssistantOpen(id: string) {
    if (!id) {
      setError("Email ID was not provided.");
      return;
    }

    router.push(`/mail/${id}`);
  }

  // ---------------------------------------------
  // CLEAR FILTERS
  // ---------------------------------------------

  function clearFilters() {
    setSearch("");
    setSender("");
    setFromDate("");
    setToDate("");
    setReadStatus("all");

    filtersActiveRef.current = false;

    loadInbox();
  }

  // ---------------------------------------------
  // UI HELPERS
  // ---------------------------------------------

  function getSenderName(sender: string) {
    if (!sender) {
      return "Unknown sender";
    }

    const match = sender.match(/^"?([^"<]+)"?\s*</);

    if (match?.[1]) {
      return match[1].trim();
    }

    return sender.split("@")[0] || sender;
  }

  function getInitials(sender: string) {
    const name = getSenderName(sender);

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

  function getEmailAddress(sender: string) {
    const match = sender.match(/<([^>]+)>/);

    if (match?.[1]) {
      return match[1];
    }

    return sender;
  }

  function getSubject(subject: string) {
    return subject?.trim() || "(No subject)";
  }

  // ---------------------------------------------
  // AUTH LOADING / BLOCKED STATE
  // ---------------------------------------------

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-lg">
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
    <div className="h-screen flex bg-gray-100">
      {/* =========================================
          LEFT SIDEBAR
      ========================================= */}

      <aside className="w-80 bg-white border-r border-gray-200 p-8 flex flex-col">
        <div className="mb-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl font-bold shadow-sm">
              N
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Nebula Mail
              </h1>

              <p className="text-sm text-gray-500">
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
            className="w-full text-left px-5 py-4 rounded-2xl bg-blue-50 text-blue-700 text-lg font-semibold flex items-center gap-3"
          >
            <span className="text-xl">📥</span>
            Inbox
          </button>

          <button
            onClick={() => router.push("/mail/sent")}
            className="w-full text-left px-5 py-4 rounded-2xl text-gray-700 text-lg font-semibold hover:bg-gray-100 transition flex items-center gap-3"
          >
            <span className="text-xl">📤</span>
            Sent
          </button>
        </nav>

        <div className="mt-auto border-t border-gray-200 pt-6">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-400 mb-2">
            Connected account
          </p>

          <p className="text-sm text-gray-600">
            Gmail
          </p>
        </div>
      </aside>

      {/* =========================================
          MAIN CONTENT
      ========================================= */}

      <main className="flex-1 bg-gray-50 p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {/* HEADER */}

          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-sm font-semibold text-blue-600 mb-1">
                MAILBOX
              </p>

              <h2 className="text-4xl font-bold text-gray-900">
                Inbox
              </h2>

              <p className="text-gray-500 mt-2">
                Your latest Gmail messages
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-3 shadow-sm">
              <p className="text-sm text-gray-500">
                Messages
              </p>

              <p className="text-2xl font-bold text-gray-900">
                {emails.length}
              </p>
            </div>
          </div>

          {/* =====================================
              FILTER PANEL
          ===================================== */}

          <div className="bg-white border border-gray-200 rounded-3xl p-6 mb-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Email Filters
                </h3>

                <p className="text-sm text-gray-500 mt-1">
                  Search and narrow down your Gmail messages
                </p>
              </div>

              <span className="text-2xl">
                🔎
              </span>
            </div>

            {/* Keyword + Sender */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Keyword
                </label>

                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search subject or message..."
                  className="w-full border border-gray-300 bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sender
                </label>

                <input
                  type="text"
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  placeholder="name or email@example.com"
                  className="w-full border border-gray-300 bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Dates */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  From Date
                </label>

                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full border border-gray-300 bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  To Date
                </label>

                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full border border-gray-300 bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Read Status */}

            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Read Status
              </label>

              <select
                value={readStatus}
                onChange={(e) => setReadStatus(e.target.value)}
                className="w-full border border-gray-300 bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">
                  All emails
                </option>

                <option value="read">
                  Read emails
                </option>

                <option value="unread">
                  Unread emails
                </option>
              </select>
            </div>

            {/* Buttons */}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSearch}
                className="bg-blue-600 text-white px-7 py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-sm"
              >
                Apply Filters
              </button>

              <button
                onClick={clearFilters}
                className="border border-gray-300 bg-white px-7 py-3 rounded-xl font-semibold hover:bg-gray-100 transition"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* ERROR */}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl mb-6">
              <div className="font-semibold">
                Something went wrong
              </div>

              <div className="text-sm mt-1">
                {error}
              </div>
            </div>
          )}

          {/* =====================================
              EMAIL LIST
          ===================================== */}

          {loading ? (
            <div className="bg-white border border-gray-200 rounded-3xl p-10 shadow-sm">
              <div className="flex items-center justify-center gap-3">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />

                <p className="text-gray-500 text-lg">
                  Loading emails...
                </p>
              </div>
            </div>
          ) : emails.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-3xl p-12 shadow-sm text-center">
              <div className="text-5xl mb-4">
                📭
              </div>

              <h3 className="text-xl font-bold text-gray-900">
                No emails found
              </h3>

              <p className="text-gray-500 mt-2">
                Try changing your search or clearing the filters.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {emails.map((email) => (
                <button
                  key={email.id}
                  onClick={() => router.push(`/mail/${email.id}`)}
                  className="w-full text-left bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-200 hover:bg-blue-50/30 transition group"
                >
                  <div className="flex items-start gap-4">
                    {/* SENDER AVATAR */}

                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                      {getInitials(email.from)}
                    </div>

                    {/* EMAIL CONTENT */}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 truncate">
                            {getSenderName(email.from)}
                          </p>

                          <p className="text-xs text-gray-500 truncate mt-1">
                            {getEmailAddress(email.from)}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm text-gray-500 whitespace-nowrap">
                            {email.date}
                          </span>

                          <span className="text-gray-300 group-hover:text-blue-600 text-xl transition">
                            →
                          </span>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                            Email
                          </span>

                          <h3 className="font-bold text-lg text-gray-900 truncate">
                            {getSubject(email.subject)}
                          </h3>
                        </div>

                        <p className="text-gray-500 line-clamp-2 leading-6">
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

      {/* =========================================
          AI ASSISTANT
      ========================================= */}

      <AssistantPanel
        onSearch={handleAssistantSearch}
        onCompose={handleAssistantCompose}
        onOpen={handleAssistantOpen}
      />
    </div>
  );
}