"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ComposePage() {
  const router = useRouter();

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [darkMode, setDarkMode] = useState(false);

  // --------------------------------------------------
  // DARK MODE
  // --------------------------------------------------

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

  // --------------------------------------------------
  // LOAD AI COMPOSE DATA FROM URL
  // --------------------------------------------------

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const aiTo = params.get("to") || "";
    const aiSubject = params.get("subject") || "";
    const aiBody = params.get("body") || "";

    setTo(aiTo);
    setSubject(aiSubject);
    setBody(aiBody);
  }, []);

  // --------------------------------------------------
  // SEND EMAIL
  // --------------------------------------------------

  async function handleSend() {
    const params = new URLSearchParams(window.location.search);

    const finalTo =
      to.trim() ||
      (params.get("to") || "").trim();

    const finalSubject =
      subject.trim() ||
      (params.get("subject") || "").trim();

    const finalBody =
      body.trim() ||
      (params.get("body") || "").trim();

    // Validation
    if (!finalTo) {
      setError("Please enter a recipient email address.");
      return;
    }

    if (!finalSubject) {
      setError("Please enter a subject.");
      return;
    }

    if (!finalBody) {
      setError("Please enter a message.");
      return;
    }

    try {
      setSending(true);
      setError("");
      setMessage("");

      const response = await fetch("/api/gmail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: finalTo,
          subject: finalSubject,
          body: finalBody,
          message: finalBody,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to send email"
        );
      }

      setMessage("Email sent successfully!");

      setTimeout(() => {
        router.push("/mail");
      }, 1000);
    } catch (error) {
      console.error("Send email error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Failed to send email"
      );
    } finally {
      setSending(false);
    }
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-gray-100 p-10 transition-colors duration-200">
      <div className="max-w-4xl mx-auto">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Compose Email
            </h1>

            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Write and send an email through Gmail.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* DARK MODE */}

            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex items-center gap-3 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 px-5 py-3 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-slate-700 transition"
            >
              <span>
                {darkMode ? "Dark Mode" : "Light Mode"}
              </span>

              <span className="text-xl">
                {darkMode ? "🌙" : "☀️"}
              </span>
            </button>

            {/* BACK TO INBOX */}

            <button
              type="button"
              onClick={() => router.push("/mail")}
              className="border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-slate-800 transition"
            >
              Back to Inbox
            </button>
          </div>
        </div>

        {/* COMPOSE CARD */}

        <div className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-800 rounded-2xl p-8 shadow-sm transition-colors duration-200">

          {/* TO */}

          <div className="mb-6">
            <label
              htmlFor="email-to"
              className="block text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100"
            >
              To
            </label>

            <input
              id="email-to"
              name="to"
              type="email"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setError("");
              }}
              placeholder="recipient@example.com"
              className="w-full bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-300 dark:border-slate-700 rounded-xl px-5 py-4 text-lg outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
          </div>

          {/* SUBJECT */}

          <div className="mb-6">
            <label
              htmlFor="email-subject"
              className="block text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100"
            >
              Subject
            </label>

            <input
              id="email-subject"
              name="subject"
              type="text"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setError("");
              }}
              placeholder="Email subject"
              className="w-full bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-300 dark:border-slate-700 rounded-xl px-5 py-4 text-lg outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
          </div>

          {/* MESSAGE */}

          <div className="mb-6">
            <label
              htmlFor="email-body"
              className="block text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100"
            >
              Message
            </label>

            <textarea
              id="email-body"
              name="body"
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setError("");
              }}
              placeholder="Write your message..."
              className="w-full h-72 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-300 dark:border-slate-700 rounded-xl px-5 py-4 text-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-colors"
            />
          </div>

          {/* SUCCESS MESSAGE */}

          {message && (
            <div className="bg-green-100 dark:bg-green-950/40 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-300 p-4 rounded-xl mb-6">
              {message}
            </div>
          )}

          {/* ERROR MESSAGE */}

          {error && (
            <div className="bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 p-4 rounded-xl mb-6">
              {error}
            </div>
          )}

          {/* BUTTONS */}

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.push("/mail")}
              className="flex-1 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 py-4 rounded-xl text-lg font-semibold hover:bg-gray-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="flex-1 bg-blue-600 text-white py-4 rounded-xl text-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition"
            >
              {sending
                ? "Sending..."
                : "Send Email"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}