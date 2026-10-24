import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  Bot,
  BookOpen,
  CalendarDays,
  HeartPulse,
  Loader2,
  PanelRightOpen,
  Send,
  Search,
  Sparkles,
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
  runCampusAgentStep,
  type CampusAgentStep,
  type CampusConversationTurn,
} from "@/services/gemini-client";
import {
  ADMIN_TOOL_ROLES,
  getToolArgsValidationMessage,
  toolRegistry,
  validateToolArgs,
} from "@/services/tools";

interface ChatMessage {
  id: number;
  role: "assistant" | "user";
  text: string;
}

interface PendingAction {
  tool: string;
  args: CampusAgentStep["args"];
  prompt: string;
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
  const canBookForOthers = role === "superadmin" || role === "medadmin";

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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: "assistant",
      text:
        role === "student"
          ? "Hi! I’m Omni-Intelligence. I can help you find campus information about the library, clubs, medical services, and lost and found."
          : `Hi! I’m Omni-Intelligence. I’m ready to help with your ${role === "superadmin" ? "campus operations" : role?.replace("admin", " administration")} dashboard.`,
    },
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isTyping]);

  const addAssistantMessage = (text: string) => {
    setMessages((current) => [...current, { id: Date.now(), role: "assistant", text }]);
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

    const requiresConfirmation =
      step.requiresConfirmation ||
      step.tool === "insertAppointment" ||
      Boolean(ADMIN_TOOL_ROLES[step.tool]);
    if (requiresConfirmation) {
      if (step.tool === "insertAppointment") {
        setAppointmentUserId(canBookForOthers ? "" : (user?.id ?? ""));
      }
      setPendingAction({ tool: step.tool, args: step.args, prompt });
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
    if (!prompt || isTyping) return;

    setInput("");
    setMessages((current) => [...current, { id: Date.now(), role: "user", text: prompt }]);
    setIsTyping(true);
    const conversationHistory = messages
      .slice(1)
      .slice(-10)
      .map(({ role: messageRole, text }) => ({ role: messageRole, text }));

    try {
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
    const conversationHistory = messages
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
                  <p className="font-semibold">I’m ready to use {pendingAction.tool}.</p>
                  <p className="mt-1 text-muted-foreground">
                    This action can change your campus records. Confirm only if the details are
                    correct.
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
                        : "Confirm action"}
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
              <div className="flex items-end gap-3">
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about campus life..."
                  className="min-h-[48px] min-w-0 resize-none bg-background sm:min-h-[52px]"
                  maxLength={4000}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-12 w-12 shrink-0 sm:h-[52px] sm:w-[52px]"
                  disabled={isTyping || !input.trim()}
                  aria-label="Send message"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </form>
          </section>

          <aside className="hidden space-y-4 lg:block">
            <AssistantSupportContent roleContent={roleContent} onSelectPrompt={selectPrompt} />
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AIAssistantPage;
