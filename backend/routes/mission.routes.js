```javascript
import { Router } from "express";
import { dispatchMission, getAllMissions, getMissionById } from "../controllers/mission.controller.js";
import { protect, restrictTo } from "../middleware/auth.js";
import validate, { missionDispatchSchema } from "../middleware/validate.js";

const router = Router();

router.get("/", protect, getAllMissions);
router.post("/dispatch", protect, restrictTo("admin", "operator"), validate(missionDispatchSchema), dispatchMission);
router.get("/:id", protect, getMissionById);

export default router;
```
