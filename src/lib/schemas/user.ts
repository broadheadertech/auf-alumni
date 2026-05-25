import { z } from "zod";

/** Signup form input (Epic 2 Story 2.1). */
export const SignupSchema = z
  .object({
    email: z.string().email("Enter a valid email"),
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(128, "Password too long"),
    consentAcknowledged: z
      .boolean()
      .refine((v) => v === true, {
        message: "You must acknowledge the privacy notice to continue",
      }),
  })
  .strict();
export type SignupInput = z.infer<typeof SignupSchema>;

/** Login form input. */
export const LoginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1, "Password required"),
  })
  .strict();
export type LoginInput = z.infer<typeof LoginSchema>;
