import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, errorText } from "@/lib/api";

function CommunityCard({ habit }) {
  return (
    <li data-testid={`community-habit-${habit.id}`} className="fade-up rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
        <Link to={`/habits/${habit.id}`} data-testid={`community-habit-link-${habit.id}`} className="font-heading text-xl font-semibold text-stone-900 hover:text-orange-700 transition-colors">
          {habit.name}
        </Link>
        <span data-testid={`community-habit-days-${habit.id}`} className="text-sm font-semibold text-stone-700">
          Days done: <span className="text-orange-700">{habit.days_done}</span>
        </span>
      </div>
      <p data-testid={`community-habit-owner-${habit.id}`} className="text-sm text-stone-500 mb-4">by {habit.owner_name}</p>
      {habit.when_i_do_it && (
        <p data-testid={`community-habit-when-${habit.id}`} className="text-stone-600 leading-relaxed whitespace-pre-line">{habit.when_i_do_it}</p>
      )}
    </li>
  );
}

export default function Community() {
  const [habits, setHabits] = useState(null);

  useEffect(() => {
    api.get("/habits/community").then((r) => setHabits(r.data)).catch((e) => toast.error(errorText(e)));
  }, []);

  return (
    <div className="space-y-10">
      <div>
        <h1 data-testid="community-title" className="font-heading text-4xl sm:text-5xl font-bold tracking-tight text-stone-900 mb-3">Community</h1>
        <p className="text-stone-600">Habits members have chosen to share.</p>
      </div>
      {habits && habits.length === 0 && <p data-testid="community-empty" className="text-stone-500">No shared habits yet.</p>}
      <ul data-testid="community-list" className="space-y-5">
        {habits?.map((h) => <CommunityCard key={h.id} habit={h} />)}
      </ul>
    </div>
  );
}
