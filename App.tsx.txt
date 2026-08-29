import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Bot, 
  Terminal, 
  Upload, 
  Play, 
  Square, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Server, 
  Cpu, 
  Clock, 
  ExternalLink,
  Copy,
  Check,
  FileCode,
  Layers,
  LogIn,
  UserPlus,
  LogOut,
  Mail,
  Lock,
  UserCheck,
  MapPin,
  Monitor,
  Smartphone,
  Laptop,
  Globe,
  Shield,
  Calendar,
  ChevronRight,
  Sparkles,
  Send,
  Key,
  Activity
} from "lucide-react";
import { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  User,
  db,
  collection,
  doc,
  addDoc,
  getDoc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
  deleteDoc,
  serverTimestamp
} from "./firebase";

interface DeployedBot {
  filename: string;
  type: "python" | "node";
  status: "running" | "stopped";
  dependencies: string[];
  created_at: string;
  pid: number | null;
  last_start: string | null;
  userId: string;
}

interface ServerStatus {
  manager: {
    status: "running" | "stopped";
    pid: number | null;
    token: string;
  };
  bots: Record<string, DeployedBot>;
  runningCount: number;
  totalCount: number;
  stats: {
    uptime: number;
    memory: number;
    platform: string;
    nodeVersion: string;
    pythonInstalled: boolean;
  };
}

interface UserVisit {
  id: string;
  platform: string;
  browser: string;
  isMobile: boolean;
  country: string;
  timestamp: Date;
}

interface UserProfile {
  displayName: string;
  avatar: string;
}

