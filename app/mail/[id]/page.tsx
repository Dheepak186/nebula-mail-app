"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AssistantPanel from "@/components/AssistantPanel";

type Email = {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  snippet?: string;
};

export default function EmailDetailPage() {
  const params = useParams();
  const router = useRouter();

  const id = String(params.id);

  const [email, setEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --------------------------------------------------
  // LOAD EMAIL
  // --------------------------------------------------

  useEffect(() => {
    async function loadEmail() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/gmail/message/${id}`
        );

        if (!response.ok) {
          throw new Error("Failed to load email");
        }

        const data = await response.json();

        setEmail(data);
      } catch (error) {
        console.error(error);
        setError("Failed to load email");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadEmail();
    }
  }, [id]);

  // --------------------------------------------------
  // AI COMPOSE / REPLY / FORWARD
  // --------------------------------------------------

  function handleAssistantCompose(data: {
    to: string;
    subject: string;
    body: string;
  }) {
    const params = new URLSearchParams();

    let to = data.to || "";
    let subject = data.subject || "";
    let body = data.body || "";

    // ------------------------------------------------
    // FORWARD FIX
    // Always use the real currently opened email
    // for the forwarded subject and body.
    // ------------------------------------------------

    const isForward =
      subject.trim().toLowerCase().startsWith("fwd:");

    if (isForward && email) {
      // Use the current email recipient if AI did not
      // provide a valid recipient.
      if (
        !to.trim() ||
        to.toLowerCase().includes("example.com")
      ) {
        to = email.to || "";
      }

      // Always use the actual current email subject.
      subject = `Fwd: ${
        email.subject || "(No subject)"
      }`;

      // Always use the actual current email body.
      body =
        email.body ||
        email.snippet ||
        "(No message)";
    }

    // ------------------------------------------------
    // Add values to compose URL
    // ------------------------------------------------

    if (to.trim()) {
      params.set("to", to);
    }

    if (subject.trim()) {
      params.set("subject", subject);
    }

    if (body.trim()) {
      params.set("body", body);
    }

    router.push(
      `/mail/compose?${params.toString()}`
    );
  }

  // --------------------------------------------------
  // AI SEARCH
  // --------------------------------------------------

  async function handleAssistantSearch(
    query: string
  ) {
    router.push(
      `/mail?q=${encodeURIComponent(query)}`
    );
  }

  // --------------------------------------------------
  // AI OPEN EMAIL
  // --------------------------------------------------

  function handleAssistantOpen(id: string) {
    if (!id) {
      return;
    }

    router.push(`/mail/${id}`);
  }

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------

  return (
    <div className="h-screen flex bg-gray-100">

      {/* =========================================
          MAIN EMAIL
      ========================================= */}

      <main className="flex-1 overflow-y-auto p-10">

        <div className="max-w-5xl mx-auto">

          {/* Back button */}

          <button
            onClick={() => router.push("/mail")}
            className="border border-gray-300 bg-white px-5 py-3 rounded-xl font-semibold hover:bg-gray-100 mb-8"
          >
            ← Back to Inbox
          </button>

          {/* =====================================
              LOADING
          ===================================== */}

          {loading ? (

            <div className="bg-white rounded-2xl p-8">
              <p className="text-gray-500 text-lg">
                Loading email...
              </p>
            </div>

          ) : error ? (

            /* ===================================
               ERROR
            =================================== */

            <div className="bg-red-100 text-red-700 rounded-xl p-5">
              {error}
            </div>

          ) : !email ? (

            /* ===================================
               EMAIL NOT FOUND
            =================================== */

            <div className="bg-white rounded-2xl p-8">
              <p className="text-gray-500">
                Email not found.
              </p>
            </div>

          ) : (

            /* ===================================
               EMAIL CONTENT
            =================================== */

            <div className="bg-white border border-gray-200 rounded-2xl p-10 shadow-sm">

              {/* SUBJECT */}

              <h1 className="text-3xl font-bold mb-8">
                {email.subject || "(No subject)"}
              </h1>

              {/* EMAIL INFORMATION */}

              <div className="space-y-3 mb-8">

                <p className="text-lg">
                  <strong>From:</strong>{" "}
                  {email.from}
                </p>

                <p className="text-lg">
                  <strong>To:</strong>{" "}
                  {email.to}
                </p>

                <p className="text-lg">
                  <strong>Date:</strong>{" "}
                  {email.date}
                </p>

              </div>

              <hr className="border-gray-300 mb-8" />

              {/* MESSAGE */}

              <div>

                <h2 className="text-xl font-bold mb-4">
                  Message
                </h2>

                <div className="text-lg text-gray-800 whitespace-pre-wrap leading-8">
                  {email.body ||
                    email.snippet ||
                    "(No message)"}
                </div>

              </div>

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
        contextEmail={
          email
            ? {
                from: email.from,
                to: email.to,
                subject: email.subject,
                date: email.date,
                body: email.body,
                snippet: email.snippet,
              }
            : undefined
        }
      />

    </div>
  );
}