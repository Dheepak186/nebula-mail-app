import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return Response.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const auth = new google.auth.OAuth2();

    auth.setCredentials({
      access_token: session.accessToken,
    });

    const gmail = google.gmail({
      version: "v1",
      auth,
    });

    // Get only the latest 10 inbox messages.
    const response = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["INBOX"],
      maxResults: 10,
    });

    const messages = response.data.messages || [];

    const emails = [];

    // Fetch message details one at a time.
    // This is intentionally limited to 10 messages
    // to reduce Gmail API usage.
    for (const message of messages) {
      if (!message.id) continue;

      const details = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });

      const headers = details.data.payload?.headers || [];

      const getHeader = (name: string) =>
        headers.find(
          (header) =>
            header.name?.toLowerCase() === name.toLowerCase()
        )?.value || "";

      emails.push({
        id: message.id,
        from: getHeader("From"),
        subject: getHeader("Subject"),
        date: getHeader("Date"),
        snippet: details.data.snippet || "",
      });
    }

    return Response.json({ emails });
  } catch (error) {
    console.error("Gmail API error:", error);

    return Response.json(
      { error: "Failed to fetch Gmail messages" },
      { status: 500 }
    );
  }
}