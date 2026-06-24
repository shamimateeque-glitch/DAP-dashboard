import { useState, useRef, useEffect } from "react";
import { Search, Bell, Moon, Sun, CheckCircle2, AlertTriangle, X, ExternalLink, CheckCheck, Menu } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ProfileSettingsModal from "@/components/forms/ProfileSettingsModal";
import { formatDistanceToNow } from "date-fns";

// Alert type display config
const ALERT_DISPLAY: Record<string, { label: string; color: string }> = {
  CASE_APPROVED:            { label: "Case Approved",               color: "#16a34a" },
  CASE_REJECTED:            { label: "Case Rejected",               color: "#dc2626" },
  FINAL_REPORT_SUBMITTED:   { label: "Final Report Submitted",      color: "#2563eb" },
  IN_DEPTH_DONE:            { label: "In-Depth Done",               color: "#16a34a" },
  IN_DEPTH_DATE_CHANGED:    { label: "In-Depth Date Changed",       color: "#ea640f" },
  ENFORCEMENT_DONE:         { label: "Enforcement Done",            color: "#16a34a" },
  ENFORCEMENT_DATE_CHANGED: { label: "Enforcement Date Changed",    color: "#ea640f" },
  DESTRUCTION_DONE:         { label: "Destruction Done",            color: "#16a34a" },
  INVOICE_ISSUED:           { label: "Invoice Issued",              color: "#2563eb" },
  INVOICE_PAID:             { label: "Invoice Paid",                color: "#16a34a" },
  INVOICE_OVERDUE:          { label: "Invoice Overdue",             color: "#dc2626" },
};

