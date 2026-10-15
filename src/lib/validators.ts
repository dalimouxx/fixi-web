import { z } from 'zod';
export const loginSchema=z.object({
  loginCode:z.string().min(2).max(50),
  shopSlug:z.string().min(2).max(80),
  pin:z.string().regex(/^\d{6}$/,'Le code personnel doit contenir exactement 6 chiffres')
});
export const repairCreateSchema=z.object({
  clientName:z.string().min(2),clientPhone:z.string().min(6),clientEmail:z.string().email().optional().or(z.literal('')),
  category:z.enum(['PHONE','TABLET','COMPUTER','OTHER']),brand:z.string().optional(),model:z.string().min(1),serialNumber:z.string().optional(),color:z.string().optional(),lockCode:z.string().optional(),
  reportedIssue:z.string().min(2),priority:z.enum(['NORMAL','URGENT']).default('NORMAL'),technicianId:z.string().optional().nullable(),estimatedPrice:z.coerce.number().nonnegative().optional().nullable(),finalPrice:z.coerce.number().nonnegative().optional().nullable(),warrantyDays:z.coerce.number().int().min(0).max(3650).default(30),promisedAt:z.string().optional().nullable(),estimatedMinutes:z.coerce.number().int().min(5).max(10080).optional().nullable()
});
export const paymentSchema=z.object({repairId:z.string().min(1),method:z.enum(['CASH','CARD','D17','FLOUCI','BANK_TRANSFER','OTHER']),amount:z.coerce.number().positive(),receivedAmount:z.coerce.number().positive().optional().nullable(),note:z.string().optional()});
