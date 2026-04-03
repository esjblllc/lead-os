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

export type InboundFieldDefinition = {
  key: InboundFieldKey;
  label: string;
  description: string;
  example: string;
};

export const INBOUND_FIELD_DEFINITIONS: InboundFieldDefinition[] = [
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

export function buildInboundFieldSelection(params: {
  requiredFields?: string | null;
  optionalFields?: string | null;
}) {
  const required = new Set(parseInboundFieldList(params.requiredFields));
  const optional = new Set(
    parseInboundFieldList(params.optionalFields).filter((key) => !required.has(key))
  );

  return INBOUND_FIELD_DEFINITIONS.map((field) => ({
    ...field,
    status: required.has(field.key)
      ? "required"
      : optional.has(field.key)
        ? "optional"
        : "hidden",
  }));
}

export function buildInboundSamplePayload(params: {
  campaignSlug: string;
  source?: string | null;
  requiredFields?: string | null;
  optionalFields?: string | null;
}) {
  const payload: Record<string, string | number> = {
    campaignSlug: params.campaignSlug,
  };

  for (const field of buildInboundFieldSelection(params)) {
    if (field.status === "hidden") continue;
    payload[field.key] = field.key === "cost" ? 12.5 : field.example;
  }

  if (!payload.source && params.source) {
    payload.source = params.source;
  }

  return payload;
}
