import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, errorText } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

function AddHabitForm({ onAdded }) {
  const [name, setName] = useState("");
  const [when, setWhen] = useState("");
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/habits", { name, when_i_do_it: when, shared });
      onAdded(data);
      setName(""); setWhen(""); setShared(false);
      toast.success("Habit added");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} data-testid="add-habit-form" className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 space-y-5">
      <div className="space-y-2">
        <Label htmlFor="habit-name" className="font-semibold text-stone-700">Habit name</Label>
        <Input id="habit-name" data-testid="habit-name-input" required value={name} onChange={(e) => setName(e.target.value)}
          className="h-12 rounded-xl bg-stone-50 border-stone-200 focus:bg-white" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="habit-when" className="font-semibold text-stone-700">When I do it</Label>
        <Textarea id="habit-when" data-testid="habit-when-input" value={when} onChange={(e) => setWhen(e.target.value)}
          placeholder="When do you usually do it, and what makes you more likely to?"
          className="min-h-[96px] rounded-xl bg-stone-50 border-stone-200 focus:bg-white" />
      </div>
      <div className="flex items-center gap-3">
        <Checkbox id="habit-share" data-testid="habit-share-checkbox" checked={shared} onCheckedChange={(v) => setShared(v === true)}
          className="h-5 w-5 rounded-md data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600" />
        <Label htmlFor="habit-share" className="text-stone-700 cursor-pointer">Share with the community</Label>
      </div>
      <button type="submit" disabled={busy} data-testid="add-habit-button"
        className="rounded-full bg-orange-600 px-6 h-11 text-white font-semibold hover:bg-orange-700 transition-colors disabled:opacity-60">
        Add habit
      </button>
    </form>
  );
}

function HabitRow({ habit }) {
  return (
    <li data-testid={`habit-item-${habit.id}`} className="fade-up flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white px-6 py-5 transition-transform duration-200 hover:-translate-y-0.5">
      <Link to={`/habits/${habit.id}`} data-testid={`habit-link-${habit.id}`} className="font-heading text-lg font-semibold text-stone-900 hover:text-orange-700 transition-colors">
        {habit.name}
      </Link>
      <span data-testid={`habit-visibility-${habit.id}`}
        className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${habit.shared ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-stone-100 text-stone-600 border border-stone-200"}`}>
        {habit.shared ? "Shared" : "Private"}
      </span>
    </li>
  );
}

export default function MyHabits() {
  const [habits, setHabits] = useState(null);

  useEffect(() => {
    api.get("/habits/mine").then((r) => setHabits(r.data)).catch((e) => toast.error(errorText(e)));
  }, []);

  return (
    <div className="space-y-10">
      <h1 data-testid="my-habits-title" className="font-heading text-4xl sm:text-5xl font-bold tracking-tight text-stone-900">My habits</h1>
      <AddHabitForm onAdded={(h) => setHabits((list) => [h, ...(list || [])])} />
      <section>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500 mb-4">Your habits</p>
        {habits && habits.length === 0 && <p data-testid="my-habits-empty" className="text-stone-500">No habits yet. Add your first one above.</p>}
        <ul data-testid="my-habits-list" className="space-y-3">
          {habits?.map((h) => <HabitRow key={h.id} habit={h} />)}
        </ul>
      </section>
    </div>
  );
}
