"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  MessageCircle, Video as VideoIcon, Phone, MapPin, Settings, LogOut, Users, Bell,
  Search, ChevronRight, Clock, Shield, Zap, Globe, Activity, Plus,
  Home, Camera, Mic, Send, X, Menu, User, Heart, Star, Sparkles, ArrowLeft,
  Radio, AlertTriangle, ExternalLink, Flame, Film, CalendarHeart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvatarDisplay } from "@/components/AvatarDisplay";
import { Chat } from "@/components/Chat";
import { Stories } from "@/components/Stories";
import { ProfileSettings } from "@/components/ProfileSettings";
import { VideoCall } from "@/components/VideoCall";
import { WatchParty } from "@/components/WatchParty";
import { SpecialDays } from "@/components/SpecialDays";
import { PrivateSafe } from "@/components/PrivateSafe";
import { PasswordGate } from "@/components/PasswordGate";

type ActiveView = "dashboard" | "chat" | "vault" | "calls" | "watchparty" | "calendar" | "settings";

interface UserDashboardViewProps {
  session: any;
  privateKey: CryptoKey;
}

function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return "Offline";
  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  
  if (diffMins < 1) return "Last seen just now";
  if (diffMins < 60) return `Last seen ${diffMins}m ago`;
  if (diffHours < 24 && date.getDate() === now.getDate()) return `Last seen today at ${timeStr}`;
  if (diffDays === 1 || (diffHours < 48 && date.getDate() === now.getDate() - 1)) return `Last seen yesterday at ${timeStr}`;
  
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `Last seen ${dateStr} at ${timeStr}`;
}

