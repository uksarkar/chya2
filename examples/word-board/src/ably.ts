import Ably from "ably";

export const client = new Ably.Realtime(
  import.meta.env.VITE_APP_ABLY_KEY
);

export const channel = client.channels.get("word-board-room");
