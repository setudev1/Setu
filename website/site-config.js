// Settings you edit once. Replace the placeholder values, then upload the site.
window.SETU_SITE = {
  // Shown on the page for privacy questions. Use an address you read every day.
  contactEmail: "setuworkas@gmail.com",
  // Your GitHub repository as "owner/name", e.g. "anshrai/setu". Every Download button then
  // downloads the newest installer directly from that repository's Releases.
  githubRepo: "setudev1/Setu",
  // Optional: a full link that overrides githubRepo (for example your own domain).
  downloadUrl: "",
  // false: the Download button unlocks when the countdown reaches zero (8 Nov 2026, 00:00 India time).
  // true: it works right now. Testers can also open the page with ?tester at the end of the link.
  unlockEarly: false,
  // ---- Founding Wall (optional). Leave these empty and the page still works; names then come from names.json.
  // Use wallApi (automatic) OR the Google Form lines below, not both.
  // 1) Make a Google Form with ONE short-answer question ("Name"). 2) Open its Responses > link to Sheets.
  // 3) In the Sheet: File > Share > Publish to web > pick the responses sheet > CSV > Publish. Paste that link in namesFeedUrl.
  // 4) In the Form, use "Get pre-filled link", fill any name, copy the link. From it take the part before /viewform, and change
  //    "viewform" to "formResponse" -> nameFormUrl. The "entry.123456789" part is nameFormField.
  // EASIEST: the address of your free Cloudflare wall (see wall-server/SETUP-WALL.md). When set, names are added by themselves, checked, and capped at 100.
  wallApi: "",
  namesFeedUrl: "",
  nameFormUrl: "",
  nameFormField: "",
  namesColumn: 1   // column of the name in the Sheet (0 = Timestamp, 1 = first question)
};