export function UserDashboardView({ session, privateKey }: UserDashboardViewProps) {
  const router = useRouter();
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [isChatUnlocked, setIsChatUnlocked] = useState(false);

  useEffect(() => {
    const unlocked = sessionStorage.getItem("chat_unlocked") === "true";
    setIsChatUnlocked(unlocked);
  }, []);

  const [myProfile, setMyProfile] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
    const [activeCall, setActiveCall] = useState<any>(null);
    const [activeWatchParty, setActiveWatchParty] = useState<any>(null);
    const [incomingCall, setIncomingCall] = useState<any>(null);
    const [broadcasts, setBroadcasts] = useState<any[]>([]);
    const [systemConfig, setSystemConfig] = useState<any>({});
    const [unviewedSnapshots, setUnviewedSnapshots] = useState<any[]>([]);
    const [chatSearchQuery, setChatSearchQuery] = useState("");
    const notificationSound = useRef<HTMLAudioElement | null>(null);
    const presenceChannelRef = useRef<any>(null);

    useEffect(() => {
      notificationSound.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
    }, []);

      useEffect(() => {
        // Register Service Worker for mobile/background notifications
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/sw.js').then((registration) => {
            console.log('Service Worker registered with scope:', registration.scope);
          }).catch((error) => {
            console.error('Service Worker registration failed:', error);
          });
        }

      fetchProfile();
      fetchProfiles();
      fetchRecentChats();
      fetchBroadcasts();
      fetchSystemConfig();
      fetchUnviewedSnapshots();
      fetchUnreadCount();
      updateStreak();
      const cleanup = setupRealtimeSubscriptions();

          const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
              updateOnlineStatus(true);
            } else {
              // Quick update for offline status
              setTimeout(() => {
                if (document.visibilityState !== 'visible') {
                  updateOnlineStatus(false);
                }
              }, 1000); 
            }
          };

        const handleFocus = () => updateOnlineStatus(true);
        // Removed aggressive blur tracking as it causes "offline" when user is still looking
        // const handleBlur = () => updateOnlineStatus(false);

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);
          const handleBeforeUnload = () => {
            if (!session?.user?.id) return;
            const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}`;
            const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
            const data = JSON.stringify({ 
              last_seen: new Date().toISOString(), 
              updated_at: new Date().toISOString() 
            });
            
            if (navigator.sendBeacon) {
              const blob = new Blob([data], { type: 'application/json' });
              navigator.sendBeacon(url, blob);
            } else {
              updateOnlineStatus(false);
            }
          };

          window.addEventListener('beforeunload', handleBeforeUnload);
          window.addEventListener('pagehide', handleBeforeUnload);

        // Initial status
        if (document.visibilityState === 'visible') {
          updateOnlineStatus(true);
        }

        const interval = setInterval(() => {
          if (document.visibilityState === 'visible') {
            updateOnlineStatus(true);
          }
          fetchUnviewedSnapshots();
          supabase.rpc('purge_viewed_content');
        }, 10000); // Reduced to 10s for more "immediate" status

        if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
        }

        return () => {
          clearInterval(interval);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          window.removeEventListener('focus', handleFocus);
          updateOnlineStatus(false);
          cleanup();
      };
    }, [session.user.id]);

  async function updateOnlineStatus(online: boolean = true) {
    if (!session?.user?.id) return;
    
    try {
      const now = new Date().toISOString();
      if (online) {
        await supabase.from("profiles").update({ 
          updated_at: now 
        }).eq("id", session.user.id);
        
        if (presenceChannelRef.current) {
          await presenceChannelRef.current.track({
            user_id: session.user.id,
            online_at: now,
          });
        }
      } else {
        await supabase.from("profiles").update({ 
          last_seen: now,
          updated_at: now 
        }).eq("id", session.user.id);
        
        if (presenceChannelRef.current) {
          await presenceChannelRef.current.untrack();
        }
      }
    } catch (error) {
      console.error("Failed to update online status:", error);
    }
  }


    async function fetchProfile() {
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (data) setMyProfile(data);
    }

    async function fetchProfiles() {
      const { data } = await supabase.from("profiles").select("*").neq("id", session.user.id);
      if (data) setProfiles(data);
    }

    async function fetchRecentChats() {
      const { data: messages } = await supabase
        .from("messages")
        .select("sender_id, receiver_id, created_at")
        .or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
        .order("created_at", { ascending: false });

      if (messages) {
        const contactIds = Array.from(new Set(messages.flatMap(m => [m.sender_id, m.receiver_id])))
          .filter(id => id !== session.user.id);
        
        if (contactIds.length > 0) {
          const { data: profilesData } = await supabase.from("profiles").select("*").in("id", contactIds);
          if (profilesData) {
            const sorted = contactIds.map(id => profilesData.find(p => p.id === id)).filter(Boolean);
            setRecentChats(sorted);
          }
        }
      }
    }

    async function fetchBroadcasts() {
      const { data } = await supabase.from("broadcasts").select("*").order("created_at", { ascending: false }).limit(1);
      if (data) setBroadcasts(data);
    }

    async function fetchSystemConfig() {
      const { data } = await supabase.from("system_config").select("*").single();
      if (data) setSystemConfig(data);
    }

    async function fetchUnviewedSnapshots() {
      const { data } = await supabase.from("stories").select("*").order("created_at", { ascending: false });
      if (data) setUnviewedSnapshots(data);
    }

  async function fetchUnreadCount() {
    const { count } = await supabase
      .from("messages")
      .select("*", { count: 'exact', head: true })
      .eq("receiver_id", session.user.id)
      .eq("is_viewed", false);
    setUnreadCount(count || 0);
  }

  async function updateStreak() {
    try {
      const response = await fetch('/api/streak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id })
      });
      const data = await response.json();
      if (data.success && data.streak > 1) {
        fetchProfile();
      }
    } catch (error) {
      console.error("Failed to update streak:", error);
    }
  }

  async function showNotification(title: string, options?: NotificationOptions) {
      // Play sound
      if (notificationSound.current) {
        notificationSound.current.play().catch(e => console.error("Sound play failed:", e));
      }

      // Show browser notification via Service Worker if available for better mobile/background support
      if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === "granted") {
        const registration = await navigator.serviceWorker.ready;
        registration.showNotification(title, {
          icon: "/icon.png",
          badge: "/icon.png",
          vibrate: [100, 50, 100],
          ...options
        } as any);
      } else if ("Notification" in window && Notification.permission === "granted") {
        try {
          const n = new Notification(title, {
            icon: "/icon.png",
            badge: "/icon.png",
            ...options
          });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        } catch (e) {
          console.error("Browser notification failed:", e);
        }
      }
    }

    function setupRealtimeSubscriptions() {
      const broadcastsChannel = supabase.channel("global-broadcasts").on("postgres_changes", { event: "INSERT", schema: "public", table: "broadcasts" }, (payload) => {
        setBroadcasts([payload.new]);
        toast.info("Global Broadcast Received", { description: payload.new.content, icon: <Radio className="w-4 h-4 text-indigo-500" /> });
        showNotification("Global Broadcast", { body: payload.new.content });
      }).subscribe();

      const messagesChannel = supabase.channel("dashboard-messages").on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${session.user.id}` }, (payload) => {
        fetchRecentChats();
        fetchUnreadCount();
        toast.info("New message received");
        showNotification("New Message", { body: "You have received a new intelligence packet." });
      }).subscribe();

      const callsChannel = supabase.channel("incoming-calls").on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `receiver_id=eq.${session.user.id}` }, async (payload) => {
        const data = payload.new;
        if (data.type === "offer" && !activeCall && !incomingCall) {
          const { data: caller } = await supabase.from("profiles").select("*").eq("id", data.caller_id).single();
          if (caller) {
            setIncomingCall({ ...data, caller });
            toast.info(`Incoming ${data.call_mode} call from ${caller.username}`, { duration: 10000 });
            showNotification(`Incoming ${data.call_mode} call`, { body: `Call from ${caller.username}` });
          }
        }
      }).subscribe();

      const storiesChannel = supabase.channel("new-stories").on("postgres_changes", { event: "INSERT", schema: "public", table: "stories" }, async (payload) => {
        if (payload.new.user_id !== session.user.id) {
          const { data: creator } = await supabase.from("profiles").select("username").eq("id", payload.new.user_id).single();
          if (creator) {
            toast.info(`New story from ${creator.username}`, { icon: <Camera className="w-4 h-4 text-pink-500" /> });
            showNotification("New Story", { body: `${creator.username} shared a new temporal snapshot.` });
          }
        }
      }).subscribe();

      const presenceChannel = supabase.channel("online-users").on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const online = new Set<string>();
        Object.values(state).forEach((users: any) => { users.forEach((u: any) => online.add(u.user_id)); });
        setOnlineUsers(online);
      }).subscribe();

    presenceChannelRef.current = presenceChannel;

    return () => {
      supabase.removeChannel(broadcastsChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(callsChannel);
      supabase.removeChannel(storiesChannel);
      supabase.removeChannel(presenceChannel);
    };
  }

  const handleNavClick = (view: ActiveView) => {
    setActiveView(view);
    if (view !== "chat") setSelectedContact(null);
    setSidebarOpen(false);
  };

  const navItems = [
    { id: "dashboard", icon: Home, label: "Chatify" },
    { id: "chat", icon: MessageCircle, label: "Signals", badge: unreadCount },
    { id: "vault", icon: Shield, label: "Vault" },
    { id: "calls", icon: Phone, label: "Uplink" },
    { id: "watchparty", icon: Film, label: "Cinema" },
    { id: "calendar", icon: CalendarHeart, label: "Memories" },
    { id: "settings", icon: Settings, label: "Entity" },
  ];

  if (!myProfile) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#030303]">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Syncing Node</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] bg-[#030303] text-white overflow-hidden font-sans selection:bg-indigo-500/30">
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] lg:hidden" />
            <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed top-0 left-0 bottom-0 w-[80%] max-sm bg-[#050505] border-r border-white/5 z-[101] lg:hidden p-6 flex flex-col">
                <div className="flex items-center justify-between mb-12">
                  <h2 className="text-xl font-black italic tracking-tighter uppercase font-accent">Chatify <span className="text-indigo-500">Core</span></h2>
                  <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} className="text-white/20 hover:text-white bg-white/5 rounded-xl"><X className="w-5 h-5" /></Button>
                </div>
                <div 
                  className="flex items-center gap-4 mb-12 p-4 bg-white/[0.02] border border-white/5 rounded-[2rem] cursor-pointer group hover:border-indigo-500/30 transition-all"
                  onClick={() => { router.push(`/profile/${session.user.id}`); setMobileMenuOpen(false); }}
                >
                  <div className="relative">
                    <AvatarDisplay profile={myProfile} className="h-12 w-12" />
                    <div className="absolute -bottom-0.5 -right-0.5 bg-indigo-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm uppercase tracking-tight truncate leading-tight font-accent group-hover:text-indigo-400 transition-colors">{myProfile.username}</p>
                    <p className="text-[8px] font-bold uppercase tracking-widest text-emerald-500">Online</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-indigo-400 transition-colors" />
                </div>
                <nav className="flex-1 space-y-1">
                  {navItems.map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <motion.button 
                        key={item.id} 
                        whileTap={{ scale: 0.98 }} 
                        onClick={() => { 
                          handleNavClick(item.id as ActiveView); 
                          setMobileMenuOpen(false); 
                        }} 
                          className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all relative group overflow-hidden ${
                            isActive 
                              ? 'text-white bg-white/5 border border-white/10 shadow-[inset_0_0_20px_rgba(79,70,229,0.1)]' 
                              : 'text-white/30 hover:text-white hover:bg-white/[0.03]'
                          }`}
                        >
                          {isActive && (
                            <motion.div 
                              layoutId="mobileIndicator" 
                              className="absolute left-0 top-0 bottom-0 w-full z-20 pointer-events-none" 
                              initial={false}
                              style={{ 
                                background: 'linear-gradient(90deg, rgba(79, 70, 229, 0.4) 0%, rgba(79, 70, 229, 0.1) 40%, rgba(79, 70, 229, 0) 100%)',
                                borderLeft: '3px solid #6366f1',
                                boxShadow: 'inset 10px 0 20px -10px rgba(79, 70, 229, 0.5)'
                              }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          )}
                          
                          <item.icon className={`w-4 h-4 transition-transform relative z-10 ${isActive ? 'text-indigo-400 scale-110' : 'text-white/20 group-hover:text-white/40'}`} />
                          <span className="text-[10px] font-bold tracking-widest uppercase leading-none relative z-10 font-accent">{item.label}</span>
                        </motion.button>

                    );
                  })}
                </nav>
              <Button variant="ghost" onClick={() => supabase.auth.signOut()} className="mt-auto w-full justify-start gap-4 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-[2rem] h-14 px-6 font-accent"><LogOut className="w-5 h-5" /><span className="text-[11px] font-black uppercase tracking-[0.2em]">Sign Out</span></Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

        <motion.aside initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className={`${sidebarOpen ? 'w-80' : 'w-24'} border-r border-white/5 bg-[#050505]/80 backdrop-blur-3xl flex flex-col transition-all duration-500 hidden lg:flex relative z-40 h-full overflow-hidden`}>
          <div className={`p-6 border-b border-white/5 shrink-0 flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'}`}>
            <div 
              className="flex items-center gap-5 cursor-pointer group"
              onClick={() => router.push(`/profile/${session.user.id}`)}
            >
              <div className="relative">
                <AvatarDisplay profile={myProfile} className="h-12 w-12 group-hover:ring-2 ring-indigo-500/50 transition-all" />
                <div className="absolute -bottom-0.5 -right-0.5 bg-indigo-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ExternalLink className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm uppercase tracking-tight truncate font-accent group-hover:text-indigo-400 transition-colors">{myProfile.username}</p>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-white/30 group-hover:text-indigo-400/50 transition-colors">View Profile</p>
                </div>
              )}
            </div>
            {sidebarOpen && <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}><Menu className="w-5 h-5" /></Button>}
          </div>
        {!sidebarOpen && <div className="p-4 flex justify-center border-b border-white/5"><Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}><Menu className="w-5 h-5" /></Button></div>}
          <nav className="flex-1 p-6 space-y-3">
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                  <motion.button 
                    key={item.id} 
                    onClick={() => handleNavClick(item.id as ActiveView)} 
                    className={`w-full flex items-center ${sidebarOpen ? 'gap-5 px-5' : 'justify-center'} py-4 rounded-xl transition-all relative group overflow-hidden ${
                      isActive ? 'text-white bg-white/5 border border-white/10 shadow-[inset_0_0_20px_rgba(79,70,229,0.1)]' : 'text-white/30 hover:text-white hover:bg-white/[0.02]'
                    }`}
                  >
                    {isActive && (
                      <motion.div 
                        layoutId="desktopIndicator" 
                        className="absolute left-0 top-0 bottom-0 w-full z-20 pointer-events-none" 
                        initial={false}
                        style={{ 
                          background: 'linear-gradient(90deg, rgba(79, 70, 229, 0.4) 0%, rgba(79, 70, 229, 0.1) 40%, rgba(79, 70, 229, 0) 100%)',
                          borderLeft: '3px solid #6366f1',
                          boxShadow: 'inset 10px 0 20px -10px rgba(79, 70, 229, 0.5)'
                        }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                    
                    <item.icon className={`w-5 h-5 transition-transform relative z-10 ${isActive ? 'text-indigo-400 scale-110' : 'text-white/20 group-hover:text-white/40'}`} />
                    {sidebarOpen && <span className="text-[10px] font-bold tracking-widest uppercase relative z-10 font-accent">{item.label}</span>}
                  </motion.button>

                );
              })}
            </nav>
        </motion.aside>

        <div className="flex-1 flex flex-col min-w-0 bg-[#030303] relative overflow-hidden h-full">
            <header className="lg:hidden h-20 border-b border-white/5 bg-[#050505]/80 backdrop-blur-3xl flex items-center justify-between px-6 z-30 shrink-0">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)} className="text-white/20"><Menu className="w-6 h-6" /></Button>
                <h1 className="text-lg font-black italic tracking-tighter uppercase font-accent">Chatify <span className="text-indigo-500">Core</span></h1>
              </div>
              <AvatarDisplay profile={myProfile} className="h-10 w-10" />
            </header>

          <main className="flex-1 min-h-0 overflow-hidden relative">
            <AnimatePresence mode="wait">
              {activeView === "dashboard" && (
                <motion.div key="dashboard" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} className="h-full overflow-y-auto custom-scrollbar p-5 sm:p-8 md:p-12 space-y-8 md:space-y-12 pb-32 lg:pb-12">
                  {broadcasts.length > 0 && (
                    <div className="bg-indigo-600 rounded-[2rem] p-6 text-white">
                      <div className="flex items-center gap-3 mb-4"><Radio className="w-4 h-4 animate-pulse" /><span className="text-[10px] font-black uppercase tracking-[0.4em]">Broadcast</span></div>
                      <p className="text-xl font-black italic">"{broadcasts[0].content}"</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {[
                      { label: "Streak", value: `${myProfile?.streak_count || 0}`, icon: Flame, color: "from-orange-500 to-red-600" },
                      { label: "Signals", value: unreadCount, icon: MessageCircle, color: "from-indigo-600 to-indigo-700" },
                      { label: "Nodes", value: onlineUsers.size, icon: Users, color: "from-emerald-600 to-emerald-700", hideOnMobile: true },
                      { label: "Entities", value: profiles.length, icon: User, color: "from-purple-600 to-purple-700" }
                    ].map((stat, i) => (
                      <div key={i} className={`bg-gradient-to-br ${stat.color} p-6 rounded-[2rem] shadow-xl ${stat.hideOnMobile ? 'hidden sm:block' : ''}`}>
                        <stat.icon className="w-6 h-6 text-white mb-4" />
                        <p className="text-3xl font-black italic text-white">{stat.value}</p>
                        <p className="text-[10px] font-black text-white/80 uppercase tracking-widest mt-2">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-6">
                    <div className="flex items-center gap-4 mb-6"><Camera className="w-5 h-5 text-indigo-400" /><h3 className="text-sm font-black uppercase tracking-[0.3em] font-accent">Temporal Stories</h3></div>
                    <Stories userId={session.user.id} />
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-6">
                      <h3 className="text-sm font-black uppercase tracking-[0.3em] mb-6 font-accent">Recent Channels</h3>
                      <div className="space-y-2">
                        {recentChats.map(chat => (
<div key={chat.id} className="w-full flex items-center gap-4 p-4 hover:bg-white/5 rounded-2xl transition-all">
                              <div 
                                className="cursor-pointer hover:scale-105 transition-transform"
                                onClick={(e) => { e.stopPropagation(); router.push(`/profile/${chat.id}`); }}
                              >
                                <AvatarDisplay profile={chat} className="h-10 w-10" />
                              </div>
                                <div 
                                  className="flex-1 text-left cursor-pointer"
                                  onClick={() => { setSelectedContact(chat); setActiveView("chat"); }}
                                >
                                  <p className="font-black text-sm uppercase italic font-accent hover:text-indigo-400 transition-colors">{chat.username}</p>
                                  <p className={`text-[8px] font-bold uppercase tracking-widest ${onlineUsers.has(chat.id) ? 'text-emerald-500' : 'text-white/20'}`}>
                                    {onlineUsers.has(chat.id) ? 'Online' : formatLastSeen(chat.last_seen)}
                                  </p>
                                </div>
                              <ChevronRight 
                                className="w-4 h-4 text-white/10 cursor-pointer hover:text-indigo-400 transition-colors" 
                                onClick={() => { setSelectedContact(chat); setActiveView("chat"); }}
                              />
                            </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-6">
                      <h3 className="text-sm font-black uppercase tracking-[0.3em] mb-6 font-accent">Global Nodes</h3>
                      <div className="grid grid-cols-2 gap-3">
{profiles.map(p => (
                              <div key={p.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col items-center gap-3 hover:border-indigo-500/30 transition-all">
                                <div 
                                  className="cursor-pointer hover:scale-105 transition-transform relative"
                                  onClick={() => router.push(`/profile/${p.id}`)}
                                >
                                  <AvatarDisplay profile={p} className="h-10 w-10" />
                                  {(p.streak_count || 0) > 0 && (
                                    <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-[6px] font-black px-1 py-0.5 rounded-full flex items-center gap-0.5">
                                      <Flame className="w-2 h-2" />
                                      {p.streak_count}
                                    </div>
                                  )}
                                </div>
                                <div className="text-center">
                                  <p 
                                    className="text-[10px] font-black uppercase font-accent cursor-pointer hover:text-indigo-400 transition-colors"
                                    onClick={() => router.push(`/profile/${p.id}`)}
                                  >
                                    {p.username}
                                  </p>
                                  <p className={`text-[6px] font-bold uppercase tracking-widest ${onlineUsers.has(p.id) ? 'text-emerald-500' : 'text-white/20'}`}>
                                    {onlineUsers.has(p.id) ? 'Online' : formatLastSeen(p.last_seen)}
                                  </p>
                                </div>
                                <Button 
                                  size="sm"
                                  onClick={() => { setSelectedContact(p); setActiveView("chat"); }}
                                  className="w-full text-[8px] font-black uppercase bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white h-8 rounded-xl"
                                >
                                  <MessageCircle className="w-3 h-3 mr-1" /> Chat
                                </Button>
                              </div>
                            ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
                  {activeView === "chat" && (
                    <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                      {!isChatUnlocked ? (
                        <PasswordGate 
                          correctPassword="040408" 
                          onUnlock={() => {
                            sessionStorage.setItem("chat_unlocked", "true");
                            setIsChatUnlocked(true);
                          }}
                          title="Signal Uplink"
                          subtitle="Encrypted Channel"
                          description="Authorization code required to decrypt message matrix."
                        />
                      ) : !selectedContact ? (
                        <div className="h-full flex flex-col p-8">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                            <h2 className="text-2xl font-black uppercase italic font-accent">Signal Channels</h2>
                            <div className="relative group w-full md:w-80">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" />
                              <input 
                                placeholder="Search channels..."
                                value={chatSearchQuery}
                                onChange={(e) => setChatSearchQuery(e.target.value)}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3 pl-12 pr-6 text-sm outline-none focus:border-indigo-500/50 transition-all placeholder:text-white/10"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar pr-2 pb-24">
                            {profiles.filter(p => p.username.toLowerCase().includes(chatSearchQuery.toLowerCase())).length === 0 ? (
                              <div className="col-span-full py-20 text-center opacity-20">
                                <Search className="w-12 h-12 mx-auto mb-4" />
                                <p className="text-sm font-black uppercase tracking-widest">No matching channels found</p>
                              </div>
                            ) : (
profiles
                                    .filter(p => p.username.toLowerCase().includes(chatSearchQuery.toLowerCase()))
                                    .map(p => (
                                          <div key={p.id} className="flex items-center gap-4 p-6 bg-white/[0.02] border border-white/5 rounded-[2.5rem] hover:bg-white/[0.05] transition-all group">
                                            <div 
                                              className="cursor-pointer"
                                              onClick={() => router.push(`/profile/${p.id}`)}
                                            >
                                              <AvatarDisplay profile={p} className="h-14 w-14 group-hover:scale-110 transition-transform" />
                                            </div>
                                              <div 
                                                className="flex-1 text-left cursor-pointer"
                                                onClick={() => { setSelectedContact(p); if (window.innerWidth < 1024) setActiveView("chat"); }}
                                              >
                                                <p className="font-black text-lg uppercase italic font-accent hover:text-indigo-400 transition-colors">{p.username}</p>
                                                <p className={`text-[10px] font-bold uppercase tracking-widest ${onlineUsers.has(p.id) ? 'text-emerald-500' : 'text-white/20'}`}>
                                                  {onlineUsers.has(p.id) ? 'Online' : formatLastSeen(p.last_seen)}
                                                </p>
                                              </div>
                                            <ChevronRight 
                                              className="w-5 h-5 text-white/10 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all cursor-pointer" 
                                              onClick={() => { setSelectedContact(p); if (window.innerWidth < 1024) setActiveView("chat"); }}
                                            />
                                          </div>
                                      ))
                              )}
                            </div>
                          </div>
                        ) : (
                            <Chat 
                              session={session} 
                              privateKey={privateKey} 
                              initialContact={selectedContact} 
                              isPartnerOnline={onlineUsers.has(selectedContact.id)}
                              onBack={() => setSelectedContact(null)}
                              onInitiateCall={(c, m) => setActiveCall({ contact: c, mode: m, isInitiator: true })} 
                            />
                        )}
                      </motion.div>
                    )}

                {activeView === "vault" && (
                  <motion.div key="vault" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full">
                    <PrivateSafe session={session} onClose={() => setActiveView("dashboard")} />
                  </motion.div>
                )}
                  {activeView === "calls" && (
                    <motion.div key="calls" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="absolute inset-0 overflow-y-auto custom-scrollbar p-6 sm:p-8 pb-32 lg:pb-12">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
{profiles.map(p => (

                          <div key={p.id} className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl flex flex-col items-center gap-4">
                            <div 
                              className="cursor-pointer hover:scale-105 transition-transform"
                              onClick={() => router.push(`/profile/${p.id}`)}
                            >
                              <AvatarDisplay profile={p} className="h-16 w-16" />
                            </div>
                            <div className="text-center">
                              <p 
                                className="font-black text-lg uppercase font-accent cursor-pointer hover:text-indigo-400 transition-colors"
                                onClick={() => router.push(`/profile/${p.id}`)}
                              >
                                {p.username}
                              </p>
                              <p className={`text-[10px] font-bold uppercase tracking-widest ${onlineUsers.has(p.id) ? 'text-emerald-500' : 'text-white/20'}`}>
                                {onlineUsers.has(p.id) ? 'Online' : formatLastSeen(p.last_seen)}
                              </p>
                            </div>
                            <div className="flex gap-2 w-full">
                            <Button onClick={() => setActiveCall({ contact: p, mode: "voice", isInitiator: true })} className="flex-1 bg-emerald-600 font-accent uppercase text-[10px]">Voice</Button>
                            <Button onClick={() => setActiveCall({ contact: p, mode: "video", isInitiator: true })} className="flex-1 bg-indigo-600 font-accent uppercase text-[10px]">Video</Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </motion.div>
              )}
{activeView === "settings" && (
                  <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full">
                    <ProfileSettings profile={myProfile} onUpdate={fetchProfile} onClose={() => setActiveView("dashboard")} />
                  </motion.div>
                )}
{activeView === "watchparty" && (
                    <motion.div key="watchparty" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="absolute inset-0 overflow-y-auto custom-scrollbar p-6 sm:p-8 pb-32 lg:pb-12">
                      <div className="mb-8">
                        <h2 className="text-2xl font-black uppercase italic font-accent mb-2">Cinema Mode</h2>
                        <p className="text-sm text-white/40">Watch movies together with video call</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {profiles.map(p => (
                          <div key={p.id} className="p-6 bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border border-white/5 rounded-3xl flex flex-col items-center gap-4 hover:border-purple-500/30 transition-all group">
                            <div 
                              className="cursor-pointer hover:scale-105 transition-transform relative"
                              onClick={() => router.push(`/profile/${p.id}`)}
                            >
                              <AvatarDisplay profile={p} className="h-16 w-16" />
                              <div className="absolute -bottom-1 -right-1 p-1.5 bg-purple-600 rounded-full">
                                <Film className="w-3 h-3 text-white" />
                              </div>
                            </div>
                            <div className="text-center">
                              <p 
                                className="font-black text-lg uppercase font-accent cursor-pointer hover:text-purple-400 transition-colors"
                                onClick={() => router.push(`/profile/${p.id}`)}
                              >
                                {p.username}
                              </p>
                              <p className={`text-[10px] font-bold uppercase tracking-widest ${onlineUsers.has(p.id) ? 'text-emerald-500' : 'text-white/20'}`}>
                                {onlineUsers.has(p.id) ? 'Online' : formatLastSeen(p.last_seen)}
                              </p>
                            </div>
                            <Button 
                              onClick={() => setActiveWatchParty({ contact: p })} 
                              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 font-accent uppercase text-[10px] tracking-widest"
                            >
                              <Film className="w-4 h-4 mr-2" /> Start Watch Party
                            </Button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                  {activeView === "calendar" && (
                    <motion.div key="calendar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0">
                      <SpecialDays userId={session.user.id} />
                    </motion.div>
                  )}
            </AnimatePresence>
          </main>

          <AnimatePresence>
            {activeCall && <VideoCall userId={session.user.id} contact={activeCall.contact} callType={activeCall.mode} isInitiator={activeCall.isInitiator} incomingSignal={activeCall.incomingSignal} onClose={() => setActiveCall(null)} />}
            {activeWatchParty && <WatchParty userId={session.user.id} contact={activeWatchParty.contact} onClose={() => setActiveWatchParty(null)} />}
            {incomingCall && !activeCall && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
                <div className="bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-10 max-w-sm w-full text-center space-y-8">
                  <AvatarDisplay profile={incomingCall.caller} className="h-32 w-32 mx-auto" />
                  <h3 className="text-4xl font-black italic uppercase font-accent">{incomingCall.caller.username}</h3>
                  <div className="flex gap-4">
                    <Button onClick={() => setIncomingCall(null)} className="flex-1 bg-red-600">Decline</Button>
                    <Button onClick={() => { setActiveCall({ contact: incomingCall.caller, mode: incomingCall.call_mode, isInitiator: false, incomingSignal: JSON.parse(incomingCall.signal_data) }); setIncomingCall(null); }} className="flex-1 bg-emerald-600">Accept</Button>
                  </div>
                </div>
              </div>
            )}
          </AnimatePresence>

            <nav className={`lg:hidden fixed bottom-0 left-0 right-0 border-t border-white/5 bg-[#050505]/95 backdrop-blur-3xl px-4 py-4 flex justify-around items-center z-50 rounded-t-[2.5rem] pb-safe transition-all ${ (activeView === 'chat' && selectedContact) ? 'translate-y-full' : ''}`}>
              {navItems.map(item => {
                const isActive = activeView === item.id;
                return (
                      <button 
                        key={item.id} 
                        onClick={() => handleNavClick(item.id as ActiveView)} 
                        className={`flex flex-col items-center gap-1.5 px-3 py-2 relative transition-all group ${isActive ? 'text-white' : 'text-white/30'}`}
                      >
                        <item.icon className={`w-5 h-5 transition-all duration-300 ${isActive ? 'text-indigo-400 scale-110 drop-shadow-[0_0_12px_rgba(99,102,241,0.6)]' : 'group-hover:text-white/50'}`} />
                        
                          <span className={`text-[8px] font-black uppercase tracking-[0.2em] font-accent leading-none transition-all ${isActive ? 'text-white' : 'text-white/40'}`}>{item.label}</span>
  
                          {isActive && (
                            <motion.div 
                              layoutId="bottomIndicator" 
                              className="absolute left-1/2 -translate-x-1/2 h-[3px] bg-indigo-500 rounded-full" 
                              initial={{ width: 0, opacity: 0 }}
                              animate={{ width: '16px', opacity: 1 }}
                              style={{ 
                                boxShadow: '0 0 15px rgba(99, 102, 241, 1), 0 0 5px rgba(99, 102, 241, 0.5)',
                                bottom: '2px'
                              }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          )}
                        </button>

                );
              })}
            </nav>
        </div>
    </div>
  );
}
