import { z } from "zod";

export const droneSchema = z.object({
  droneId: z.string().min(3).max(20),
  batteryLevel: z.number().min(0).max(100).optional(),
  payloadCapacity: z.number().positive(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
});

export const orderSchema = z.object({
  pickupLocation: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  dropLocation: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  weight: z.number().positive(),
});

export const telemetrySchema = z.object({
  droneId: z.string(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  altitude: z.number(),
  speed: z.number(),
  batteryLevel: z.number().min(0).max(100),
});
