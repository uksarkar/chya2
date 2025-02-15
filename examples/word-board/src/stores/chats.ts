import { channel } from "../ably";
import { user } from "../hooks/auth";

const [messages, setMessages] = Chya.createSignal<
  { name: string; text: string }[]
>([]);
const [isTyping, setIsTyping] = Chya.createSignal(false);
const [messageInput, setMessageInput] = Chya.createSignal("");

let interval: NodeJS.Timeout | undefined = undefined;
let lastCallTime = 0;

channel.subscribe("chat", message => {
  setMessages(prev => [...prev, message.data]);
});

channel.subscribe("typing", message => {
  if (message.data === user()?.uid) {
    return;
  }

  setIsTyping(true);
  clearTimeout(interval);

  interval = setTimeout(() => setIsTyping(false), 1000);
});

const sendMessage = () => {
  if (!messageInput().trim().length || !user()) {
    return;
  }

  channel.publish("chat", {
    text: messageInput(),
    name: user()?.displayName
  });

  setMessageInput("");
  setIsTyping(false);
};

Chya.createEffect(() => {
  messageInput();
  const u = user();
  const currentTime = Date.now();

  if (u && currentTime - lastCallTime >= 200) {
    channel.publish("typing", u.uid);
    lastCallTime = currentTime;
  }
});

export { messages, messageInput, isTyping, sendMessage };
