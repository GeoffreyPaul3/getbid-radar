import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  FileText,
  BookOpen,
  ClipboardList,
  ShieldAlert,
  Search,
  X,
  Loader2,
  ChevronRight,
  FileSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace-context";
import { workspaceSearchFn } from "@/lib/search/search.functions";
import type { SearchResult, SearchResultType } from "@/lib/search/search.types";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const TYPE_ICONS: Record<SearchResultType, React.ElementType> = {
  opportunity: FileText,
  requirement: ClipboardList,
  proposal_section: FileSearch,
  compliance_finding: ShieldAlert,
  evidence: BookOpen,
  task: ClipboardList,
};

const TYPE_LABELS: Record<SearchResultType, string> = {
  opportunity: "Tender",
  requirement: "Requirement",
  proposal_section: "Proposal",
  compliance_finding: "Compliance",
  evidence: "Evidence",
  task: "Task",
};

const BADGE_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
  BID: "bg-bid-soft text-bid",
  NO_BID: "bg-nobid-soft text-nobid",
  REVIEW: "bg-review-soft text-review",
};

interface GlobalSearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearchDialog({ open, onClose }: GlobalSearchDialogProps) {
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 280);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 2 || !workspace?.id) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    workspaceSearchFn({ data: { workspaceId: workspace.id, query: debouncedQuery } })
      .then((r) => {
        if (!cancelled) setResults(r ?? []);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, workspace?.id]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const selectResult = useCallback(
    (result: SearchResult) => {
      onClose();
      void navigate({ to: result.url as never });
    },
    [navigate, onClose],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      selectResult(results[selectedIndex]!);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-label="Global Search"
        aria-modal="true"
        className="fixed left-1/2 top-[15vh] z-50 w-full max-w-xl -translate-x-1/2 rounded-2xl bg-surface shadow-2xl border border-border overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          {isSearching ? (
            <Loader2 className="h-4 w-4 text-muted-foreground shrink-0 animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <input
            ref={inputRef}
            id="global-search-input"
            type="text"
            placeholder="Search tenders, requirements, evidence…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-surface-muted text-[10px] text-muted-foreground font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <ul className="max-h-80 overflow-y-auto py-1.5" role="listbox">
            {results.map((result, i) => {
              const Icon = TYPE_ICONS[result.type];
              return (
                <li key={result.id} role="option" aria-selected={i === selectedIndex}>
                  <button
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors",
                      i === selectedIndex ? "bg-primary-soft" : "hover:bg-surface-muted",
                    )}
                    onClick={() => selectResult(result)}
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {result.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-mono uppercase">
                          {TYPE_LABELS[result.type]}
                        </span>
                        {result.badge && (
                          <span
                            className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase shrink-0",
                              BADGE_COLORS[result.badge] ??
                                "bg-surface-muted text-muted-foreground",
                            )}
                          >
                            {result.badge}
                          </span>
                        )}
                      </div>
                      {result.excerpt && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {result.excerpt}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : query.length >= 2 && !isSearching ? (
          <div className="py-10 text-center text-muted-foreground">
            <p className="text-sm">No results for &ldquo;{query}&rdquo;</p>
          </div>
        ) : query.length < 2 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p className="text-xs">Type at least 2 characters to search</p>
          </div>
        ) : null}

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground">
          <span>
            <kbd className="font-mono">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="font-mono">↵</kbd> open
          </span>
          <span>
            <kbd className="font-mono">Esc</kbd> close
          </span>
        </div>
      </div>
    </>
  );
}
