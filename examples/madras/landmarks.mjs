// Landmarks measured on reference.png (637 × 481 px) for scripts/fit-camera.mjs: `node scripts/fit-camera.mjs
// examples/madras/landmarks.mjs`. The fitted camera and masses are the LENS and the dimensions in scene.mjs.
// World: metres, x east along the south wing, y north along the west wing, z up; the central pavilion's outer corner is
// the origin. The west wing's face is x = 1.5, the south wing's y = 1.5.

const p = 1.5;

export const params = {
  ex: [-60, 10], ey: [-70, 10], h: [1.6, 0.5], yaw: [45, 5], f: [1200, 150], cx: [318, 10], cy: [400, 10],
  P: [14, 2], zPe: [20, 2], zTop: [26, 2], zWe: [15, 1], zSill: [10.5, 1], zStr: [7, 1],
  yt: [40, 5], tw: [9, 2], tpr: [2, 0.5], zTe: [26, 2], zTtop: [33, 2],
  xb: [50, 5], Pb: [12, 2], pb: [3, 0.5], zBe: [19, 2], zBtop: [24, 2],
};

export const points = [
  // The central pavilion: its three corners at the cornice and the middle of its roof platform.
  [(k) => [0, 0, k.zPe], [381, 209]],
  [(k) => [0, k.P, k.zPe], [337, 211]],
  [(k) => [k.P, 0, k.zPe], [438, 210]],
  [(k) => [k.P / 2, k.P / 2, k.zTop], [391, 158]],
  // Where the wings' eaves meet it.
  [(k) => [p, k.P, k.zWe], [338, 251]],
  [(k) => [k.P, p, k.zWe], [442, 253]],
  // The clock tower: its west face from yt to yt + tw stands tpr proud of the wing; the cornice and the roof platform.
  [(k) => [p - k.tpr, k.yt, k.zTe], [171, 118]],
  [(k) => [p - k.tpr, k.yt + k.tw, k.zTe], [141, 119]],
  [(k) => [p - k.tpr + k.tw, k.yt, k.zTe], [229, 120]],
  [(k) => [p - k.tpr + k.tw / 2, k.yt + k.tw / 2, k.zTtop], [190, 45]],
  // The east pavilion on the south wing, pb proud of it.
  [(k) => [k.xb, p - k.pb, k.zBe], [558, 241]],
  [(k) => [k.xb + k.Pb, p - k.pb, k.zBe], [604, 245]],
  [(k) => [k.xb, p, k.zBe], [546, 241]],
  [(k) => [k.xb + k.Pb / 2, p - k.pb + k.Pb / 2, k.zBtop], [578, 192]],
];

// The eaves, the loggia sills and the string courses of both wings, read wherever they show between the trees.
export const lines = [
  [(k) => [[p, k.P, k.zWe], [p, 150, k.zWe]], [[185, 275], [260, 264], [330, 253]]],
  [(k) => [[p, k.P, k.zSill], [p, 150, k.zSill]], [[195, 319], [330, 305]]],
  [(k) => [[p, k.P, k.zStr], [p, 150, k.zStr]], [[195, 343], [260, 338]]],
  [(k) => [[k.P, p, k.zWe], [200, p, k.zWe]], [[445, 256], [550, 268]]],
  [(k) => [[k.P, p, k.zSill], [200, p, k.zSill]], [[445, 303], [550, 311]]],
  [(k) => [[k.P, p, k.zStr], [200, p, k.zStr]], [[480, 341], [555, 344]]],
];

// What is known without the photograph: the eye at standing height, and the clock tower's roof at about 39 m
// (136 ft to the top of its cresting), which sets the scale. The rest keeps the fit architectural.
export const prior = (k) =>
  20 * (k.h - 1.7) ** 2 + 4 * (k.zTtop - 38) ** 2 + 0.002 * (k.cx - 318) ** 2 + (k.tpr - 2) ** 2 + 0.05 * (k.pb - 3) ** 2 + (k.yaw < 5 || k.yaw > 85 ? 1e6 : 0);
