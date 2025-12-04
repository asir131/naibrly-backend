import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { api, setAuthToken } from "../utils/api";
import { createSocket } from "../utils/socket";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

export default function ChatPage() {
  const router = useRouter();
  const socketRef = useRef(null);
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [requestId, setRequestId] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [bundleCustomerId, setBundleCustomerId] = useState("");
  const [content, setContent] = useState("");
  const [quickChats, setQuickChats] = useState([]);
  const [newQuickChat, setNewQuickChat] = useState("");
  const [joining, setJoining] = useState(false);

  // Load token/user from storage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedToken = localStorage.getItem("nb_token");
    const storedUser = localStorage.getItem("nb_user");
    if (!storedToken || !storedUser) {
      router.replace("/");
      return;
    }
    setAuthToken(storedToken);
    setToken(storedToken);
    try {
      setUser(JSON.parse(storedUser));
    } catch (e) {
      console.warn("Failed to parse stored user", e);
    }
  }, [router]);

  // Connect socket when token present
  useEffect(() => {
    if (!token || typeof window === "undefined") return;
    const socket = createSocket(token);
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      pushLog("socket connected " + socket.id);
      socket.emit("authenticate", { token });
      socket.emit("join_all_conversations");
      socket.emit("get_available_quick_chats");
    });

    socket.on("disconnect", (reason) => {
      setConnected(false);
      pushLog("socket disconnected: " + reason);
    });

    socket.on("message", (payload) => {
      const { type, data } = payload || {};
      switch (type) {
        case "welcome":
        case "authenticated":
          pushLog(type + " message received");
          break;
        case "conversation_history":
          setConversation(data?.conversation || null);
          setMessages(data?.messages || []);
          break;
        case "joined_conversation":
          pushLog("joined conversation " + data?.conversationId);
          break;
        case "new_message":
        case "new_quick_message":
          if (data?.message) {
            setMessages((prev) => [...prev, data.message]);
          }
          break;
        case "available_quick_chats":
          setQuickChats(data?.quickChats || []);
          break;
        case "error":
          pushLog("error: " + (data?.message || "unknown"));
          break;
        default:
          break;
      }
    });

    socket.on("connect_error", (err) => pushLog("connect_error: " + err.message));

    return () => {
      socket.off();
      socket.disconnect();
    };
  }, [token]);

  const pushLog = (entry) => {
    setLog((prev) => [{ text: entry, ts: Date.now() }, ...prev].slice(0, 50));
  };

  const joinConversation = () => {
    const socket = socketRef.current;
    if (!socket) return;
    setJoining(true);
    const payload = {};
    if (requestId) payload.requestId = requestId.trim();
    if (bundleId) payload.bundleId = bundleId.trim();
    if (bundleCustomerId) payload.customerId = bundleCustomerId.trim();
    socket.emit("join_conversation", payload);
    socket.emit("get_conversation", payload);
    socket.emit("get_available_quick_chats");
    setTimeout(() => setJoining(false), 300);
  };

  const sendMessage = () => {
    const socket = socketRef.current;
    if (!socket || !content) return;
    const payload = { content };
    if (requestId) payload.requestId = requestId.trim();
    if (bundleId) payload.bundleId = bundleId.trim();
    if (bundleCustomerId) payload.customerId = bundleCustomerId.trim();
    socket.emit("send_message", payload);
    setContent("");
  };

  const sendQuickChat = (quickChatId) => {
    const socket = socketRef.current;
    if (!socket) return;
    const payload = { quickChatId };
    if (requestId) payload.requestId = requestId.trim();
    if (bundleId) payload.bundleId = bundleId.trim();
    if (bundleCustomerId) payload.customerId = bundleCustomerId.trim();
    socket.emit("send_quick_chat", payload);
  };

  const createQuickChat = async () => {
    if (!newQuickChat.trim()) return;
    try {
      const { data } = await api.post("/quick-chats", { content: newQuickChat.trim() });
      if (data?.success) {
        setNewQuickChat("");
        fetchQuickChats();
      }
    } catch (err) {
      pushLog("failed to create quick chat: " + (err.response?.data?.message || err.message));
    }
  };

  const fetchQuickChats = async () => {
    try {
      const { data } = await api.get("/quick-chats");
      setQuickChats(data?.data || data?.quickChats || []);
    } catch (err) {
      pushLog("failed to load quick chats: " + (err.response?.data?.message || err.message));
    }
  };

  const logout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("nb_token");
      localStorage.removeItem("nb_user");
    }
    setAuthToken(null);
    router.replace("/");
  };

  const info = useMemo(() => {
    return user ? `${user.role || "?"} ? ${user.email || ""}` : "";
  }, [user]);

  return (
    <div className="layout">
      <div className="card">
        <div className="topbar">
          <div>
            <div className="badge">{connected ? "Connected" : "Disconnected"}</div>
            <div className="small" style={{ marginTop: 6 }}>{info}</div>
            <div className="small">API: {API_BASE}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="button secondary" onClick={fetchQuickChats}>Reload Quick Chats</button>
            <button className="button secondary" onClick={logout}>Logout</button>
          </div>
        </div>

        <div className="chat-shell">
          <div className="section">
            <h3>Context</h3>
            <div className="row">
              <label className="small">requestId</label>
              <input className="input" value={requestId} onChange={(e) => setRequestId(e.target.value)} />
            </div>
            <div className="row">
              <label className="small">bundleId</label>
              <input className="input" value={bundleId} onChange={(e) => setBundleId(e.target.value)} />
            </div>
            <div className="row">
              <label className="small">customerId (providers only for bundle)</label>
              <input className="input" value={bundleCustomerId} onChange={(e) => setBundleCustomerId(e.target.value)} />
            </div>
            <button className="button" onClick={joinConversation} disabled={joining}>
              {joining ? "Joining..." : "Join & Load"}
            </button>
            <div className="small" style={{ marginTop: 8 }}>
              Tip: Customers only need requestId or bundleId; providers talking to a bundle participant must add customerId.
            </div>
          </div>

          <div className="section">
            <h3>Conversation</h3>
            <div className="messages">
              {messages.map((m) => (
                <div key={m._id || m.timestamp} className={`bubble ${m.senderRole === "customer" ? "me" : "them"}`}>
                  <div>{m.content}</div>
                  <div className="meta">{m.senderRole} ? {new Date(m.timestamp).toLocaleTimeString()}</div>
                </div>
              ))}
              {messages.length === 0 && <div className="small">No messages yet.</div>}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Type a message" />
              <button className="button" onClick={sendMessage}>Send message</button>
            </div>
          </div>

          <div className="section">
            <h3>Quick Chats</h3>
            <div className="row">
              <textarea
                value={newQuickChat}
                onChange={(e) => setNewQuickChat(e.target.value)}
                placeholder="Create a quick chat phrase"
              />
              <button className="button secondary" onClick={createQuickChat}>Create quick chat</button>
            </div>
            <div className="quickchats">
              {quickChats.map((qc) => (
                <button key={qc._id} className="button secondary" onClick={() => sendQuickChat(qc._id)}>
                  <div>{qc.content}</div>
                  <div className="meta">usage {qc.usageCount || 0}</div>
                </button>
              ))}
              {quickChats.length === 0 && <div className="small">No quick chats yet.</div>}
            </div>
          </div>
        </div>

        <div className="section" style={{ marginTop: 12 }}>
          <h3>Log</h3>
          <div className="small">Most recent first.</div>
          <div className="messages" style={{ height: 160 }}>
            {log.map((l, idx) => (
              <div key={idx} className="small">{new Date(l.ts).toLocaleTimeString()} ? {l.text}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
