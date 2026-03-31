import { useEffect, useRef, useState } from "react";
import {
  Bot, User, Send, Loader2, AlertCircle, RotateCcw,
  Film, Check, Search, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { globalChatApi } from "../api/globalChatApi.js";
import { API_BASE } from "../api/client";
import ReactMarkdown from "react-markdown";

const SUGGESTIONS = [
  "Summarise all selected videos.",
  "Which video had the most detections?",
  "Compare the object classes across videos.",
  "Which tracked object travelled the furthest?",
  "What was the average confidence across all videos?",
  "Were there any objects detected in all videos?",
];

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "short" });
}

function Thumbnail({ jobId, alt }) {
  const [state, setState] = useState("loading");
  const src = `${API_BASE}/thumbnail/${jobId}?w=160&h=90`;

  return (
    <div className="relative w-20 h-[45px] rounded overflow-hidden shrink-0 bg-slate-900 border border-slate-700/50">
      {state === "loading" && (
        <div className="absolute inset-0 bg-slate-800 animate-pulse" />
      )}
      {state === "error" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Film size={14} className="text-slate-700" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setState("done")}
        onError={() => setState("error")}
        className={`w-full h-full object-cover transition-opacity duration-300
          ${state === "done" ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

function Message({ role, content, videosUsed }) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center
        ${isUser
          ? "bg-blue-600/30 border border-blue-500/30"
          : "bg-slate-700/60 border border-slate-600/40"}`}>
        {isUser
          ? <User size={13} className="text-blue-400" />
          : <Bot  size={13} className="text-slate-400" />}
      </div>
      <div className="max-w-[78%] space-y-1.5">
        <div className={`px-3.5 py-2.5 rounded-xl text-sm leading-relaxed
          ${isUser
            ? "bg-blue-600/20 border border-blue-500/20 text-slate-200 rounded-tr-sm"
            : "bg-slate-800/70 border border-slate-700/40 text-slate-300 rounded-tl-sm"}`}>
          <ReactMarkdown
            components={{
              strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
              ul:     ({ children }) => <ul className="list-disc list-inside space-y-1 mt-1">{children}</ul>,
              ol:     ({ children }) => <ol className="list-decimal list-inside space-y-1 mt-1">{children}</ol>,
              li:     ({ children }) => <li className="text-slate-300">{children}</li>,
              p:      ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
              code:   ({ children }) => <code className="bg-slate-900 px-1 py-0.5 rounded text-xs font-mono text-blue-300">{children}</code>,
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
        {videosUsed?.length > 0 && (
          <p className="text-[10px] text-slate-600 pl-1">
            Context: {videosUsed.join(", ")}
          </p>
        )}
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
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  );
}

function VideoSelector({ videos, selected, onToggle, onSelectAll, onClear }) {
  const [search,    setSearch]    = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const filtered = videos.filter((v) =>
    (v.filename ?? v.job_id).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-700/20 transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <Film size={13} className="text-blue-400" />
          <p className="text-xs font-semibold text-white">Video Context</p>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-600/20 border border-blue-500/30 text-blue-400">
            {selected.length} / {videos.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selected.length < videos.length
            ? <button onClick={(e) => { e.stopPropagation(); onSelectAll(); }}
                className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors">
                Select all
              </button>
            : <button onClick={(e) => { e.stopPropagation(); onClear(); }}
                className="text-[10px] text-slate-500 hover:text-red-400 transition-colors">
                Clear
              </button>
          }
          {collapsed
            ? <ChevronDown size={12} className="text-slate-500" />
            : <ChevronUp   size={12} className="text-slate-500" />}
        </div>
      </div>

      {!collapsed && (
        <div className="border-t border-slate-700/40">
          <div className="px-3 py-2 border-b border-slate-700/40">
            <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5">
              <Search size={11} className="text-slate-600 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search videos…"
                className="bg-transparent text-xs text-slate-300 placeholder-slate-600 outline-none w-full"
              />
              {search && (
                <button onClick={() => setSearch("")}>
                  <X size={10} className="text-slate-600 hover:text-slate-400" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-[11px] text-slate-600 text-center py-4">No videos found</p>
            ) : (
              filtered.map((video) => {
                const isSelected  = selected.includes(video.job_id);
                const name        = video.filename ?? video.job_id;
                const hasCaptions = !!video.captions?.global_caption;

                return (
                  <div
                    key={video.job_id}
                    onClick={() => onToggle(video.job_id)}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-slate-800/60 last:border-0
                      ${isSelected ? "bg-blue-600/10" : "hover:bg-slate-700/20"}`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                      ${isSelected
                        ? "bg-blue-600 border-blue-500"
                        : "border-slate-600 hover:border-slate-500"}`}>
                      {isSelected && <Check size={9} className="text-white" />}
                    </div>

                    <Thumbnail jobId={video.job_id} alt={name} />

                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 truncate font-medium">{name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-slate-600">{fmtDate(video.analysed_at)}</span>
                        {video.total_detections > 0 && (
                          <span className="text-[10px] text-slate-600">{video.total_detections} det</span>
                        )}
                        {video.total_unique > 0 && (
                          <span className="text-[10px] text-slate-600">{video.total_unique} obj</span>
                        )}
                        {hasCaptions && (
                          <span className="text-[10px] px-1 rounded bg-blue-500/10 text-blue-500/70">
                            captioned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const [videos,   setVideos]   = useState([]);
  const [selected, setSelected] = useState([]);
  const [history,  setHistory]  = useState([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error,    setError]    = useState(null);

  const endRef   = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res   = await globalChatApi.getHistory(100);
        const items = res.data ?? res.items ?? [];
        setVideos(items);
        if (items.length > 0) setSelected([items[0].job_id]);
      } catch (err) {
        setError(err.message);
      } finally {
        setFetching(false);
      }
    })();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  function toggleVideo(jobId) {
    setSelected((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  }

  async function send(question) {
    const q = (question ?? input).trim();
    if (!q || loading) return;

    if (selected.length === 0) {
      setError("Select at least one video before sending.");
      return;
    }

    const userTurn = { role: "user", content: q };
    const next     = [...history, userTurn];

    setHistory(next);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await globalChatApi.send(selected, q, history);
      setHistory([
        ...next,
        { role: "assistant", content: res.answer, videosUsed: res.videos_used },
      ]);
    } catch (err) {
      setError(err.message);
      setHistory(next);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function reset() { setHistory([]); setError(null); setInput(""); }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      <div className="w-80 shrink-0 border-r border-slate-800 flex flex-col gap-4 p-4 overflow-y-auto">
        <div>
          <p className="text-xs font-bold text-white mb-0.5">Global AI Chat</p>
          <p className="text-[11px] text-slate-500">
            Select one or more videos to include in the conversation context.
          </p>
        </div>

        {fetching ? (
          <div className="space-y-2">
            {[1,2,3].map((n) => (
              <div key={n} className="h-16 rounded-lg bg-slate-800/60 animate-pulse" />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Film size={24} className="text-slate-700" />
            <p className="text-xs text-slate-600">No completed analyses found.</p>
            <p className="text-[11px] text-slate-700">Analyse a video first.</p>
          </div>
        ) : (
          <VideoSelector
            videos={videos}
            selected={selected}
            onToggle={toggleVideo}
            onSelectAll={() => setSelected(videos.map((v) => v.job_id))}
            onClear={() => setSelected([])}
          />
        )}

        {selected.length > 0 && (
          <div className="rounded-lg bg-slate-800/40 border border-slate-700/40 px-3 py-2.5 space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
              Active context
            </p>
            {selected.map((id) => {
              const v = videos.find((v) => v.job_id === id);
              return (
                <div key={id} className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-400 truncate flex-1">
                    {v?.filename ?? id}
                  </p>
                  <button onClick={() => toggleVideo(id)}>
                    <X size={10} className="text-slate-600 hover:text-red-400 transition-colors" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <Bot size={13} className="text-blue-400" />
            <p className="text-xs font-semibold text-white">
              {selected.length === 0
                ? "No videos selected"
                : selected.length === 1
                  ? (videos.find((v) => v.job_id === selected[0])?.filename ?? "1 video")
                  : `${selected.length} videos in context`}
            </p>
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

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {history.length === 0 && !loading && (
            <div className="space-y-4">
              <p className="text-[11px] text-slate-600 text-center">
                {selected.length === 0
                  ? "Select a video on the left to begin."
                  : "Ask anything about the selected video(s)."}
              </p>
              {selected.length > 0 && (
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
              )}
            </div>
          )}

          {history.map((msg, i) => (
            <Message key={i} role={msg.role} content={msg.content} videosUsed={msg.videosUsed} />
          ))}

          {loading && <TypingIndicator />}

          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle size={12} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-400">{error}</p>
            </div>
          )}

          <div ref={endRef} />
        </div>

        <div className="px-5 py-3 border-t border-slate-800 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={
                selected.length === 0
                  ? "Select a video first…"
                  : "Ask about detections, objects, performance, captions…"
              }
              rows={1}
              disabled={loading || selected.length === 0}
              className="flex-1 resize-none bg-slate-900/60 border border-slate-700/50 rounded-lg
                px-3 py-2 text-sm text-slate-300 placeholder-slate-600 outline-none
                focus:border-blue-500/50 transition-colors disabled:opacity-40
                max-h-32 overflow-y-auto"
              style={{ lineHeight: "1.5" }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading || selected.length === 0}
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed
                transition-colors"
            >
              {loading
                ? <Loader2 size={13} className="text-white animate-spin" />
                : <Send    size={13} className="text-white" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-700 mt-1.5">Enter to send · Shift+Enter for new line</p>
        </div>

      </div>
    </div>
  );
}