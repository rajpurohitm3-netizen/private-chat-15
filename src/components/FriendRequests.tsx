"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { 
  UserPlus, UserCheck, UserX, Users, Search, X, Check, Clock, Heart, 
  Sparkles, Shield, Ban, Send, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvatarDisplay } from "@/components/AvatarDisplay";

interface FriendRequestsProps {
  userId: string;
  onClose: () => void;
}

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  sender?: any;
  receiver?: any;
}

export function FriendRequests({ userId, onClose }: FriendRequestsProps) {
  const [activeTab, setActiveTab] = useState<"received" | "sent" | "friends" | "blocked">("received");
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddFriend, setShowAddFriend] = useState(false);

  useEffect(() => {
    fetchAllData();
    const channel = supabase.channel("friend-requests-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, () => {
        fetchAllData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "blocked_users" }, () => {
        fetchAllData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function fetchAllData() {
    setLoading(true);
    await Promise.all([
      fetchReceivedRequests(),
      fetchSentRequests(),
      fetchFriends(),
      fetchBlockedUsers(),
      fetchAllUsers()
    ]);
    setLoading(false);
  }

  async function fetchReceivedRequests() {
    const { data } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("receiver_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (data) {
      const senderIds = data.map(r => r.sender_id);
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("*").in("id", senderIds);
        const enriched = data.map(r => ({
          ...r,
          sender: profiles?.find(p => p.id === r.sender_id)
        }));
        setReceivedRequests(enriched);
      } else {
        setReceivedRequests([]);
      }
    }
  }

  async function fetchSentRequests() {
    const { data } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("sender_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (data) {
      const receiverIds = data.map(r => r.receiver_id);
      if (receiverIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("*").in("id", receiverIds);
        const enriched = data.map(r => ({
          ...r,
          receiver: profiles?.find(p => p.id === r.receiver_id)
        }));
        setSentRequests(enriched);
      } else {
        setSentRequests([]);
      }
    }
  }

  async function fetchFriends() {
    const { data } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("status", "accepted")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    if (data) {
      const friendIds = data.map(r => r.sender_id === userId ? r.receiver_id : r.sender_id);
      if (friendIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("*").in("id", friendIds);
        setFriends(profiles || []);
      } else {
        setFriends([]);
      }
    }
  }

  async function fetchBlockedUsers() {
    const { data } = await supabase
      .from("blocked_users")
      .select("*")
      .eq("blocker_id", userId);

    if (data) {
      const blockedIds = data.map(b => b.blocked_id);
      if (blockedIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("*").in("id", blockedIds);
        setBlockedUsers(profiles || []);
      } else {
        setBlockedUsers([]);
      }
    }
  }

  async function fetchAllUsers() {
    const { data } = await supabase.from("profiles").select("*").neq("id", userId);
    if (data) setAllUsers(data);
  }

  async function sendFriendRequest(receiverId: string) {
    const { data: existing } = await supabase
      .from("friend_requests")
      .select("*")
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${userId})`);

    if (existing && existing.length > 0) {
      toast.error("Request already exists");
      return;
    }

    const { data: blocked } = await supabase
      .from("blocked_users")
      .select("*")
      .or(`and(blocker_id.eq.${userId},blocked_id.eq.${receiverId}),and(blocker_id.eq.${receiverId},blocked_id.eq.${userId})`);

    if (blocked && blocked.length > 0) {
      toast.error("Cannot send request to blocked user");
      return;
    }

    const { error } = await supabase.from("friend_requests").insert({
      sender_id: userId,
      receiver_id: receiverId,
      status: "pending"
    });

    if (error) {
      toast.error("Failed to send request");
    } else {
      toast.success("Friendship request sent!");
      fetchAllData();
      setShowAddFriend(false);
    }
  }

  async function acceptRequest(requestId: string) {
    const { error } = await supabase
      .from("friend_requests")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", requestId);

    if (error) {
      toast.error("Failed to accept request");
    } else {
      toast.success("Friendship approved!");
      fetchAllData();
    }
  }

  async function declineRequest(requestId: string) {
    const { error } = await supabase.from("friend_requests").delete().eq("id", requestId);

    if (error) {
      toast.error("Failed to decline request");
    } else {
      toast("Request declined");
      fetchAllData();
    }
  }

  async function cancelRequest(requestId: string) {
    const { error } = await supabase.from("friend_requests").delete().eq("id", requestId);

    if (error) {
      toast.error("Failed to cancel request");
    } else {
      toast("Request cancelled");
      fetchAllData();
    }
  }

  async function removeFriend(friendId: string) {
    await supabase
      .from("friend_requests")
      .delete()
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`);

    toast("Friend removed");
    fetchAllData();
  }

  async function blockUser(blockedId: string) {
    await supabase
      .from("friend_requests")
      .delete()
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${blockedId}),and(sender_id.eq.${blockedId},receiver_id.eq.${userId})`);

    const { error } = await supabase.from("blocked_users").insert({
      blocker_id: userId,
      blocked_id: blockedId
    });

    if (error) {
      toast.error("Failed to block user");
    } else {
      toast("User blocked");
      fetchAllData();
    }
  }

  async function unblockUser(blockedId: string) {
    const { error } = await supabase
      .from("blocked_users")
      .delete()
      .eq("blocker_id", userId)
      .eq("blocked_id", blockedId);

    if (error) {
      toast.error("Failed to unblock user");
    } else {
      toast.success("User unblocked");
      fetchAllData();
    }
  }

  const friendIds = new Set(friends.map(f => f.id));
  const blockedIds = new Set(blockedUsers.map(b => b.id));
  const pendingSentIds = new Set(sentRequests.map(r => r.receiver_id));
  const pendingReceivedIds = new Set(receivedRequests.map(r => r.sender_id));

  const availableUsers = allUsers.filter(u => 
    !friendIds.has(u.id) && 
    !blockedIds.has(u.id) && 
    !pendingSentIds.has(u.id) && 
    !pendingReceivedIds.has(u.id) &&
    u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs = [
    { id: "received", label: "Requests", count: receivedRequests.length, icon: UserPlus },
    { id: "sent", label: "Sent", count: sentRequests.length, icon: Send },
    { id: "friends", label: "Friends", count: friends.length, icon: Users },
    { id: "blocked", label: "Blocked", count: blockedUsers.length, icon: Ban },
  ];

  return (
    <div className="h-full flex flex-col bg-[#030303]">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-black uppercase italic tracking-tight">Connections</h2>
            <p className="text-[10px] text-white/30 uppercase tracking-widest">Manage your network</p>
          </div>
        </div>
        <Button 
          onClick={() => setShowAddFriend(true)}
          className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-[10px] font-black uppercase tracking-widest"
        >
          <UserPlus className="w-4 h-4 mr-2" /> Add Friend
        </Button>
      </div>

      <div className="flex border-b border-white/5 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-4 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
              activeTab === tab.id 
                ? 'text-white border-indigo-500 bg-indigo-500/10' 
                : 'text-white/30 border-transparent hover:text-white/50 hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[8px] ${
                activeTab === tab.id ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/50'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pb-32 lg:pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === "received" && (
              <div className="space-y-4">
                {receivedRequests.length === 0 ? (
                  <div className="text-center py-20 opacity-30">
                    <UserPlus className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-sm font-black uppercase tracking-widest">No pending requests</p>
                  </div>
                ) : (
                  receivedRequests.map(req => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-r from-pink-900/20 to-purple-900/20 border border-white/10 rounded-3xl p-6"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <AvatarDisplay profile={req.sender} className="h-14 w-14" />
                        <div className="flex-1">
                          <p className="font-black text-lg uppercase italic">{req.sender?.username}</p>
                          <p className="text-[10px] text-white/30 uppercase tracking-widest flex items-center gap-2">
                            <Heart className="w-3 h-3 text-pink-500" />
                            Approval for Friendship
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl mb-4">
                        <Sparkles className="w-5 h-5 text-yellow-500" />
                        <p className="text-sm text-white/60">
                          <span className="font-bold text-white">{req.sender?.username}</span> wants to connect with you
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          onClick={() => declineRequest(req.id)}
                          variant="outline"
                          className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/20 text-[10px] font-black uppercase"
                        >
                          <X className="w-4 h-4 mr-2" /> Decline
                        </Button>
                        <Button
                          onClick={() => acceptRequest(req.id)}
                          className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-[10px] font-black uppercase"
                        >
                          <Check className="w-4 h-4 mr-2" /> Approve
                        </Button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            )}

            {activeTab === "sent" && (
              <div className="space-y-4">
                {sentRequests.length === 0 ? (
                  <div className="text-center py-20 opacity-30">
                    <Send className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-sm font-black uppercase tracking-widest">No pending requests</p>
                  </div>
                ) : (
                  sentRequests.map(req => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 flex items-center gap-4"
                    >
                      <AvatarDisplay profile={req.receiver} className="h-12 w-12" />
                      <div className="flex-1">
                        <p className="font-black uppercase italic">{req.receiver?.username}</p>
                        <p className="text-[10px] text-amber-500 uppercase tracking-widest flex items-center gap-2">
                          <Clock className="w-3 h-3" /> Waiting for approval
                        </p>
                      </div>
                      <Button
                        onClick={() => cancelRequest(req.id)}
                        variant="outline"
                        size="sm"
                        className="border-white/10 text-white/50 hover:bg-red-500/20 hover:text-red-400 text-[10px] font-black uppercase"
                      >
                        Cancel
                      </Button>
                    </motion.div>
                  ))
                )}
              </div>
            )}

            {activeTab === "friends" && (
              <div className="space-y-4">
                {friends.length === 0 ? (
                  <div className="text-center py-20 opacity-30">
                    <Users className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-sm font-black uppercase tracking-widest">No friends yet</p>
                  </div>
                ) : (
                  friends.map(friend => (
                    <motion.div
                      key={friend.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 flex items-center gap-4"
                    >
                      <AvatarDisplay profile={friend} className="h-12 w-12" />
                      <div className="flex-1">
                        <p className="font-black uppercase italic">{friend.username}</p>
                        <p className="text-[10px] text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                          <UserCheck className="w-3 h-3" /> Connected
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => blockUser(friend.id)}
                          variant="outline"
                          size="sm"
                          className="border-white/10 text-white/50 hover:bg-red-500/20 hover:text-red-400 text-[10px] font-black uppercase"
                        >
                          <Ban className="w-3 h-3" />
                        </Button>
                        <Button
                          onClick={() => removeFriend(friend.id)}
                          variant="outline"
                          size="sm"
                          className="border-white/10 text-white/50 hover:bg-red-500/20 hover:text-red-400 text-[10px] font-black uppercase"
                        >
                          <UserX className="w-3 h-3" />
                        </Button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            )}

            {activeTab === "blocked" && (
              <div className="space-y-4">
                {blockedUsers.length === 0 ? (
                  <div className="text-center py-20 opacity-30">
                    <Ban className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-sm font-black uppercase tracking-widest">No blocked users</p>
                  </div>
                ) : (
                  blockedUsers.map(user => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-900/10 border border-red-500/20 rounded-3xl p-6 flex items-center gap-4"
                    >
                      <AvatarDisplay profile={user} className="h-12 w-12 opacity-50" />
                      <div className="flex-1">
                        <p className="font-black uppercase italic text-white/50">{user.username}</p>
                        <p className="text-[10px] text-red-500 uppercase tracking-widest flex items-center gap-2">
                          <Ban className="w-3 h-3" /> Blocked
                        </p>
                      </div>
                      <Button
                        onClick={() => unblockUser(user.id)}
                        variant="outline"
                        size="sm"
                        className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-black uppercase"
                      >
                        Unblock
                      </Button>
                    </motion.div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {showAddFriend && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddFriend(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-[10%] bottom-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[500px] bg-[#0a0a0a] border border-white/10 rounded-3xl z-50 flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black uppercase italic">Send Friend Request</h3>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest">Find new connections</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowAddFriend(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="p-4 border-b border-white/5">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                {availableUsers.length === 0 ? (
                  <div className="text-center py-10 opacity-30">
                    <Search className="w-10 h-10 mx-auto mb-3" />
                    <p className="text-xs font-bold uppercase tracking-widest">No users found</p>
                  </div>
                ) : (
                  availableUsers.map(user => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.05] transition-all"
                    >
                      <AvatarDisplay profile={user} className="h-10 w-10" />
                      <div className="flex-1">
                        <p className="font-black text-sm uppercase">{user.username}</p>
                        <p className="text-[9px] text-white/30 uppercase tracking-widest">{user.full_name || "User"}</p>
                      </div>
                      <Button
                        onClick={() => sendFriendRequest(user.id)}
                        size="sm"
                        className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-[9px] font-black uppercase"
                      >
                        <Heart className="w-3 h-3 mr-1" /> Request
                      </Button>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
