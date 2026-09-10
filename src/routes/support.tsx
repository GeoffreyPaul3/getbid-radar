import React, { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LifeBuoy,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Mail,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { sendSupportTicketFn } from "@/lib/email/support.functions";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Customer Support Desk | GetBidRadar" },
      {
        name: "description",
        content:
          "Submit a support ticket to the GetBidRadar engineering and customer success teams for billing inquiries, technical troubleshooting, or tender analysis assistance.",
      },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [category, setCategory] = useState<
    | "Billing & Invoices"
    | "Technical Issue"
    | "Tender Ingestion / Analysis"
    | "Account & Team Access"
    | "Feature Request"
    | "Other"
  >("Technical Issue");
  const [priority, setPriority] = useState<"Low" | "Normal" | "High" | "Critical">("Normal");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Please provide your name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Please enter a valid work email address.");
      return;
    }
    if (!subject.trim()) {
      setErrorMessage("Please enter a ticket subject.");
      return;
    }
    if (message.trim().length < 20) {
      setErrorMessage("Please describe your issue in at least 20 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await sendSupportTicketFn({
        data: {
          name: name.trim(),
          email: email.trim(),
          category,
          priority,
          subject: subject.trim(),
          message: message.trim(),
          honeypot: honeypot.trim() || undefined,
        },
      });

      if (res.success) {
        setTicketId(res.ticketId || "GBR-REC");
        toast.success("Support ticket created", {
          description: `Reference #${res.ticketId}`,
        });
      } else {
        setErrorMessage(res.error || "Failed to submit ticket. Please try again.");
      }
    } catch (err) {
      setErrorMessage((err as Error).message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <div className="py-16 sm:py-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary-soft text-primary text-xs font-mono font-semibold uppercase tracking-wider mb-4">
            <LifeBuoy className="h-3.5 w-3.5" />
            Help & Customer Success
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-foreground tracking-tight">
            How Can We Assist You?
          </h1>
          <p className="text-sm text-text-secondary mt-3">
            Our engineering and tender intelligence specialists respond to all inquiries within 4 business hours.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Support Ticket Form */}
          <div className="lg:col-span-2">
            <Card className="border border-border/80 shadow-panel bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="font-display text-xl font-bold">
                  {ticketId ? "Ticket Dispatched" : "Submit Support Request"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {ticketId
                    ? "Your ticket has been logged and assigned to our on-call support team."
                    : "Please provide complete context to ensure swift technical diagnosis."}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {errorMessage && (
                  <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 p-3.5 text-xs text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {ticketId ? (
                  <div className="space-y-6 py-4">
                    <div className="flex items-start gap-3.5 rounded-xl border border-primary/25 bg-primary-soft/40 p-5">
                      <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="font-bold text-foreground text-sm">
                          Ticket Successfully Logged
                        </h4>
                        <p className="text-xs text-text-secondary">
                          Reference ID: <strong className="text-foreground font-mono">{ticketId}</strong>
                        </p>
                        <p className="text-xs text-text-secondary pt-1">
                          A confirmation has been routed to{" "}
                          <strong className="text-foreground">{email}</strong>. Our specialists will review your ticket and reply directly.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button
                        variant="outline"
                        className="text-xs"
                        onClick={() => {
                          setTicketId(null);
                          setSubject("");
                          setMessage("");
                        }}
                      >
                        Submit another ticket
                      </Button>
                      <Button asChild className="text-xs font-medium">
                        <Link to="/">Back to Home</Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Honeypot */}
                    <div className="hidden" aria-hidden="true">
                      <label htmlFor="support-website">Website</label>
                      <input
                        id="support-website"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="support-name" className="text-xs">
                          Your Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="support-name"
                          required
                          placeholder="e.g. Michael Banda"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="h-10 text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="support-email" className="text-xs">
                          Work Email <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="support-email"
                          type="email"
                          required
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-10 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Category</Label>
                        <Select
                          value={category}
                          onValueChange={(val: any) => setCategory(val)}
                        >
                          <SelectTrigger className="h-10 text-xs">
                            <SelectValue placeholder="Select Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Billing & Invoices">Billing & Invoices</SelectItem>
                            <SelectItem value="Technical Issue">Technical Issue</SelectItem>
                            <SelectItem value="Tender Ingestion / Analysis">
                              Tender Ingestion / Analysis
                            </SelectItem>
                            <SelectItem value="Account & Team Access">
                              Account & Team Access
                            </SelectItem>
                            <SelectItem value="Feature Request">Feature Request</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Priority</Label>
                        <Select
                          value={priority}
                          onValueChange={(val: any) => setPriority(val)}
                        >
                          <SelectTrigger className="h-10 text-xs">
                            <SelectValue placeholder="Select Priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Low">Low — General inquiry</SelectItem>
                            <SelectItem value="Normal">Normal — Standard response</SelectItem>
                            <SelectItem value="High">High — Impending tender deadline</SelectItem>
                            <SelectItem value="Critical">Critical — Service disruption</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="support-subject" className="text-xs">
                        Subject <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="support-subject"
                        required
                        placeholder="Brief summary of the issue"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="support-message" className="text-xs">
                        Description & Details <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="support-message"
                        required
                        rows={5}
                        placeholder="Please describe the steps you took, any error message received, and relevant tender details..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="text-sm resize-y"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Minimum 20 characters ({message.length}/4000)
                      </p>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        disabled={isSubmitting || message.trim().length < 20}
                        className="w-full sm:w-auto h-10 px-6 font-medium text-xs"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting Ticket...
                          </>
                        ) : (
                          <>
                            <Send className="h-3.5 w-3.5 mr-2" /> Submit Support Ticket
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick FAQ / Channels Sidebar */}
          <div className="space-y-6">
            <Card className="border border-border bg-surface p-5 space-y-4 shadow-subtle">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground">Service Level Agreement</h3>
                  <p className="text-[11px] text-muted-foreground font-mono">Response Times</p>
                </div>
              </div>
              <ul className="space-y-2 text-xs text-text-secondary border-t border-border/60 pt-3">
                <li className="flex justify-between">
                  <span>Critical (Deadlines):</span>
                  <strong className="text-foreground font-mono">&lt; 1 Hour</strong>
                </li>
                <li className="flex justify-between">
                  <span>Standard Inquiries:</span>
                  <strong className="text-foreground font-mono">&lt; 4 Hours</strong>
                </li>
                <li className="flex justify-between">
                  <span>Operational Hours:</span>
                  <strong className="text-foreground font-mono">07:00 – 19:00 UTC</strong>
                </li>
              </ul>
            </Card>

            <Card className="border border-border bg-surface p-5 space-y-3 shadow-subtle text-xs">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" /> Direct Contact
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Prefer email directly? Reach out anytime:
              </p>
              <a
                href="mailto:support@getbidradar.com"
                className="font-mono text-primary hover:underline font-semibold block"
              >
                support@getbidradar.com
              </a>
            </Card>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
