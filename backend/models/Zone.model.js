import mongoose from "mongoose";

const geometrySchema = new mongoose.Schema(
  {
    // 'Polygon' | 'Circle' | 'Rectangle'
    type: {
      type: String,
      enum: ["Polygon", "Circle", "Rectangle"],
      required: true,
    },
    // GeoJSON coordinates array  [ [ [lng,lat], ... ] ]  for Polygon/Rectangle
    // For Circle: [ [centerLng, centerLat] ] — radius stored separately
    coordinates: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // Only used when type === 'Circle'
    radius: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
);

const zoneSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["NO_FLY", "RESTRICTED"],
      required: true,
    },
    geometry: {
      type: geometrySchema,
      required: true,
    },
    altitude_min: {
      type: Number,
      default: 0,
    },
    altitude_max: {
      type: Number,
      default: 120,
    },
    start_time: {
      type: Date,
      default: null,
    },
    end_time: {
      type: Date,
      default: null,
    },
    visible: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Zone", zoneSchema);
