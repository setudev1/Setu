// Daily challenge: one small, fun project a day for beginners. The same challenge shows all day, then it changes.
// The streak counts days in a row that the person marked a challenge as finished. Everything is kept on this computer.
export type Challenge = { id: number; title: string; level: 'Easy' | 'Medium' | 'Hard' | 'Fun'; prompt: string }

export const CHALLENGES: Challenge[] = [
  { id: 1, title: "Counter with buttons", level: "Easy", prompt: "Make a counter web page in one index.html: a big number with + and - buttons and a reset button. Explain each part in simple words after you write it." },
  { id: 2, title: "Digital clock", level: "Easy", prompt: "Make a digital clock web page in one index.html that shows the current time and updates every second. Explain each part in simple words after you write it." },
  { id: 3, title: "Color changer", level: "Easy", prompt: "Make a page in one index.html with a button that changes the background to a random color and shows its hex code. Explain each part in simple words after you write it." },
  { id: 4, title: "Tip calculator", level: "Easy", prompt: "Make a tip calculator in one index.html: bill amount, tip percent buttons and the total per person. Explain each part in simple words after you write it." },
  { id: 5, title: "Quote of the day", level: "Easy", prompt: "Make a page in one index.html that shows a random motivational quote from a list of 10, with a New quote button. Explain each part in simple words after you write it." },
  { id: 6, title: "Dark mode toggle", level: "Easy", prompt: "Make a simple page in one index.html with a dark and light mode switch that remembers the choice. Explain each part in simple words after you write it." },
  { id: 7, title: "Age calculator", level: "Easy", prompt: "Make an age calculator in one index.html: pick a birth date and show the age in years, months and days. Explain each part in simple words after you write it." },
  { id: 8, title: "Word counter", level: "Easy", prompt: "Make a page in one index.html with a text box that shows live word and character counts. Explain each part in simple words after you write it." },
  { id: 9, title: "Stopwatch", level: "Medium", prompt: "Make a stopwatch in one index.html with start, stop, lap and reset. Explain each part in simple words after you write it." },
  { id: 10, title: "Rock paper scissors", level: "Medium", prompt: "Make a rock paper scissors game in one index.html against the computer, with a score. Explain each part in simple words after you write it." },
  { id: 11, title: "Number guessing game", level: "Medium", prompt: "Make a number guessing game in one index.html: guess 1 to 100, with higher or lower hints and an attempts counter. Explain each part in simple words after you write it." },
  { id: 12, title: "Quiz app", level: "Medium", prompt: "Make a 5-question quiz in one index.html with a score at the end and a restart button. Explain each part in simple words after you write it." },
  { id: 13, title: "Notes app", level: "Medium", prompt: "Make a notes app in one index.html where I can add and delete notes, saved in the browser. Explain each part in simple words after you write it." },
  { id: 14, title: "Image slider", level: "Medium", prompt: "Make an image slider in one index.html using colored boxes, with next and previous buttons and dots. Explain each part in simple words after you write it." },
  { id: 15, title: "Expense tracker", level: "Medium", prompt: "Make a small expense tracker in one index.html: add items with an amount, see the total, delete items, saved in the browser. Explain each part in simple words after you write it." },
  { id: 16, title: "Password generator", level: "Medium", prompt: "Make a password generator in one index.html with length slider, options for numbers and symbols, and a copy button. Explain each part in simple words after you write it." },
  { id: 17, title: "Memory card game", level: "Hard", prompt: "Make a memory card matching game in one index.html with 8 pairs, a move counter and a restart button. Explain each part in simple words after you write it." },
  { id: 18, title: "Tic tac toe", level: "Hard", prompt: "Make tic tac toe in one index.html for two players, with winner detection and a reset button. Explain each part in simple words after you write it." },
  { id: 19, title: "Snake game", level: "Hard", prompt: "Make the classic snake game in one index.html using the arrow keys, with a score. Explain each part in simple words after you write it." },
  { id: 20, title: "Pomodoro timer", level: "Medium", prompt: "Make a pomodoro timer in one index.html: 25 minutes focus, 5 minutes break, start, pause and reset. Explain each part in simple words after you write it." },
  { id: 21, title: "Unit converter", level: "Easy", prompt: "Make a unit converter in one index.html for length and temperature. Explain each part in simple words after you write it." },
  { id: 22, title: "Typing speed test", level: "Hard", prompt: "Make a typing speed test in one index.html that shows words per minute after 30 seconds. Explain each part in simple words after you write it." },
  { id: 23, title: "Weather card (fake data)", level: "Medium", prompt: "Make a weather card page in one index.html using made-up data for 5 cities, with a dropdown to pick the city and nice icons. Explain each part in simple words after you write it." },
  { id: 24, title: "Birthday countdown", level: "Easy", prompt: "Make a countdown page in one index.html to a date I pick, showing days, hours, minutes and seconds. Explain each part in simple words after you write it." },
  { id: 25, title: "Habit tracker", level: "Medium", prompt: "Make a weekly habit tracker in one index.html with checkboxes for 7 days, saved in the browser. Explain each part in simple words after you write it." },
  { id: 26, title: "Landing page for a chai stall", level: "Fun", prompt: "Make a beautiful one-page website in one index.html for a chai stall, with a menu, prices and a contact section. Explain each part in simple words after you write it." },
  { id: 27, title: "Diwali greeting card", level: "Fun", prompt: "Make an animated Diwali greeting card page in one index.html with a diya, sparkles and a message I can type. Explain each part in simple words after you write it." },
  { id: 28, title: "Drawing pad", level: "Hard", prompt: "Make a drawing pad in one index.html with a canvas, color picker, brush size and a clear button. Explain each part in simple words after you write it." },
  { id: 29, title: "Flashcards", level: "Medium", prompt: "Make a flashcard study app in one index.html where I can add cards and flip them. Explain each part in simple words after you write it." },
  { id: 30, title: "Mini portfolio", level: "Fun", prompt: "Make a mini portfolio in one index.html with my name, three skills and a contact button. Ask me for my details first. Explain each part in simple words after you write it." }
]

