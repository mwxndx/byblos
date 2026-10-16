import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../.agents/skills/anatomy/kit/iso-kit.mjs";
import { kitScript } from "../../../.agents/skills/anatomy/scripts/inline-kit.mjs";
import {
  DEPOSIT_TOTAL,
  SHARES,
  AMOUNTS,
  ESCROW_TRAVEL,
  GATE_TRAVEL,
  LEVER_ANGLE,
  evaluateRig
} from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 760;
const HEIGHT = 520;

// World geometry coordinates
const BASE = { x: -125, y: -65, w: 250, d: 130, r: 8 };
const BASE_H = 12;
const FOOT_H = 6;

// Structural Stanchions
const POST_L = [-88, -15];
const POST_R = [88, -15];
const POST_TOP = 158;

// Lower Receiver Shelf
const SHELF = { x: -74, y: -30, w: 148, d: 30, r: 3 };
const SHELF_Z = 24;
const SHELF_H = 4;

// Upper Gantry Crossbeam
const BEAM = { x: -90, y: -20, w: 180, d: 10, r: 2 };
const BEAM_Z = 148;
const BEAM_H = 5;

// Escrow Chamber (Center)
const ESCROW = [0, -15];
const ESCROW_R = 17;
const ESCROW_Z0 = 92;
const ESCROW_Z1 = 144;
const ESCROW_H = ESCROW_Z1 - ESCROW_Z0;

// Lower Settlement Receivers (Centers on the z = 28 shelf)
const REC_SELLER = [-46, -15];
const REC_COURIER = [0, -15];
const REC_COMMISSION = [46, -15];
const REC_H = 34;

// Dial Indicator on Right Post
const DIAL = [POST_R[0] + 19, -15];
const DIAL_R = 16;
const DIAL_Z = 108;
const DIAL_H = 8;
const DIAL_TOP = DIAL_Z + DIAL_H;

