import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronUp, LogOut, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  email: string;
  initials: string;
  roleLabel: string;
  collapsed: boolean;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onSignOut: () => void;
}

export function SidebarUserMenu({
  email,
  initials,
  roleLabel,
  collapsed,
  theme,
  onToggleTheme,
  onSignOut,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 w-full rounded-md p-2 text-left",
            "hover:bg-sidebar-accent/15 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            collapsed && "justify-center p-1.5",
          )}
          aria-label="Menú de usuario"
        >
          <Avatar className="h-8 w-8 shrink-0 ring-1 ring-sidebar-border">
            <AvatarFallback className="bg-muted text-foreground text-[11px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-sidebar-foreground truncate leading-tight">
                  {email}
                </div>
                {roleLabel && (
                  <div className="text-[10px] text-sidebar-foreground/65 truncate">
                    {roleLabel}
                  </div>
                )}
              </div>
              <ChevronUp className="h-4 w-4 text-sidebar-foreground/50 shrink-0" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={collapsed ? "right" : "top"}
        align={collapsed ? "start" : "end"}
        className="w-56"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium truncate">{email}</span>
            {roleLabel && <span className="text-[10px] text-muted-foreground">{roleLabel}</span>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onToggleTheme}>
          {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
          {theme === "dark" ? "Modo claro" : "Modo oscuro"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onSignOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
