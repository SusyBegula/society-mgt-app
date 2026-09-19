// Add dictionaries here as more languages become available.
const en = {
  home: "Home",
  visitors: "Visitors",
  payments: "Payments",
  complaints: "Complaints",
  more: "More",
  retry: "Try again",
  cancel: "Cancel",
};
export type Locale = "en";
export const t = (key: keyof typeof en, locale: Locale = "en") =>
  ({ en })[locale][key];