// Projections & Bounds
const P = k.fitProjection(
  [
    ...k.boxCorners(BASE, -BASE_H - FOOT_H, 0),
    [POST_L[0] - 6, POST_L[1], POST_TOP + 4],
    [POST_R[0] + 6, POST_R[1], POST_TOP + 4],
    [DIAL[0] + DIAL_R + 6, DIAL[1], DIAL_TOP + 12],
    [0, -15, 178] // Inflow Funnel Top
  ],
  WIDTH,
  HEIGHT,
  { pad: 36, azimuth: 44, elevation: 30 }
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// 1. Base Plate & Feet
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`];

  // 4 Leveling feet with knurled knurls & threaded studs
  for (const [x, y] of byDepth(k.corners(BASE, 20))) {
    out.push(S(k.cylinder(x, y, 7.5, -BASE_H - FOOT_H, 2.2, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.2, -BASE_H - FOOT_H + 2.2, FOOT_H - 2.2, P, 28), { tone: "mid" }));
    out.push(L(k.knurl(x, y, 7.5, -BASE_H - FOOT_H, -BASE_H - FOOT_H + 2.2, 24, P, 0.2), { tone: "lo" }));
  }

  // Heavy milled base slab
  out.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.8), { tone: "mid" }));

  // Inset perimeter groove
  out.push(L(k.planOutline(k.insetPlan(BASE, 5.5), 0, P, 8), { tone: "lo" }));

  // 4 Corner hex screws with washer rings
  const screws = k.corners(BASE, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.5, 0, P, 18)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.55, tone: "lo" }));

  // Front vernier millimeter ruler strip
  const strip = { x: -105, y: BASE.y + BASE.d - 16, w: 210, d: 8, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 20, strip.y + 1, 0.6, [2.2, 4.2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 4, 0.6]), at([strip.x + strip.w - 2, strip.y + 4, 0.6])], { size: 0.45 }));

  // Engraved Brass Specification Plate
  const platePlan = { x: -52, y: BASE.y + BASE.d - 38, w: 104, d: 18, r: 1.5 };
  out.push(S(k.slabOf(platePlan, 0, 0.8, P, 4, 0.2), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(platePlan, 1.5), 0.8, P, 3), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([0, platePlan.y + 5.5], 0.8, P, "x"), "BYBLOS ESCROW & SETTLEMENT ENGINE", { size: 2.8, tone: "hi", anchor: "middle" }));
  out.push(k.faceTextSvg(k.topMatrix([0, platePlan.y + 11.5], 0.8, P, "x"), "AUTONOMOUS CLEARING · MODEL BV-IV · 85:10:5", { size: 2.0, tone: "lo", anchor: "middle" }));
  out.push(D([
    at([platePlan.x + 3, platePlan.y + 3, 0.8]),
    at([platePlan.x + platePlan.w - 3, platePlan.y + 3, 0.8]),
    at([platePlan.x + 3, platePlan.y + platePlan.d - 3, 0.8]),
    at([platePlan.x + platePlan.w - 3, platePlan.y + platePlan.d - 3, 0.8]),
  ], { size: 0.4 }));

  return out.join("");
}

// 2. Twin Support Columns & Framework
function structure() {
  const out = [];

  // Left & Right upright posts
  for (const [px, py] of [POST_L, POST_R]) {
    // Mounting base boss
    out.push(S(k.cylinder(px, py, 6.2, 0, 4, P, 28), { tone: "mid" }));
    out.push(L(k.ring(px, py, 4.6, 4, P, 24), { tone: "lo" }));

    // Main column
    out.push(S(k.cylinder(px, py, 3.6, 4, POST_TOP - 4, P, 28), { tone: "mid", crease: "none" }));
    out.push(L([40, 80, 120].map((z) => k.sideArc(px, py, 3.6, z, P, 18)).join(""), { tone: "faint" }));

    // Column top retaining cap nut
    out.push(S(k.cylinder(px, py, 4.5, POST_TOP, 3, P, 28), { tone: "mid" }));
    out.push(L(k.knurl(px, py, 4.5, POST_TOP, POST_TOP + 3, 20, P, 0.2), { tone: "lo" }));
  }

  // Lower Receiver Shelf
  out.push(S(k.slabOf(SHELF, SHELF_Z, SHELF_H, P, 5, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(SHELF, 2.5), SHELF_Z + SHELF_H, P, 4), { tone: "faint" }));

  // Clamps connecting shelf to posts
  for (const [px, py] of [POST_L, POST_R]) {
    const clampBox = { x: px - 5.5, y: py - 5.5, w: 11, d: 11, r: 2 };
    out.push(S(k.slabOf(clampBox, SHELF_Z - 1, SHELF_H + 2, P, 4, 0.4), { tone: "mid" }));
    out.push(D([at([clampBox.x + 2, py, SHELF_Z + SHELF_H + 1])], { size: 0.45 }));
  }

  // Upper Gantry Crossbeam
  out.push(S(k.slabOf(BEAM, BEAM_Z, BEAM_H, P, 4, 0.5), { tone: "mid" }));
  out.push(D([
    at([BEAM.x + 8, BEAM.y + 5, BEAM_Z + BEAM_H]),
    at([BEAM.x + BEAM.w - 8, BEAM.y + 5, BEAM_Z + BEAM_H])
  ], { size: 0.5, tone: "lo" }));

  return out.join("");
}

// Helper for vertical graduation scale marks
function verticalGraduation(cx, cy, z0, z1, step, every, lengths, projection) {
  const minor = [];
  const major = [];
  const count = Math.round((z1 - z0) / step);
  for (let i = 0; i <= count; i++) {
    const z = z0 + i * step;
    const isMajor = (i % every === 0);
    const len = isMajor ? lengths[1] : lengths[0];
    const seg = k.segment([cx, cy, z], [cx + len, cy, z], projection);
    (isMajor ? major : minor).push(seg);
  }
  return { minor: minor.join(""), major: major.join("") };
}

// 3. Lower Settlement Receivers (Seller 85%, Courier 10%, Commission 5%)
function receivers() {
  const out = [];

  // Seller Receiver (Left: 85% volume - Large cylinder)
  {
    const [x, y] = REC_SELLER;
    const r = 13;
    const zBase = SHELF_Z + SHELF_H;
    // Mounting base flange
    out.push(S(k.cylinder(x, y, r + 2, zBase, 2.5, P, 32), { tone: "mid" }));
    // Chamber body
    out.push(S(k.cylinder(x, y, r, zBase + 2.5, REC_H, P, 36, 0.4), { tone: "hi", crease: "lo" }));
    // Top collar
    out.push(S(k.cylinder(x, y, r + 1.2, zBase + 2.5 + REC_H, 2.5, P, 32), { tone: "mid" }));
    // Vertical graduation ticks
    const ticks = verticalGraduation(x + r, y, zBase + 4, zBase + REC_H, 3.5, 4, [1.4, 2.8], P);
    out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
    // Label plate on cylinder face
    out.push(k.faceTextSvg(k.topMatrix([x, y + r + 3.5], zBase + 1, P, "x"), "SELLER 85%", { size: 2.2, tone: "hi", anchor: "middle" }));
  }

  // Courier Logistics Reservoir (Center: 10% volume - Medium cylinder)
  {
    const [x, y] = REC_COURIER;
    const r = 9.5;
    const zBase = SHELF_Z + SHELF_H;
    out.push(S(k.cylinder(x, y, r + 1.8, zBase, 2.5, P, 30), { tone: "mid" }));
    out.push(S(k.cylinder(x, y, r, zBase + 2.5, REC_H, P, 32, 0.4), { tone: "hi", crease: "lo" }));
    out.push(S(k.cylinder(x, y, r + 1, zBase + 2.5 + REC_H, 2.5, P, 30), { tone: "mid" }));
    const ticks = verticalGraduation(x + r, y, zBase + 4, zBase + REC_H, 4, 3, [1.2, 2.4], P);
    out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
    // Drain valve petcock at base
    out.push(S(k.cylinder(x, y + r + 2, 1.8, zBase + 5, 4, P, 16), { tone: "lo" }));
    out.push(k.faceTextSvg(k.topMatrix([x, y + r + 4], zBase + 1, P, "x"), "COURIER 10%", { size: 2.0, tone: "lo", anchor: "middle" }));
  }

  // Byblos Platform Commission Meter (Right: 5% volume - Precision tube)
  {
    const [x, y] = REC_COMMISSION;
    const r = 7;
    const zBase = SHELF_Z + SHELF_H;
    out.push(S(k.cylinder(x, y, r + 1.5, zBase, 2.5, P, 24), { tone: "mid" }));
    out.push(S(k.cylinder(x, y, r, zBase + 2.5, REC_H, P, 28, 0.3), { tone: "hi", crease: "lo" }));
    out.push(S(k.cylinder(x, y, r + 0.8, zBase + 2.5 + REC_H, 2.5, P, 24), { tone: "mid" }));
    const ticks = verticalGraduation(x + r, y, zBase + 4, zBase + REC_H, 4, 2, [1.0, 2.0], P);
    out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
    out.push(k.faceTextSvg(k.topMatrix([x, y + r + 3.5], zBase + 1, P, "x"), "FEE 5%", { size: 2.0, tone: "lo", anchor: "middle" }));
  }

  return out.join("");
}

// 4. Distribution Manifold & Branch Conduits
function manifold() {
  const out = [];
  const [mx, my] = [0, -15];
  const mz = 68;

  // Central 3-way splitter manifold block
  const manifoldBlock = { x: -28, y: -22, w: 56, d: 14, r: 2.5 };
  out.push(S(k.slabOf(manifoldBlock, mz, 9, P, 4, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(manifoldBlock, 1.8), mz + 9, P, 3), { tone: "faint" }));

  // 3 Throttle needle valve knobs on top of manifold block
  for (const vx of [-18, 0, 18]) {
    out.push(S(k.cylinder(vx, my, 2.6, mz + 9, 3.5, P, 20), { tone: "hi" }));
    out.push(L(k.knurl(vx, my, 2.6, mz + 9, mz + 12.5, 16, P, 0.2), { tone: "lo" }));
  }

  // Branch conduits transferring funds from manifold to lower receivers
  // Left branch to Seller
  out.push(k.wireSvg(at([-18, my, mz]), at([REC_SELLER[0], REC_SELLER[1], SHELF_Z + SHELF_H + REC_H + 2.5]), {
    via: [at([-32, my, mz - 2]), at([REC_SELLER[0], REC_SELLER[1], mz - 4])],
    tone: "hi",
    size: 1.4
  }));

  // Center branch to Courier
  out.push(k.wireSvg(at([0, my, mz]), at([REC_COURIER[0], REC_COURIER[1], SHELF_Z + SHELF_H + REC_H + 2.5]), {
    via: [at([0, my, mz - 3])],
    tone: "mid",
    size: 1.2
  }));

  // Right branch to Commission
  out.push(k.wireSvg(at([18, my, mz]), at([REC_COMMISSION[0], REC_COMMISSION[1], SHELF_Z + SHELF_H + REC_H + 2.5]), {
    via: [at([32, my, mz - 2]), at([REC_COMMISSION[0], REC_COMMISSION[1], mz - 4])],
    tone: "mid",
    size: 1.0
  }));

  return out.join("");
}

// 5. Escrow Chamber & Inflow System (Static Frame)
function escrowStatic() {
  const out = [];
  const [x, y] = ESCROW;

  // Base collar mounting
  out.push(S(k.cylinder(x, y, ESCROW_R + 2, ESCROW_Z0 - 4, 4, P, 36), { tone: "mid" }));
  out.push(L(k.ring(x, y, ESCROW_R + 1.2, ESCROW_Z0, P, 32), { tone: "lo" }));

  // Transparent Escrow Glass Cylinder Body
  out.push(S(k.cylinder(x, y, ESCROW_R, ESCROW_Z0, ESCROW_H, P, 40, 0.4), { tone: "hi", crease: "lo" }));

  // Vertical graduation rule strip on cylinder side
  const ticks = verticalGraduation(x + ESCROW_R, y, ESCROW_Z0 + 4, ESCROW_Z1 - 4, 4, 5, [1.5, 3.2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([x + ESCROW_R + 4, y + 2], ESCROW_Z1 - 6, P, "x"), "10,000 KES", { size: 2.2, tone: "lo", anchor: "start" }));
  out.push(k.faceTextSvg(k.topMatrix([x + ESCROW_R + 4, y + 2], ESCROW_Z0 + 6, P, "x"), "0 KES", { size: 2.2, tone: "lo", anchor: "start" }));

  // Top retaining collar
  out.push(S(k.cylinder(x, y, ESCROW_R + 2, ESCROW_Z1, 4, P, 36), { tone: "mid" }));

  // Inflow Flared Funnel (Payment Intake)
  out.push(S(k.cylinder(x, y, 7, ESCROW_Z1 + 4, 6, P, 24), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 14, ESCROW_Z1 + 10, 8, P, 32, 1.2), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, 14, ESCROW_Z1 + 14, ESCROW_Z1 + 18, 36, P, 0.2), { tone: "lo" }));

  // Solenoid Intake Shutoff Lock Crown
  out.push(S(k.cylinder(x, y, 6, ESCROW_Z1 + 18, 5, P, 24), { tone: "mid" }));
  out.push(L(k.knurl(x, y, 6, ESCROW_Z1 + 18, ESCROW_Z1 + 23, 20, P, 0.2), { tone: "lo" }));
  out.push(D([at([x, y, ESCROW_Z1 + 23])], { size: 0.6, tone: "hi" }));

  return out.join("");
}

// 6. Sliding Release Valve Gate Housing & Lever Bracket
function releaseMechanism() {
  const out = [];
  const [x, y] = ESCROW;
  const zGate = 80;

  // Slide valve block housing
  const gateBox = { x: -16, y: -22, w: 32, d: 14, r: 2 };
  out.push(S(k.slabOf(gateBox, zGate, 8, P, 4, 0.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(gateBox, 1.5), zGate + 8, P, 3), { tone: "faint" }));

  // Pivot support bracket for manual release lever
  const pivotBracket = { x: 16, y: -20, w: 10, d: 10, r: 1.5 };
  out.push(S(k.slabOf(pivotBracket, zGate + 1, 6, P, 3, 0.3), { tone: "mid" }));

  return out.join("");
}

// 7. Dial Indicator (Pressure & Settlement Status)
function dialGauge() {
  const out = [];
  const [dx, dy] = DIAL;

  // Bracket arm connecting dial gauge to right column
  const arm = { x: POST_R[0] + 3, y: -18, w: dx - POST_R[0] - 3, d: 6, r: 1.5 };
  out.push(S(k.slabOf(arm, DIAL_Z + 2, 4, P, 3, 0.3), { tone: "mid" }));
  out.push(D([at([arm.x + 3, -15, DIAL_Z + 6]), at([arm.x + arm.w - 3, -15, DIAL_Z + 6])], { size: 0.4 }));

  // Main dial cylinder housing
  out.push(S(k.cylinder(dx, dy, DIAL_R, DIAL_Z, DIAL_H, P, 48, 0.6), { tone: "hi", crease: "lo" }));

  // Knurled outer bezel rim
  out.push(L(k.knurl(dx, dy, DIAL_R, DIAL_TOP - 3, DIAL_TOP, 64, P, 0.2), { tone: "lo" }));
  out.push(L(k.ring(dx, dy, DIAL_R - 1.8, DIAL_TOP, P, 48), { tone: "lo" }));

  // Radial dial ticks (0% to 100% / Escrow Hold to Settled)
  const ticks = k.radialTicks(dx, dy, DIAL_R - 2.5, 40, 5, DIAL_TOP, [1.2, 2.6], P, Math.PI, Math.PI);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));

  // Dial Center Pivot
  out.push(L(k.ring(dx, dy, 1.8, DIAL_TOP, P, 18), { tone: "mid" }));
  out.push(D([at([dx, dy, DIAL_TOP])], { size: 0.55, tone: "hi" }));

  // Dial Text
  out.push(k.faceTextSvg(k.topMatrix([dx, dy - 7], DIAL_TOP, P, "x"), "ESCROW", { size: 2.2, tone: "lo", anchor: "middle" }));
  out.push(k.faceTextSvg(k.topMatrix([dx - 8, dy + 2], DIAL_TOP, P, "x"), "LOCK", { size: 1.8, tone: "lo", anchor: "middle" }));
  out.push(k.faceTextSvg(k.topMatrix([dx + 8, dy + 2], DIAL_TOP, P, "x"), "CLEARED", { size: 1.8, tone: "lo", anchor: "middle" }));

  // Top Zero-Adjust Crown
  out.push(S(k.cylinder(dx, dy + DIAL_R - 1, 3.2, DIAL_Z + 1, 5, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(dx, dy + DIAL_R - 1, 3.2, DIAL_Z + 1, DIAL_Z + 6, 18, P, 0.2), { tone: "lo" }));

  return out.join("");
}

// Dynamic Parts (moving with progress s)
function buildDynamicPiston() {
  const [x, y] = ESCROW;
  // Weighted piston body
  const out = [];
  out.push(S(k.cylinder(x, y, ESCROW_R - 1.2, 0, 7, P, 36, 0.5), { tone: "lit", lit: true }));
  out.push(L(k.sideArc(x, y, ESCROW_R - 1.2, 2.2, P, 24), { tone: "lo" }));
  out.push(L(k.sideArc(x, y, ESCROW_R - 1.2, 4.8, P, 24), { tone: "lo" }));
  // Guide rod reaching upward
  out.push(S(k.cylinder(x, y, 1.8, 7, 24, P, 16), { tone: "hi", crease: "none" }));
  return out.join("");
}

function buildDynamicGate() {
  // Sliding interlock gate blade
  const blade = { x: -8, y: -20, w: 16, d: 10, r: 1.2 };
  const out = [];
  out.push(S(k.slabOf(blade, 0, 8, P, 3, 0.3), { tone: "lit", lit: true }));
  out.push(D([at([0, -15, 6])], { size: 0.5, tone: "lo" }));
  return out.join("");
}

function buildDynamicLever() {
  // Manual release lever with knurled thumb knob
  const out = [];
  const arm = { x: 20, y: -18, w: 22, d: 4, r: 1.2 };
  out.push(S(k.slabOf(arm, 82, 3.2, P, 3, 0.3), { tone: "hi" }));
  // Knurled thumb knob at end of lever
  out.push(S(k.cylinder(42, -16, 4.2, 80, 7, P, 24), { tone: "lit", lit: true }));
  out.push(L(k.knurl(42, -16, 4.2, 80, 87, 20, P, 0.2), { tone: "lo" }));
  return out.join("");
}

const needleAt = (progress) => {
  const angle = Math.PI + progress * Math.PI; // 180 deg to 360 deg
  const [dx, dy] = DIAL;
  const tipR = DIAL_R - 3.5;
  const tailR = 3.0;
  return k.lineOnTop(
    [dx - Math.sin(angle) * tailR, dy + Math.cos(angle) * tailR],
    [dx + Math.sin(angle) * tipR, dy - Math.cos(angle) * tipR],
    DIAL_TOP + 0.2,
    P
  );
};

// Assembly
const initialPistonZ = ESCROW_Z1 - 10;
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "The Byblos Multi-Party Escrow Settlement Rig. A high-precision industrial apparatus displaying buyer funds securely held in an upper escrow cylinder. Actuating the delivery verification release lever lowers the safety interlock gate, descending the weighted piston and dispensing metered funds across three lower reservoirs: 85% to the Seller, 10% to the Courier, and 5% to Byblos Platform Commission.",
  body: [
    plate(),
    structure(),
    receivers(),
    manifold(),
    escrowStatic(),
    releaseMechanism(),
    dialGauge(),

    // Dynamic Moving Groups
    `<g data-part="piston" transform="${k.translateAlong(P, [0, 0, initialPistonZ])}">${buildDynamicPiston()}</g>`,
    `<g data-part="gate" transform="${k.translateAlong(P, [0, 0, 76])}">${buildDynamicGate()}</g>`,
    `<g data-part="lever">${buildDynamicLever()}</g>`,
    `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(0)}" style="stroke-width:1.2"/>`
  ]
});

