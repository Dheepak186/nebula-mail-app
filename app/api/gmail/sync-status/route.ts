import { gmailRealtimeState } from "@/lib/gmail-realtime";

export async function GET() {
  return Response.json({
    version: gmailRealtimeState.version,
    lastChangeAt: gmailRealtimeState.lastChangeAt,
    lastHistoryId: gmailRealtimeState.lastHistoryId,
  });
}