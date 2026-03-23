export function getValueByPath(obj: any, path: string | null | undefined) {
  if (!obj || !path) return null;

  try {
    return path.split(".").reduce((acc, key) => acc?.[key], obj);
  } catch {
    return null;
  }
}

export function normalizeValue(value: any) {
  if (value === null || typeof value === "undefined") return null;

  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);

  return String(value).toLowerCase().trim();
}

export function parseBuyerResponse(
  buyer: {
    acceptanceMode: string;
    acceptancePath?: string | null;
    acceptanceValue?: string | null;
    payoutPath?: string | null;
    pricePerLead?: any;
  },
  responseBody: any
) {
  let accepted = false;
  let payout: number | null = null;

  // --------------------------
  // ACCEPTANCE LOGIC
  // --------------------------

  if (buyer.acceptanceMode === "path_equals") {
    const actual = getValueByPath(responseBody, buyer.acceptancePath);
    const expected = normalizeValue(buyer.acceptanceValue);
    const actualNormalized = normalizeValue(actual);

    accepted = actualNormalized === expected;
  } else {
    // STANDARD FALLBACK LOGIC
    if (
      responseBody?.accepted === true ||
      responseBody?.success === true ||
      responseBody?.status === "accepted" ||
      responseBody?.result === "accepted"
    ) {
      accepted = true;
    }
  }

  // --------------------------
  // PAYOUT LOGIC
  // --------------------------

  if (buyer.payoutPath) {
    const payoutRaw = getValueByPath(responseBody, buyer.payoutPath);

    if (payoutRaw !== null && payoutRaw !== undefined) {
      const num = Number(payoutRaw);
      if (!Number.isNaN(num)) {
        payout = num;
      }
    }
  }

  // fallback to static price
  if (payout === null && buyer.pricePerLead) {
    payout = Number(buyer.pricePerLead);
  }

  return {
    accepted,
    payout,
  };
}