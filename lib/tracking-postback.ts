import crypto from "node:crypto";

type PostbackVariables = Record<string, string | number | null | undefined>;

const PLACEHOLDER_PATTERNS: Array<[RegExp, string]> = [
  [/\{\{click_id\}\}/gi, "click_id"],
  [/\{click_id\}/gi, "click_id"],
  [/\{\{clickId\}\}/g, "clickId"],
  [/\{clickId\}/g, "clickId"],
  [/\{\{lead_id\}\}/gi, "lead_id"],
  [/\{lead_id\}/gi, "lead_id"],
  [/\{\{leadId\}\}/g, "leadId"],
  [/\{leadId\}/g, "leadId"],
  [/\{\{revenue\}\}/gi, "revenue"],
  [/\{revenue\}/gi, "revenue"],
  [/\{\{payout\}\}/gi, "payout"],
  [/\{payout\}/gi, "payout"],
  [/\{\{amount\}\}/gi, "amount"],
  [/\{amount\}/gi, "amount"],
  [/\{\{cost\}\}/gi, "cost"],
  [/\{cost\}/gi, "cost"],
  [/\{\{profit\}\}/gi, "profit"],
  [/\{profit\}/gi, "profit"],
  [/\{\{publisher_id\}\}/gi, "publisher_id"],
  [/\{publisher_id\}/gi, "publisher_id"],
  [/\{\{publisherId\}\}/g, "publisherId"],
  [/\{publisherId\}/g, "publisherId"],
  [/\{\{sub_id\}\}/gi, "sub_id"],
  [/\{sub_id\}/gi, "sub_id"],
  [/\{\{subId\}\}/g, "subId"],
  [/\{subId\}/g, "subId"],
  [/\{\{tracking_link_id\}\}/gi, "tracking_link_id"],
  [/\{tracking_link_id\}/gi, "tracking_link_id"],
  [/\{\{trackingLinkId\}\}/g, "trackingLinkId"],
  [/\{trackingLinkId\}/g, "trackingLinkId"],
];

function normalizeValue(value: string | number | null | undefined) {
  if (value === null || typeof value === "undefined") return "";
  return String(value);
}

export function buildPostbackSecret() {
  return crypto.randomBytes(16).toString("hex");
}

export function applyPostbackTemplate(
  template: string,
  variables: PostbackVariables
) {
  let result = template;

  for (const [pattern, key] of PLACEHOLDER_PATTERNS) {
    result = result.replace(pattern, encodeURIComponent(normalizeValue(variables[key])));
  }

  return result;
}
