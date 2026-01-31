const TIMEZONE = "Asia/Taipei";

export function nowInTaipei(): Date {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)!.value, 10);
  return new Date(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
}

function todayMidnight(): Date {
  const now = nowInTaipei();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function getTodayRange(): { start: Date; end: Date } {
  const start = todayMidnight();
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function getWeekRange(): { start: Date; end: Date } {
  const today = todayMidnight();
  const dayOfWeek = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7)); // 週一起算
  const end = new Date(today);
  end.setDate(today.getDate() + 1);
  return { start: monday, end };
}

export function getMonthRange(): { start: Date; end: Date } {
  const today = todayMidnight();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today);
  end.setDate(today.getDate() + 1);
  return { start, end };
}

export function formatDate(date: Date): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}/${d}`;
}
