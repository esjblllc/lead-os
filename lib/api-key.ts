export function generateApiKey(prefix = "sup") {
  const randomPart = crypto.randomUUID().replace(/-/g, "");
  return `${prefix}_${randomPart}`;
}