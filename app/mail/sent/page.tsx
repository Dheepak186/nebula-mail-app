"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSentEmails() {
      try {
        const response = await fetch("/api/gmail/sent");

        if (!response.ok) {
          throw new Error("Failed to load sent emails");
        }

        const data = await response.json();

        setEmails(data.emails || []);
      } catch (err) {
        console.error(err);
        setError("Unable to load sent emails.");
      } finally {
        setLoading(false);
      }
    }

    loadSentEmails();
  }, []);

  return (
    <main className="min-h-screen flex bg-gray-100">

      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-gray-300 p-8">
        <h1 className="text-3xl font-bold mb-8">
          Nebula Mail
        </h1>

        <button
          onClick={() => router.push("/mail/compose")}
          className="w-full bg-blue-600 text-white py-4 rounded-lg text-lg font-semibold mb-8 hover:bg-blue-700"
        >
          Compose
        </button>

        <nav className="space-y-4 text-lg">
          <button
            onClick={() => router.push("/mail")}
            className="block w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100"
          >
            Inbox
          </button>

          <button
            className="block w-full text-left px-4 py-3 rounded-lg bg-gray-100 font-semibold"
          >
            Sent
          </button>
        </nav>
      </aside>

      {/* Main area */}
      <section className="flex-1 p-8">

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold">
            Sent
          </h2>

          <span className="text-gray-500">
            {emails.length} emails
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-xl border border-gray-300 p-8">
            <p className="text-gray-500">
              Loading your sent emails...
            </p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-white rounded-xl border border-red-300 p-8">
            <p className="text-red-600">
              {error}
            </p>
          </div>
        )}

        {/* Emails */}
        {!loading && !error && (
          <div className="bg-white rounded-xl border border-gray-300 overflow-hidden">

            {emails.length === 0 ? (
              <div className="p-8">
                <p className="text-gray-500">
                  No sent emails found.
                </p>
              </div>
            ) : (
              emails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => router.push(`/mail/${email.id}`)}
                  className="border-b border-gray-200 p-5 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex justify-between gap-4">

                    <p className="font-semibold text-gray-900">
                      To: {email.to}
                    </p>

                    <p className="text-sm text-gray-500 whitespace-nowrap">
                      {email.date}
                    </p>

                  </div>

                  <h3 className="font-medium text-gray-900 mt-2">
                    {email.subject}
                  </h3>

                  <p className="text-gray-500 mt-1 line-clamp-2">
                    {email.snippet}
                  </p>

                </div>
              ))
            )}

          </div>
        )}

      </section>
    </main>
  );
}