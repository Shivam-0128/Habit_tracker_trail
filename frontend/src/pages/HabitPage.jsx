import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { api, errorText, lastSevenDays } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

function LastSevenDays({ habit, onChange }) {
  const done = new Set(habit.completed_dates);
  const toggle = async (day, value) => {
    try {
      const { data } = await api.put(`/habits/${habit.id}/ticks`, { date: day, done: value });
      onChange(data);
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
      <h2 className="font-heading text-lg font-semibold text-stone-800 mb-5">Last 7 days</h2>
      <ul data-testid="last-7-days-list" className="space-y-2">
        {lastSevenDays().map((day) => (
          <li key={day}>
            <label htmlFor={`day-${day}`} className={`flex items-center gap-4 rounded-xl px-4 py-3 transition-colors ${habit.is_owner ? "cursor-pointer hover:bg-stone-50" : "cursor-default"}`}>
              <Checkbox
                id={`day-${day}`}
                data-testid={`day-checkbox-${day}`}
                checked={done.has(day)}
                disabled={!habit.is_owner}
                onCheckedChange={(v) => toggle(day, v === true)}
                className="h-6 w-6 rounded-md data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600 disabled:opacity-80"
              />
              <span className="font-mono text-stone-800">{day}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value, testId }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6">
      <p className="text-sm font-semibold text-stone-600">{label}</p>
      <p data-testid={testId} className="font-heading text-4xl font-bold text-orange-700 mt-1">{value}</p>
    </div>
  );
}

function Comments({ habitId }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/habits/${habitId}/comments`)
      .then((r) => setComments((cur) => [...r.data, ...cur.filter((c) => !r.data.some((x) => x.id === c.id))]))
      .catch(() => {});
  }, [habitId]);

  const post = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/habits/${habitId}/comments`, { text });
      setComments((c) => [...c, data]);
      setText("");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
      <h2 className="font-heading text-lg font-semibold text-stone-800 mb-5">Comments</h2>
      <ul data-testid="comments-list" className="space-y-4 mb-8">
        {comments.length === 0 && <li data-testid="comments-empty" className="text-stone-500 text-sm">No comments yet.</li>}
        {comments.map((c) => (
          <li key={c.id} data-testid={`comment-${c.id}`} className="fade-up rounded-xl bg-stone-50 px-4 py-3">
            <p data-testid={`comment-author-${c.id}`} className="text-sm font-semibold text-stone-800">{c.author_name}</p>
            <p className="text-stone-600 whitespace-pre-line">{c.text}</p>
          </li>
        ))}
      </ul>
      <form onSubmit={post} className="space-y-3">
        <Label htmlFor="comment" className="font-semibold text-stone-700">Comment</Label>
        <Textarea id="comment" data-testid="comment-input" value={text} onChange={(e) => setText(e.target.value)}
          className="min-h-[88px] rounded-xl bg-stone-50 border-stone-200 focus:bg-white" />
        <button type="submit" disabled={busy || !text.trim()} data-testid="post-comment-button"
          className="rounded-full bg-orange-600 px-6 h-11 text-white font-semibold hover:bg-orange-700 transition-colors disabled:opacity-60">
          Post comment
        </button>
      </form>
    </section>
  );
}

export default function HabitPage() {
  const { id } = useParams();
  const [habit, setHabit] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setHabit(null);
    api.get(`/habits/${id}`).then((r) => setHabit(r.data)).catch((e) => setError(errorText(e)));
  }, [id]);

  if (error) return <p data-testid="habit-error" className="text-stone-600">{error}</p>;
  if (!habit) return <p className="text-stone-500">Loading...</p>;

  return (
    <div className="space-y-8">
      <div className="fade-up">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500 mb-2">
          {habit.is_owner ? (habit.shared ? "Shared" : "Private") : `by ${habit.owner_name}`}
        </p>
        <h1 data-testid="habit-name" className="font-heading text-4xl sm:text-5xl font-bold tracking-tight text-stone-900 mb-4">{habit.name}</h1>
        <p className="text-sm font-semibold text-stone-700">When I do it</p>
        <p data-testid="habit-when" className="text-stone-600 leading-relaxed whitespace-pre-line">{habit.when_i_do_it || "—"}</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Days done:" value={habit.days_done} testId="days-done-value" />
        <Stat label="Current streak:" value={habit.current_streak} testId="current-streak-value" />
      </div>
      <LastSevenDays habit={habit} onChange={setHabit} />
      <Comments habitId={habit.id} />
    </div>
  );
}
