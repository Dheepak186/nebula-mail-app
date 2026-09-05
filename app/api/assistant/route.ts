import { GoogleGenAI, Type } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ==================================================
// DATE / SEARCH HELPERS
// ==================================================

function formatGmailDate(date: Date): string {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}/${month}/${day}`;
}

/**
 * Fix natural-language date searches after Gemini
 * generates the Gmail query.
 *
 * The important point is:
 * Gemini does NOT decide the actual calendar date.
 * Our application calculates it.
 */
function normalizeDateSearchQuery(
  query: string,
  userMessage: string
): string {
  const lowerMessage =
    userMessage.toLowerCase();

  const now = new Date();

  // ==================================================
  // THIS WEEK
  // ==================================================

  if (
    lowerMessage.includes("this week") ||
    lowerMessage.includes("current week")
  ) {
    const startOfWeek =
      new Date(now);

    // Sunday = 0
    const day =
      startOfWeek.getDay();

    startOfWeek.setDate(
      startOfWeek.getDate() - day
    );

    startOfWeek.setHours(
      0,
      0,
      0,
      0
    );

    // Tomorrow is used as an exclusive
    // upper boundary.
    const tomorrow =
      new Date(now);

    tomorrow.setDate(
      tomorrow.getDate() + 1
    );

    tomorrow.setHours(
      0,
      0,
      0,
      0
    );

    // Remove any incorrect dates Gemini
    // may have generated.
    let finalQuery =
      query
        .replace(
          /after:\d{4}\/\d{1,2}\/\d{1,2}/gi,
          ""
        )
        .replace(
          /before:\d{4}\/\d{1,2}\/\d{1,2}/gi,
          ""
        )
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    finalQuery +=
      ` after:${formatGmailDate(
        startOfWeek
      )}`;

    finalQuery +=
      ` before:${formatGmailDate(
        tomorrow
      )}`;

    return finalQuery.trim();
  }

  // ==================================================
  // TODAY
  // ==================================================

  if (
    lowerMessage.includes("today")
  ) {
    const tomorrow =
      new Date(now);

    tomorrow.setDate(
      tomorrow.getDate() + 1
    );

    let finalQuery =
      query
        .replace(
          /after:\d{4}\/\d{1,2}\/\d{1,2}/gi,
          ""
        )
        .replace(
          /before:\d{4}\/\d{1,2}\/\d{1,2}/gi,
          ""
        )
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    finalQuery +=
      ` after:${formatGmailDate(
        new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 1
        )
      )}`;

    finalQuery +=
      ` before:${formatGmailDate(
        tomorrow
      )}`;

    return finalQuery.trim();
  }

  // ==================================================
  // YESTERDAY
  // ==================================================

  if (
    lowerMessage.includes(
      "yesterday"
    )
  ) {
    const yesterday =
      new Date(now);

    yesterday.setDate(
      yesterday.getDate() - 1
    );

    const tomorrow =
      new Date(now);

    tomorrow.setDate(
      tomorrow.getDate() + 1
    );

    let finalQuery =
      query
        .replace(
          /after:\d{4}\/\d{1,2}\/\d{1,2}/gi,
          ""
        )
        .replace(
          /before:\d{4}\/\d{1,2}\/\d{1,2}/gi,
          ""
        )
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    finalQuery +=
      ` after:${formatGmailDate(
        new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate() - 1
        )
      )}`;

    finalQuery +=
      ` before:${formatGmailDate(
        new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate() + 1
        )
      )}`;

    return finalQuery.trim();
  }

  return query.trim();
}

// ==================================================
// MAIN ASSISTANT API
// ==================================================

export async function POST(
  request: Request
) {
  try {
    // --------------------------------------------------
    // AUTHENTICATION
    // --------------------------------------------------

    const session =
      await getServerSession(
        authOptions
      );

    if (!session?.accessToken) {
      return Response.json(
        {
          error:
            "Not authenticated",
        },
        {
          status: 401,
        }
      );
    }

    const {
      message,
      contextEmail,
    } = await request.json();

    if (!message) {
      return Response.json(
        {
          error:
            "Message is required",
        },
        {
          status: 400,
        }
      );
    }

    // ==================================================
    // DIRECT FORWARD HANDLING
    // ==================================================
    // Forwarding is deterministic: when the user asks to
    // forward the currently open email, do not ask Gemini
    // to invent the recipient, subject, or body.
    // Use the actual email context supplied by the page.
    // This also makes simple requests such as
    // "Forward this email to my own email address" work.
    // ==================================================

    const lowerMessage = String(message).toLowerCase();

    const isForwardRequest =
      lowerMessage.includes("forward");

    if (isForwardRequest && contextEmail) {
      const currentUserEmail =
        String(
          session.user?.email ||
            ""
        ).trim();

      const emailMatches =
        String(message).match(
          /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
        ) || [];

      const saysOwnEmail =
        lowerMessage.includes("my own email") ||
        lowerMessage.includes("my email") ||
        lowerMessage.includes("email myself") ||
        lowerMessage.includes("to myself");

      const recipient =
        saysOwnEmail
          ? currentUserEmail || contextEmail.to || ""
          : emailMatches[0] ||
            currentUserEmail ||
            contextEmail.to ||
            "";

      const originalSubject =
        String(
          contextEmail.subject ||
            ""
        ).trim();

      const originalBody =
        String(
          contextEmail.body ||
            contextEmail.snippet ||
            ""
        ).trim();

      return Response.json(
        {
          success: true,

          action: {
            type: "forward",
            to: recipient,
            subject:
              originalSubject
                ? `Fwd: ${originalSubject}`
                : "Fwd:",
            body:
              originalBody ||
              "(No message)",
          },

          reply:
            "I prepared the current email for forwarding.",
        }
      );
    }

    // ==================================================
    // 1. SEARCH EMAILS
    // ==================================================

    const searchEmailsFunction = {
      name: "search_emails",

      description:
        "Search the user's Gmail emails and update the main mail UI with the results. " +
        "Convert natural language into Gmail search syntax. " +
        "Use from:email@example.com for an exact sender email. " +
        "Use a sender name as a keyword when only a name is provided. " +
        "Use is:unread for unread emails. " +
        "Use is:read for read emails. " +
        "Use after:YYYY/MM/DD for emails after a date. " +
        "Use before:YYYY/MM/DD for emails before a date. " +
        "Combine conditions when needed. " +
        "For 'this week', use is:unread or other relevant filters, but the application will calculate the correct dates. " +
        "Examples: " +
        "'emails from john@gmail.com' -> from:john@gmail.com. " +
        "'unread emails' -> is:unread. " +
        "'read emails' -> is:read. " +
        "'emails about interview' -> interview. " +
        "'emails after September 1 2026' -> after:2026/09/01. " +
        "'unread emails from Claude' -> Claude is:unread. " +
        "'unread emails from Claude after September 1 2026' -> Claude is:unread after:2026/09/01.",

      parameters: {
        type: Type.OBJECT,

        properties: {
          query: {
            type: Type.STRING,

            description:
              "A valid Gmail search query. " +
              "Use Gmail operators such as from:, is:unread, is:read, after:, before:.",
          },
        },

        required: [
          "query",
        ],
      },
    };

    // ==================================================
    // 2. COMPOSE EMAIL
    // ==================================================

    const composeEmailFunction = {
      name: "compose_email",

      description:
        "Prepare a new email and open the compose UI. " +
        "Do NOT send the email. " +
        "Extract the recipient, subject, and complete body from the user's request. " +
        "The compose UI must visibly contain the extracted values. " +
        "If the user did not provide a subject, create a short appropriate subject.",

      parameters: {
        type: Type.OBJECT,

        properties: {
          to: {
            type: Type.STRING,

            description:
              "The recipient email address.",
          },

          subject: {
            type: Type.STRING,

            description:
              "The email subject.",
          },

          body: {
            type: Type.STRING,

            description:
              "The complete email body.",
          },
        },

        required: [
          "to",
          "subject",
          "body",
        ],
      },
    };

    // ==================================================
    // 3. OPEN EMAIL
    // ==================================================

    const openEmailFunction = {
      name: "open_email",

      description:
        "Find a specific email and open it in the email detail view. " +
        "Convert the user's natural-language description into a Gmail search query. " +
        "Use this when the user asks to open, read, or view a specific email.",

      parameters: {
        type: Type.OBJECT,

        properties: {
          query: {
            type: Type.STRING,

            description:
              "A Gmail search query that identifies the email to open.",
          },
        },

        required: [
          "query",
        ],
      },
    };

    // ==================================================
    // 4. REPLY TO CURRENT EMAIL
    // ==================================================

    const replyToEmailFunction = {
      name: "reply_to_email",

      description:
        "Prepare a reply to the email currently being viewed by the user. " +
        "Use the current email context supplied by the application. " +
        "The recipient must be the sender of the current email. " +
        "Keep the original subject and add Re: if necessary. " +
        "Do NOT send the reply. " +
        "Open the compose UI with the reply information visibly filled in.",

      parameters: {
        type: Type.OBJECT,

        properties: {
          to: {
            type: Type.STRING,

            description:
              "The sender email address of the currently open email.",
          },

          subject: {
            type: Type.STRING,

            description:
              "The reply subject based on the current email subject.",
          },

          body: {
            type: Type.STRING,

            description:
              "The reply message requested by the user.",
          },
        },

        required: [
          "to",
          "subject",
          "body",
        ],
      },
    };

    // ==================================================
    // 5. FORWARD EMAIL
    // ==================================================

    const forwardEmailFunction = {
      name: "forward_email",

      description:
        "Prepare the CURRENTLY VIEWED EMAIL for forwarding. " +
        "Use ONLY the current email context supplied by the application as the source. " +
        "The subject MUST be exactly 'Fwd: ' followed by the actual current email subject. " +
        "The body MUST copy the actual current email body exactly; do not summarize, rewrite, paraphrase, shorten, or add commentary. " +
        "If the user says 'my own email', 'my email', 'email myself', or 'to myself', use the signed-in user's actual email address. " +
        "NEVER use placeholders such as '[Original Subject]', '[Forwarded email content]', '[Current email subject unavailable]', or '[Current email body unavailable]'. " +
        "Do NOT send the forwarded email. " +
        "Prepare only the compose action with the correct recipient, subject, and original body.",

      parameters: {
        type: Type.OBJECT,

        properties: {
          to: {
            type: Type.STRING,

            description:
              "The email address that should receive the forwarded email.",
          },

          subject: {
            type: Type.STRING,

            description:
              "The forwarding subject, normally beginning with Fwd:.",
          },

          body: {
            type: Type.STRING,

            description:
              "The forwarded email body, including the original email content.",
          },
        },

        required: [
          "to",
          "subject",
          "body",
        ],
      },
    };

    // ==================================================
    // 6. SEND EMAIL
    // ==================================================

    const sendEmailFunction = {
      name: "send_email",

      description:
        "Prepare an email that the user explicitly requested to send. " +
        "Use this when the user clearly says send an email. " +
        "Extract the recipient, subject, and complete body. " +
        "Do NOT actually send the email from this function. " +
        "Return the email information so the application can show a confirmation UI. " +
        "The application will ask the user to confirm before the real Gmail send occurs.",

      parameters: {
        type: Type.OBJECT,

        properties: {
          to: {
            type: Type.STRING,

            description:
              "The recipient email address.",
          },

          subject: {
            type: Type.STRING,

            description:
              "The email subject.",
          },

          body: {
            type: Type.STRING,

            description:
              "The complete email body.",
          },
        },

        required: [
          "to",
          "subject",
          "body",
        ],
      },
    };

    // ==================================================
    // BUILD AI INPUT
    // ==================================================

    let aiMessage =
      message;

    if (contextEmail) {
      aiMessage =
        `CURRENT EMAIL:\n` +
        `From: ${
          contextEmail.from || ""
        }\n` +
        `To: ${
          contextEmail.to || ""
        }\n` +
        `Subject: ${
          contextEmail.subject || ""
        }\n` +
        `Date: ${
          contextEmail.date || ""
        }\n` +
        `Body:\n${
          contextEmail.body ||
          contextEmail.snippet ||
          ""
        }\n\n` +
        `USER REQUEST:\n${message}\n\n` +
        `ACTION RULES:\n` +
        `- First identify the user's requested action: SEARCH, OPEN, COMPOSE, REPLY, FORWARD, or SEND.\n` +
        `- SEARCH: use search_emails and convert the request to Gmail search syntax.\n` +
        `- OPEN/READ: use open_email to locate the requested email.\n` +
        `- COMPOSE/DRAFT: use compose_email. Do not send the email.\n` +
        `- REPLY: use reply_to_email. The recipient MUST be the current email sender and the subject MUST be based on the current email subject with Re: when needed.\n` +
        `- FORWARD: use forward_email. The recipient, subject, and body MUST be based on the current email and the user's forwarding instruction.\n` +
        `- FORWARD SUBJECT: use exactly "Fwd: " followed by the CURRENT EMAIL subject. Never invent a subject.\n` +
        `- FORWARD BODY: copy the CURRENT EMAIL body exactly. Do not summarize, rewrite, paraphrase, shorten, or add commentary.\n` +
        `- FORWARD RECIPIENT: when the user says "my own email", "my email", "email myself", or "to myself", use the signed-in user's actual email address.\n` +
        `- FORWARD PLACEHOLDERS ARE FORBIDDEN: never use "[Original Subject]", "[Forwarded email content]", "[Current email subject unavailable]", "[Current email body unavailable]", "Original Message", or similar placeholder text.\n` +
        `- SEND: use send_email only when the user explicitly asks to send an email. The application will request confirmation before actually sending.\n` +
        `- NEVER send an email merely because the user asks to compose, reply, or forward it.\n`;
    } else {
      aiMessage =
        `USER REQUEST:\n${message}\n\n` +
        `ACTION RULES:\n` +
        `- First identify the user's requested action: SEARCH, OPEN, COMPOSE, REPLY, FORWARD, or SEND.\n` +
        `- SEARCH: use search_emails.\n` +
        `- OPEN/READ: use open_email.\n` +
        `- COMPOSE/DRAFT: use compose_email and do not send.\n` +
        `- SEND: use send_email only when the user explicitly asks to send.\n` +
        `- REPLY or FORWARD requires a current email context. If there is no current email context, do not invent one; ask the user to open the email first.\n` +
        `- Do not invent dates for relative date phrases such as "today", "yesterday", or "this week".\n`;
    }

    // ==================================================
    // ASK GEMINI WITH RETRY
    // ==================================================

    let response;

    const maxAttempts = 3;

    for (
      let attempt = 1;
      attempt <= maxAttempts;
      attempt++
    ) {
      try {
        response =
          await ai.models.generateContent(
            {
              model: "gemini-3.5-flash-lite",
              contents:
                aiMessage,

              config: {
                tools: [
                  {
                    functionDeclarations:
                      [
                        searchEmailsFunction,
                        composeEmailFunction,
                        openEmailFunction,
                        replyToEmailFunction,
                        forwardEmailFunction,
                        sendEmailFunction,
                      ],
                  },
                ],
              },
            }
          );

        break;
      } catch (error: any) {
        console.error(
          `Gemini attempt ${attempt} failed:`,
          error
        );

        const errorText =
          String(
            error?.message ||
              error ||
              ""
          );

        const temporaryError =
          errorText.includes(
            "503"
          ) ||
          errorText.includes(
            "UNAVAILABLE"
          ) ||
          errorText.includes(
            "429"
          ) ||
          errorText.includes(
            "RESOURCE_EXHAUSTED"
          );

        if (
          !temporaryError ||
          attempt === maxAttempts
        ) {
          throw error;
        }

        const delay =
          attempt * 2000;

        console.log(
          `Temporary Gemini error. Retrying in ${delay}ms...`
        );

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              delay
            )
        );
      }
    }

    if (!response) {
      throw new Error(
        "Gemini did not return a response."
      );
    }

    // ==================================================
    // FUNCTION CALL
    // ==================================================

    if (
      response.functionCalls &&
      response.functionCalls
        .length > 0
    ) {
      const functionCall =
        response.functionCalls[0];

      // =================================================
      // SEARCH
      // =================================================

      if (
        functionCall.name ===
        "search_emails"
      ) {
        const rawQuery =
          String(
            functionCall.args
              ?.query || ""
          );

        // IMPORTANT:
        // The application fixes relative
        // date phrases here.
        const query =
          normalizeDateSearchQuery(
            rawQuery,
            message
          );

        console.log(
          "AI search:",
          {
            userMessage:
              message,
            rawQuery,
            finalQuery:
              query,
          }
        );

        const gmailResponse =
          await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
              query
            )}&maxResults=20`,
            {
              headers: {
                Authorization:
                  `Bearer ${session.accessToken}`,
              },

              cache:
                "no-store",
            }
          );

        if (
          !gmailResponse.ok
        ) {
          const errorText =
            await gmailResponse.text();

          console.error(
            "Gmail search error:",
            errorText
          );

          throw new Error(
            "Gmail search failed"
          );
        }

        const gmailData =
          await gmailResponse.json();

        return Response.json(
          {
            success: true,

            action: {
              type: "search",
              query,
              messages:
                gmailData.messages ||
                [],
            },

            reply:
              `I searched your emails for "${query}".`,
          }
        );
      }

      // =================================================
      // COMPOSE
      // =================================================

      if (
        functionCall.name ===
        "compose_email"
      ) {
        const args =
          functionCall.args ||
          {};

        const to =
          String(
            args.to || ""
          );

        const subject =
          String(
            args.subject || ""
          );

        const body =
          String(
            args.body || ""
          );

        return Response.json(
          {
            success: true,

            action: {
              type: "compose",
              to,
              subject,
              body,
            },

            reply:
              "I opened the compose window and filled in the email.",
          }
        );
      }

      // =================================================
      // OPEN
      // =================================================

      if (
        functionCall.name ===
        "open_email"
      ) {
        const query =
          String(
            functionCall.args
              ?.query || ""
          );

        const gmailResponse =
          await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
              query
            )}&maxResults=1`,
            {
              headers: {
                Authorization:
                  `Bearer ${session.accessToken}`,
              },

              cache:
                "no-store",
            }
          );

        if (
          !gmailResponse.ok
        ) {
          throw new Error(
            "Gmail email lookup failed"
          );
        }

        const gmailData =
          await gmailResponse.json();

        const messages =
          gmailData.messages ||
          [];

        if (
          messages.length === 0
        ) {
          return Response.json(
            {
              success: true,

              action: {
                type: "none",
              },

              reply:
                `I couldn't find an email matching "${query}".`,
            }
          );
        }

        const emailId =
          messages[0].id;

        return Response.json(
          {
            success: true,

            action: {
              type: "open",
              id: emailId,
              query,
            },

            reply:
              "I found the email and opened it.",
          }
        );
      }

      // =================================================
      // REPLY
      // =================================================

      if (
        functionCall.name ===
        "reply_to_email"
      ) {
        const args =
          functionCall.args ||
          {};

        const to =
          String(
            args.to || ""
          );

        const subject =
          String(
            args.subject || ""
          );

        const body =
          String(
            args.body || ""
          );

        return Response.json(
          {
            success: true,

            action: {
              type: "reply",
              to,
              subject,
              body,
            },

            reply:
              "I prepared a reply to the email you're viewing.",
          }
        );
      }

      // =================================================
      // FORWARD
      // =================================================

      if (
        functionCall.name ===
        "forward_email"
      ) {
        const args =
          functionCall.args ||
          {};

        // Gemini can sometimes return placeholder values for
        // "my email" or the current email fields. Prefer the
        // real application context whenever those placeholders
        // are returned.
        const requestedTo =
          String(args.to || "").trim();

        const requestedSubject =
          String(args.subject || "").trim();

        const requestedBody =
          String(args.body || "").trim();

        const currentUserEmail =
          String(
            session.user?.email ||
              ""
          ).trim();

        const contextRecipient =
          String(
            contextEmail?.to ||
              ""
          ).trim();

        const contextSubject =
          String(
            contextEmail?.subject ||
              ""
          ).trim();

        const contextBody =
          String(
            contextEmail?.body ||
              contextEmail?.snippet ||
              ""
          ).trim();

        const isPlaceholderRecipient =
          !requestedTo ||
          requestedTo
            .toLowerCase()
            .includes("example.com") ||
          requestedTo
            .toLowerCase()
            .includes("my email") ||
          requestedTo
            .toLowerCase() === "me";

        const isPlaceholderSubject =
          !requestedSubject ||
          requestedSubject.includes(
            "[Original Subject]"
          ) ||
          requestedSubject === "Fwd:" ||
          requestedSubject === "Fwd";

        const isPlaceholderBody =
          !requestedBody ||
          requestedBody.includes(
            "[Original email content"
          ) ||
          requestedBody.includes(
            "[Original Email Content"
          );

        const to =
          isPlaceholderRecipient
            ? currentUserEmail ||
              contextRecipient
            : requestedTo;

        const subject =
          isPlaceholderSubject
            ? `Fwd: ${contextSubject}`
            : requestedSubject;

        const body =
          isPlaceholderBody
            ? contextBody
            : requestedBody;

        return Response.json(
          {
            success: true,

            action: {
              type: "forward",
              to,
              subject,
              body,
            },

            reply:
              "I prepared the email for forwarding.",
          }
        );
      }

      // =================================================
      // SEND
      // =================================================

      if (
        functionCall.name ===
        "send_email"
      ) {
        const args =
          functionCall.args ||
          {};

        const to =
          String(
            args.to || ""
          );

        const subject =
          String(
            args.subject || ""
          );

        const body =
          String(
            args.body || ""
          );

        return Response.json(
          {
            success: true,

            action: {
              type: "send",
              to,
              subject,
              body,
            },

            reply:
              "I prepared the email. Please confirm before sending.",
          }
        );
      }
    }

    // ==================================================
    // NORMAL AI RESPONSE
    // ==================================================

    return Response.json(
      {
        success: true,

        action: {
          type: "none",
        },

        reply:
          response.text ||
          "I couldn't find an email action to perform.",
      }
    );
  } catch (error: any) {
    console.error(
      "Assistant error:",
      error
    );

    const errorText =
      String(
        error?.message ||
          error ||
          ""
      );

          if (
      errorText.includes("429") ||
      errorText.includes("RESOURCE_EXHAUSTED") ||
      errorText.toLowerCase().includes("quota")
    ) {
      return Response.json(
        {
          error:
            "AI Assistant is temporarily unavailable because the Gemini API quota has been reached. Please try again later.",
        },
        { status: 429 }
      );
    }

    return Response.json(
      {
        error:
          errorText ||
          "Failed to process assistant request",
      },
      {
        status: 500,
      }
    );
  }
}