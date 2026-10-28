/**
 * KW | Innovations policies & procedures — what every client agrees to in
 * the portal orientation, shown in full on the portal's Policies tab and to
 * staff on /policies. Bump POLICIES_VERSION whenever the wording changes in
 * a way clients should re-read: anyone who accepted an older version is
 * asked to go through the orientation again.
 *
 * A client's signed proposal or agreement always takes precedence over
 * these general terms.
 */

export const POLICIES_VERSION = "2026-10-28";

export interface PolicySection {
  key: string;
  title: string;
  summary: string;
  points: string[];
}

export const POLICY_SECTIONS: PolicySection[] = [
  {
    key: "process",
    title: "How your project runs",
    summary: "Every website and app moves through the same five stages, and you can see where each one is in your portal.",
    points: [
      "Discovery: we learn about your business, goals and customers, and agree the scope.",
      "Design: we design the look and layout and send it to you for approval.",
      "Build: we build what you approved. Progress updates appear in your portal.",
      "Review: you test everything and send us your feedback before anything goes live.",
      "Launch: once you approve, we put it live and keep watching it.",
    ],
  },
  {
    key: "communication",
    title: "Communication & response times",
    summary: "Your portal is the home for everything: messages, approvals, files and invoices.",
    points: [
      "Send messages through the portal so the whole team can see them and nothing gets lost.",
      "Our hours are Monday to Friday, 9am to 5pm (Gold Coast time). We reply within one business day.",
      "If your site is down or something is urgent, raise an IT Support request marked High and we'll act on it first.",
      "You can book a call with us any time from your portal.",
    ],
  },
  {
    key: "approvals",
    title: "Approvals & changes",
    summary: "Nothing goes live without your approval, and nothing is billed that you didn't agree to first.",
    points: [
      "We ask for approvals in your portal. Approve, or request changes with a short note.",
      "If you ask for work outside the agreed scope, we quote it before we start.",
      "Waiting on approvals or feedback pauses the timeline until we hear back.",
    ],
  },
  {
    key: "content",
    title: "Your content & materials",
    summary: "Great results need your input: logos, photos, wording and access to your accounts.",
    points: [
      "Upload logos, photos and documents to the Files tab of your portal.",
      "You confirm you own, or are allowed to use, any material you send us.",
      "Logins and access you share with us are stored securely and used only for your work.",
      "Delays getting materials to us move the launch date by the same amount.",
    ],
  },
  {
    key: "billing",
    title: "Billing & payments",
    summary: "Invoices are emailed to you and also appear on the Billing tab of your portal.",
    points: [
      "Monthly plans (website, SEO, hosting, care and marketing) are invoiced monthly in advance.",
      "One-off project work is quoted upfront. Usually 50% is due to start and the balance at launch.",
      "Payment is due within 14 days of the invoice date. Pay by the link on the invoice or by bank transfer.",
      "Prices are in Australian dollars, and GST appears on each invoice where it applies.",
      "We send a reminder when an invoice becomes overdue. Work may pause if it's more than 30 days overdue.",
    ],
  },
  {
    key: "privacy",
    title: "Privacy & security",
    summary: "Your information is used only to deliver your services. We never sell or share it.",
    points: [
      "Portal logins are personal. Ask us and we'll add a login for anyone else on your team.",
      "We keep backups of the sites and systems we look after.",
      "Tell us straight away if you think a password or account has been compromised.",
    ],
  },
  {
    key: "ownership",
    title: "Ownership & cancelling",
    summary: "You own what we make for you once it's paid for, and you can stop a monthly plan with notice.",
    points: [
      "Once paid in full, the design and content we create for you are yours.",
      "Third-party items (fonts, plugins, stock images, hosting) stay under their own licences.",
      "Monthly plans can be cancelled with 30 days' written notice. Work done to date is billed.",
      "If you ever move on, we'll help you hand everything over.",
    ],
  },
];

export function policySection(key: string): PolicySection | undefined {
  return POLICY_SECTIONS.find((s) => s.key === key);
}
