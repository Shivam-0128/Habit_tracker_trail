import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Sprout, Users, ListChecks, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const links = [
  { to: "/my-habits", label: "My habits", icon: ListChecks, id: "my-habits" },
  { to: "/community", label: "Community", icon: Users, id: "community" },
];

function SignOutButton({ testId, className }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <button
      data-testid={testId}
      onClick={async () => { await signOut(); navigate("/sign-in"); }}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${className}`}
    >
      <LogOut className="h-4 w-4" /> Sign out
    </button>
  );
}

function Sidebar() {
  const { user } = useAuth();
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-stone-200 bg-stone-100 p-6">
      <div className="flex items-center gap-2 mb-10">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-600 text-white"><Sprout className="h-5 w-5" /></span>
        <span className="font-heading text-xl font-bold text-stone-900">Habit Circle</span>
      </div>
      <nav className="flex flex-col gap-2">
        {links.map(({ to, label, icon: Icon, id }) => (
          <NavLink
            key={to}
            to={to}
            data-testid={`sidebar-${id}-button`}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                isActive ? "bg-white text-orange-700 shadow-[0_2px_8px_rgba(0,0,0,0.04)]" : "text-stone-600 hover:bg-stone-200"
              }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto pt-6 border-t border-stone-200">
        <p className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1">Signed in as</p>
        <p data-testid="sidebar-user-name" className="font-semibold text-stone-800 mb-4 truncate">{user?.display_name}</p>
        <SignOutButton testId="sidebar-sign-out-button" className="w-full justify-center bg-stone-200 text-stone-800 hover:bg-stone-300" />
      </div>
    </aside>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-stone-200/50 bg-white/70 px-4 sm:px-8 py-3 backdrop-blur-xl">
      <nav className="flex items-center gap-1 sm:gap-4">
        {links.map(({ to, label, id }) => (
          <NavLink
            key={to}
            to={to}
            data-testid={`nav-${id}-link`}
            className={({ isActive }) =>
              `rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${isActive ? "bg-orange-50 text-orange-700" : "text-stone-600 hover:text-stone-900"}`}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <SignOutButton testId="nav-sign-out-button" className="bg-stone-100 text-stone-800 hover:bg-stone-200" />
    </header>
  );
}

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-stone-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <TopNav />
        <div className="max-w-4xl px-4 sm:px-8 lg:px-12 py-10 sm:py-14">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
