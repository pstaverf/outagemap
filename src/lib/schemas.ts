import { z } from "zod";
export const categories = {
  POWER: "Электричество",
  WATER: "Вода",
  HEATING: "Отопление",
  INTERNET: "Интернет",
  ROAD: "Дороги",
  LIGHTING: "Освещение",
  WASTE: "Мусор",
  OTHER: "Другое",
} as const;
export const statuses = {
  OPEN: "Открыта",
  CONFIRMED: "Подтверждена",
  RESOLVED: "Решена",
  REJECTED: "Отклонена",
} as const;
export const safeText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((v) => !/[<>\u0000-\u0008]/u.test(v), "Недопустимые символы");
export const categorySchema = z.enum([
  "POWER",
  "WATER",
  "HEATING",
  "INTERNET",
  "ROAD",
  "LIGHTING",
  "WASTE",
  "OTHER",
]);
export const pointSchema = z.object({
  lat: z.coerce.number().min(-85).max(85),
  lng: z.coerce.number().min(-180).max(180),
});
export const issueSchema = z.object({
  title: safeText(5, 120),
  description: safeText(15, 3000),
  category: categorySchema,
  lat: z.number().min(-85).max(85),
  lng: z.number().min(-180).max(180),
  city: safeText(2, 100),
  region: safeText(0, 100),
  address: safeText(0, 250),
});
export const createIssueSchema = issueSchema.extend({
  mediaIds: z.array(z.string().cuid()).max(5).default([]),
});
export const querySchema = z
  .object({
    west: z.coerce.number().min(-180).max(180).default(44),
    east: z.coerce.number().min(-180).max(180).default(88),
    south: z.coerce.number().min(-85).max(85).default(40),
    north: z.coerce.number().min(-85).max(85).default(57),
    category: categorySchema.optional(),
    status: z.enum(["OPEN", "CONFIRMED", "RESOLVED"]).optional(),
    q: z.string().max(120).default(""),
    region: z.string().max(100).default(""),
    period: z.enum(["all", "day", "week", "month"]).default("all"),
    sort: z.enum(["date", "affected"]).default("date"),
    cursor: z.string().max(100).optional(),
  })
  .refine((q) => q.south <= q.north, "Некорректная область");
export const reactionSchema = z.object({
  type: z.enum(["AFFECTED", "NOT_AFFECTED"]).nullable(),
});
export const reviewSchema = z.object({
  locationKey: safeText(2, 100),
  rating: z.number().int().min(1).max(5),
  text: safeText(10, 2000),
});
export const reportSchema = z.object({ reason: safeText(10, 1000) });
export const moderationSchema = z.object({
  status: z.enum(["RESOLVED", "REJECTED"]),
  reason: safeText(10, 1000),
});
export const moderatorActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("block"),
    userId: z.string().cuid(),
    blocked: z.boolean(),
    reason: safeText(10, 1000),
  }),
  z.object({
    action: z.literal("hide-review"),
    reviewId: z.string().cuid(),
    reason: safeText(10, 1000),
  }),
  z.object({
    action: z.literal("dismiss"),
    reportId: z.string().cuid(),
    reason: safeText(10, 1000),
  }),
]);
export type IssueInput = z.infer<typeof issueSchema>;
export const issueViewSchema = issueSchema.extend({
  id: z.string(),
  status: z.enum(["OPEN", "CONFIRMED", "RESOLVED", "REJECTED"]),
  createdAt: z.string(),
  affected: z.number(),
  notAffected: z.number(),
  authorId: z.string(),
  mediaIds: z.array(z.string()).default([]),
});
export type IssueView = z.infer<typeof issueViewSchema>;
export const issueDetailSchema = issueViewSchema.extend({
  myReaction: z.enum(["AFFECTED", "NOT_AFFECTED"]).nullable(),
  canManage: z.boolean(),
  suggestResolve: z.boolean(),
});
export const listSchema = z.object({
  items: z.array(issueViewSchema),
  nextCursor: z.string().nullable(),
});
export const reviewsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      rating: z.number(),
      createdAt: z.string(),
    }),
  ),
  summary: z.object({
    _avg: z.object({ rating: z.number().nullable() }),
    _count: z.number(),
  }),
});
export const locationSchema = z.object({
  city: z.string().max(100),
  region: z.string().max(100).default(""),
  center: z.tuple([z.number().min(-180).max(180), z.number().min(-85).max(85)]),
  zoom: z.number().min(2).max(18),
  source: z.enum(["choice", "ip", "fallback", "device"]),
});
export type Location = z.infer<typeof locationSchema>;
const coordinateNumber = z
  .union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
  .transform(Number);
const ring = z
  .array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
  .min(4);
const polygonSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Polygon"), coordinates: z.array(ring).min(1) }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(z.array(ring).min(1)).min(1),
  }),
]);
export const geocodeResultSchema = z.object({
  lat: coordinateNumber.pipe(z.number().min(-85).max(85)),
  lon: coordinateNumber.pipe(z.number().min(-180).max(180)),
  display_name: z.string(),
  geojson: z
    .unknown()
    .optional()
    .transform((value) => {
      const result = polygonSchema.safeParse(value);
      return result.success ? result.data : undefined;
    }),
});
export const uploadSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z
    .number()
    .int()
    .positive()
    .max(8 * 1024 * 1024),
});
export const mediaFinalizeSchema = z.object({
  key: z.string().min(1).max(250),
});
export const emailSchema = z
  .string()
  .trim()
  .max(254)
  .transform((v) => v.normalize("NFKC").toLowerCase())
  .pipe(z.email())
  .refine(
    (v) => /^[\x21-\x7e]+$/.test(v),
    "Используйте адрес без Unicode-символов",
  );
