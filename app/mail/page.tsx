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
  const { data: session, status } = useSession();

  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  // Filter fields
  const [search, setSearch] = useState("");
  const [sender, setSender] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [readStatus, setReadStatus] = useState("all");

  // Tracks whether the user currently has any filter/search applied.
  // We avoid overwriting a user's active search results with a
  // background inbox refresh.
  const filtersActiveRef = useRef(false);

  // Tracks the last realtime "version" we have seen, so we only
  // refresh when something has actually changed.
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

      // The inbox API returns { emails: [...] }.
      // Keep compatibility with older responses that used { messages: [...] }.
      const inboxEmails = Array.isArray(data.emails)
        ? data.emails
        : Array.isArray(data.messages)
          ? data.messages
          : [];

      setEmails(inboxEmails);
    } catch (error) {
      console.error("Inbox load failed:", error);

      // Don't surface an error banner for a silent background
      // refresh failure - only show it for a user-triggered load.
      if (!silent) {
        setError("Failed to load emails");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    // Only load the inbox once we know the user is actually
    // signed in. Loading it unconditionally would hit the Gmail
    // API with no session and just show a "Failed to load
    // emails" error instead of redirecting to login.
    if (status === "authenticated") {
      loadInbox();
    }
  }, [status]);

  // ---------------------------------------------
  // AUTH GUARD
  // ---------------------------------------------
  // If NextAuth confirms there is no session, send the user back
  // to the home page where they can sign in. This prevents the
  // Inbox page from being reachable directly (e.g. via a shared
  // link or bookmark) without being logged in.

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  // ---------------------------------------------
  // REALTIME SYNC (SAFE BACKGROUND POLLING)
  // ---------------------------------------------
  // We do NOT poll the full inbox on a timer (that caused emails
  // to flash/disappear previously). Instead we poll a lightweight
  // sync-status endpoint that just returns a version number backed
  // by the Gmail webhook. Only when that version changes do we
  // quietly refresh the inbox in the background, without touching
  // the loading state, so the UI never flickers.

  useEffect(() => {
    // Don't start background polling until we know the user is
    // signed in - there is nothing to sync for a logged-out user.
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
          // First check - just record the current version,
          // don't trigger a refresh.
          lastVersionRef.current = version;
          return;
        }

        if (version !== lastVersionRef.current) {
          lastVersionRef.current = version;

          // Only auto-refresh the plain inbox view. If the user
          // currently has a search/filter applied, leave their
          // results alone rather than silently replacing them.
          if (!filtersActiveRef.current && !cancelled) {
            loadInbox({ silent: true });
          }
        }
      } catch (error) {
        // Silently ignore - this is a background check and
        // should never interrupt the user.
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

    // Keyword
    if (search.trim()) {
      filters.push(search.trim());
    }

    // Sender
    if (sender.trim()) {
      if (sender.includes("@")) {
        filters.push(`from:${sender.trim()}`);
      } else {
        filters.push(sender.trim());
      }
    }

    // From date
    // Gmail "after" is exclusive.
    // Subtract one day so selected date is included.
    if (fromDate) {
      const date = new Date(`${fromDate}T00:00:00`);

      date.setDate(date.getDate() - 1);

      const previousDate = date
        .toISOString()
        .split("T")[0]
        .replaceAll("-", "/");

      filters.push(`after:${previousDate}`);
    }

    // To date
    // Gmail "before" is exclusive.
    // Add one day so selected date is included.
    if (toDate) {
      const date = new Date(`${toDate}T00:00:00`);

      date.setDate(date.getDate() + 1);

      const nextDate = date
        .toISOString()
        .split("T")[0]
        .replaceAll("-", "/");

      filters.push(`before:${nextDate}`);
    }

    // Read status
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

  async function handleAssistantSearch(
    query: string
  ) {
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

    router.push(
      `/mail/compose?${params.toString()}`
    );
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
  // AUTH LOADING / BLOCKED STATE
  // ---------------------------------------------
  // While NextAuth is still figuring out whether there is a
  // session, or once we know there isn't one (and the redirect
  // above is about to kick in), show a simple neutral screen
  // instead of the Inbox UI. This avoids ever flashing "Failed
  // to load emails" for a logged-out visitor.

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500 text-lg">Checking sign-in status...</p>
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

      <aside className="w-80 bg-white border-r border-gray-300 p-10">

        <h1 className="text-4xl font-bold mb-10">
          Nebula Mail
        </h1>

        <button
          onClick={() =>
            router.push("/mail/compose")
          }
          className="w-full bg-blue-600 text-white py-5 rounded-xl text-xl font-bold hover:bg-blue-700 mb-10"
        >
          Compose
        </button>

        <button
          onClick={() =>
            router.push("/mail")
          }
          className="w-full text-left px-5 py-4 rounded-xl bg-gray-100 text-xl font-semibold mb-3"
        >
          Inbox
        </button>

        <button
          onClick={() =>
            router.push("/mail/sent")
          }
          className="w-full text-left px-5 py-4 rounded-xl text-xl font-semibold hover:bg-gray-100"
        >
          Sent
        </button>

      </aside>

      {/* =========================================
          MAIN CONTENT
      ========================================= */}

      <main className="flex-1 bg-white p-10 overflow-y-auto">

        <div className="flex items-center justify-between mb-8">

          <h2 className="text-4xl font-bold">
            Inbox
          </h2>

          <span className="text-gray-500 text-lg">
            {emails.length} emails
          </span>

        </div>

        {/* =====================================
            FILTER PANEL
        ===================================== */}

        <div className="border border-gray-300 rounded-2xl p-6 mb-8 bg-gray-50">

          <h3 className="text-xl font-bold mb-5">
            Email Filters
          </h3>

          {/* Keyword + Sender */}

          <div className="grid grid-cols-2 gap-4 mb-4">

            <div>

              <label className="block text-sm font-semibold mb-2">
                Keyword
              </label>

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search subject or message..."
                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>

            <div>

              <label className="block text-sm font-semibold mb-2">
                Sender
              </label>

              <input
                type="text"
                value={sender}
                onChange={(e) =>
                  setSender(e.target.value)
                }
                placeholder="name or email@example.com"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>

          </div>

          {/* Dates */}

          <div className="grid grid-cols-2 gap-4 mb-4">

            <div>

              <label className="block text-sm font-semibold mb-2">
                From Date
              </label>

              <input
                type="date"
                value={fromDate}
                onChange={(e) =>
                  setFromDate(e.target.value)
                }
                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>

            <div>

              <label className="block text-sm font-semibold mb-2">
                To Date
              </label>

              <input
                type="date"
                value={toDate}
                onChange={(e) =>
                  setToDate(e.target.value)
                }
                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>

          </div>

          {/* Read Status */}

          <div className="mb-5">

            <label className="block text-sm font-semibold mb-2">
              Read Status
            </label>

            <select
              value={readStatus}
              onChange={(e) =>
                setReadStatus(e.target.value)
              }
              className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-blue-500"
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

          <div className="flex gap-4">

            <button
              onClick={handleSearch}
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700"
            >
              Apply Filters
            </button>

            <button
              onClick={clearFilters}
              className="border border-gray-300 bg-white px-8 py-3 rounded-xl font-semibold hover:bg-gray-100"
            >
              Clear Filters
            </button>

          </div>

        </div>

        {/* =====================================
            ERROR
        ===================================== */}

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-xl mb-6">
            {error}
          </div>
        )}

        {/* =====================================
            EMAIL LIST
        ===================================== */}

        {loading ? (

          <div className="text-gray-500 text-lg">
            Loading emails...
          </div>

        ) : emails.length === 0 ? (

          <div className="text-gray-500 text-lg">
            No emails found.
          </div>

        ) : (

          <div className="border border-gray-300 rounded-xl overflow-hidden">

            {emails.map((email) => (

              <button
                key={email.id}
                onClick={() =>
                  router.push(`/mail/${email.id}`)
                }
                className="w-full text-left p-6 border-b border-gray-200 last:border-b-0 hover:bg-gray-50"
              >

                <div className="flex justify-between gap-4">

                  <div className="min-w-0">

                    <p className="font-bold text-lg">
                      {email.from}
                    </p>

                    <p className="text-lg mt-2">
                      {email.subject}
                    </p>

                    <p className="text-gray-500 mt-2">
                      {email.snippet}
                    </p>

                  </div>

                  <span className="text-gray-500 whitespace-nowrap">
                    {email.date}
                  </span>

                </div>

              </button>

            ))}

          </div>

        )}

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
