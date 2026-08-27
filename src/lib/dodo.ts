import "server-only";

import DodoPayments from "dodopayments";

let dodoClient: DodoPayments | null = null;

export function getDodoEnvironment(): "live_mode" | "test_mode" {
  return process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode";
}

export function getDodo() {
  if (dodoClient) return dodoClient;

  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  if (!apiKey) {
    throw new Error("DODO_PAYMENTS_API_KEY is not configured");
  }

  dodoClient = new DodoPayments({
    bearerToken: apiKey,
    environment: getDodoEnvironment(),
  });

  return dodoClient;
}

export function getPlacementProductId() {
  const productId = process.env.DODO_PAYMENTS_PLACEMENT_PRODUCT_ID;
  if (!productId) {
    throw new Error("DODO_PAYMENTS_PLACEMENT_PRODUCT_ID is not configured");
  }
  return productId;
}
