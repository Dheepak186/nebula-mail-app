import { GoogleGenAI, Type } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return Response.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { message, contextEmail } = await request.json();

    if (!message) {
      return Response.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // SEARCH EMAILS
    // --------------------------------------------------

    const searchEmailsFunction = {
      name: "search_emails",
description:
  "Search the user's Gmail emails using Gmail search syntax. " +
  "Convert the user's natural-language request into the appropriate Gmail query. " +
  "For an exact sender email use from:email@example.com. " +
  "For an unknown sender name, use the name as a keyword. " +
  "For unread emails use is:unread. " +
  "For read emails use is:read. " +
  "For emails after a date use after:YYYY/MM/DD. " +
  "For emails before a date use before:YYYY/MM/DD. " +
  "Combine multiple conditions when the user asks for multiple filters. " +
  "Examples: 'unread emails from Claude' -> Claude is:unread. " +
  "'emails from john@gmail.com' -> from:john@gmail.com. " +
  "'emails about interview' -> interview. " +
  "'emails after September 1 2026' -> after:2026/09/01. " +
  "'unread emails from Claude after September 1 2026' -> Claude is:unread after:2026/09/01.",

      parameters: {
        type: Type.OBJECT,

        properties: {
          query: {
            type: Type.STRING,
            description:
              "A Gmail search query. Use a plain keyword for an unknown sender name.",
          },
        },

        required: ["query"],
      },
    };

    // --------------------------------------------------
    // COMPOSE EMAIL
    // --------------------------------------------------

    const composeEmailFunction = {
      name: "compose_email",

      description:
        "Prepare a new email draft and open the compose UI. " +
        "Do not send the email. " +
        "Extract the recipient, subject, and body from the user's request. " +
        "If the user does not provide a subject, create a short appropriate subject.",

      parameters: {
        type: Type.OBJECT,

        properties: {
          to: {
            type: Type.STRING,
            description: "The recipient email address.",
          },

          subject: {
            type: Type.STRING,
            description: "The email subject.",
          },

          body: {
            type: Type.STRING,
            description: "The complete email body.",
          },
        },

        required: ["to", "subject", "body"],
      },
    };

    // --------------------------------------------------
    // OPEN EMAIL
    // --------------------------------------------------

    const openEmailFunction = {
      name: "open_email",

      description:
        "Find an email matching the user's description and open it in the email detail view. " +
        "Use a Gmail search query to find the email.",

      parameters: {
        type: Type.OBJECT,

        properties: {
          query: {
            type: Type.STRING,
            description:
              "A Gmail search query used to find the email that should be opened.",
          },
        },

        required: ["query"],
      },
    };

    // --------------------------------------------------
    // REPLY TO CURRENT EMAIL
    // --------------------------------------------------

    const replyToEmailFunction = {
      name: "reply_to_email",

      description:
        "Prepare a reply to the email currently being viewed by the user. " +
        "Use the current email context provided by the application. " +
        "The reply recipient must be the sender of the current email. " +
        "Keep the original subject and add 'Re:' if needed. " +
        "Do not send the email. Open the compose UI with the reply information filled in.",

      parameters: {
        type: Type.OBJECT,

        properties: {
          to: {
            type: Type.STRING,
            description:
              "The sender email address of the current email.",
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

        required: ["to", "subject", "body"],
      },
    };

    // --------------------------------------------------
    // BUILD AI INPUT
    // --------------------------------------------------

    let aiMessage = message;

    if (contextEmail) {
      aiMessage =
        `The user is currently viewing this email:\n\n` +
        `From: ${contextEmail.from || ""}\n` +
        `To: ${contextEmail.to || ""}\n` +
        `Subject: ${contextEmail.subject || ""}\n` +
        `Date: ${contextEmail.date || ""}\n` +
        `Message: ${contextEmail.body || contextEmail.snippet || ""}\n\n` +
        `User request: ${message}\n\n` +
        `Important: If the user says "reply to this", "reply to this email", ` +
        `"respond to this", or similar wording, use the current email above ` +
        `and select the reply_to_email function.`;
    }

    // --------------------------------------------------
    // ASK GEMINI
    // --------------------------------------------------

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",

      contents: aiMessage,

      config: {
        tools: [
          {
            functionDeclarations: [
              searchEmailsFunction,
              composeEmailFunction,
              openEmailFunction,
              replyToEmailFunction,
            ],
          },
        ],
      },
    });

    // --------------------------------------------------
    // FUNCTION CALL
    // --------------------------------------------------

    if (
      response.functionCalls &&
      response.functionCalls.length > 0
    ) {
      const functionCall = response.functionCalls[0];

      // ------------------------------------------------
      // SEARCH
      // ------------------------------------------------

      if (functionCall.name === "search_emails") {
        const query = String(
          functionCall.args?.query || ""
        );

        const gmailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
            query
          )}&maxResults=20`,
          {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
            },
          }
        );

        if (!gmailResponse.ok) {
          throw new Error("Gmail search failed");
        }

        const gmailData = await gmailResponse.json();

        return Response.json({
          success: true,

          action: {
            type: "search",
            query,
            messages: gmailData.messages || [],
          },

          reply: `I searched your emails for "${query}".`,
        });
      }

      // ------------------------------------------------
      // COMPOSE
      // ------------------------------------------------

      if (functionCall.name === "compose_email") {
        const args = functionCall.args || {};

        const to = String(args.to || "");
        const subject = String(args.subject || "");
        const body = String(args.body || "");

        return Response.json({
          success: true,

          action: {
            type: "compose",
            to,
            subject,
            body,
          },

          reply:
            "I opened the compose window and filled in the email.",
        });
      }

      // ------------------------------------------------
      // OPEN
      // ------------------------------------------------

      if (functionCall.name === "open_email") {
        const query = String(
          functionCall.args?.query || ""
        );

        const gmailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
            query
          )}&maxResults=1`,
          {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
            },
          }
        );

        if (!gmailResponse.ok) {
          throw new Error("Gmail email lookup failed");
        }

        const gmailData = await gmailResponse.json();

        const messages = gmailData.messages || [];

        if (messages.length === 0) {
          return Response.json({
            success: true,

            action: {
              type: "none",
            },

            reply:
              `I couldn't find an email matching "${query}".`,
          });
        }

        const emailId = messages[0].id;

        return Response.json({
          success: true,

          action: {
            type: "open",
            id: emailId,
            query,
          },

          reply:
            "I found the email and opened it.",
        });
      }

      // ------------------------------------------------
      // REPLY
      // ------------------------------------------------

      if (functionCall.name === "reply_to_email") {
        const args = functionCall.args || {};

        const to = String(args.to || "");
        const subject = String(args.subject || "");
        const body = String(args.body || "");

        return Response.json({
          success: true,

          action: {
            type: "reply",
            to,
            subject,
            body,
          },

          reply:
            "I prepared a reply to the email you're viewing.",
        });
      }
    }

    // --------------------------------------------------
    // NORMAL AI RESPONSE
    // --------------------------------------------------

    return Response.json({
      success: true,

      action: {
        type: "none",
      },

      reply:
        response.text ||
        "I couldn't find an email action to perform.",
    });

  } catch (error) {
    console.error("Assistant error:", error);

    return Response.json(
      {
        error: "Failed to process assistant request",
      },
      {
        status: 500,
      }
    );
  }
}