const AppHeader = ({ onMenuClick }: { onMenuClick?: () => void }) => {
  const { theme, toggleTheme } = useTheme();
  const { appUser, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    if (isNotifOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isNotifOpen]);

  // Fetch unread count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["alert-unread-count", appUser?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("alert_logs")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", appUser!.id)
        .eq("is_read", false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!appUser?.id,
    refetchInterval: 30000, // Poll every 30s
  });

  // Fetch recent alerts (last 20)
  const { data: recentAlerts = [] } = useQuery({
    queryKey: ["alert-recent", appUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_logs")
        .select("*, cases(case_id, target_name)")
        .eq("recipient_id", appUser!.id)
        .order("sent_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!appUser?.id && isNotifOpen,
  });

  // Mark single alert as read
  const markAsRead = async (alertId: string) => {
    await supabase
      .from("alert_logs")
      .update({ is_read: true })
      .eq("id", alertId);
    queryClient.invalidateQueries({ queryKey: ["alert-unread-count"] });
    queryClient.invalidateQueries({ queryKey: ["alert-recent"] });
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!appUser?.id) return;
    await supabase
      .from("alert_logs")
      .update({ is_read: true })
      .eq("recipient_id", appUser.id)
      .eq("is_read", false);
    queryClient.invalidateQueries({ queryKey: ["alert-unread-count"] });
    queryClient.invalidateQueries({ queryKey: ["alert-recent"] });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <header
      className="border-b border-border bg-card flex items-center justify-between px-4 md:px-6 gap-2"
      style={{
        // Sit below the device status bar (Android 15+ / iOS notch draw edge-to-edge).
        height: "calc(4rem + env(safe-area-inset-top))",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* Left: mobile menu button + page title */}
      <div className="flex items-center gap-2 min-w-0">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center bg-muted hover:bg-secondary transition-colors flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
        <h1 className="text-base md:text-lg font-semibold text-foreground truncate">
          DAP CaseView<span className="hidden sm:inline"> - Dashboard</span>
        </h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search cases..."
            className="pl-9 pr-4 py-2 w-64 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="relative w-9 h-9 rounded-lg flex items-center justify-center bg-muted hover:bg-secondary transition-colors"
          aria-label="Toggle theme"
        >
          <motion.div
            key={theme}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Moon className="w-4 h-4 text-muted-foreground" />
            )}
          </motion.div>
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative w-9 h-9 rounded-lg flex items-center justify-center bg-muted hover:bg-secondary transition-colors"
          >
            <Bell className="w-4 h-4 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 gradient-primary rounded-full text-[10px] text-primary-foreground flex items-center justify-center font-medium">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          <AnimatePresence>
            {isNotifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-[380px] z-50 rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-primary hover:underline font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-primary/10 transition-colors"
                        title="Mark all as read"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark all read
                      </button>
                    )}
                    <button
                      onClick={() => setIsNotifOpen(false)}
                      className="p-1 rounded hover:bg-muted transition-colors"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {/* Alert list */}
                <div className="max-h-[400px] overflow-y-auto">
                  {recentAlerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Bell className="w-8 h-8 mb-2 opacity-30" />
                      <p className="text-sm">No notifications yet</p>
                    </div>
                  ) : (
                    recentAlerts.map((alert: any) => {
                      const display = ALERT_DISPLAY[alert.alert_type] || {
                        label: alert.alert_type.replace(/_/g, " "),
                        color: "#6b7280",
                      };
                      const isSuccess = alert.email_status === "SENT";
                      const caseInfo = alert.cases;

                      return (
                        <div
                          key={alert.id}
                          className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors cursor-pointer ${
                            !alert.is_read ? "bg-primary/5" : ""
                          }`}
                          onClick={() => {
                            if (!alert.is_read) markAsRead(alert.id);
                            if (caseInfo?.case_id) {
                              // Navigate to case detail using the UUID (alert.case_id)
                              navigate(`/cases/${alert.case_id}`);
                              setIsNotifOpen(false);
                            }
                          }}
                        >
                          {/* Color indicator */}
                          <div
                            className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                            style={{ backgroundColor: !alert.is_read ? display.color : "transparent" }}
                          />

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="text-xs font-bold uppercase tracking-wide"
                                style={{ color: display.color }}
                              >
                                {display.label}
                              </span>
                              {isSuccess ? (
                                <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                              ) : (
                                <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
                              )}
                            </div>
                            {caseInfo && (
                              <p className="text-sm text-foreground mt-0.5 truncate">
                                {caseInfo.target_name}
                                <span className="text-muted-foreground ml-1 text-xs">
                                  ({caseInfo.case_id})
                                </span>
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(alert.sent_at), { addSuffix: true })}
                            </p>
                          </div>

                          {/* External link icon */}
                          {caseInfo && (
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground mt-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-border px-4 py-2.5 bg-muted/30">
                  <button
                    onClick={() => {
                      navigate("/alerts-reminders");
                      setIsNotifOpen(false);
                    }}
                    className="w-full text-center text-xs text-primary hover:underline font-medium py-1"
                  >
                    View All Alerts & Settings
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User */}
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <button onClick={() => setIsProfileOpen(true)} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="w-8 h-8 cursor-pointer hover:opacity-80 transition-opacity">
              <AvatarImage src={appUser?.avatar_url} className="object-cover" />
              <AvatarFallback className="gradient-accent text-primary-foreground text-xs font-semibold">
                {appUser ? getInitials(appUser.full_name) : "?"}
              </AvatarFallback>
            </Avatar>
          </button>
          <div className="hidden lg:block text-left">
            <p className="text-sm font-medium text-foreground leading-none">
              {appUser ? appUser.full_name : "Not Logged In"}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {appUser ? appUser.role.toLowerCase().replace("_", " ") : "No Profile"}
            </p>
          </div>
          <button
            onClick={() => {
              signOut().then(() => navigate('/login'));
            }}
            className="text-[10px] text-red-500 hover:underline font-medium cursor-pointer ml-1"
          >
            Sign Out
          </button>
        </div>
      </div>

      <ProfileSettingsModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </header>
  );
};

export default AppHeader;
