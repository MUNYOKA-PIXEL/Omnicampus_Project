import { FormEvent, KeyboardEvent, useState } from "react";
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
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/context/AuthContext";
import { generateCampusResponse } from "@/services/gemini-client";

interface ChatMessage {
  id: number;
  role: "assistant" | "user";
  text: string;
}

const suggestedPrompts = [
  { icon: BookOpen, label: "Find available library books" },
  { icon: CalendarDays, label: "What campus events are coming up?" },
  { icon: HeartPulse, label: "Which doctors are available today?" },
  { icon: Search, label: "Search recent lost and found reports" },
];

const AIAssistantPage = () => {
	const { profile } = useAuth();
	const [input, setInput] = useState("");
	const [isTyping, setIsTyping] = useState(false);
	const [messages, setMessages] = useState<ChatMessage[]>([
		{
			id: 0,
			role: "assistant",
			text: "Hi! I’m Omni-Intelligence. I can help you find campus information about the library, clubs, medical services, and lost and found.",
		},
	]);

	const sendMessage = async (event?: FormEvent) => {
		event?.preventDefault();
		const prompt = input.trim();
		if (!prompt || isTyping) return;

		setInput("");
		setMessages((current) => [...current, { id: Date.now(), role: "user", text: prompt }]);
		setIsTyping(true);

		try {
			const response = await generateCampusResponse(prompt, {
				course: profile?.course,
				year_of_study: profile?.year_of_study,
			});
			setMessages((current) => [
				...current,
				{ id: Date.now() + 1, role: "assistant", text: response },
			]);
		} catch {
			setMessages((current) => [
				...current,
				{
					id: Date.now() + 1,
					role: "assistant",
					text: "I couldn’t connect to campus services right now. Please try again in a moment.",
				},
			]);
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
								{suggestedPrompts.map(({ icon: Icon, label }) => (
									<button key={label} type="button" onClick={() => setInput(label)} className="flex w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-3 text-left text-sm text-foreground transition-colors hover:border-primary hover:text-primary">
										<Icon className="h-4 w-4 shrink-0 text-primary" />
										<span>{label}</span>
									</button>
								))}
							</div>
						</div>
						<div className="rounded-2xl border border-primary/15 bg-primary p-5 text-primary-foreground shadow-sm">
							<h2 className="font-semibold">What I can help with</h2>
							<p className="mt-2 text-sm leading-6 text-primary-foreground/75">Library availability, campus events, available doctors, and recent lost and found reports.</p>
						</div>
					</aside>
				</div>
			</div>
		</DashboardLayout>
	);
};

export default AIAssistantPage;
