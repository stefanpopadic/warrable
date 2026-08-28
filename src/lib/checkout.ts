import "server-only";

import { createHmac } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import { isRectInViewport, viewportForLevel, type Rect } from "@/lib/auction";

const MAX_CREATIVE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email.")
  .max(320, "Email is too long.")
  .transform((value) => value.toLowerCase());

const checkoutFields = z.object({
  brand: z
    .string()
    .trim()
    .min(1, "Add a brand name.")
    .max(80, "Brand name must be 80 characters or less.")
    .transform((value) => value.replace(/\s+/g, " ")),
  website: z.string().trim().min(1, "Add a website."),
  email: emailSchema,
  creativeFit: z.enum(["contain", "cover"]),
  x: z.coerce.number().int(),
  y: z.coerce.number().int(),
  w: z.coerce.number().int().min(1),
  h: z.coerce.number().int().min(1),
  termsAccepted: z.literal("true"),
  extendPlacementId: z.string().trim().uuid().optional(),
});

function normalizeWebsite(value: string) {
  const trimmed = value.trim();
  const withProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
  const url = new URL(withProtocol);
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

export async function parseCheckoutFormData(
  formData: FormData,
  viewport: Rect = viewportForLevel(0),
) {
  const extendRaw = formData.get("extendPlacementId");
  const parsed = checkoutFields.parse({
    brand: formData.get("brand"),
    website: formData.get("website"),
    email: formData.get("email"),
    creativeFit: formData.get("creativeFit") ?? "contain",
    x: formData.get("x"),
    y: formData.get("y"),
    w: formData.get("w"),
    h: formData.get("h"),
    termsAccepted: formData.get("termsAccepted"),
    extendPlacementId:
      typeof extendRaw === "string" && extendRaw.trim() ? extendRaw.trim() : undefined,
  });
  const rect: Rect = { x: parsed.x, y: parsed.y, w: parsed.w, h: parsed.h };

  if (!isRectInViewport(rect, viewport)) {
    throw new Error("The selected area is outside the artboard.");
  }

  const isExtend = Boolean(parsed.extendPlacementId);

  if (isExtend) {
    return {
      brandName: parsed.brand,
      websiteUrl: normalizeWebsite(parsed.website),
      email: parsed.email,
      creativeFit: parsed.creativeFit,
      rect,
      extendPlacementId: parsed.extendPlacementId!,
      creative: null as Blob | null,
      mimeType: null as string | null,
      extension: null as string | null,
    };
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
    email: parsed.email,
    creativeFit: parsed.creativeFit,
    rect,
    extendPlacementId: undefined as string | undefined,
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCheckoutSessionId(value: string) {
  return value.length > 0 && value.length <= 255 && value.startsWith("cs_");
}

export function isPaymentId(value: string) {
  return value.length > 0 && value.length <= 255 && value.startsWith("pi_");
}

export function isPlacementId(value: string) {
  return UUID_RE.test(value);
}

export function isCheckoutReference(value: string | undefined) {
  if (!value) return false;
  return isPlacementId(value) || isCheckoutSessionId(value) || isPaymentId(value);
}
