import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import AuthPage from "@/pages/AuthPage";
import MyHabits from "@/pages/MyHabits";
import Community from "@/pages/Community";
import HabitPage from "@/pages/HabitPage";

function Protected({ children }) {
  const { user } = useAuth();
  if (user === null) return <div className="p-10 text-stone-500">Loading...</div>;
  if (!user) return <Navigate to="/sign-in" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user } = useAuth();
  if (user === null) return <div className="p-10 text-stone-500">Loading...</div>;
  if (user) return <Navigate to="/my-habits" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/sign-up" element={<GuestOnly><AuthPage mode="signup" /></GuestOnly>} />
          <Route path="/sign-in" element={<GuestOnly><AuthPage mode="signin" /></GuestOnly>} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route path="/my-habits" element={<MyHabits />} />
            <Route path="/community" element={<Community />} />
            <Route path="/habits/:id" element={<HabitPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/my-habits" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

export default App;
