type GmailRealtimeState = {
  version: number;
  lastChangeAt: number;
  lastHistoryId?: string;
};

declare global {
  var gmailRealtimeState: GmailRealtimeState | undefined;
}

export const gmailRealtimeState =
  globalThis.gmailRealtimeState ??
  (globalThis.gmailRealtimeState = {
    version: 0,
    lastChangeAt: 0,
  });