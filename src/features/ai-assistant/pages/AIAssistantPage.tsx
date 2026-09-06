import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  Bot,
  BookOpen,
  CalendarDays,
  HeartPulse,
  Loader2,
  Send,
  Search,
  Sparkles,
  UserRound,
	Users,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/context/AuthContext";
import { runCampusAgentStep, type CampusAgentStep } from "@/services/gemini-client";
import { ADMIN_TOOL_ROLES, toolRegistry } from "@/services/tools";

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
			{ icon: Search, label: "Summarize campus operations" },
		],
		help: "Library, clubs, medical operations, campus records, and cross-domain oversight.",
	},
} as const;

const AIAssistantPage = () => {
	const { profile, user, role } = useAuth();
	const roleContent = assistantRoleContent[role ?? "student"];
	const [input, setInput] = useState("");
	const [isTyping, setIsTyping] = useState(false);
	const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([
		{
			id: 0,
			role: "assistant",
			text: role === "student"
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

	const completeToolAction = async (prompt: string, tool: string, args: CampusAgentStep["args"]) => {
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

		const result = await executeTool(user.id, args);
		const finalStep = await runCampusAgentStep(
			prompt,
			{ course: profile?.course, year_of_study: profile?.year_of_study },
			{ name: tool, result },
			role ?? "student",
		);
		if (finalStep.type === "final") {
			addAssistantMessage(finalStep.message);
			return;
		}
		addAssistantMessage("I could not complete that request safely. Please provide a little more detail.");
	};

	const processAgentStep = async (prompt: string, step: CampusAgentStep) => {
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

		if (step.requiresConfirmation) {
			setPendingAction({ tool: step.tool, args: step.args, prompt });
			addAssistantMessage(`${step.message || "I can carry out that action for you."} Please confirm below before I continue.`);
			return;
		}

		await completeToolAction(prompt, step.tool, step.args);
	};

	const sendMessage = async (event?: FormEvent) => {
		event?.preventDefault();
		const prompt = input.trim();
		if (!prompt || isTyping) return;

		setInput("");
		setMessages((current) => [...current, { id: Date.now(), role: "user", text: prompt }]);
		setIsTyping(true);

		try {
			const step = await runCampusAgentStep(prompt, {
				course: profile?.course,
				year_of_study: profile?.year_of_study,
			}, undefined, role ?? "student");
			await processAgentStep(prompt, step);
		} catch {
			addAssistantMessage("I couldn’t connect to campus services right now. Please try again in a moment.");
		} finally {
			setIsTyping(false);
		}
	};

	const confirmAction = async () => {
		if (!pendingAction) return;
		const action = pendingAction;
		setPendingAction(null);
		setIsTyping(true);
		try {
			await completeToolAction(action.prompt, action.tool, action.args);
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

	return (
		<DashboardLayout>
			<div className="mx-auto flex max-w-6xl flex-col gap-8">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
							<Sparkles className="h-4 w-4 text-accent" /> Campus intelligence
						</div>
						<h1 className="text-3xl font-bold text-foreground sm:text-4xl">Ask Omni-Intelligence</h1>
						<p className="mt-2 max-w-2xl text-muted-foreground">
							Get answers from current campus information in one conversation.
						</p>
					</div>
					<div className="hidden items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm sm:flex">
						<span className="h-2 w-2 rounded-full bg-green-600" /> Live campus data
					</div>
				</div>

				<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
					<section className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-usiu">
						<div className="flex items-center gap-3 border-b border-border bg-primary px-6 py-5 text-primary-foreground">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-primary">
								<Bot className="h-5 w-5" />
							</div>
							<div>
								<h2 className="font-semibold">Omni-Intelligence</h2>
								<p className="text-xs text-primary-foreground/70">Your campus information assistant</p>
							</div>
						</div>

						<div className="flex-1 space-y-5 overflow-y-auto bg-background/60 p-5 sm:p-7">
							{messages.map((message) => (
								<div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
									{message.role === "assistant" && (
										<div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
											<Bot className="h-4 w-4" />
										</div>
									)}
									<div className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border bg-card text-foreground"}`}>
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
									<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"><Bot className="h-4 w-4" /></div>
									<div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3">
										<Loader2 className="h-4 w-4 animate-spin" /> Checking campus information...
									</div>
								</div>
							)}
							{pendingAction && (
								<div className="rounded-xl border border-accent/50 bg-accent/10 p-4 text-sm text-foreground">
									<p className="font-semibold">I’m ready to use {pendingAction.tool}.</p>
									<p className="mt-1 text-muted-foreground">This action can change your campus records. Confirm only if the details are correct.</p>
									<div className="mt-3 flex gap-2">
										<Button type="button" size="sm" onClick={() => void confirmAction()}>Confirm action</Button>
										<Button type="button" size="sm" variant="outline" onClick={() => { setPendingAction(null); addAssistantMessage("No problem. I left that action unchanged."); }}>Cancel</Button>
									</div>
								</div>
							)}
							<div ref={messagesEndRef} aria-hidden="true" />
						</div>

						<form onSubmit={sendMessage} className="border-t border-border bg-card p-4 sm:p-5">
							<div className="flex items-end gap-3">
								<Textarea
									value={input}
									onChange={(event) => setInput(event.target.value)}
									onKeyDown={handleKeyDown}
									placeholder="Ask about campus life..."
									className="min-h-[52px] resize-none bg-background"
									maxLength={4000}
								/>
								<Button type="submit" size="icon" className="h-[52px] w-[52px] shrink-0" disabled={isTyping || !input.trim()} aria-label="Send message">
									<Send className="h-5 w-5" />
								</Button>
							</div>
						</form>
					</section>

					<aside className="space-y-4">
						<div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
							<h2 className="flex items-center gap-2 font-semibold text-foreground"><Sparkles className="h-4 w-4 text-accent" /> Try asking</h2>
							<div className="mt-4 space-y-2">
								{roleContent.prompts.map(({ icon: Icon, label }) => (
									<button key={label} type="button" onClick={() => setInput(label)} className="flex w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-3 text-left text-sm text-foreground transition-colors hover:border-primary hover:text-primary">
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
					</aside>
				</div>
			</div>
		</DashboardLayout>
	);
};

export default AIAssistantPage;
