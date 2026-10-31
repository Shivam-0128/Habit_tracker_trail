import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sprout } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const IMG = "https://images.unsplash.com/photo-1601642964568-1917224f4e4d?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400";

function Field({ id, label, type = "text", value, onChange }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold text-stone-700">{label}</Label>
      <Input
        id={id}
        data-testid={`${id}-input`}
        type={type}
        value={value}
        required
        onChange={(e) => onChange(e.target.value)}
        className="h-12 rounded-xl border-stone-200 bg-stone-50 focus:bg-white focus-visible:ring-2 focus-visible:ring-orange-200"
      />
    </div>
  );
}

export default function AuthPage({ mode }) {
  const isSignUp = mode === "signup";
  const [form, setForm] = useState({ display_name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const body = isSignUp ? form : { email: form.email, password: form.password };
      const { data } = await api.post(isSignUp ? "/auth/register" : "/auth/login", body);
      signIn(data);
      navigate("/my-habits");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const title = isSignUp ? "Sign up" : "Sign in";
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-stone-50">
      <div className="flex flex-col justify-center px-6 sm:px-16 py-12">
        <div className="flex items-center gap-2 mb-14">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-600 text-white"><Sprout className="h-5 w-5" /></span>
          <span className="font-heading text-xl font-bold text-stone-900">Habit Circle</span>
        </div>
        <div className="max-w-md w-full fade-up">
          <h1 data-testid="auth-title" className="font-heading text-4xl sm:text-5xl font-bold tracking-tight text-stone-900 mb-3">{title}</h1>
          <p className="text-stone-600 mb-10">
            {isSignUp ? "Track your daily habits with friends." : "Welcome back to your circle."}
          </p>
          <form onSubmit={submit} className="space-y-5" data-testid="auth-form">
            {isSignUp && <Field id="display-name" label="Display name" value={form.display_name} onChange={set("display_name")} />}
            <Field id="email" label="Email" type="email" value={form.email} onChange={set("email")} />
            <Field id="password" label="Password" type="password" value={form.password} onChange={set("password")} />
            {error && <p data-testid="auth-error" className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              data-testid="auth-submit-button"
              className="w-full h-12 rounded-full bg-orange-600 text-white font-semibold hover:bg-orange-700 transition-colors disabled:opacity-60"
            >
              {title}
            </button>
          </form>
          <p className="mt-8 text-sm text-stone-600">
            {isSignUp ? "Already have an account? " : "New here? "}
            <Link data-testid="auth-switch-link" to={isSignUp ? "/sign-in" : "/sign-up"} className="font-semibold text-orange-700 hover:underline">
              {isSignUp ? "Sign in" : "Sign up"}
            </Link>
          </p>
        </div>
      </div>
      <div className="hidden lg:block p-4">
        <img src={IMG} alt="" className="h-full w-full object-cover rounded-3xl" />
      </div>
    </div>
  );
}
