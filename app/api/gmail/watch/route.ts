import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { google } from "googleapis";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return Response.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const topicName = process.env.GMAIL_PUBSUB_TOPIC;

    if (!topicName) {
      return Response.json(
        {
          error: "GMAIL_PUBSUB_TOPIC is not configured",
        },
        { status: 500 }
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

    const response = await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName,
        labelIds: ["INBOX"],
        labelFilterBehavior: "INCLUDE",
      },
    });

    return Response.json({
      success: true,
      historyId: response.data.historyId,
      expiration: response.data.expiration,
    });
  } catch (error) {
    console.error("Gmail watch error:", error);

    return Response.json(
      {
        error: "Failed to start Gmail watch",
      },
      { status: 500 }
    );
  }
}