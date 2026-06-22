import { useState } from "react";
import { Outlet } from "react-router-dom";
import AppSidebar from "../AppSidebar";
import AppHeader from "../AppHeader";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const MainLayout = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Static sidebar — desktop / tablet only */}
            <div className="hidden md:flex">
                <AppSidebar
                    collapsed={sidebarCollapsed}
                    onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                />
            </div>

            {/* Mobile nav drawer */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetContent side="left" className="p-0 w-[220px] max-w-[80vw]">
                    <AppSidebar
                        mobile
                        collapsed={false}
                        onToggleCollapse={() => {}}
                        onNavigate={() => setMobileNavOpen(false)}
                    />
                </SheetContent>
            </Sheet>

            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <AppHeader onMenuClick={() => setMobileNavOpen(true)} />
                <main
                    className="flex-1 overflow-y-auto p-4 lg:p-6"
                    style={{
                        paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
                        paddingLeft: "calc(1rem + env(safe-area-inset-left))",
                        paddingRight: "calc(1rem + env(safe-area-inset-right))",
                    }}
                >
                    <div className="mx-auto max-w-7xl">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
