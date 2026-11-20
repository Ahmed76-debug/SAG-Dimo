import { Router } from "express";
import { readPublicContent, bookedSlots, addBooking } from "../repo.mjs";
import { bad } from "../util.mjs";

export const publicRouter = Router();

publicRouter.get("/content", (_req, res) => {
  res.json({ ok: true, data: readPublicContent() });
});

publicRouter.get("/slots", (req, res, next) => {
  try {
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    if (!from || !to) return next(bad("تاريخ البداية والنهاية مطلوبان.", "missing_range", 400));
    res.json({ ok: true, data: bookedSlots(from, to) });
  } catch (error) {
    next(error);
  }
});

publicRouter.post("/bookings", (req, res, next) => {
  try {
    const body = req.body || {};
    if (!String(body.patientName || "").trim()) {
      return next(bad("اسم المريض مطلوب.", "missing_name", 400));
    }
    if (!String(body.phone || "").trim()) {
      return next(bad("رقم الهاتف مطلوب.", "missing_phone", 400));
    }
    if (!String(body.preferredDate || "").trim() || !String(body.preferredTime || "").trim()) {
      return next(bad("التاريخ والوقت المطلوبان مطلوبان.", "missing_slot", 400));
    }
    const booking = addBooking(body);
    res.status(201).json({ ok: true, data: booking });
  } catch (error) {
    next(error);
  }
});
