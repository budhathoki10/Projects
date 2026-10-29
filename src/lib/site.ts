/** Business details shown on legal pages. Set these env vars before going live. */
export const SITE = {
  name: "Shortlist",
  operator: process.env.LEGAL_OPERATOR_NAME || "the operator of Shortlist",
  country: process.env.LEGAL_COUNTRY || "Nepal",
  supportEmail: process.env.SUPPORT_EMAIL || "support@example.com",
  legalUpdated: "29 October 2026",
};
