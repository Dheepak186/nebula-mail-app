"use client";

import { useState } from "react";

type ContextEmail = {
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  snippet?: string;
};

type PendingEmail = {
  to: string;
  subject: string;
  body: string;
};

type AssistantPanelProps = {
  onSearch: (query: string) => Promise<void>;

  onCompose: (data: {
    to: string;
    subject: string;
    body: string;
  }) => void;

  onOpen: (id: string) => void;

  contextEmail?: ContextEmail;
};

export default function AssistantPanel({
  onSearch,
  onCompose,
  onOpen,
  contextEmail,
}: AssistantPanelProps) {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  // Email waiting for user confirmation
  const [pendingEmail, setPendingEmail] =
    useState<PendingEmail | null>(null);

  // --------------------------------------------------
  // ASK ASSISTANT
  // --------------------------------------------------

  async function handleSend() {
    if (!message.trim()) {
      return;
    }

    try {
      setLoading(true);
      setReply("");

      const response = await fetch("/api/assistant", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          message,

          // Give the AI the currently opened email
          contextEmail: contextEmail || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Assistant request failed"
        );
      }

      // ------------------------------------------------
      // SEARCH
      // ------------------------------------------------

      if (data.action?.type === "search") {
        await onSearch(data.action.query);

        setReply(
          `I searched your emails for "${data.action.query}".`
        );
      }

      // ------------------------------------------------
      // COMPOSE
      // ------------------------------------------------

      else if (data.action?.type === "compose") {
        onCompose({
          to: data.action.to || "",
          subject: data.action.subject || "",
          body: data.action.body || "",
        });

        setReply(
          "I've opened the compose window and filled in the email."
        );
      }

      // ------------------------------------------------
      // SEND
      // ------------------------------------------------

      else if (data.action?.type === "send") {
        const email: PendingEmail = {
          to: data.action.to || "",
          subject: data.action.subject || "",
          body: data.action.body || "",
        };

        // Don't send immediately.
        // Show confirmation to the user.
        setPendingEmail(email);

        setReply(
          "I've prepared the email. Please review it and confirm before sending."
        );
      }

      // ------------------------------------------------
      // OPEN EMAIL
      // ------------------------------------------------

      else if (data.action?.type === "open") {
        onOpen(data.action.id);

        setReply(
          "I've opened the email for you."
        );
      }

      // ------------------------------------------------
      // REPLY
      // ------------------------------------------------

      else if (data.action?.type === "reply") {
        onCompose({
          to: data.action.to || "",
          subject: data.action.subject || "",
          body: data.action.body || "",
        });

        setReply(
          "I've prepared a reply to this email."
        );
      }

      // ------------------------------------------------
      // FORWARD
      // ------------------------------------------------

      else if (data.action?.type === "forward") {
        // Forwarding must use the real email currently being viewed.
        // Gemini may return generic placeholders such as "Fwd: Email"
        // or "Forwarding this email as requested."; do not trust those
        // values when the current email context is available.
        const currentSubject =
          contextEmail?.subject?.trim() || "";

        const currentBody =
          contextEmail?.body?.trim() ||
          contextEmail?.snippet?.trim() ||
          "";

        const aiTo = String(data.action.to || "").trim();
        const aiSubject = String(data.action.subject || "").trim();
        const aiBody = String(data.action.body || "").trim();

        const to =
          aiTo && !aiTo.includes("example.com")
            ? aiTo
            : contextEmail?.to?.trim() || aiTo;

        const subject = currentSubject
          ? `Fwd: ${currentSubject.replace(/^Fwd:\s*/i, "")}`
          : aiSubject || "Fwd:";

        const body = currentBody || aiBody;

        onCompose({
          to,
          subject,
          body,
        });

        setReply(
          "I've prepared this email for forwarding."
        );
      }

      // ------------------------------------------------
      // NO ACTION
      // ------------------------------------------------

      else {
        setReply(
          data.reply || "No response received."
        );
      }

      setMessage("");

    } catch (error) {
      console.error(error);

      setReply(
        "Sorry, something went wrong."
      );

    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // CONFIRM EMAIL SEND
  // --------------------------------------------------

  async function confirmSend() {
    if (!pendingEmail) {
      return;
    }

    try {
      setLoading(true);
      setReply("");

      const response = await fetch(
        "/api/gmail/send",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            to: pendingEmail.to,
            subject: pendingEmail.subject,
            body: pendingEmail.body,

            // Compatibility with the existing
            // Gmail send endpoint.
            message: pendingEmail.body,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to send email"
        );
      }

      setPendingEmail(null);

      setReply(
        "Email sent successfully!"
      );

    } catch (error) {
      console.error(error);

      setReply(
        error instanceof Error
          ? error.message
          : "Failed to send email."
      );

    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // CANCEL EMAIL SEND
  // --------------------------------------------------

  function cancelSend() {
    setPendingEmail(null);

    setReply(
      "Email sending cancelled."
    );
  }

  return (
    <aside className="w-96 bg-white dark:bg-slate-900 border-l border-gray-300 dark:border-slate-800 p-6 flex flex-col transition-colors duration-200">

      {/* =============================================
          HEADER
      ============================================= */}

      <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
        AI Assistant
      </h2>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Ask me to help with your email.
      </p>

      {/* =============================================
          CURRENT EMAIL CONTEXT
      ============================================= */}

      {contextEmail && (
        <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4">

          <p className="text-xs text-blue-600 dark:text-blue-300 font-semibold mb-1">
            CURRENT EMAIL
          </p>

          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
            {contextEmail.subject || "(No subject)"}
          </p>

          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            From: {contextEmail.from}
          </p>

        </div>
      )}

      {/* =============================================
          ASSISTANT RESPONSE
      ============================================= */}

      <div className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-4 min-h-32">

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">
            Thinking...
          </p>
        ) : reply ? (
          <p className="text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
            {reply}
          </p>
        ) : (
          <p className="text-gray-400 dark:text-gray-500">
            Try asking:
            <br />
            "Find emails from Claude"
            <br />
            <br />
            "Compose an email to someone"
            <br />
            <br />
            "Send an email to someone"
            <br />
            <br />
            "Open the email from Claude"
            <br />
            <br />
            "Reply to this saying thanks"
            <br />
            <br />
            "Forward this email to someone"
          </p>
        )}

      </div>

      {/* =============================================
          SEND CONFIRMATION
      ============================================= */}

      {pendingEmail && (
        <div className="border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 rounded-xl p-4 mb-4">

          <p className="font-bold text-blue-800 dark:text-blue-200 mb-3">
            Confirm Email
          </p>

          <div className="space-y-2 text-sm text-gray-800 dark:text-gray-200">

            <p>
              <span className="font-semibold">
                To:
              </span>{" "}
              {pendingEmail.to}
            </p>

            <p>
              <span className="font-semibold">
                Subject:
              </span>{" "}
              {pendingEmail.subject}
            </p>

            <div>
              <p className="font-semibold">
                Message:
              </p>

              <p className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-2 mt-1 whitespace-pre-wrap max-h-32 overflow-y-auto">
                {pendingEmail.body}
              </p>
            </div>

          </div>

          <div className="flex gap-3 mt-4">

            <button
              onClick={confirmSend}
              disabled={loading}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 transition"
            >
              Send Email
            </button>

            <button
              onClick={cancelSend}
              disabled={loading}
              className="flex-1 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-200 py-2 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-slate-700 disabled:bg-gray-200 dark:disabled:bg-slate-700 transition"
            >
              Cancel
            </button>

          </div>

        </div>
      )}

      {/* =============================================
          USER MESSAGE
      ============================================= */}

      <textarea
        value={message}
        onChange={(e) =>
          setMessage(e.target.value)
        }
        onKeyDown={(e) => {
          if (
            e.key === "Enter" &&
            !e.shiftKey
          ) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="Ask your email assistant..."
        className="w-full h-24 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-300 dark:border-slate-700 rounded-xl p-3 resize-none outline-none focus:ring-2 focus:ring-blue-500 mb-3 transition-colors"
      />

      {/* =============================================
          ASK BUTTON
      ============================================= */}

      <button
        onClick={handleSend}
        disabled={
          loading || !message.trim()
        }
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition"
      >
        {loading
          ? "Thinking..."
          : "Ask Assistant"}
      </button>

    </aside>
  );
}