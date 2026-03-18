import { z } from "zod";

export const droneSchema = z.object({
  body: z.object({
    droneId: z.string().min(3).max(20),
    type: z.string().optional(),
    batteryLevel: z.number().min(0).max(100).optional(),
    payloadCapacity: z.number().positive(),
    status: z.enum(["idle", "delivering", "maintenance", "charging"]).optional(),
    location: z.object({
      lat: z.number(),
      lng: z.number(),
    }).optional(),
  })
});

export const orderSchema = z.object({
  body: z.object({
    pickupLocation: z.object({
      lat: z.number(),
      lng: z.number(),
    }),
    dropLocation: z.object({
      lat: z.number(),
      lng: z.number(),
    }),
    weight: z.number().positive(),
    customerName: z.string().optional()
  })
});

export const missionDispatchSchema = z.object({
  body: z.object({
    orderId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID").optional(),
    pickupLocation: z.object({
      lat: z.number(),
      lng: z.number(),
    }).optional(),
    dropLocation: z.object({
      lat: z.number(),
      lng: z.number(),
    }).optional(),
    weight: z.number().positive().optional()
  }).refine(data => data.orderId || (data.pickupLocation && data.dropLocation && data.weight), {
    message: "Either orderId or (pickupLocation, dropLocation, weight) must be provided"
  })
});

export const telemetrySchema = z.object({
  body: z.object({
    droneId: z.string(),
    location: z.object({
      lat: z.number(),
      lng: z.number(),
    }),
    altitude: z.number(),
    speed: z.number(),
    batteryLevel: z.number().min(0).max(100),
  })
});
