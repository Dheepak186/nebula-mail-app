"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AssistantPanel from "@/components/AssistantPanel";

type Email = {
  id: string;
  threadId?: string;
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
  const [threadMessages, setThreadMessages] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --------------------------------------------------
  // LOAD EMAIL + THREAD
  // --------------------------------------------------

  useEffect(() => {
    async function loadEmailAndThread() {
      try {
        setLoading(true);
        setError("");

        // First load the selected message.
        const messageResponse = await fetch(
          `/api/gmail/message/${id}`
        );

        if (!messageResponse.ok) {
          throw new Error("Failed to load email");
        }

        const messageData = await messageResponse.json();

        const currentEmail: Email = {
          id: messageData.id || id,
          threadId: messageData.threadId,
          from: messageData.from || "",
          to: messageData.to || "",
          subject: messageData.subject || "",
          date: messageData.date || "",
          body:
            messageData.body ||
            messageData.snippet ||
            "",
          snippet: messageData.snippet || "",
        };

        setEmail(currentEmail);

        // ------------------------------------------------
        // Load the complete Gmail thread.
        // ------------------------------------------------

        if (messageData.threadId) {
          const threadResponse = await fetch(
            `/api/gmail/thread/${messageData.threadId}`
          );

          if (!threadResponse.ok) {
            throw new Error("Failed to load email thread");
          }

          const threadData = await threadResponse.json();

          const messages: Email[] =
            threadData.messages || [];

          setThreadMessages(messages);
        } else {
          // Fallback if no thread ID is available.
          setThreadMessages([currentEmail]);
        }
      } catch (error) {
        console.error(error);
        setError("Failed to load email");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadEmailAndThread();
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
    // Always use the real currently opened email.
    // ------------------------------------------------

    const isForward =
      subject.trim().toLowerCase().startsWith("fwd:");

    if (isForward && email) {
      if (
        !to.trim() ||
        to.toLowerCase().includes("example.com")
      ) {
        to = email.to || "";
      }

      subject = `Fwd: ${
        email.subject || "(No subject)"
      }`;

      body =
        email.body ||
        email.snippet ||
        "(No message)";
    }

    // ------------------------------------------------
    // Add values to compose URL.
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
          MAIN EMAIL / THREAD
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
                Loading email thread...
              </p>
            </div>

          ) : error ? (

            <div className="bg-red-100 text-red-700 rounded-xl p-5">
              {error}
            </div>

          ) : !email ? (

            <div className="bg-white rounded-2xl p-8">
              <p className="text-gray-500">
                Email not found.
              </p>
            </div>

          ) : (

            <div>

              {/* =================================
                  THREAD HEADER
              ================================= */}

              <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm mb-6">

                <h1 className="text-3xl font-bold">
                  {email.subject || "(No subject)"}
                </h1>

                <p className="text-gray-500 mt-2">
                  {threadMessages.length}{" "}
                  {threadMessages.length === 1
                    ? "message"
                    : "messages"}{" "}
                  in this conversation
                </p>

              </div>

              {/* =================================
                  THREAD MESSAGES
              ================================= */}

              <div className="space-y-6">

                {threadMessages.map(
                  (message, index) => (

                    <div
                      key={
                        message.id ||
                        `${message.date}-${index}`
                      }
                      className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm"
                    >

                      {/* MESSAGE HEADER */}

                      <div className="mb-6">

                        <h2 className="text-xl font-bold mb-4">
                          {message.subject ||
                            "(No subject)"}
                        </h2>

                        <div className="space-y-2 text-gray-700">

                          <p>
                            <strong>From:</strong>{" "}
                            {message.from}
                          </p>

                          <p>
                            <strong>To:</strong>{" "}
                            {message.to}
                          </p>

                          <p>
                            <strong>Date:</strong>{" "}
                            {message.date}
                          </p>

                        </div>

                      </div>

                      <hr className="border-gray-300 mb-6" />

                      {/* MESSAGE BODY */}

                      <div>

                        <h3 className="text-lg font-bold mb-4">
                          Message
                        </h3>

                        <div className="text-lg text-gray-800 whitespace-pre-wrap leading-8">
                          {message.body ||
                            message.snippet ||
                            "(No message)"}
                        </div>

                      </div>

                    </div>

                  )
                )}

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