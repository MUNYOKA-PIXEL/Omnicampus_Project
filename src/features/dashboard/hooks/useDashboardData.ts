// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { generateCampusResponse } from "@/services/gemini";

export const useDashboardData = (user: any, role: string | null) => {
  const isSuperAdmin = role === "superadmin";

  const [chatMessages, setChatMessages] = useState([
    {
      type: "bot",
      text: "Hello! I'm Omni-Intelligence, your campus assistant. Ask me anything about library books, clubs, or medical services!",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const [booksBorrowed, setBooksBorrowed] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState(0);
  const [activeClubs, setActiveClubs] = useState(0);
  const [overdueFines, setOverdueFines] = useState(0);
  const [globalStats, setGlobalStats] = useState({
    users: 0,
    appointments: 0,
    inventory: 0,
    items: 0,
  });

  const [loans, setLoans] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [recommendedBooks, setRecommendedBooks] = useState<any[]>([]);
  const [userList, setUserList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchDashboard = async () => {
      setLoading(true);
      const promises = [
        supabase
          .from("book_loans")
          .select("*, books(title)")
          .eq("user_id", user.id)
          .order("issue_date", { ascending: false })
          .limit(5),
        supabase.from("club_memberships").select("club_id").eq("user_id", user.id),
        supabase
          .from("club_events")
          .select("*, clubs(name)")
          .gte("date", new Date().toISOString().split("T")[0])
          .order("date")
          .limit(5),
        supabase.from("books").select("*").eq("available", true).limit(3),
      ];

      if (isSuperAdmin) {
        promises.push(
          supabase.from("profiles").select("*, user_roles(role)"),
          supabase.from("profiles").select("id", { count: "exact" }),
          supabase.from("appointments").select("id", { count: "exact" }),
          supabase.from("books").select("id", { count: "exact" }),
          supabase.from("lost_found_items").select("id", { count: "exact" }),
        );
      }

      const results = await Promise.all(promises);

      const userLoans = results[0].data || [];
      setLoans(userLoans);
      const activeLoans = userLoans.filter((loan: any) => loan.status === "active");
      setBooksBorrowed(activeLoans.length);
      setOverdueFines(
        userLoans.reduce((sum: number, loan: any) => sum + (loan.fine_amount || 0), 0),
      );

      setActiveClubs((results[1].data || []).length);
      setEvents(results[2].data || []);
      setUpcomingEvents((results[2].data || []).length);
      setRecommendedBooks(results[3].data || []);

      if (isSuperAdmin) {
        setUserList(results[4].data || []);
        setGlobalStats({
          users: results[5].count || 0,
          appointments: results[6].count || 0,
          inventory: results[7].count || 0,
          items: results[8].count || 0,
        });
      }

      setLoading(false);
    };

    fetchDashboard();
  }, [user, role]);

  const sendMessage = async () => {
    if (!chatInput.trim() || isTyping) return;

    const userMessage = chatInput;
    setChatInput("");
    setChatMessages((prev) => [...prev, { type: "user", text: userMessage }]);
    setIsTyping(true);

    try {
      const response = await generateCampusResponse(userMessage);
      setChatMessages((prev) => [...prev, { type: "bot", text: response }]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        { type: "bot", text: "I'm having trouble connecting right now. Please try again later." },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleRoleUpdate = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", userId);

    if (error) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Role Updated", description: `User role is now ${newRole}.` });
    const { data } = await supabase.from("profiles").select("*, user_roles(role)");
    if (data) setUserList(data);
  };

  return {
    isSuperAdmin,
    chatMessages,
    setChatMessages,
    chatInput,
    setChatInput,
    isTyping,
    booksBorrowed,
    upcomingEvents,
    activeClubs,
    overdueFines,
    globalStats,
    loans,
    events,
    recommendedBooks,
    userList,
    loading,
    sendMessage,
    handleRoleUpdate,
  };
};
