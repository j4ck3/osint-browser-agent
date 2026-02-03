import { z } from 'zod';

// Phone number regex - accepts Swedish and international formats
const phoneRegex = /^\+?[0-9\s\-()]{6,20}$/;

// Search request schema
export const SearchRequestSchema = z.object({
  name: z.string().min(1, "Name must not be empty").optional(),
  phone: z.string().regex(phoneRegex, "Invalid phone number format").optional(),
  city: z.string().min(1, "City must not be empty").optional(),
  ageMin: z.number().int().min(0).max(120).optional(),
  ageMax: z.number().int().min(0).max(120).optional(),
}).refine(
  data => data.name || data.phone,
  { message: "Either name or phone must be provided" }
).refine(
  data => {
    if (data.ageMin !== undefined && data.ageMax !== undefined) {
      return data.ageMin <= data.ageMax;
    }
    return true;
  },
  { message: "ageMin must be less than or equal to ageMax" }
);

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

// Validation helper
export function validateSearchRequest(data: unknown): SearchRequest {
  return SearchRequestSchema.parse(data);
}