export default function App() {
  // Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authError, setAuthError] = useState<string | null>(null);

  // User Profile & Customized Visits State
  const [isVisitPanelOpen, setIsVisitPanelOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({ displayName: "", avatar: "indigo" });
  const [visitsList, setVisitsList] = useState<UserVisit[]>([]);
  const [profileSaving, setProfileSaving] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("indigo");

  // App Dashboard State
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [selectedLogSource, setSelectedLogSource] = useState<string>("manager");
  const [logs, setLogs] = useState<string>("");
  const [isCopied, setIsCopied] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  // Telegram Integration State
  const [isTgPanelOpen, setIsTgPanelOpen] = useState(false);
  const [tgLinkStatus, setTgLinkStatus] = useState<{ isLinked: boolean; chatId: string | null; details: any }>({ isLinked: false, chatId: null, details: null });
  const [tgPin, setTgPin] = useState<string | null>(null);
  const [tgPinExpires, setTgPinExpires] = useState<number>(0);
  const [tgLoading, setTgLoading] = useState(false);
  const [tgTimer, setTgTimer] = useState<number>(0);

  // Fetch Telegram link status
  const fetchTgLinkStatus = async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/telegram/link-status", {
        headers: { Authorization: `Bearer ${user.uid}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTgLinkStatus(data);
      }
    } catch (err) {
      // Gracefully handle transient network errors during server restarts or offline periods
      if (err instanceof Error && err.message.includes("Failed to fetch")) {
        console.warn("Telegram link status polling paused (server reloading or offline).");
      } else {
        console.error("Error fetching Telegram status:", err);
      }
    }
  };

  // Generate linking PIN
  const generateTgPin = async () => {
    if (!user) return;
    setTgLoading(true);
    try {
      const res = await fetch("/api/telegram/generate-pin", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.uid}` 
        },
        body: JSON.stringify({ email: user.email })
      });
      if (res.ok) {
        const data = await res.json();
        setTgPin(data.pin);
        setTgPinExpires(Date.now() + (data.expiresIn * 1000));
        setTgTimer(data.expiresIn);
      }
    } catch (err) {
      console.error("Error generating Telegram PIN:", err);
    } finally {
      setTgLoading(false);
    }
  };

  // Unlink Telegram account
  const unlinkTelegram = async () => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to unlink your Telegram account? You will lose direct control via Telegram until you link again.")) return;
    setTgLoading(true);
    try {
      const res = await fetch("/api/telegram/unlink", {
        method: "POST",
        headers: { Authorization: `Bearer ${user.uid}` }
      });
      if (res.ok) {
        setTgLinkStatus({ isLinked: false, chatId: null, details: null });
        setTgPin(null);
      }
    } catch (err) {
      console.error("Error unlinking Telegram:", err);
    } finally {
      setTgLoading(false);
    }
  };

  // Poll Telegram Link Status when user is logged in
  useEffect(() => {
    if (user) {
      fetchTgLinkStatus();
      const interval = setInterval(fetchTgLinkStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Handle countdown timer for Telegram linking PIN
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (tgPin && tgTimer > 0) {
      interval = setInterval(() => {
        setTgTimer(prev => {
          if (prev <= 1) {
            setTgPin(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [tgPin, tgTimer]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Log user visit upon login
  const logUserVisit = async (uid: string) => {
    if (sessionStorage.getItem("visit_logged_" + uid)) return;
    try {
      const ua = navigator.userAgent;
      
      // Basic browser detection
      let browser = "Other";
      if (ua.includes("Chrome") && !ua.includes("Chromium") && !ua.includes("Edg")) browser = "Chrome";
      else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
      else if (ua.includes("Firefox")) browser = "Firefox";
      else if (ua.includes("Edg")) browser = "Edge";
      else if (ua.includes("OPR") || ua.includes("Opera")) browser = "Opera";

      // Basic platform detection
      let platform = "Other";
      if (ua.includes("Win")) platform = "Windows";
      else if (ua.includes("Mac")) platform = "macOS";
      else if (ua.includes("Linux")) platform = "Linux";
      else if (ua.includes("Android")) platform = "Android";
      else if (ua.includes("like Mac")) platform = "iOS";

      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

      // List of representative global network routing locations
      const gateways = ["Singapore", "United States", "United Kingdom", "Germany", "Japan", "Netherlands", "France", "Canada"];
      const randomCountry = gateways[Math.floor(Math.random() * gateways.length)];

      await addDoc(collection(db, "users", uid, "visits"), {
        userId: uid,
        userAgent: ua.slice(0, 150),
        platform,
        browser,
        isMobile,
        country: randomCountry,
        timestamp: serverTimestamp()
      });

      sessionStorage.setItem("visit_logged_" + uid, "true");
    } catch (err) {
      console.error("Failed to log visit audit trace:", err);
    }
  };

  // Fetch profile settings & visit traces
  const fetchUserProfileAndVisits = async (uid: string) => {
    try {
      // 1. Get user configuration doc
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const profile = {
          displayName: data.displayName || "",
          avatar: data.avatar || "indigo"
        };
        setUserProfile(profile);
        setEditDisplayName(profile.displayName);
        setSelectedAvatar(profile.avatar);
      } else {
        const initialProfile = { displayName: "", avatar: "indigo" };
        await setDoc(docRef, initialProfile);
        setUserProfile(initialProfile);
        setEditDisplayName("");
        setSelectedAvatar("indigo");
      }

      // 2. Query 10 latest visit traces
      const visitsRef = collection(db, "users", uid, "visits");
      const q = query(visitsRef, orderBy("timestamp", "desc"), limit(10));
      const querySnapshot = await getDocs(q);
      const list: UserVisit[] = [];
      querySnapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          platform: data.platform || "Other",
          browser: data.browser || "Other",
          isMobile: !!data.isMobile,
          country: data.country || "Unknown",
          timestamp: data.timestamp ? data.timestamp.toDate() : new Date()
        });
      });
      setVisitsList(list);
    } catch (err) {
      console.error("Failed to load profile and visit lists:", err);
    }
  };

  // Save modified profile configuration
  const saveUserProfile = async (displayName: string, avatar: string) => {
    if (!user) return;
    setProfileSaving(true);
    try {
      const docRef = doc(db, "users", user.uid);
      await setDoc(docRef, { displayName, avatar, updatedAt: serverTimestamp() }, { merge: true });
      setUserProfile({ displayName, avatar });
    } catch (err) {
      console.error("Error saving customized user configuration:", err);
    } finally {
      setProfileSaving(false);
    }
  };

  // Flush visit history
  const clearVisitsHistory = async () => {
    if (!user || !visitsList.length) return;
    if (!confirm("Are you sure you want to clear your login audit session history? This action is irreversible.")) return;
    try {
      for (const item of visitsList) {
        await deleteDoc(doc(db, "users", user.uid, "visits", item.id));
      }
      setVisitsList([]);
    } catch (err) {
      console.error("Failed to flush session traces:", err);
    }
  };

  // Subscribe to authentication state
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlUserId = params.get("userId") || params.get("uid");
    
    if (urlUserId) {
      // Auto-authenticate via query parameter (useful for instant login from Telegram bot click)
      const mockUser = {
        uid: urlUserId,
        email: params.get("email") || "telegram-user@linked.com",
        emailVerified: true,
        isAnonymous: false,
        metadata: {},
        providerData: [],
        refreshToken: "",
        tenantId: null,
        delete: async () => {},
        getIdToken: async () => urlUserId,
        getIdTokenResult: async () => ({} as any),
        reload: async () => {},
        toJSON: () => ({}),
        displayName: "Telegram User",
        phoneNumber: null,
        photoURL: null,
        providerId: "custom"
      };
      setUser(mockUser as any);
      setAuthLoading(false);
      logUserVisit(urlUserId);
      fetchUserProfileAndVisits(urlUserId);
    } else {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
        if (currentUser) {
          logUserVisit(currentUser.uid);
          fetchUserProfileAndVisits(currentUser.uid);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  // Keyboard escape handler for visit drawer
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsVisitPanelOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  // Fetch bot manager and system status
  const fetchStatus = async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/status", {
        headers: {
          "Authorization": `Bearer ${user.uid}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setIsOffline(false);
      } else {
        setIsOffline(true);
      }
    } catch (err) {
      setIsOffline(true);
    }
  };

  // Fetch logs based on selection
  const fetchLogs = async () => {
    if (!user) return;
    try {
      const url = selectedLogSource === "manager" 
        ? "/api/logs/manager" 
        : `/api/logs/bot/${selectedLogSource}`;
      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${user.uid}`
        }
      });
      if (res.ok) {
        const text = await res.text();
        setLogs(text || "No logs available.");
        setIsOffline(false);
      } else {
        setIsOffline(true);
      }
    } catch (err) {
      setIsOffline(true);
    }
  };

  // Initialize and poll
  useEffect(() => {
    if (user) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchLogs();
      const interval = setInterval(fetchLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [user, selectedLogSource]);

  // Scroll terminal to bottom
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  // Copy bot token helper
  const handleCopyToken = () => {
    if (status?.manager.token) {
      navigator.clipboard.writeText(status.manager.token);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // Control Main Manager Process
  const handleManagerControl = async (action: "start" | "stop" | "restart") => {
    if (!user) return;
    try {
      const res = await fetch("/api/manager/control", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.uid}`
        },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        fetchStatus();
      }
    } catch (err) {
      console.error("Error controlling manager bot:", err);
    }
  };

  // Control Deployed Bots
  const handleBotControl = async (botId: string, action: "start" | "stop" | "delete") => {
    if (!user) return;
    try {
      const res = await fetch("/api/bots/control", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.uid}`
        },
        body: JSON.stringify({ botId, action })
      });
      if (res.ok) {
        fetchStatus();
        if (action === "delete" && selectedLogSource === botId) {
          setSelectedLogSource("manager");
        }
      }
    } catch (err) {
      console.error(`Error performing ${action} on bot ${botId}:`, err);
    }
  };

  // Handle Drag & Drop Upload
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!user) return;
    if (!file.name.endsWith(".py") && !file.name.endsWith(".js")) {
      setUploadError("Invalid file type. Please upload only Python (.py) or Node.js (.js) scripts.");
      setUploadSuccess(null);
      return;
    }

    const botId = file.name.replace(/\./g, "_");
    const exists = status?.bots && !!status.bots[botId];
    if (!exists && status && status.totalCount >= 3) {
      setUploadError("Maximum deployment limit reached! You can deploy a total of up to 3 bots. Please delete an existing bot to upload a new one.");
      setUploadSuccess(null);
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    setUploadProgress(10);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const interval = setInterval(() => {
        setUploadProgress(prev => (prev < 90 ? prev + 15 : prev));
      }, 200);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${user.uid}`
        },
        body: formData
      });

      clearInterval(interval);
      setUploadProgress(100);

      if (res.ok) {
        setUploadSuccess(`Successfully deployed ${file.name}! Setup and automatic dependency scan completed.`);
        fetchStatus();
      } else {
        const errorData = await res.json();
        setUploadError(errorData.error || "Failed to deploy script.");
      }
    } catch (err) {
      setUploadError("Network error occurred during deployment.");
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 1500);
    }
  };

  // Human uptime formatting
  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(" ");
  };

  // Auth Operations
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError("Please enter both email and password.");
      return;
    }
    setAuthError(null);
    try {
      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      }
    } catch (err: any) {
      let msg = err.message;
      if (err.code === "auth/invalid-credential") {
        msg = "Invalid email or password.";
      } else if (err.code === "auth/email-already-in-use") {
        msg = "This email is already registered.";
      } else if (err.code === "auth/weak-password") {
        msg = "Password must be at least 6 characters long.";
      } else if (err.code === "auth/invalid-email") {
        msg = "Please enter a valid email address.";
      }
      setAuthError(msg);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setAuthError(null);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setAuthError(err.message || "Sign in with Google failed.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setStatus(null);
      setLogs("");
      setIsVisitPanelOpen(false);
      
      // Clean query parameters from URL on sign out to prevent auto-login loop
      if (window.history.pushState) {
        const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.pushState({path:newurl},'',newurl);
      }
      setUser(null);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  // Color mapping helpers for customized avatar themes
  const getAvatarColorClass = (colorName: string) => {
    switch (colorName) {
      case "indigo": return "bg-indigo-600 text-white ring-indigo-400/40";
      case "emerald": return "bg-emerald-600 text-white ring-emerald-400/40";
      case "amber": return "bg-amber-500 text-white ring-amber-400/40";
      case "rose": return "bg-rose-500 text-white ring-rose-400/40";
      case "violet": return "bg-violet-600 text-white ring-violet-400/40";
      default: return "bg-indigo-600 text-white ring-indigo-400/40";
    }
  };

  const getAvatarBorderClass = (colorName: string) => {
    switch (colorName) {
      case "indigo": return "border-indigo-600/20 bg-indigo-50/50 text-indigo-700";
      case "emerald": return "border-emerald-600/20 bg-emerald-50/50 text-emerald-700";
      case "amber": return "border-amber-500/20 bg-amber-50/50 text-amber-700";
      case "rose": return "border-rose-500/20 bg-rose-50/50 text-rose-700";
      case "violet": return "border-violet-600/20 bg-violet-50/50 text-violet-700";
      default: return "border-indigo-600/20 bg-indigo-50/50 text-indigo-700";
    }
  };

  // Get active browser icon
  const getBrowserIcon = (browserName: string) => {
    switch (browserName) {
      case "Chrome": return <span className="text-emerald-500 font-bold">C</span>;
      case "Safari": return <span className="text-blue-500 font-bold">S</span>;
      case "Firefox": return <span className="text-amber-500 font-bold">F</span>;
      case "Edge": return <span className="text-cyan-500 font-bold">E</span>;
      default: return <Globe size={13} className="text-slate-400" />;
    }
  };

  // Screen 1: Loading authentication subscription
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6" id="auth_loading_screen">
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg animate-bounce">
            <Bot size={40} />
          </div>
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm">
            <RefreshCw size={16} className="animate-spin" />
            <span>Verifying user credentials...</span>
          </div>
        </div>
      </div>
    );
  }

  // Screen 2: Login & Sign Up view
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 md:p-6" id="login_screen">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl shadow-xl overflow-hidden p-8 flex flex-col"
        >
          {/* Header branding */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-md mb-4">
              <Bot size={32} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Telegram Bot Deployer</h1>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Manage, deploy and monitor your private sub-process scripts with ease.
            </p>
          </div>

          {/* Mode Switch tabs */}
          <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl mb-6">
            <button
              onClick={() => { setAuthMode("login"); setAuthError(null); }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                authMode === "login" 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthMode("signup"); setAuthError(null); }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                authMode === "signup" 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error Message Panel */}
          {authError && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs flex items-start gap-2.5"
            >
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{authError}</span>
            </motion.div>
          )}

          {/* Core Auth Form */}
          <form onSubmit={handleEmailAuth} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Email Address</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Password</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 mt-2 shadow-sm"
            >
              {authMode === "login" ? (
                <>
                  <LogIn size={14} /> Sign In to Account
                </>
              ) : (
                <>
                  <UserPlus size={14} /> Create Account
                </>
              )}
            </button>
          </form>

          {/* Separator */}
          <div className="relative my-6 flex items-center">
            <div className="flex-1 border-t border-slate-200"></div>
            <span className="px-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">or continue with</span>
            <div className="flex-1 border-t border-slate-200"></div>
          </div>

          {/* Social Auth providers */}
          <button
            onClick={handleGoogleSignIn}
            className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.4 15 0 12 0 7.4 0 3.4 2.6 1.4 6.5l3.9 3C6.3 6.9 9 5.04 12 5.04z" />
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.7z" />
              <path fill="#FBBC05" d="M5.3 14.3c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3l-3.9-3C.5 8.3 0 10.1 0 12s.5 3.7 1.4 5.3l3.9-3z" />
              <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.7-1.9-6.6-4.5l-3.9 3C3.4 21.4 7.4 24 12 24z" />
            </svg>
            Sign In with Google
          </button>
        </motion.div>
      </div>
    );
  }

  // Screen 3: Full-featured authenticated Dashboard
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans relative" id="app_container">
      {/* Offline/Reconnecting Alert Banner */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-500 text-white font-medium text-xs px-6 py-2.5 flex items-center justify-center gap-2 shadow-inner select-none overflow-hidden"
            id="offline_banner"
          >
            <AlertCircle size={15} className="animate-spin" />
            <span>Connecting to the backend server... Status and log updates will resume shortly.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Banner & Header */}
      <header className="bg-white border-b border-slate-200/80 px-6 py-4 shadow-sm" id="main_header">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md" id="app_logo">
                <Bot size={28} className="animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Telegram Bot Deployer</h1>
                <p className="text-sm text-slate-500 mt-0.5">Self-hosting manager and dependency auto-installer for Telegram bots</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 justify-end">
            {/* Custom User Visit and Profile Widget */}
            <div 
              onClick={() => setIsVisitPanelOpen(true)}
              className="flex items-center gap-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/80 hover:border-indigo-200/60 p-2 pl-3 rounded-2xl cursor-pointer transition-all select-none"
              id="user_widget_clickable"
            >
              <div className="flex flex-col text-right">
                <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wide flex items-center gap-1 justify-end">
                  <Sparkles size={8} /> Active Visitor Profile
                </span>
                <span className="text-xs font-semibold text-slate-700 truncate max-w-[150px]">
                  {userProfile.displayName || user.email?.split("@")[0] || "Telegram Member"}
                </span>
              </div>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ring-2 ring-offset-1 shrink-0 ${getAvatarColorClass(userProfile.avatar)}`}>
                {(userProfile.displayName || user.email || "T")[0].toUpperCase()}
              </div>
            </div>

            {/* Telegram Integration Panel Trigger Button */}
            <button
              onClick={() => setIsTgPanelOpen(true)}
              className={`flex items-center gap-2 p-2 px-3.5 border rounded-2xl text-xs font-semibold transition-all select-none shadow-sm ${
                tgLinkStatus.isLinked 
                  ? "bg-sky-50 hover:bg-sky-100 border-sky-100 hover:border-sky-200 text-sky-700" 
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 hover:border-slate-300 text-slate-700"
              }`}
              id="btn_telegram_integration"
            >
              <Send size={13} className={tgLinkStatus.isLinked ? "text-sky-600 animate-pulse shrink-0" : "text-slate-400 shrink-0"} />
              <span className="truncate">Telegram Link</span>
              {tgLinkStatus.isLinked && (
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
              )}
            </button>

            {/* Bot Manager Connection Status */}
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-2 px-3 rounded-2xl" id="manager_status_card">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Telegram Manager Bot</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${status?.manager.status === "running" ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                  <span className="text-xs font-semibold text-slate-700 capitalize">{status?.manager.status || "Checking..."}</span>
                </div>
              </div>
              <div className="h-6 w-[1px] bg-slate-200"></div>
              <div className="flex gap-1.5">
                {status?.manager.status === "running" ? (
                  <button 
                    onClick={() => handleManagerControl("stop")} 
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1"
                    title="Stop Bot Manager"
                    id="btn_stop_manager"
                  >
                    <Square size={11} fill="currentColor" /> Stop
                  </button>
                ) : (
                  <button 
                    onClick={() => handleManagerControl("start")} 
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1"
                    title="Start Bot Manager"
                    id="btn_start_manager"
                  >
                    <Play size={11} fill="currentColor" /> Start
                  </button>
                )}
                <button 
                  onClick={() => handleManagerControl("restart")} 
                  className="p-1 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors"
                  title="Restart Bot Manager"
                  id="btn_restart_manager"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Slide-out Drawer: Custom User Visit & Profile Security Panel */}
      <AnimatePresence>
        {isVisitPanelOpen && (
          <>
            {/* Dark Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsVisitPanelOpen(false)}
              className="fixed inset-0 bg-slate-950 z-40"
            />

            {/* Sliding Drawer Body */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200"
              id="user_visit_panel_drawer"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="text-indigo-600" size={20} />
                  <h2 className="text-base font-bold text-slate-900">User Visit & Profile Panel</h2>
                </div>
                <button
                  onClick={() => setIsVisitPanelOpen(false)}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors text-xs font-semibold"
                >
                  ✕ Close
                </button>
              </div>

              {/* Drawer Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                
                {/* Section 1: Customized Profile Settings */}
                <div className="flex flex-col gap-4 bg-slate-50/60 p-4 border border-slate-200/60 rounded-2xl">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide block">Customise Profile Settings</span>
                  
                  {/* Nickname input */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Custom Display Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Bot master, Administrator"
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  {/* Avatar Theme Selection */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Avatar Accent Theme</label>
                    <div className="flex gap-2.5 mt-1.5">
                      {["indigo", "emerald", "amber", "rose", "violet"].map((color) => (
                        <button
                          key={color}
                          onClick={() => setSelectedAvatar(color)}
                          className={`w-6 h-6 rounded-lg transition-all capitalize ring-offset-2 shrink-0 ${
                            color === "indigo" ? "bg-indigo-600" :
                            color === "emerald" ? "bg-emerald-600" :
                            color === "amber" ? "bg-amber-500" :
                            color === "rose" ? "bg-rose-500" : "bg-violet-600"
                          } ${selectedAvatar === color ? "ring-2 ring-indigo-500 scale-110" : "opacity-60 hover:opacity-100"}`}
                          title={`${color} theme`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Save profile button */}
                  <button
                    onClick={() => saveUserProfile(editDisplayName, selectedAvatar)}
                    disabled={profileSaving}
                    className="w-full mt-2 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-sm"
                  >
                    {profileSaving ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" /> Saving Configuration...
                      </>
                    ) : (
                      <>
                        <UserCheck size={12} /> Apply Custom Profile
                      </>
                    )}
                  </button>
                </div>

                {/* Section 2: Visitor Statistics Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Logins</span>
                    <span className="text-xl font-bold text-slate-800 mt-1 block">{visitsList.length}</span>
                    <span className="text-[8px] text-slate-400 block mt-0.5">audit visits logged</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Primary Ingress</span>
                    <span className="text-xs font-semibold text-slate-700 mt-1.5 block truncate">
                      {visitsList[0]?.country || "Secured"}
                    </span>
                    <span className="text-[8px] text-slate-400 block mt-0.5">last detected location</span>
                  </div>
                </div>

                {/* Section 3: Detailed Session Audit Logs */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Device & Visit History Logs</span>
                    {visitsList.length > 0 && (
                      <button
                        onClick={clearVisitsHistory}
                        className="text-[9px] font-bold text-rose-500 hover:text-rose-700 transition-colors"
                      >
                        Flush Logs
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {visitsList.length > 0 ? (
                      visitsList.map((item, idx) => (
                        <div 
                          key={item.id} 
                          className="p-3 border border-slate-150 rounded-xl bg-white hover:bg-slate-50/50 transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-slate-100 text-slate-500 rounded-lg shrink-0">
                              {item.isMobile ? <Smartphone size={13} /> : <Laptop size={13} />}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-slate-800">{item.platform}</span>
                                <span className="text-[9px] text-slate-400">•</span>
                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                  {getBrowserIcon(item.browser)} {item.browser}
                                </span>
                              </div>
                              <span className="text-[9px] text-slate-400 block mt-0.5">
                                {item.timestamp.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 font-bold px-2 py-0.5 rounded-full block">
                              {item.country}
                            </span>
                            {idx === 0 && (
                              <span className="text-[8px] font-bold text-emerald-500 block mt-1">
                                Active Session
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-slate-400 italic text-xs">
                        No login visit logs stored.
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 4: Secure Key Info and Sign Out */}
                <div className="mt-auto border-t border-slate-150 pt-5 flex flex-col gap-3">
                  <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex items-center gap-2.5">
                    <Shield className="text-indigo-600 shrink-0" size={16} />
                    <div className="text-[10px]">
                      <p className="font-semibold text-slate-700">Firebase Session Encryption</p>
                      <p className="text-slate-400">All session activity traces are cryptographically bound to your UID.</p>
                    </div>
                  </div>

                  <button
                    onClick={handleSignOut}
                    className="w-full py-2.5 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <LogOut size={13} /> Sign Out of Applet
                  </button>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Slide-out Drawer: Telegram Authentication & Integration Panel */}
      <AnimatePresence>
        {isTgPanelOpen && (
          <>
            {/* Dark Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTgPanelOpen(false)}
              className="fixed inset-0 bg-slate-950 z-40"
              id="tg_overlay"
            />

            {/* Sliding Drawer Body */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-[420px] bg-white border-l border-slate-200 z-50 shadow-2xl flex flex-col overflow-hidden"
              id="tg_drawer"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-150 flex items-center justify-between bg-sky-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-sky-100 text-sky-700 rounded-xl">
                    <Send size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Telegram Integration</h2>
                    <p className="text-[10px] text-slate-400 font-medium">Link & authorize your Telegram Account</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsTgPanelOpen(false)}
                  className="p-1.5 hover:bg-slate-200/80 rounded-lg text-slate-400 hover:text-slate-600 transition-colors text-xl font-semibold leading-none"
                >
                  &times;
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                {/* Integration Info Status Card */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-3">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Connection Status</span>
                  
                  {tgLinkStatus.isLinked ? (
                    <div className="flex items-center gap-3 bg-white border border-sky-100 p-3.5 rounded-xl">
                      <div className="p-2 bg-sky-50 text-sky-600 rounded-lg shrink-0">
                        <Send size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800">Linked to Telegram</p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">Chat ID: <span className="font-mono font-semibold">{tgLinkStatus.chatId}</span></p>
                        {tgLinkStatus.details?.email && (
                          <p className="text-[10px] text-slate-500 mt-1 font-semibold">👤 {tgLinkStatus.details.email}</p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-sky-50 text-sky-700 border border-sky-100 uppercase">
                          Active
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 bg-white border border-slate-200/80 p-3.5 rounded-xl">
                      <div className="p-2 bg-slate-50 text-slate-400 rounded-lg shrink-0">
                        <Send size={15} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-600">No Account Linked</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Link a Telegram chat to enable process controls.</p>
                      </div>
                      <div className="shrink-0">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                          Unlinked
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Linking PIN Generation Section */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Pairing & Linking PIN</span>
                  </div>

                  {!tgLinkStatus.isLinked ? (
                    <div className="border border-slate-200 rounded-2xl p-4 flex flex-col gap-4 bg-white">
                      <p className="text-xs text-slate-500 leading-relaxed">
                        To link your Telegram chat, generate a secure verification PIN below and send it to the bot or click the link.
                      </p>

                      {tgPin ? (
                        <div className="flex flex-col items-center gap-3 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl text-center">
                          <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-500">6-Digit Pairing PIN</span>
                          <span className="text-3xl font-bold tracking-widest text-indigo-700 font-mono select-all">
                            {tgPin}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1.5 justify-center">
                            <Clock size={11} /> Expires in <b>{Math.floor(tgTimer / 60)}:{(tgTimer % 60).toString().padStart(2, '0')}</b> minutes
                          </span>

                          <div className="w-full h-[1px] bg-indigo-100/80 my-1"></div>

                          <div className="flex flex-col gap-2 w-full">
                            <a
                              href={`https://t.me/nttforosbot?start=${tgPin}`}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <ExternalLink size={12} /> Direct Pairing Link
                            </a>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`/link ${tgPin}`);
                                alert("Copied '/link " + tgPin + "' to clipboard!");
                              }}
                              className="w-full py-1.5 border border-indigo-200 hover:bg-indigo-50/50 text-indigo-600 rounded-xl text-[10px] font-semibold transition-colors flex items-center justify-center gap-1"
                            >
                              <Copy size={11} /> Copy Command
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={generateTgPin}
                          disabled={tgLoading}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Key size={13} />
                          {tgLoading ? "Generating pairing code..." : "Link Telegram Account"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 bg-sky-50/20">
                      <div className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle size={14} />
                        <span className="text-xs font-bold">Cryptographically Paired</span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Your account is linked. You can monitor process execution, view logs, start/stop sub-processes, and upload scripts directly from Telegram.
                      </p>
                      
                      <a
                        href="https://t.me/nttforosbot"
                        target="_blank"
                        rel="noreferrer"
                        className="w-full mt-2 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Send size={12} /> Launch Telegram Bot
                      </a>
                    </div>
                  )}
                </div>

                {/* Instructions / Security Specs */}
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Features & Permissions</span>
                  <div className="flex flex-col gap-2.5">
                    <div className="flex gap-2.5">
                      <div className="p-2 bg-slate-100 text-slate-500 rounded-lg shrink-0 h-fit">
                        <Key size={12} />
                      </div>
                      <div className="text-[11px]">
                        <p className="font-semibold text-slate-700">Multi-User Authentication</p>
                        <p className="text-slate-400 mt-0.5">Only you can view and command bots spawned under your web dashboard profile.</p>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <div className="p-2 bg-slate-100 text-slate-500 rounded-lg shrink-0 h-fit">
                        <Send size={12} />
                      </div>
                      <div className="text-[11px]">
                        <p className="font-semibold text-slate-700">Script Deployment</p>
                        <p className="text-slate-400 mt-0.5">Directly upload Python or Node.js files in Telegram to deploy instantly.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Unlink Button */}
                {tgLinkStatus.isLinked && (
                  <div className="mt-auto border-t border-slate-150 pt-5">
                    <button
                      onClick={unlinkTelegram}
                      disabled={tgLoading}
                      className="w-full py-2.5 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <LogOut size={13} />
                      {tgLoading ? "Unlinking..." : "Unlink Telegram Account"}
                    </button>
                  </div>
                )}

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6" id="main_content">
        {/* Statistics and System Overview Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="stats_row">
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm" id="stat_running">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Bot size={22} />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-medium block">Running Bots</span>
              <span className="text-2xl font-bold text-slate-800">{status?.runningCount ?? 0}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">active sub-processes</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm" id="stat_total">
            <div className={`p-3 rounded-xl ${(status?.totalCount ?? 0) >= 3 ? "bg-amber-50 text-amber-600 animate-pulse" : "bg-indigo-50 text-indigo-600"}`}>
              <Layers size={22} />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-medium block">Total Deployed</span>
              <span className="text-2xl font-bold text-slate-800">
                {status?.totalCount ?? 0}
                <span className="text-xs font-normal text-slate-400 ml-1.5">/ 3 limit</span>
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">uploaded scripts</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm" id="stat_uptime">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Clock size={22} />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-medium block">Server Uptime</span>
              <span className="text-xl font-bold text-slate-800 truncate block max-w-[150px]">
                {status ? formatUptime(status.stats.uptime) : "0s"}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">continuous hosting</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm" id="stat_memory">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <Server size={22} />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-medium block">Memory Usage</span>
              <span className="text-2xl font-bold text-slate-800">
                {status ? `${(status.stats.memory / 1024 / 1024).toFixed(1)} MB` : "0 MB"}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Node process stack</span>
            </div>
          </div>
        </div>

        {/* Token and Integration Panel */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4" id="token_banner">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-lg">
              <Cpu size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Manager Bot Token</h3>
              <p className="text-xs text-slate-400">Use this token to connect or talk to your master bot in Telegram</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl flex-1 max-w-lg">
            <code className="text-xs font-mono text-slate-600 truncate select-all flex-1">
              8923444398:AAF68GO0jb3_1ofreVAnMF7APcfdoIY0_K4
            </code>
            <button 
              onClick={handleCopyToken}
              className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-lg transition-colors flex items-center"
              title="Copy Token"
            >
              {isCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>
          </div>
          <a 
            href="https://t.me/BotFather" 
            target="_blank" 
            referrerPolicy="no-referrer"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            Open Telegram <ExternalLink size={12} />
          </a>
        </div>

        {/* Dashboard Split Screen */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard_body">
          
          {/* LEFT: Deployment Uploader and Bot List */}
          <div className="lg:col-span-7 flex flex-col gap-6" id="left_column">
            
            {/* Uploader Box */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`bg-white border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer relative overflow-hidden shadow-sm ${
                isDragOver ? "border-indigo-500 bg-indigo-50/20" : "border-slate-200 hover:border-indigo-400"
              }`}
              onClick={() => fileInputRef.current?.click()}
              id="upload_box"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept=".py,.js" 
                className="hidden" 
              />
              <div className="flex flex-col items-center gap-2">
                <div className={`p-4 rounded-full ${isDragOver ? "bg-indigo-100 text-indigo-600" : "bg-slate-50 text-slate-400"} transition-colors`}>
                  <Upload size={28} />
                </div>
                <h3 className="font-semibold text-slate-800 text-sm">Deploy New Telegram Bot Script</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Drag and drop your <span className="font-medium text-slate-600">.py (Python)</span> or <span className="font-medium text-slate-600">.js (Node.js)</span> files here, or click to browse.
                </p>
                <span className="text-[10px] text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-full font-medium mt-1">
                  Automatic dependency resolver & installer enabled
                </span>
              </div>

              {/* Progress and status notifications */}
              <AnimatePresence>
                {isUploading && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-6"
                  >
                    <RefreshCw className="animate-spin text-indigo-600 mb-3" size={32} />
                    <span className="text-xs font-semibold text-slate-700">Analyzing Script Dependencies...</span>
                    <div className="w-full max-w-xs bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Notifications panel */}
            {(uploadError || uploadSuccess) && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl border flex gap-3 ${
                  uploadError ? "bg-rose-50 border-rose-100 text-rose-700" : "bg-emerald-50 border-emerald-100 text-emerald-700"
                }`}
                id="upload_feedback_panel"
              >
                {uploadError ? <AlertCircle size={18} className="shrink-0" /> : <CheckCircle size={18} className="shrink-0" />}
                <div className="text-xs">
                  <p className="font-semibold">{uploadError ? "Deployment Error" : "Deployment Successful"}</p>
                  <p className="mt-0.5 opacity-90">{uploadError || uploadSuccess}</p>
                </div>
              </motion.div>
            )}

            {/* Deployed Bot List */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1" id="bots_list_card">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500">
                    <Bot size={16} />
                  </span>
                  <h2 className="text-sm font-semibold text-slate-800">Deployed Bot Sub-processes</h2>
                </div>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                  {status ? Object.keys(status.bots).length : 0} Total
                </span>
              </div>

              {/* Bot rows */}
              <div className="flex-1 divide-y divide-slate-100 overflow-y-auto max-h-[400px]">
                {status && Object.keys(status.bots).length > 0 ? (
                  Object.entries(status.bots).map(([botId, item]) => {
                    const botInfo = item as DeployedBot;
                    const isRunning = botInfo.status === "running";
                    return (
                      <div key={botId} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className={`p-2.5 rounded-xl border ${isRunning ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                            <FileCode size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-slate-800">{botInfo.filename}</span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                                botInfo.type === "python" ? "bg-blue-50 text-blue-600 border border-blue-100" : "bg-yellow-50 text-yellow-600 border border-yellow-100"
                              } uppercase`}>
                                {botInfo.type === "python" ? "Python" : "Node.js"}
                              </span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                isRunning ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                              }`}>
                                {isRunning ? "Active" : "Stopped"}
                              </span>
                            </div>
                            
                            {/* Dependencies chip list */}
                            {botInfo.dependencies && botInfo.dependencies.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <span className="text-[10px] text-slate-400">Deps:</span>
                                {botInfo.dependencies.map(dep => (
                                  <span key={dep} className="text-[9px] font-mono bg-slate-100 border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded">
                                    {dep}
                                  </span>
                                ))}
                              </div>
                            )}

                            <span className="text-[10px] text-slate-400 block mt-1.5">
                              Deployed: {new Date(botInfo.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Bot Actions */}
                        <div className="flex items-center gap-2 sm:self-center">
                          {isRunning ? (
                            <button 
                              onClick={() => handleBotControl(botId, "stop")}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
                              id={`btn_stop_${botId}`}
                            >
                              <Square size={12} fill="currentColor" /> Stop
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleBotControl(botId, "start")}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
                              id={`btn_start_${botId}`}
                            >
                              <Play size={12} fill="currentColor" /> Run
                            </button>
                          )}
                          
                          <button 
                            onClick={() => setSelectedLogSource(botId)}
                            className={`p-1.5 border rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 ${
                              selectedLogSource === botId 
                                ? "bg-indigo-50 border-indigo-200 text-indigo-600" 
                                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-500"
                            }`}
                            title="View Terminal Logs"
                            id={`btn_logs_${botId}`}
                          >
                            <Terminal size={14} />
                          </button>

                          <button 
                            onClick={() => handleBotControl(botId, "delete")}
                            className="p-1.5 bg-white border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors"
                            title="Delete Script"
                            id={`btn_delete_${botId}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 px-6 text-center text-slate-400 flex flex-col items-center gap-2" id="empty_bots_fallback">
                    <Bot size={36} className="opacity-40" />
                    <p className="text-sm font-medium text-slate-500">No script bots deployed yet</p>
                    <p className="text-xs max-w-xs mx-auto">Upload a script (.py or .js) using the card above or through your master Telegram bot!</p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT: Terminal Log Viewer */}
          <div className="lg:col-span-5 flex flex-col" id="right_column">
            <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-lg border border-slate-800 flex flex-col flex-1 h-full min-h-[450px] lg:min-h-[550px] overflow-hidden" id="terminal_card">
              
              {/* Terminal Header */}
              <div className="px-4 py-3 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5 mr-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
                  </div>
                  <Terminal size={14} className="text-slate-400" />
                  <span className="text-xs font-mono font-semibold tracking-wide text-slate-300">Live Log Terminal</span>
                </div>

                {/* Log Source selector */}
                <div className="flex items-center gap-2">
                  <select 
                    value={selectedLogSource} 
                    onChange={(e) => setSelectedLogSource(e.target.value)}
                    className="bg-slate-800 border border-slate-700/80 rounded-lg text-xs text-slate-200 px-2 py-1 font-mono focus:outline-none focus:border-indigo-500"
                    id="log_source_select"
                  >
                    <option value="manager">📋 Bot Manager Log</option>
                    {status && Object.entries(status.bots).map(([botId, item]) => {
                      const botInfo = item as DeployedBot;
                      return (
                        <option key={botId} value={botId}>
                          {botInfo.filename} ({botInfo.status === "running" ? "🟢" : "🔴"})
                        </option>
                      );
                    })}
                  </select>

                  <button 
                    onClick={fetchLogs}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-md transition-colors"
                    title="Manual Refresh Logs"
                    id="btn_refresh_logs"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>

              {/* Terminal Output Stream */}
              <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed select-text flex flex-col gap-1 bg-slate-950/40">
                {logs ? (
                  logs.split("\n").map((line, idx) => {
                    let colorClass = "text-slate-300";
                    if (line.includes("[ERROR]") || line.includes("Error") || line.includes("Exception")) colorClass = "text-rose-400";
                    else if (line.includes("[WARN]") || line.includes("Warning")) colorClass = "text-amber-400";
                    else if (line.includes("Success") || line.includes("started successfully")) colorClass = "text-emerald-400";
                    else if (line.startsWith("---")) colorClass = "text-indigo-400/80";

                    return (
                      <div key={idx} className={`${colorClass} whitespace-pre-wrap break-all hover:bg-slate-800/10 px-1 py-0.5 rounded transition-colors`}>
                        {line}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-slate-500 italic py-10 text-center">Awaiting log entries...</div>
                )}
                <div ref={terminalEndRef}></div>
              </div>

              {/* Terminal Footer controls */}
              <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Polling: every 2s</span>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={autoScroll} 
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-0 w-3 h-3 cursor-pointer"
                  />
                  <span>Auto-Scroll</span>
                </label>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/60 py-5 text-center text-xs text-slate-400 mt-12" id="main_footer">
        <p>© 2026 Telegram Bot Deployer. Made with 🤍 on Google AI Studio.</p>
      </footer>
    </div>
  );
}
