"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter fields
  const [search, setSearch] = useState("");
  const [sender, setSender] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [readStatus, setReadStatus] = useState("all");

  // ---------------------------------------------
  // LOAD INBOX
  // ---------------------------------------------

  async function loadInbox() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/gmail/inbox");

      if (!response.ok) {
        throw new Error("Failed to load inbox");
      }

      const data = await response.json();

      setEmails(data.messages || []);
    } catch (error) {
      console.error(error);
      setError("Failed to load emails");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInbox();
  }, []);

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
    // We subtract one day so the selected date is included.
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
    // We add one day so the selected date is included.
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
  // REFRESH CURRENT MAIL VIEW
  // ---------------------------------------------

  async function refreshMailView() {
    const query = buildFilterQuery();

    if (!query) {
      await loadInbox();
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/gmail/search?q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error("Refresh search failed");
      }

      const data = await response.json();
      setEmails(data.emails || []);
    } catch (error) {
      console.error(error);
      setError("Failed to refresh emails");
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------
  // REAL-TIME GMAIL SYNC
  // ---------------------------------------------

  useEffect(() => {
    let lastVersion = 0;
    let statusInterval: ReturnType<typeof setInterval> | undefined;
    let watchInterval: ReturnType<typeof setInterval> | undefined;

    async function startRealtimeSync() {
      try {
        // Remember the current version so old notifications do not
        // immediately refresh the page when we first start.
        const statusResponse = await fetch(
          "/api/gmail/sync-status"
        );

        if (statusResponse.ok) {
          const status = await statusResponse.json();
          lastVersion = status.version || 0;
        }

        // Start/renew Gmail's push watch.
        const watchResponse = await fetch(
          "/api/gmail/watch"
        );

        if (!watchResponse.ok) {
          console.error("Failed to start Gmail watch");
        }

        // Check the tiny sync-status endpoint frequently. The actual
        // Gmail change is delivered to our backend through Pub/Sub.
        statusInterval = setInterval(async () => {
          try {
            const response = await fetch(
              "/api/gmail/sync-status",
              { cache: "no-store" }
            );

            if (!response.ok) return;

            const status = await response.json();
            const currentVersion = status.version || 0;

            if (currentVersion > lastVersion) {
              lastVersion = currentVersion;
              await refreshMailView();
            }
          } catch (error) {
            console.error("Realtime sync check failed:", error);
          }
        }, 3000);

        // Gmail watches expire, so renew the watch once every 24 hours
        // while the mail page is open.
        watchInterval = setInterval(async () => {
          try {
            await fetch("/api/gmail/watch");
          } catch (error) {
            console.error("Gmail watch renewal failed:", error);
          }
        }, 24 * 60 * 60 * 1000);
      } catch (error) {
        console.error("Failed to start realtime sync:", error);
      }
    }

    startRealtimeSync();

    return () => {
      if (statusInterval) clearInterval(statusInterval);
      if (watchInterval) clearInterval(watchInterval);
    };
  }, []);

  // ---------------------------------------------
  // APPLY FILTERS
  // ---------------------------------------------

  async function handleSearch() {
    const query = buildFilterQuery();

    if (!query) {
      loadInbox();
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/gmail/search?q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();

      setEmails(data.emails || []);
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
        `/api/gmail/search?q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();

      setEmails(data.emails || []);
      setSearch(query);
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

    loadInbox();
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
          onClick={() => router.push("/mail/compose")}
          className="w-full bg-blue-600 text-white py-5 rounded-xl text-xl font-bold hover:bg-blue-700 mb-10"
        >
          Compose
        </button>

        <button
          onClick={() => router.push("/mail")}
          className="w-full text-left px-5 py-4 rounded-xl bg-gray-100 text-xl font-semibold mb-3"
        >
          Inbox
        </button>

        <button
          onClick={() => router.push("/mail/sent")}
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