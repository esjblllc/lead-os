export type InboundFieldKey =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "state"
  | "zip"
  | "source"
  | "subId"
  | "publisherId"
  | "cost"
  | "clickId";

export type InboundFieldStatus = "hidden" | "optional" | "required";

export type InboundFieldDefinition = {
  key: string;
  label: string;
  description: string;
  example: string;
};

export type BuiltInInboundFieldDefinition = InboundFieldDefinition & {
  key: InboundFieldKey;
};

export type CustomInboundFieldDefinition = InboundFieldDefinition & {
  status: Exclude<InboundFieldStatus, "hidden">;
};

export const INBOUND_FIELD_DEFINITIONS: BuiltInInboundFieldDefinition[] = [
  {
    key: "firstName",
    label: "First Name",
    description: "Consumer first name.",
    example: "Jane",
  },
  {
    key: "lastName",
    label: "Last Name",
    description: "Consumer last name.",
    example: "Doe",
  },
  {
    key: "email",
    label: "Email",
    description: "Consumer email address.",
    example: "jane@example.com",
  },
  {
    key: "phone",
    label: "Phone",
    description: "Consumer phone number.",
    example: "5551234567",
  },
  {
    key: "state",
    label: "State",
    description: "Two-letter state or region value.",
    example: "NY",
  },
  {
    key: "zip",
    label: "ZIP",
    description: "Postal code for consumer location.",
    example: "11746",
  },
  {
    key: "source",
    label: "Source",
    description: "Traffic source or channel name.",
    example: "facebook",
  },
  {
    key: "subId",
    label: "Sub ID",
    description: "Publisher sub identifier for attribution.",
    example: "sub_123",
  },
  {
    key: "publisherId",
    label: "Publisher ID",
    description: "External publisher identifier for reporting.",
    example: "pub_123",
  },
  {
    key: "cost",
    label: "Cost",
    description: "Optional explicit lead cost; falls back to supplier default cost.",
    example: "12.50",
  },
  {
    key: "clickId",
    label: "Click ID",
    description: "Optional click identifier for tracking reconciliation.",
    example: "clk_123",
  },
];

const inboundFieldKeySet = new Set<InboundFieldKey>(
  INBOUND_FIELD_DEFINITIONS.map((field) => field.key)
);

function uniqueByKey<T extends { key: string }>(items: T[]) {
  const seen = new Set<string>();
  const output: T[] = [];

  for (const item of items) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    output.push(item);
  }

  return output;
}

export function normalizeInboundFieldList(value: string | null | undefined) {
  if (!value) return "";

  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is InboundFieldKey =>
      inboundFieldKeySet.has(part as InboundFieldKey)
    )
    .filter((part, index, array) => array.indexOf(part) === index)
    .join(",");
}

export function parseInboundFieldList(value: string | null | undefined) {
  const normalized = normalizeInboundFieldList(value);
  return normalized ? (normalized.split(",") as InboundFieldKey[]) : [];
}

export function sanitizeCustomInboundFieldKey(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const parts = trimmed
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "";

  const combined = parts
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");

  const startsWithAlpha = combined.match(/^[a-zA-Z]/) ? combined : `field${combined}`;
  return startsWithAlpha.replace(/[^a-zA-Z0-9_]/g, "");
}

export function normalizeCustomInboundFields(value: unknown) {
  let parsed: unknown = value;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = [];
    }
  }

  if (!Array.isArray(parsed)) {
    return "[]";
  }

  const normalized = parsed
    .map((field) => {
      if (!field || typeof field !== "object") return null;

      const maybeField = field as Record<string, unknown>;
      const key = sanitizeCustomInboundFieldKey(String(maybeField.key || ""));
      const label = String(maybeField.label || "").trim();
      const description = String(maybeField.description || "").trim();
      const example = String(maybeField.example || "").trim();
      const status =
        maybeField.status === "required" ? "required" : "optional";

      if (!key || inboundFieldKeySet.has(key as InboundFieldKey)) return null;
      if (!label) return null;

      return {
        key,
        label,
        description,
        example,
        status,
      } satisfies CustomInboundFieldDefinition;
    })
    .filter((field): field is CustomInboundFieldDefinition => Boolean(field));

  return JSON.stringify(uniqueByKey(normalized));
}

export function parseCustomInboundFields(
  value: string | null | undefined
): CustomInboundFieldDefinition[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(normalizeCustomInboundFields(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function buildInboundFieldSelection(params: {
  requiredFields?: string | null;
  optionalFields?: string | null;
  customFields?: string | null;
}) {
  const required = new Set(parseInboundFieldList(params.requiredFields));
  const optional = new Set(
    parseInboundFieldList(params.optionalFields).filter((key) => !required.has(key))
  );

  const builtIns = INBOUND_FIELD_DEFINITIONS.map((field) => ({
    ...field,
    status: required.has(field.key)
      ? "required"
      : optional.has(field.key)
        ? "optional"
        : "hidden",
  }));

  const customFields = parseCustomInboundFields(params.customFields).map((field) => ({
    ...field,
    status: field.status,
  }));

  return [...builtIns, ...customFields];
}

export function buildInboundSamplePayload(params: {
  campaignSlug: string;
  source?: string | null;
  requiredFields?: string | null;
  optionalFields?: string | null;
  customFields?: string | null;
}) {
  const payload: Record<string, string | number> = {
    campaignSlug: params.campaignSlug,
  };

  for (const field of buildInboundFieldSelection(params)) {
    if (field.status === "hidden") continue;
    payload[field.key] = field.key === "cost" ? 12.5 : field.example || "sample_value";
  }

  if (!payload.source && params.source) {
    payload.source = params.source;
  }

  return payload;
}

export function getRequiredInboundFieldKeys(params: {
  requiredFields?: string | null;
  customFields?: string | null;
}) {
  const builtIns = parseInboundFieldList(params.requiredFields);
  const custom = parseCustomInboundFields(params.customFields)
    .filter((field) => field.status === "required")
    .map((field) => field.key);

  return [...builtIns, ...custom];
}

export function extractCustomInboundData(
  body: Record<string, unknown>,
  customFields?: string | null
) {
  const config = parseCustomInboundFields(customFields);
  const output: Record<string, unknown> = {};

  for (const field of config) {
    const value = body[field.key];
    if (value === null || typeof value === "undefined" || value === "") {
      continue;
    }
    output[field.key] = value;
  }

  return output;
}
