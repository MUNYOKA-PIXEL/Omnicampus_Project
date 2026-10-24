import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  Bot,
  BookOpen,
  CalendarDays,
  HeartPulse,
  Loader2,
  MessageSquareText,
  PanelRightOpen,
  Plus,
  Send,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/features/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  createConversationTitle,
  deleteSavedConversation,
  listSavedConversations,
  parseConversationMessages,
  saveConversation,
  type ConversationMessage,
  type SavedConversation,
} from "@/services/assistant-conversations";
import {
  runCampusAgentStep,
  type CampusAgentStep,
  type CampusConversationTurn,
} from "@/services/gemini-client";
import { getCampusDate } from "@/services/campusContext";
import {
  ADMIN_TOOL_ROLES,
  STUDENT_MUTATION_TOOLS,
  getToolArgsValidationMessage,
  toolRegistry,
  validateToolArgs,
} from "@/services/tools";
import type { AppRole } from "@/types/roles";

type ChatMessage = ConversationMessage;

const createWelcomeMessage = (role: AppRole | null): ChatMessage => ({
  id: 0,
  role: "assistant",
  text:
    role === "student"
      ? "Hi! I’m Omni-Intelligence. I can help you find campus information about the library, clubs, medical services, and lost and found."
      : `Hi! I’m Omni-Intelligence. I’m ready to help with your ${role === "superadmin" ? "campus operations" : role?.replace("admin", " administration")} dashboard.`,
});

interface PendingAction {
  tool: string;
  args: CampusAgentStep["args"];
  prompt: string;
  displayText?: string;
}

interface AppointmentProfile {
  id: string;
  full_name: string | null;
  student_id: string | null;
  email: string | null;
}

const assistantRoleContent = {
  student: {
    prompts: [
      { icon: BookOpen, label: "Find available library books" },
      { icon: CalendarDays, label: "What campus events are coming up?" },
      { icon: HeartPulse, label: "Which doctors are available today?" },
      { icon: Search, label: "Search recent lost and found reports" },
    ],
    help: "Library availability, campus events, available doctors, appointments, and recent lost and found reports.",
  },
  libadmin: {
    prompts: [
      { icon: BookOpen, label: "Add a new book to inventory" },
      { icon: BookOpen, label: "Show pending acquisition requests" },
      { icon: Search, label: "Which loans are overdue?" },
      { icon: CalendarDays, label: "Mark a loan as returned" },
    ],
    help: "Book inventory, loans and returns, acquisition requests, and library digital resources.",
  },
  clubadmin: {
    prompts: [
      { icon: CalendarDays, label: "Create a club event" },
      { icon: Search, label: "Show registrations for an event" },
      { icon: BookOpen, label: "Add a club resource" },
      { icon: Users, label: "Show the member roster" },
    ],
    help: "Club registry, events, member rosters, event registrations, and club resources.",
  },
  medadmin: {
    prompts: [
      { icon: CalendarDays, label: "Show pending appointments" },
      { icon: CalendarDays, label: "Book an appointment for someone" },
      { icon: HeartPulse, label: "Add a new practitioner" },
      { icon: HeartPulse, label: "Add pharmacy medication" },
      { icon: BookOpen, label: "Publish a wellness resource" },
    ],
    help: "Appointment schedules, practitioners, pharmacy stock, and wellness resources.",
  },
  superadmin: {
    prompts: [
      { icon: BookOpen, label: "Review library operations" },
      { icon: CalendarDays, label: "Review club events and registrations" },
      { icon: HeartPulse, label: "Review medical appointments" },
      { icon: CalendarDays, label: "Book an appointment for someone" },
      { icon: Search, label: "Summarize campus operations" },
    ],
    help: "Library, clubs, medical operations, campus records, and cross-domain oversight.",
  },
} as const;

type AssistantRoleContent = (typeof assistantRoleContent)[keyof typeof assistantRoleContent];