/** Local date as YYYY-MM-DD. */
export function dayKey(d: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

export function challengeOfDay(key: string = dayKey()): Challenge {
  const n = dayNumber(key)
  if (!Number.isFinite(n)) return CHALLENGES[0]
  return CHALLENGES[((n % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length]
}

export type Progress = { done: string[] }

const KEY = 'setu.challenges'

type Store = Pick<Storage, 'getItem' | 'setItem'>

export function loadProgress(store: Store = localStorage): Progress {
  try {
    const v = JSON.parse(store.getItem(KEY) ?? '{}') as Partial<Progress>
    const done = Array.isArray(v.done) ? v.done.filter((x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)) : []
    return { done: [...new Set(done)].sort().slice(-400) }
  } catch {
    return { done: [] }
  }
}

export function markDone(key: string = dayKey(), store: Store = localStorage): Progress {
  const p = loadProgress(store)
  if (!p.done.includes(key)) p.done = [...p.done, key].sort().slice(-400)
  try {
    store.setItem(KEY, JSON.stringify(p))
  } catch {
    /* storage can be blocked; the streak just will not be kept */
  }
  return p
}

/** Days in a row, counting back from today. A streak stays alive until the end of tomorrow, so missing "today so far" does not reset it. */
export function streak(p: Progress, today: string = dayKey()): number {
  const set = new Set(p.done)
  let n = dayNumber(today)
  if (!set.has(today)) n -= 1
  let count = 0
  const toKey = (num: number): string => new Date(num * 86400000).toISOString().slice(0, 10)
  while (set.has(toKey(n))) {
    count++
    n--
  }
  return count
}
