import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FolderOpen,
  Settings2,
  DollarSign,
  BarChart3,
  Bell,
  Shield,
  ClipboardList,
  FilePlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

interface NavItem {
  icon: React.ElementType;
  label: string;
  children?: string[];
  defaultHref?: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", defaultHref: "/" },
  { icon: ClipboardList, label: "Pending Work", defaultHref: "/pending-work" },
  { icon: FilePlus, label: "Open New Case", defaultHref: "/new-case" },
  {
    icon: FolderOpen,
    label: "Cases",
    children: ["All Cases", "In-Hand", "Uploaded", "Awaiting Decision", "Approved", "Rejected"],
    defaultHref: "/all-cases",
  },
  {
    icon: Settings2,
    label: "Workflow",
    children: ["In-Depth", "Enforcement", "Destruction", "Closed"],
    defaultHref: "/in-depth",
  },
  {
    icon: DollarSign,
    label: "Invoices",
    children: ["All Invoices", "Invoices Unpaid", "Invoices Paid", "Invoices Over Due"],
    defaultHref: "/all-invoices",
  },
  {
    icon: BarChart3,
    label: "Reports",
    children: ["Finance", "Client Reports", "Pending Work", "Custom Report"],
    defaultHref: "/finance",
  },
  { icon: Bell, label: "Alerts & Reminders", defaultHref: "/alerts-reminders" },
  {
    icon: Shield,
    label: "Admin",
    children: ["Users", "Settings"],
    defaultHref: "/users",
  },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const AppSidebar = ({ collapsed, onToggleCollapse }: AppSidebarProps) => {
  const location = useLocation();
  const { can, role } = usePermissions();

  // Auto-open the menu section that matches the current route
  const getActiveMenus = (): string[] => {
    const path = location.pathname;
    const active: string[] = [];
    for (const item of navItems) {
      if (!item.children) continue;
      const match = item.children.some((child) => {
        const childHref = `/${child.toLowerCase().replace(/ /g, '-')}`;
        return path === childHref || path.startsWith(childHref + '/');
      });
      if (match) active.push(item.label);
    }
    // Default to Cases if nothing matches
    if (active.length === 0 && path === '/') active.push('Cases');
    return active;
  };

  const [openMenus, setOpenMenus] = useState<string[]>(getActiveMenus);
  const [flyoutMenu, setFlyoutMenu] = useState<string | null>(null);

  // Keep menus open when navigating to a new page
  useEffect(() => {
    const active = getActiveMenus();
    setOpenMenus((prev) => {
      const merged = new Set([...prev, ...active]);
      return Array.from(merged);
    });
  }, [location.pathname]);

  const dapLogo = "/DAP-Logo-Ver03.png";
  const dapLogoCollapsed = "/DAP-Logo-dash.png";


  const toggleMenu = (label: string) => {
    setOpenMenus((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const filteredItems = navItems.filter(item => {
    const label = item.label.toLowerCase();
    if (label === "dashboard") return true;
    if (label === "open new case") return can('cases', 'create');
    if (label === "alerts & reminders") return can('alerts', 'view');
    if (label === "cases") return can('cases', 'view');
    if (label === "workflow") return can('workflow', 'view');
    if (label === "invoices") return can('invoices', 'view');
    if (label === "reports") return can('reports', 'view');
    if (label === "admin") return role === 'SUPER_ADMIN' || can('admin', 'users') || can('admin', 'settings');
    return true;
  }).map(item => {
    if (!item.children) return item;

    const filteredChildren = item.children.filter(child => {
      const childLower = child.toLowerCase();
      if (childLower === "new case") return can('cases', 'create');
      if (childLower === "users") return can('admin', 'users');
      if (childLower === "settings") return can('admin', 'settings');
      return true;
    });

    return { ...item, children: filteredChildren };
  });

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 56 : 220 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="h-screen flex-shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col overflow-hidden"
    >
      {/* Logo */}
      <div className={`h-16 flex items-center ${collapsed ? "px-1" : "px-4"} border-b border-sidebar-border`}>
        <div className="flex items-center justify-center w-full overflow-hidden">
          <img
            src={collapsed ? dapLogoCollapsed : dapLogo}
            alt="DAP Logo"
            className={`${collapsed ? "h-[3.3rem] w-auto" : "h-[3.3rem] w-auto max-w-[140px]"} flex-shrink-0 object-contain transition-all duration-200`}
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-1">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isOpen = openMenus.includes(item.label);
          const href = item.label === "Dashboard" ? "/" : `/${item.label.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`;

          if (item.children && item.children.length === 0) return null;

          return (
            <div key={item.label} className="relative group/nav">
              {item.children && item.children.length > 0 && !collapsed ? (
                <button
                  onClick={() => toggleMenu(item.label)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 text-sidebar-foreground hover:bg-sidebar-accent hover:text-primary`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="flex-1 text-left whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                  {!collapsed && (
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  )}
                </button>
              ) : (
                <NavLink
                  to={item.defaultHref || href}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-primary"
                    }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="flex-1 text-left whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                </NavLink>
              )}
              {/* Custom tooltip when collapsed */}
              {collapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150">
                  <div className="glass-card text-foreground text-xs font-semibold px-3 py-2 rounded-md shadow-xl whitespace-nowrap bg-background/80 backdrop-blur-md border-border/50">
                    {item.label}
                  </div>
                </div>
              )}

              {/* Submenu */}
              <AnimatePresence>
                {item.children && isOpen && !collapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    {item.children.map((child) => {
                      const childHref = `/${child.toLowerCase().replace(/ /g, '-')}`;
                      return (
                        <NavLink
                          key={child}
                          to={childHref}
                          className={({ isActive }) => `w-full block pl-11 pr-3 py-1.5 text-sm rounded-lg transition-colors ${isActive
                            ? "text-primary font-medium"
                            : "text-muted-foreground hover:text-sidebar-foreground"
                            }`}
                        >
                          {child}
                        </NavLink>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Powered by Ventura Canada Inc. */}
      <div className="px-2 py-3 border-t border-sidebar-border flex flex-col items-center gap-1">
        <img
          src="/VENTURA-CANADA-INC-white-cc55ff.svg"
          alt="Ventura Canada Inc."
          className={`${collapsed ? "h-5 w-5" : "h-7"} object-contain transition-all duration-200`}
        />
        {!collapsed && (
          <p className="text-[10px] text-muted-foreground leading-tight">
            Powered by Ventura Canada Inc.
          </p>
        )}
      </div>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-sidebar-border">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center py-2 rounded-lg text-muted-foreground hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </motion.aside>
  );
};

export default AppSidebar;