const AssistantSupportContent = ({
  roleContent,
  onSelectPrompt,
}: {
  roleContent: AssistantRoleContent;
  onSelectPrompt: (label: string) => void;
}) => (
  <>
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 font-semibold text-foreground">
        <Sparkles className="h-4 w-4 text-accent" /> Try asking
      </h2>
      <div className="mt-4 space-y-2">
        {roleContent.prompts.map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => onSelectPrompt(label)}
            className="flex w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-3 text-left text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Icon className="h-4 w-4 shrink-0 text-primary" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
    <div className="rounded-2xl border border-primary/15 bg-primary p-5 text-primary-foreground shadow-sm">
      <h2 className="font-semibold">What I can help with</h2>
      <p className="mt-2 text-sm leading-6 text-primary-foreground/75">{roleContent.help}</p>
    </div>
  </>
);

const ConversationHistory = ({
  conversations,
  activeConversationId,
  loading,
  disabled,
  onSelect,
  onDelete,
}: {
  conversations: SavedConversation[];
  activeConversationId: string | null;
  loading: boolean;
  disabled: boolean;
  onSelect: (conversation: SavedConversation) => void;
  onDelete: (conversation: SavedConversation) => void;
}) => (
  <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
    <h2 className="flex items-center gap-2 font-semibold text-foreground">
      <MessageSquareText className="h-4 w-4 text-primary" /> Saved conversations
    </h2>
    {loading ? (
      <p className="mt-3 text-sm text-muted-foreground">Loading your conversations...</p>
    ) : conversations.length === 0 ? (
      <p className="mt-3 text-sm text-muted-foreground">
        Your conversations will appear here after you send a message.
      </p>
    ) : (
      <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {conversations.map((conversation) => (
          <li
            key={conversation.id}
            className={`flex items-center gap-1 rounded-lg border ${
              conversation.id === activeConversationId
                ? "border-primary/50 bg-primary/5"
                : "border-transparent hover:bg-muted/60"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(conversation)}
              disabled={disabled}
              className="min-w-0 flex-1 px-3 py-2 text-left disabled:opacity-60"
              aria-current={conversation.id === activeConversationId ? "true" : undefined}
            >
              <span className="block truncate text-sm font-medium text-foreground">
                {conversation.title}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {new Date(conversation.updated_at).toLocaleDateString()}
              </span>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mr-1 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(conversation)}
              disabled={disabled}
              aria-label={`Delete conversation: ${conversation.title}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const AIAssistantPage = () => {
  const { user, role } = useAuth();
  const roleContent = assistantRoleContent[role ?? "student"];
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [appointmentProfiles, setAppointmentProfiles] = useState<AppointmentProfile[]>([]);
  const [appointmentProfilesLoading, setAppointmentProfilesLoading] = useState(false);
  const [appointmentProfilesError, setAppointmentProfilesError] = useState(false);
  const [appointmentUserId, setAppointmentUserId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const canBookForOthers = role === "superadmin" || role === "medadmin";
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isChangingConversation, setIsChangingConversation] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const userId = user?.id;

  useEffect(() => {
    if (!canBookForOthers) {
      setAppointmentProfiles([]);
      setAppointmentProfilesLoading(false);
      setAppointmentProfilesError(false);
      return;
    }

    let active = true;
    setAppointmentProfilesLoading(true);
    void supabase
      .from("profiles")
      .select("id, full_name, student_id, email")
      .order("full_name")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Failed to load appointment recipients:", error);
          setAppointmentProfilesError(true);
        } else {
          setAppointmentProfiles(data ?? []);
          setAppointmentProfilesError(false);
        }
        setAppointmentProfilesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [canBookForOthers]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createWelcomeMessage(role)]);
  const messagesRef = useRef(messages);

  useEffect(() => {
    if (!userId) {
      setConversations([]);
      setHistoryLoading(false);
      conversationIdRef.current = null;
      return;
    }

    let active = true;
    setHistoryLoading(true);
    setHistoryError(null);
    void listSavedConversations(userId)
      .then((savedConversations) => {
        if (!active) return;
        setConversations(savedConversations);
        const latestConversation = savedConversations[0];
        if (latestConversation) {
          const savedMessages = parseConversationMessages(latestConversation.messages);
          conversationIdRef.current = latestConversation.id;
          messagesRef.current = savedMessages;
          setMessages(savedMessages);
        } else {
          conversationIdRef.current = null;
          const welcome = [createWelcomeMessage(role)];
          messagesRef.current = welcome;
          setMessages(welcome);
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to load saved AI conversations:", error);
        if (active) {
          setHistoryError("Saved conversations could not be loaded. Please try refreshing.");
        }
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId, role]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isTyping]);

  const persistMessages = (nextMessages: ChatMessage[]) => {
    if (!userId || !nextMessages.some((message) => message.role === "user")) {
      return Promise.resolve();
    }

    setSaveStatus("saving");
    setHistoryError(null);
    const operation = saveQueueRef.current.then(async () => {
      const conversation = await saveConversation(userId, conversationIdRef.current, nextMessages);
      conversationIdRef.current = conversation.id;
      setConversations((current) =>
        [conversation, ...current.filter((item) => item.id !== conversation.id)]
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .slice(0, 50),
      );
      setSaveStatus("saved");
    });
    saveQueueRef.current = operation.catch((error: unknown) => {
      console.error("Failed to save AI conversation:", error);
      setSaveStatus("error");
      setHistoryError(
        "This conversation could not be saved. It may not be available after you leave this page.",
      );
    });
    return saveQueueRef.current;
  };

  const addAssistantMessage = (text: string) => {
    const assistantMessage: ChatMessage = { id: Date.now(), role: "assistant", text };
    const nextMessages = [...messagesRef.current, assistantMessage];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    void persistMessages(nextMessages);
  };

  const startNewConversation = async () => {
    setIsChangingConversation(true);
    await saveQueueRef.current;
    conversationIdRef.current = null;
    const welcome = [createWelcomeMessage(role)];
    messagesRef.current = welcome;
    setMessages(welcome);
    setPendingAction(null);
    setSaveStatus("idle");
    setHistoryError(null);
    setIsChangingConversation(false);
    setHistoryOpen(false);
  };

  const openConversation = async (conversation: SavedConversation) => {
    setIsChangingConversation(true);
    await saveQueueRef.current;
    try {
      const savedMessages = parseConversationMessages(conversation.messages);
      conversationIdRef.current = conversation.id;
      messagesRef.current = savedMessages;
      setMessages(savedMessages);
      setPendingAction(null);
      setSaveStatus("saved");
      setHistoryError(null);
      setHistoryOpen(false);
    } catch (error) {
      console.error("Failed to open saved AI conversation:", error);
      setHistoryError("This saved conversation could not be opened.");
    } finally {
      setIsChangingConversation(false);
    }
  };

  const removeConversation = async (conversation: SavedConversation) => {
    if (!userId || !window.confirm(`Delete "${conversation.title}"? This cannot be undone.`))
      return;
    setIsChangingConversation(true);
    await saveQueueRef.current;
    try {
      await deleteSavedConversation(userId, conversation.id);
      setConversations((current) => current.filter((item) => item.id !== conversation.id));
      if (conversationIdRef.current === conversation.id) {
        conversationIdRef.current = null;
        const welcome = [createWelcomeMessage(role)];
        messagesRef.current = welcome;
        setMessages(welcome);
        setSaveStatus("idle");
        setPendingAction(null);
      }
      setHistoryError(null);
    } catch (error) {
      console.error("Failed to delete saved AI conversation:", error);
      setHistoryError("That conversation could not be deleted. Please try again.");
    } finally {
      setIsChangingConversation(false);
    }
  };

  const completeToolAction = async (
    prompt: string,
    tool: string,
    args: CampusAgentStep["args"],
    conversationHistory: CampusConversationTurn[],
    appointmentTargetUserId?: string,
  ) => {
    if (!user) {
      addAssistantMessage("Please sign in again before I access your campus information.");
      return;
    }

    const executeTool = toolRegistry[tool];
    if (!executeTool) {
      addAssistantMessage("I do not have permission to perform that campus action yet.");
      return;
    }
    if (ADMIN_TOOL_ROLES[tool] && (!role || !ADMIN_TOOL_ROLES[tool].includes(role))) {
      addAssistantMessage("That action is outside your administrator permissions.");
      return;
    }
    const validatedArgs = validateToolArgs(tool, args);
    if (!validatedArgs) {
      addAssistantMessage(
        getToolArgsValidationMessage(tool, args) ??
          "I could not validate the details for that action.",
      );
      return;
    }

    const targetUserId =
      tool === "insertAppointment" ? (appointmentTargetUserId ?? user.id) : undefined;
    if (targetUserId !== user.id && !canBookForOthers) {
      addAssistantMessage("You can only book appointments for yourself.");
      return;
    }
    if (
      tool === "insertAppointment" &&
      targetUserId !== user.id &&
      !appointmentProfiles.some((profile) => profile.id === targetUserId)
    ) {
      addAssistantMessage("Select a valid campus account before booking for another person.");
      return;
    }

    const result = await executeTool(user.id, validatedArgs, targetUserId);
    const finalStep = await runCampusAgentStep(prompt, { name: tool, result }, conversationHistory);
    if (finalStep.type === "final") {
      addAssistantMessage(finalStep.message);
      return;
    }
    addAssistantMessage(
      "I could not complete that request safely. Please provide a little more detail.",
    );
  };

  const processAgentStep = async (
    prompt: string,
    step: CampusAgentStep,
    conversationHistory: CampusConversationTurn[],
  ) => {
    if (step.type === "final") {
      addAssistantMessage(step.message);
      return;
    }

    if (!step.tool || !toolRegistry[step.tool]) {
      addAssistantMessage("I could not identify a safe campus action for that request.");
      return;
    }
    if (ADMIN_TOOL_ROLES[step.tool] && (!role || !ADMIN_TOOL_ROLES[step.tool].includes(role))) {
      addAssistantMessage("That action is outside your administrator permissions.");
      return;
    }

    const validatedArgs = validateToolArgs(step.tool, step.args);
    if (!validatedArgs) {
      addAssistantMessage(
        getToolArgsValidationMessage(step.tool, step.args) ??
          "I could not validate the details for that action.",
      );
      return;
    }

    const requiresConfirmation =
      step.requiresConfirmation ||
      STUDENT_MUTATION_TOOLS.some((tool) => tool === step.tool) ||
      Boolean(ADMIN_TOOL_ROLES[step.tool]);
    if (requiresConfirmation) {
      if (step.tool === "insertAppointment") {
        setAppointmentUserId(canBookForOthers ? "" : (user?.id ?? ""));
      }
      let displayText: string | undefined;
      if (!user) {
        addAssistantMessage("Please sign in again before making this change.");
        return;
      }
      if (step.tool === "libraryBorrowBook") {
        const { data: book, error } = await supabase
          .from("books")
          .select("title, author")
          .eq("id", String(step.args.book_id ?? ""))
          .eq("available", true)
          .maybeSingle();
        if (error) {
          console.error("Failed to verify book before borrowing:", error);
          addAssistantMessage("I couldn’t verify that book is available. Please try again.");
          return;
        }
        if (!book) {
          addAssistantMessage(
            "That book is no longer available to borrow. Please check the library.",
          );
          return;
        }
        displayText = `${book.title}${book.author ? ` by ${book.author}` : ""}`;
      } else if (step.tool === "cancelAppointment") {
        const { data: appointment, error } = await supabase
          .from("appointments")
          .select("date, time, status, doctors(name)")
          .eq("id", String(validatedArgs.appointment_id))
          .eq("user_id", user.id)
          .in("status", ["pending", "confirmed"])
          .maybeSingle();
        if (error || !appointment) {
          if (error) console.error("Failed to verify appointment cancellation:", error);
          addAssistantMessage("I couldn’t verify a cancellable appointment for your account.");
          return;
        }
        displayText = `${appointment.doctors?.name ?? "appointment"} on ${appointment.date} at ${appointment.time}`;
      } else if (step.tool === "libraryRequestBook") {
        displayText = `Request "${String(validatedArgs.title)}" from the library`;
      } else if (step.tool === "clubMembership") {
        const clubId = String(validatedArgs.club_id);
        const action = String(validatedArgs.action);
        const { data: club, error } = await supabase
          .from("clubs")
          .select("name")
          .eq("id", clubId)
          .maybeSingle();
        if (error || !club) {
          if (error) console.error("Failed to verify club membership action:", error);
          addAssistantMessage("I couldn’t find that club in the current registry.");
          return;
        }
        const { data: membership, error: membershipError } = await supabase
          .from("club_memberships")
          .select("id")
          .eq("club_id", clubId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (membershipError) {
          console.error("Failed to verify club membership:", membershipError);
          addAssistantMessage("I couldn’t verify your current membership in that club.");
          return;
        }
        if ((action === "join" && membership) || (action === "leave" && !membership)) {
          addAssistantMessage(
            action === "join"
              ? `You’re already a member of ${club.name}.`
              : `You’re not a member of ${club.name}.`,
          );
          return;
        }
        displayText = `${action === "join" ? "Join" : "Leave"} ${club.name}`;
      } else if (step.tool === "eventRsvp") {
        const eventId = String(validatedArgs.event_id);
        const action = String(validatedArgs.action);
        const { data: event, error } = await supabase
          .from("club_events")
          .select("title, date, clubs(name)")
          .eq("id", eventId)
          .gte("date", getCampusDate())
          .maybeSingle();
        if (error || !event) {
          if (error) console.error("Failed to verify event RSVP:", error);
          addAssistantMessage("I couldn’t find that upcoming event.");
          return;
        }
        const { data: rsvp, error: rsvpError } = await supabase
          .from("event_rsvps")
          .select("id")
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (rsvpError) {
          console.error("Failed to verify event RSVP status:", rsvpError);
          addAssistantMessage("I couldn’t verify your current RSVP for that event.");
          return;
        }
        if ((action === "attend" && rsvp) || (action === "cancel" && !rsvp)) {
          addAssistantMessage(
            action === "attend"
              ? `You’re already attending ${event.title}.`
              : `You don’t have an RSVP for ${event.title}.`,
          );
          return;
        }
        displayText = `${action === "attend" ? "RSVP to" : "Cancel your RSVP for"} ${event.title} on ${event.date}`;
      } else if (step.tool === "createLostFoundReport") {
        displayText = `Submit ${String(validatedArgs.type)} item report: "${String(validatedArgs.item_name)}"`;
      } else if (step.tool === "resolveLostFoundReport") {
        const { data: report, error } = await supabase
          .from("lost_found_items")
          .select("item_name, type")
          .eq("id", String(validatedArgs.report_id))
          .eq("user_id", user.id)
          .eq("status", "open")
          .maybeSingle();
        if (error || !report) {
          if (error) console.error("Failed to verify lost-and-found report:", error);
          addAssistantMessage("I couldn’t find an open report owned by your account to resolve.");
          return;
        }
        displayText = `Resolve your ${report.type} report for "${report.item_name}"`;
      }
      setPendingAction({ tool: step.tool, args: validatedArgs, prompt, displayText });
      addAssistantMessage(
        `${step.message || "I can carry out that action for you."} Please confirm below before I continue.`,
      );
      return;
    }

    await completeToolAction(prompt, step.tool, step.args, conversationHistory);
  };

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const prompt = input.trim();
    if (!prompt || isTyping || historyLoading || isChangingConversation) return;

    setInput("");
    const conversationHistory = messagesRef.current
      .slice(1)
      .slice(-10)
      .map(({ role: messageRole, text }) => ({ role: messageRole, text }));
    const userMessage: ChatMessage = { id: Date.now(), role: "user", text: prompt };
    const nextMessages = [...messagesRef.current, userMessage];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setIsTyping(true);

    try {
      await persistMessages(nextMessages);
      const step = await runCampusAgentStep(prompt, undefined, conversationHistory);
      await processAgentStep(prompt, step, conversationHistory);
    } catch {
      addAssistantMessage(
        "I couldn’t connect to campus services right now. Please try again in a moment.",
      );
    } finally {
      setIsTyping(false);
    }
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    const action = pendingAction;
    const targetUserId =
      action.tool === "insertAppointment"
        ? canBookForOthers
          ? appointmentUserId
          : user?.id
        : undefined;
    if (action.tool === "insertAppointment" && !targetUserId) {
      addAssistantMessage("Select who the appointment is for before confirming the booking.");
      return;
    }
    setPendingAction(null);
    setIsTyping(true);
    const conversationHistory = messagesRef.current
      .slice(1)
      .slice(-10)
      .map(({ role: messageRole, text }) => ({ role: messageRole, text }));
    try {
      await completeToolAction(
        action.prompt,
        action.tool,
        action.args,
        conversationHistory,
        targetUserId,
      );
    } catch {
      addAssistantMessage("I couldn’t complete that action right now. Please try again later.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const selectPrompt = (label: string) => {
    setInput(label);
    setSuggestionsOpen(false);
  };

  const historyDisabled = isTyping || historyLoading || isChangingConversation;
  const historyContent = (
    <ConversationHistory
      conversations={conversations}
      activeConversationId={conversationIdRef.current}
      loading={historyLoading}
      disabled={historyDisabled}
      onSelect={(conversation) => void openConversation(conversation)}
      onDelete={(conversation) => void removeConversation(conversation)}
    />
  );

  return (
    <DashboardLayout>
      <div className="mx-auto flex min-w-0 max-w-6xl flex-col gap-6 sm:gap-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-4 w-4 text-accent" /> Campus intelligence
            </div>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Ask Omni-Intelligence
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Get answers from current campus information in one conversation.
            </p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm sm:flex">
            <span className="h-2 w-2 rounded-full bg-green-600" /> Live campus data
          </div>
        </div>

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="flex h-[clamp(22rem,calc(100dvh-20rem),52rem)] min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-usiu lg:h-[min(72dvh,52rem)] lg:min-h-[32rem]">
            <div className="flex items-center gap-3 border-b border-border bg-primary px-4 py-4 text-primary-foreground sm:px-6 sm:py-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">Omni-Intelligence</h2>
                <p className="truncate text-xs text-primary-foreground/70">
                  Your campus information assistant
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 px-2 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground sm:px-3"
                onClick={() => void startNewConversation()}
                disabled={historyDisabled}
                aria-label="Start a new conversation"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New chat</span>
              </Button>
              <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground lg:hidden"
                    aria-label="Open saved conversations"
                  >
                    <MessageSquareText className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[min(90vw,22rem)] overflow-y-auto">
                  <SheetHeader className="text-left">
                    <SheetTitle>Conversation history</SheetTitle>
                    <SheetDescription>
                      Your saved chats are private to your account. You can delete them at any time.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    {historyContent}
                    {historyError && (
                      <p role="alert" className="text-sm text-destructive">
                        {historyError}
                      </p>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
              <Sheet open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground lg:hidden"
                    aria-label="Open assistant suggestions"
                  >
                    <PanelRightOpen className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[min(90vw,22rem)] overflow-y-auto">
                  <SheetHeader className="text-left">
                    <SheetTitle>Campus assistant help</SheetTitle>
                    <SheetDescription>
                      Choose a prompt or see what Omni-Intelligence can help with.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    <AssistantSupportContent
                      roleContent={roleContent}
                      onSelectPrompt={selectPrompt}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <div
              role="log"
              aria-label="Conversation with Omni-Intelligence"
              aria-live="polite"
              aria-relevant="additions text"
              className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain bg-background/60 p-4 sm:p-7"
            >
              {historyError && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  {historyError}
                </p>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex min-w-0 gap-2 sm:gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[min(82%,40rem)] break-words whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border bg-card text-foreground"}`}
                  >
                    {message.text}
                  </div>
                  {message.role === "user" && (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                      <UserRound className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin" /> Checking campus information...
                  </div>
                </div>
              )}
              {pendingAction && (
                <div className="rounded-xl border border-accent/50 bg-accent/10 p-4 text-sm text-foreground">
                  <p className="font-semibold">
                    {pendingAction.displayText
                      ? `Confirm: ${pendingAction.displayText}?`
                      : `I’m ready to use ${pendingAction.tool}.`}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    This will change your account’s campus records. Confirm only if the details are
                    correct.
                    {pendingAction.tool === "createLostFoundReport" &&
                      " This report cannot include a photo; you can add one from the Lost & Found page."}
                  </p>
                  {pendingAction.tool === "insertAppointment" && canBookForOthers && (
                    <label className="mt-3 block font-medium text-foreground">
                      Book this appointment for
                      <select
                        value={appointmentUserId}
                        onChange={(event) => setAppointmentUserId(event.target.value)}
                        disabled={appointmentProfilesLoading || appointmentProfilesError}
                        className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2"
                      >
                        <option value="">
                          {appointmentProfilesLoading
                            ? "Loading campus accounts..."
                            : appointmentProfilesError
                              ? "Could not load campus accounts"
                              : "Select a person"}
                        </option>
                        {appointmentProfiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.full_name || "Unnamed account"}
                            {profile.student_id ? ` · ${profile.student_id}` : ""}
                            {profile.email ? ` · ${profile.email}` : ""}
                          </option>
                        ))}
                      </select>
                      {appointmentProfilesError && (
                        <span className="mt-1 block text-xs text-destructive">
                          Account list could not be loaded. Cancel and try again.
                        </span>
                      )}
                    </label>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void confirmAction()}
                      disabled={
                        isTyping ||
                        (pendingAction.tool === "insertAppointment" &&
                          canBookForOthers &&
                          (appointmentProfilesLoading ||
                            appointmentProfilesError ||
                            !appointmentUserId))
                      }
                    >
                      {pendingAction.tool === "insertAppointment"
                        ? "Confirm appointment"
                        : pendingAction.tool === "libraryBorrowBook"
                          ? "Borrow this book"
                          : "Confirm"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPendingAction(null);
                        addAssistantMessage("No problem. I left that action unchanged.");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} aria-hidden="true" />
            </div>

            <form onSubmit={sendMessage} className="border-t border-border bg-card p-3 sm:p-5">
              <p className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  Chats are saved privately to your account. Avoid sharing sensitive details.
                </span>
                <span aria-live="polite">
                  {saveStatus === "saving"
                    ? "Saving..."
                    : saveStatus === "saved"
                      ? "Saved"
                      : saveStatus === "error"
                        ? "Not saved"
                        : ""}
                </span>
              </p>
              <div className="flex items-end gap-3">
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about campus life..."
                  className="min-h-[48px] min-w-0 resize-none bg-background sm:min-h-[52px]"
                  maxLength={4000}
                  disabled={historyLoading || isChangingConversation}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-12 w-12 shrink-0 sm:h-[52px] sm:w-[52px]"
                  disabled={isTyping || historyLoading || isChangingConversation || !input.trim()}
                  aria-label="Send message"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </form>
          </section>

          <aside className="hidden space-y-4 lg:block">
            {historyContent}
            {historyError && (
              <p role="alert" className="text-sm text-destructive">
                {historyError}
              </p>
            )}
            <AssistantSupportContent roleContent={roleContent} onSelectPrompt={selectPrompt} />
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AIAssistantPage;
