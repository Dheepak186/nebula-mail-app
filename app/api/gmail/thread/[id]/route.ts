import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { google } from "googleapis";

type GmailPart = {
  mimeType?: string | null;
  body?: {
    data?: string | null;
  } | null;
  parts?: GmailPart[] | null;
};

function decodeBase64Url(data: string): string {
  const normalized = data
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded =
    normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  return Buffer.from(padded, "base64").toString("utf-8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

function extractBody(part?: GmailPart): string {
  if (!part) {
    return "";
  }

  if (
    part.mimeType === "text/plain" &&
    part.body?.data
  ) {
    return decodeBase64Url(part.body.data);
  }

  if (
    part.mimeType === "text/html" &&
    part.body?.data
  ) {
    return stripHtml(
      decodeBase64Url(part.body.data)
    );
  }

  if (part.parts) {
    for (const child of part.parts) {
      const body = extractBody(child);

      if (body) {
        return body;
      }
    }
  }

  return "";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return Response.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id) {
      return Response.json(
        { error: "Thread ID is required" },
        { status: 400 }
      );
    }

    const oauth2Client = new google.auth.OAuth2();

    oauth2Client.setCredentials({
      access_token: session.accessToken,
    });

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const response = await gmail.users.threads.get({
      userId: "me",
      id,
      format: "full",
    });

    const messages = response.data.messages || [];

    const threadMessages = messages.map((message) => {
      const headers = message.payload?.headers || [];

      const getHeader = (name: string) =>
        headers.find(
          (header) =>
            header.name?.toLowerCase() ===
            name.toLowerCase()
        )?.value || "";

      const body = extractBody(
        message.payload as GmailPart | undefined
      );

      return {
        id: message.id || "",
        threadId: message.threadId || id,
        from: getHeader("From"),
        to: getHeader("To"),
        subject: getHeader("Subject"),
        date: getHeader("Date"),
        body: body || message.snippet || "",
        snippet: message.snippet || "",
      };
    });

    return Response.json({
      threadId: response.data.id || id,
      messages: threadMessages,
    });
  } catch (error) {
    console.error("Gmail thread error:", error);

    return Response.json(
      { error: "Failed to fetch email thread" },
      { status: 500 }
    );
  }
}