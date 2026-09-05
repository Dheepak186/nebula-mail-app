import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { google } from "googleapis";

function encodeMessage(message: string) {
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function isSelfRecipient(value: string) {
  const normalized = value.trim().toLowerCase();

  return (
    normalized === "me" ||
    normalized === "my email" ||
    normalized === "my own email" ||
    normalized === "my own email address" ||
    normalized === "my email address" ||
    normalized === "myself" ||
    normalized === "self"
  );
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return Response.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { to, subject, message } = await request.json();

    if (!to || !subject || !message) {
      return Response.json(
        { error: "To, subject and message are required" },
        { status: 400 }
      );
    }

    /*
     * If the AI says "me" or "my own email address",
     * use the email address of the currently signed-in user.
     */
    let recipient = String(to).trim();

    if (isSelfRecipient(recipient)) {
      const ownEmail = session.user?.email;

      if (!ownEmail) {
        return Response.json(
          { error: "Could not determine your signed-in email address" },
          { status: 400 }
        );
      }

      recipient = ownEmail;
    }

    const oauth2Client = new google.auth.OAuth2();

    oauth2Client.setCredentials({
      access_token: session.accessToken,
    });

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const emailLines = [
      `To: ${recipient}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      message,
    ];

    const rawMessage = encodeMessage(
      emailLines.join("\r\n")
    );

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: rawMessage,
      },
    });

    return Response.json({
      success: true,
      messageId: response.data.id,
      recipient,
    });
  } catch (error: any) {
    console.error("Gmail send error:", error);

    return Response.json(
      {
        error:
          error?.message ||
          "Failed to send email",
      },
      { status: 500 }
    );
  }
}