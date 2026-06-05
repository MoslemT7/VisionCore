import { useState } from "react";
import { useAuth } from "./context/AuthContext";
import LoginForm from "./components/LoginForm";
import RegisterForm from "./components/RegisterForm";
import Sidebar from "./components/layout/Sidebar";
import TopBar  from "./components/layout/TopBar";
import DashboardPage from "./pages/Dashboard";
import AnalyserPage  from "./pages/analyser/AnalyserPage";
import HistoryPage   from "./pages/history/HistoryPage";
import ChatPage      from "./pages/ChatPage";
import SettingsPage  from "./pages/SettingsPage";
import { useVideoUpload } from "./hooks/useVideoUpload";

export default function App() {
  const { user, error, handleLogin, handleRegister, logout } = useAuth();
  const [authPage, setAuthPage] = useState("login");

  const [activeNav, setActiveNav] = useState("analyser");
  const [file,         setFile        ] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadError,  setUploadError ] = useState("");
  const [activeTab,    setActiveTab   ] = useState("video");
  const [messages,     setMessages    ] = useState([
    { from: "ai", text: "Analysis complete. Ask me anything about the footage." },
  ]);
  const [chatInput, setChatInput] = useState("");

  const {
    upload,
    analyzeImages,
    loading:          analysisLoading,
    result,
    error:            analysisError,
    progress:         analysisProgressPct,
    status:           analysisStatus,
    reset:            resetUpload,
    analysisProgress,
  } = useVideoUpload();

  const resetAnalyser = () => {
    setFile(null);
    setUploadedFile(null);
    setUploadError("");
    setActiveTab("video");
    resetUpload?.();
  };

  const analyserProps = {
    file,         setFile,
    uploadedFile, setUploadedFile,
    uploadError,  setUploadError,
    activeTab,    setActiveTab,
    messages,     setMessages,
    chatInput,    setChatInput,
    analysisLoading,
    result,
    analysisError,
    analysisProgress,
    analysisProgressPct,
    analysisStatus,
    upload,
    analyzeImages,
    reset: resetAnalyser,
  };

  if (!user) {
    return authPage === "login" ? (
      <LoginForm onLogin={handleLogin} onSwitch={() => setAuthPage("register")} error={error} />
    ) : (
      <RegisterForm
        onRegister={async (u, e, p) => {
          const ok = await handleRegister(u, e, p);
          if (ok) setAuthPage("login");
        }}
        onSwitch={() => setAuthPage("login")}
        error={error}
      />
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <Sidebar activeNav={activeNav} onNavChange={setActiveNav} onLogout={logout} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar activeNav={activeNav} />

        <div className="flex-1 overflow-y-auto min-h-0 relative">
          <div className={activeNav === "grid"     ? "block h-full" : "hidden"}><DashboardPage onNavigate={setActiveNav} /></div>
          <div className={activeNav === "analyser" ? "block h-full" : "hidden"}><AnalyserPage  {...analyserProps} /></div>
          <div className={activeNav === "history"  ? "block h-full" : "hidden"}><HistoryPage   onNavigate={setActiveNav} /></div>
          <div className={activeNav === "chat"     ? "block h-full" : "hidden"}><ChatPage      onNavigate={setActiveNav} /></div>
          <div className={activeNav === "cog"      ? "block h-full" : "hidden"}><SettingsPage  onNavigate={setActiveNav} /></div>
        </div>
      </div>
    </div>
  );
}