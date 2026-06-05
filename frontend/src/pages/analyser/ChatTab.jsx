import { useEffect, useRef, useState } from "react";
import { Send, Bot, User, Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { chatApi } from "../../api/chatApi";
import ReactMarkdown from "react-markdown";
import { OllamaStatusBadge } from "../../components/OllamaStatusBadge";

const SUGGESTIONS = [
  "What objects were detected most frequently?",
  "Describe the overall activity in the video.",
  "Which tracked object moved the most?",
  "What was the average detection confidence?",
  "Were there any unusual detections?",
];

function Message({ role, content }) {
  const isUser = role === "user";
  let text = "";
  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    text = parsed?.answer ?? (typeof content === "string" ? content : JSON.stringify(content ?? ""));
  } catch {
    text = typeof content === "string" ? content : JSON.stringify(content ?? "");
  }
  
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center
        ${isUser ? "bg-blue-600/30 border border-blue-500/30" : "bg-slate-700/60 border border-slate-600/40"}`}>
        {isUser
          ? <User size={13} className="text-blue-400" />
          : <Bot  size={13} className="text-slate-400" />
        }
      </div>
      <div className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-m leading-relaxed
        ${isUser
          ? "bg-blue-600/20 border border-blue-500/20 text-slate-200 rounded-tr-sm"
          : "bg-slate-800/70 border border-slate-700/40 text-slate-300 rounded-tl-sm"
        }`}>
        <ReactMarkdown
          components={{
            p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />,
            ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-2" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal ml-4 mb-2" {...props} />,
            li: ({node, ...props}) => <li className="mb-1" {...props} />,
            strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
            code: ({node, ...props}) => <code className="bg-slate-900 px-1 rounded text-blue-300 font-mono" {...props} />
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center
        bg-slate-700/60 border border-slate-600/40">
        <Bot size={13} className="text-slate-400" />
      </div>
      <div className="px-3.5 py-3 rounded-xl rounded-tl-sm bg-slate-800/70 border border-slate-700/40
        flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ChatTab({ Card, PlaceholderBox, result }) {
  const jobId     = result?.job_id ?? null;
  const isReady   = !!jobId && result?.status === "completed";

  const [history,  setHistory]  = useState([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const endRef     = useRef(null);
  const inputRef   = useRef(null);
  const prevJobRef = useRef(null);

  useEffect(() => {
    if (jobId !== prevJobRef.current) {
      setHistory([]);
      setError(null);
      setInput("");
      prevJobRef.current = jobId;
    }
  }, [jobId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  async function send(question) {
    const q = (question ?? input).trim();
    if (!q || loading || !isReady) return;

    const userTurn = { role: "user", content: q };
    const next     = [...history, userTurn];

    setHistory(next);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const data = await chatApi.send(jobId, q, history);
      const answer = typeof data.answer === "string" ? data.answer : JSON.stringify(data.answer);
      setHistory([...next, { role: "assistant", content: answer }]);
    } catch (err) {
      setError(err.message ?? "Something went wrong.");
      setHistory(next);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
      console.log("answer type:", typeof response.answer, response.answer);
    }
  }

  function reset() {
    setHistory([]);
    setError(null);
    setInput("");
  }

  if (!isReady) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bot size={13} className="text-slate-600" />
          <p className="text-xs font-semibold text-slate-500">AI Chat</p>
        </div>
        <PlaceholderBox h="h-48" />
        <p className="text-[11px] text-slate-600 mt-3 italic text-center">
          Chat will be available once a video is analysed.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-[600px]">
      <Card className="flex-1 flex flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Bot size={13} className="text-blue-400" />
            <p className="text-xs font-semibold text-white">AI Chat</p> <OllamaStatusBadge></OllamaStatusBadge>
            {history.length > 0 && (
              <span className="text-[10px] text-slate-600 font-mono">
                {Math.floor(history.length / 2)} turn{history.length > 2 ? "s" : ""}
              </span>
            )}
          </div>
          {history.length > 0 && (
            <button
              onClick={reset}
              className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
            >
              <RotateCcw size={10} />
              Clear
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {history.length === 0 && !loading && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-600 text-center">
                Ask anything about this video analysis.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-700/60
                      text-slate-400 hover:text-slate-200 hover:border-blue-500/40
                      hover:bg-blue-600/10 transition-colors text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {history.map((msg, i) => (
            <Message key={i} role={msg.role} content={msg.content} />
          ))}

          {loading && <TypingIndicator />}

          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg
              bg-red-500/10 border border-red-500/20">
              <AlertCircle size={12} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-400">{error}</p>
            </div>
          )}

          <div ref={endRef} />
        </div>

        <div className="px-4 py-3 border-t border-slate-800">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about objects, activity, confidence…"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none bg-slate-900/60 border border-slate-700/50 rounded-lg
                px-3 py-2 text-sm text-slate-300 placeholder-slate-600 outline-none
                focus:border-blue-500/50 transition-colors disabled:opacity-40
                max-h-32 overflow-y-auto"
              style={{ lineHeight: "1.5" }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed
                transition-colors"
            >
              {loading
                ? <Loader2 size={13} className="text-white animate-spin" />
                : <Send     size={13} className="text-white" />
              }
            </button>
          </div>
          <p className="text-[10px] text-slate-700 mt-1.5">Enter to send · Shift+Enter for new line</p>
        </div>
      </Card>
    </div>
  );
}