// Client live interaction & animation script
const live = `
const P = ${JSON.stringify(P)};
const ESCROW_TRAVEL = ${ESCROW_TRAVEL};
const GATE_TRAVEL = ${GATE_TRAVEL};
const INITIAL_PISTON_Z = ${initialPistonZ};
const INITIAL_GATE_Z = 76;
const DIAL = ${JSON.stringify(DIAL)};
const DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP};

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const piston = svg.querySelector('[data-part="piston"]');
const gate = svg.querySelector('[data-part="gate"]');
const lever = svg.querySelector('[data-part="lever"]');
const needle = svg.querySelector('[data-part="needle"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const needleAt = (progress) => {
  const angle = Math.PI + progress * Math.PI;
  const [dx, dy] = DIAL;
  const tipR = DIAL_R - 3.5;
  const tailR = 3.0;
  return lineOnTop(
    [dx - Math.sin(angle) * tailR, dy + Math.cos(angle) * tailR],
    [dx + Math.sin(angle) * tipR, dy - Math.cos(angle) * tipR],
    DIAL_TOP + 0.2,
    P
  );
};

let s = 0.0, target = 0.0;
let frame = 0, last = 0, clock = 0, touring = true, visible = false, idleTimer = 0;

function draw() {
  // Piston drop
  const curPistonZ = INITIAL_PISTON_Z - s * ESCROW_TRAVEL;
  piston.setAttribute("transform", translateAlong(P, [0, 0, curPistonZ]));

  // Gate drop
  const curGateZ = INITIAL_GATE_Z - s * GATE_TRAVEL;
  gate.setAttribute("transform", translateAlong(P, [0, 0, curGateZ]));

  // Lever tilt
  lever.setAttribute("transform", translateAlong(P, [0, 0, -s * 6]));

  // Needle sweep
  needle.setAttribute("d", needleAt(s));

  // Numerical & Status updates
  const escrowVal = Math.round(10000 * (1 - s));
  const sellerVal = Math.round(8500 * s);
  const courierVal = Math.round(1000 * s);
  const commVal = Math.round(500 * s);

  let text = "";
  if (s < 0.05) {
    text = "ESCROW LOCKED · 10,000 KES HELD (PENDING DELIVERY OTP)";
  } else if (s > 0.95) {
    text = "CLEARED: SELLER 8,500 KES · COURIER 1,000 KES · COMMISSION 500 KES";
  } else {
    text = "SETTLING (" + Math.round(s * 100) + "%): SELLER " + sellerVal.toLocaleString() + " · COURIER " + courierVal.toLocaleString() + " · BYBLOS " + commVal.toLocaleString() + " KES";
  }

  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(s * 100)));
  stage.setAttribute("aria-valuetext", text);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;

  if (touring) {
    clock += dt;
    // Calm continuous cycle: 0 -> 1 -> 0
    const cycle = (Math.sin(clock * 0.8) + 1) / 2;
    target = cycle < 0.15 ? 0 : cycle > 0.85 ? 1 : (cycle - 0.15) / 0.7;
  }

  s = calm ? target : s + (target - s) * (1 - Math.exp(-dt / 0.24));
  if (Math.abs(target - s) < 0.002) s = target;

  draw();

  const settled = !touring && Math.abs(target - s) < 0.001;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}

const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };

const steer = (next) => {
  touring = false;
  target = Math.max(0, Math.min(1, next));
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    touring = !still.matches;
    clock = 0;
    run();
  }, 4200);
  run();
};

new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);

if (still.matches) touring = false;

// Pointer navigation
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
  steer(share);
});

stage.addEventListener("pointerleave", () => steer(target));

// Keyboard interaction
stage.addEventListener("keydown", (event) => {
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = Math.min(1, target + 0.2);
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = Math.max(0, target - 0.2);
  if (event.key === " " || event.key === "Enter") to = target > 0.5 ? 0 : 1;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = 1;
  if (to === null) return;
  event.preventDefault();
  steer(to);
});

draw();
`;

