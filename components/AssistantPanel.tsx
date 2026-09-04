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

          // Send current email to the AI
          contextEmail: contextEmail || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Assistant request failed"
        );
      }

      // ---------------------------------------------
      // SEARCH
      // ---------------------------------------------

      if (data.action?.type === "search") {
        await onSearch(data.action.query);

        setReply(
          `I searched your emails for "${data.action.query}".`
        );
      }

      // ---------------------------------------------
      // COMPOSE
      // ---------------------------------------------

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

      // ---------------------------------------------
      // OPEN EMAIL
      // ---------------------------------------------

      else if (data.action?.type === "open") {
        onOpen(data.action.id);

        setReply(
          "I've opened the email for you."
        );
      }

      // ---------------------------------------------
      // REPLY
      // ---------------------------------------------

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

      // ---------------------------------------------
      // NO ACTION
      // ---------------------------------------------

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

  return (
    <aside className="w-96 bg-white border-l border-gray-300 p-6 flex flex-col">

      {/* TITLE */}
      <h2 className="text-2xl font-bold mb-2">
        AI Assistant
      </h2>

      <p className="text-sm text-gray-500 mb-6">
        Ask me to help with your email.
      </p>

      {/* CURRENT EMAIL INDICATOR */}
      {contextEmail && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">

          <p className="text-xs text-blue-600 font-semibold mb-1">
            CURRENT EMAIL
          </p>

          <p className="text-sm font-semibold text-gray-800 truncate">
            {contextEmail.subject || "(No subject)"}
          </p>

          <p className="text-xs text-gray-500 truncate">
            From: {contextEmail.from}
          </p>

        </div>
      )}

      {/* RESPONSE */}
      <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 min-h-32">

        {loading ? (
          <p className="text-gray-500">
            Thinking...
          </p>
        ) : reply ? (
          <p className="text-gray-800 whitespace-pre-wrap">
            {reply}
          </p>
        ) : (
          <p className="text-gray-400">
            Try asking:
            <br />
            "Find emails from Claude"
            <br />
            <br />
            "Compose an email to someone"
            <br />
            <br />
            "Open the email from Claude"
            <br />
            <br />
            "Reply to this saying thanks"
          </p>
        )}

      </div>

      {/* INPUT */}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
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
        className="w-full h-24 bg-white border border-gray-300 rounded-lg p-3 resize-none outline-none focus:ring-2 focus:ring-blue-500 mb-3"
      />

      {/* BUTTON */}
      <button
        onClick={handleSend}
        disabled={
          loading || !message.trim()
        }
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading
          ? "Thinking..."
          : "Ask Assistant"}
      </button>

    </aside>
  );
}