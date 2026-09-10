import React, { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Mail,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Building2,
  Clock,
  Sparkles,
} from "lucide-react";
import logo from "@/assets/bidradar.png";
import { sendContactMessageFn } from "@/lib/email/contact.functions";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us | GetBidRadar — Enterprise Tender Intelligence" },
      {
        name: "description",
        content:
          "Connect with the GetBidRadar team for enterprise procurement intelligence questions, pilot evaluations, technical integration support, or general inquiries.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();

  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side quick checks
    if (!name.trim()) {
      setErrorMessage("Please enter your name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!subject.trim()) {
      setErrorMessage("Please specify a subject for your inquiry.");
      return;
    }
    if (message.trim().length < 10) {
      setErrorMessage("Please provide a message with at least 10 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await sendContactMessageFn({
        data: {
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
          honeypot,
        },
      });

      if (response.success) {
        setIsSubmitted(true);
        setName("");
        setSubject("");
        setMessage("");
      } else {
        setErrorMessage(
          response.error || "Failed to deliver your inquiry. Please try again in a moment.",
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(
        msg || "An unexpected network error occurred while submitting. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-foreground font-sans antialiased selection:bg-primary-soft selection:text-primary flex flex-col justify-between">
      {/* Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-surface/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img src={logo} width={140} height={110} alt="BidRadar" />
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-text-secondary">
              <Link to="/" className="hover:text-foreground transition-colors">
                Overview
              </Link>
              <Link to="/contact" className="text-primary font-semibold transition-colors">
                Contact
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-bright shadow-subtle transition-all duration-150"
              >
                <span>Dashboard ({workspace?.name || "Workspace"})</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-xs font-medium text-text-secondary hover:text-foreground transition-colors px-3 py-2"
                >
                  Sign In
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-bright shadow-subtle transition-all duration-150"
                >
                  <span>Start Free Trial</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full space-y-10">
        {/* Hero */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface text-xs font-mono uppercase tracking-wider text-primary">
            <Mail className="h-3.5 w-3.5" /> Enterprise Support &amp; Inquiries
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Contact the GetBidRadar Team
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            Have questions about deterministic tender qualification, bespoke compliance models, or
            enterprise pilots? Send us a direct transmission below.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Left Column: Context & Guarantees */}
          <div className="md:col-span-5 space-y-6">
            <Card className="border border-border/80 bg-surface shadow-subtle">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-bid" /> Direct Human Response
                </CardTitle>
                <CardDescription className="text-xs">
                  All messages route directly to our technical and commercial team.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs text-text-secondary">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-soft text-primary shrink-0">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Response SLA</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Standard business inquiries answered within 1 business day. Priority pilot
                      requests expedited.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-soft text-primary shrink-0">
                    <Building2 className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Enterprise Procurement</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Assistance with custom evidence taxonomies, high-volume tender pipelines, and
                      team role management.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-soft text-primary shrink-0">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Strict Tenant Privacy</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Your company evidence and tender analyses are isolated strictly to your
                      authenticated workspace.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Contact Form */}
          <div className="md:col-span-7">
            <Card className="border border-border/80 bg-surface shadow-subtle">
              <CardHeader>
                <CardTitle className="text-lg font-display">Send a Message</CardTitle>
                <CardDescription className="text-xs">
                  Fill in your details and message. We will reply directly to your email.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isSubmitted ? (
                  <div className="py-8 text-center space-y-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bid-soft text-bid mx-auto">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-display text-lg font-bold text-foreground">
                        Message Sent Successfully
                      </h3>
                      <p className="text-xs text-text-secondary max-w-sm mx-auto">
                        Thank you for reaching out. We have received your message and our team will
                        review and respond shortly.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSubmitted(false)}
                      className="text-xs"
                    >
                      Send Another Message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Honeypot field (hidden from humans) */}
                    <div className="hidden" aria-hidden="true">
                      <input
                        type="text"
                        name="honeypot"
                        tabIndex={-1}
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                        autoComplete="off"
                      />
                    </div>

                    {errorMessage && (
                      <Alert variant="destructive" className="py-2.5 text-xs">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle className="text-xs font-semibold">Unable to Send</AlertTitle>
                        <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
                      </Alert>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="contact-name" className="text-xs font-medium">
                          Your Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="contact-name"
                          type="text"
                          required
                          disabled={isSubmitting}
                          placeholder="Jane Doe"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="contact-email" className="text-xs font-medium">
                          Email Address <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="contact-email"
                          type="email"
                          required
                          disabled={isSubmitting}
                          placeholder="jane@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="contact-subject" className="text-xs font-medium">
                        Subject <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="contact-subject"
                        type="text"
                        required
                        disabled={isSubmitting}
                        placeholder="e.g. Question about Enterprise Pilot or Deterministic Scoring"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="contact-message" className="text-xs font-medium">
                          Message <span className="text-destructive">*</span>
                        </Label>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {message.length}/5000
                        </span>
                      </div>
                      <Textarea
                        id="contact-message"
                        required
                        disabled={isSubmitting}
                        rows={5}
                        placeholder="Tell us about your team's bidding workflow, questions, or requirements..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="text-xs resize-y min-h-[120px]"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-primary text-white hover:bg-primary-bright text-xs font-semibold h-9 gap-1.5 shadow-subtle"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Sending Message...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          <span>Send Message</span>
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Public Footer */}
      <footer className="border-t border-border/70 bg-surface/60 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-secondary">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-foreground">GetBidRadar</span>
            <span>&copy; {new Date().getFullYear()} Enterprise Bid Intelligence</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <Link to="/contact" className="hover:text-foreground transition-colors font-medium">
              Contact
            </Link>
            <Link to="/login" className="hover:text-foreground transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
