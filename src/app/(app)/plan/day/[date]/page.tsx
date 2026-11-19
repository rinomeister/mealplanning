import { redirect } from "next/navigation";

/** Old day page: a day is edited on Today now (any date). */
export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  redirect(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `/today?date=${date}` : "/plan");
}
