import { gmailRealtimeState } from "@/lib/gmail-realtime";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const encodedData = body?.message?.data;

    if (encodedData) {
      const normalized = encodedData
        .replace(/-/g, "+")
        .replace(/_/g, "/");

      const decoded = Buffer.from(
        normalized,
        "base64"
      ).toString("utf8");

      const notification = JSON.parse(decoded);

      console.log(
        "Gmail notification received:",
        notification
      );

      gmailRealtimeState.version += 1;
      gmailRealtimeState.lastChangeAt = Date.now();
      gmailRealtimeState.lastHistoryId =
        notification.historyId;
    }

    return Response.json({
      success: true,
    });
  } catch (error) {
    console.error("Gmail webhook error:", error);

    return Response.json({
      success: true,
    });
  }
}