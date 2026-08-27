import "server-only";

import { createHmac } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import { isRectInBounds, type Rect } from "@/lib/auction";

const MAX_CREATIVE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const checkoutFields = z.object({
  brand: z
    .string()
    .trim()
    .min(1, "Add a brand name.")
    .max(80, "Brand name must be 80 characters or less.")
    .transform((value) => value.replace(/\s+/g, " ")),
  website: z.string().trim().min(1, "Add a website."),
  creativeFit: z.enum(["contain", "cover"]),
  x: z.coerce.number().int(),
  y: z.coerce.number().int(),
  w: z.coerce.number().int().min(1),
  h: z.coerce.number().int().min(1),
  termsAccepted: z.literal("true"),
});

function normalizeWebsite(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Website must use http or https.");
  }
  if (url.username || url.password) {
    throw new Error("Website cannot contain credentials.");
  }
  url.hash = "";
  const normalized = url.toString();
  if (normalized.length > 2048) throw new Error("Website URL is too long.");
  return normalized;
}

export async function parseCheckoutFormData(formData: FormData) {
  const parsed = checkoutFields.parse({
    brand: formData.get("brand"),
    website: formData.get("website"),
    creativeFit: formData.get("creativeFit"),
    x: formData.get("x"),
    y: formData.get("y"),
    w: formData.get("w"),
    h: formData.get("h"),
    termsAccepted: formData.get("termsAccepted"),
  });
  const rect: Rect = { x: parsed.x, y: parsed.y, w: parsed.w, h: parsed.h };

  if (!isRectInBounds(rect)) {
    throw new Error("The selected area is outside the artboard.");
  }

  const creative = formData.get("creative");
  if (!(creative instanceof File) || creative.size === 0) {
    throw new Error("Upload a logo or image.");
  }
  if (creative.size > MAX_CREATIVE_BYTES) {
    throw new Error("Image must be 4 MB or smaller.");
  }

  const bytes = new Uint8Array(await creative.arrayBuffer());
  const detected = await fileTypeFromBuffer(bytes);
  if (!detected || !ACCEPTED_MIME_TYPES.has(detected.mime)) {
    throw new Error("Use a valid PNG, JPEG or WebP image.");
  }

  return {
    brandName: parsed.brand,
    websiteUrl: normalizeWebsite(parsed.website),
    creativeFit: parsed.creativeFit,
    rect,
    creative: new Blob([bytes], { type: detected.mime }),
    mimeType: detected.mime,
    extension: detected.ext === "jpg" ? "jpg" : detected.ext,
  };
}

export function getRequesterHash(request: Request) {
  const secret = process.env.REQUEST_HASH_SECRET;
  if (!secret) throw new Error("REQUEST_HASH_SECRET is not configured.");

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip =
    forwarded ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-vercel-forwarded-for") ??
    "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  return createHmac("sha256", secret).update(`${ip}\0${userAgent}`).digest("hex");
}

export function getCheckoutBaseUrl(request: Request) {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(request.url).origin;
}