// Wrap in card plate
const body = k.plateHtml({
  fig: "Fig 1",
  title: "Byblos Escrow & Multi-Party Settlement Rig",
  hint: "Hover across or press Space/Arrow keys to actuate settlement release",
  readout: "ESCROW LOCKED · 10,000 KES HELD (PENDING DELIVERY OTP)",
  keys: [
    { mark: "lit", label: "Weighted Piston & Release Lever: triggers atomic clearing" },
    { mark: "hi", label: "Escrow Cylinder (10,000 KES deposit) and Settlement Receivers (85:10:5)" },
    { mark: "mid", label: "3-Way Distribution Manifold, Flow Valves and Calibrated Status Dial" },
  ],
  caption:
    "The Byblos Escrow & Settlement Machine (Model BV-IV). In Byblos social commerce, customer payments are held in non-custodial escrow until delivery is verified via courier OTP. Actuating the release valve drops the weighted piston, atomizing the 10,000 KES deposit across three segregated ledgers: 8,500 KES (85%) to the Seller payout reservoir, 1,000 KES (10%) to Courier logistics, and 500 KES (5%) to Byblos Platform Commission.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Byblos Escrow Rig: Arrow keys or Space actuate settlement clearing" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">${svg}</div>`
});

// Output pages (Dark and Light)
const outHtmlDark = k.pageHtml({
  title: "Byblos Escrow & Multi-Party Settlement Rig",
  theme: "dark",
  body,
  script: kitScript() + live
});

const outHtmlLight = k.pageHtml({
  title: "Byblos Escrow & Multi-Party Settlement Rig (Light)",
  theme: "light",
  body,
  script: kitScript() + live
});

const fileDark = join(HERE, "byblos-escrow-rig.html");
const fileLight = join(HERE, "byblos-escrow-rig-light.html");

writeFileSync(fileDark, outHtmlDark, "utf8");
writeFileSync(fileLight, outHtmlLight, "utf8");

console.log("Successfully generated:");
console.log("- Dark Theme:", fileDark);
console.log("- Light Theme:", fileLight);
