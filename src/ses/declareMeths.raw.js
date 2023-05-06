/* eslint-disable no-var */
/* eslint-disable prefer-const */

var isArray = Array.isArray;

/**
 * slightly faster than JSON copying, taken from https://github.com/streamich/fastest-json-copy
 * @param {*} obj
 * @return {*}
 */
function copy(obj) {
  if (obj === undefined || (typeof obj === 'number' && isNaN(obj))) return null;
  if (!obj) return obj;
  if (isArray(obj)) {
    let arr = [];
    var length = obj.length;
    for (var i = 0; i < length; i++) arr.push(copy(obj[i]));
    return arr;
  } else if (typeof obj === 'object') {
    let keys = Object.keys(obj);
    var length = keys.length;
    let newObject = {};
    for (var i = 0; i < length; i++) {
      let key = keys[i];
      newObject[key] = copy(obj[key]);
    }
    return newObject;
  }
  return obj;
}

// Faster than the method above, may help if you have a lot of drawings
function copyDrawings(drawings) {
  const copy = [];
  for (let i = 0; i < drawings.length; ++i) {
    const d = drawings[i];

    const nd = copy[i] = {
      alpha: d.alpha,
      angle: d.angle,
      attachId: d.attachId,
      attachTo: d.attachTo,
      isBehind: d.isBehind,
      noLerp: d.noLerp,
      pos: d.pos ? [d.pos[0], d.pos[1]] :  [0, 0],
      scale:d.scale ? [d.scale[0], d.scale[1]] :  [0, 0],
      shapes: [],
    };

    const ss = nd.shapes;
    for (let j = 0; j < d.shapes.length; ++ j) {
      const s = d.shapes[j];
      const ns = ss[j] = {
        angle: s.angle,
        alpha: s.alpha,
        colour: s.colour,
        noLerp: s.noLerp,
        pos: s.pos,
        type: s.type,
      }
      
      switch (s.type) {
        case 'im':
          const r = s.region;

          ns.id = s.id;
          ns.region = {
            pos: r.pos ? [r.pos[0], r.pos[1]] : [0, 0],
            size: r.size ? [r.size[0], r.size[1]] : [0, 0],
          };
          ns.size = s.size ? [s.size[0], s.size[1]] : [0, 0];
          break;
        case 'bx':
          ns.size = s.size ? [s.size[0], s.size[1]] : [0, 0];
          break;
        case 'ci':
          ns.size = s.size ? [s.size[0], s.size[1]] : [0, 0];
          break;
        case 'li':
          ns.end = s.end ? [s.end[0], s.end[1]] : [0, 0];
          ns.width = s.width;
          break;
        case 'po':
          ns.scale = s.scale ? [s.scale[0], s.scale[1]] : [0, 0];
          
          let vs = s.vertices;
          let nVs = ns.vertices = [];

          for (let i = 0; i < vs.length; ++i) {
            let v = vs[i];
            nVs[i] = v ? [v[0], v[1]] : [0, 0];
          }
          break;
        case 'tx':
          ns.text = s.text;
          ns.size = s.size;
          ns.align = s.align;
          ns.bold = s.bold;
          ns.italic = s.italic;
          ns.shadow = s.shadow;
          break;
      }
    }
  }

  return copy;
}

// pretty self-explanatory
window.getStaticInfo = (game) => {
  const staticInfo = copy(window.parent.gm.state.staticInfo);

  game.lobby = staticInfo.lobby;
};
harden(getStaticInfo);

window.getDynamicInfo = (game) => {
  const oldDrawings = window.parent.gm.state.gameState.gmExtra.drawings;
  window.parent.gm.state.gameState.gmExtra.drawings = undefined;

  const copied = copy({
    state: window.parent.gm.state.gameState,
    inputs: window.parent.gm.state.inputs,
  });

  window.parent.gm.state.gameState.gmExtra.drawings = oldDrawings;

  game.state = copied.state;
  game.inputs = copied.inputs;

  const gmExtra = copied.state.gmExtra;
  gmExtra.drawings = copyDrawings(oldDrawings);


  // cam/drawing props
  for (let i = 0; i < gmExtra.drawings.length; i++) {
    if (!gmExtra.drawings[i]) continue;
    gmExtra.drawings[i].noLerp = false;
  }
  gmExtra.camera.noLerp = false;

  // cameraChanged, used to determine if offscreen arrows should be rendered or not
  if (gmExtra.camera.pos[0] != 365 / game.state.physics.ppm ||
      gmExtra.camera.pos[1] != 250 / game.state.physics.ppm ||
      gmExtra.camera.angle != 0 ||
      gmExtra.camera.scale[0] != 1 ||
      gmExtra.camera.scale[1] != 1) gmExtra.cameraChanged = true;

  // reset kills array
  gmExtra.kills = [];

  // misc
  gmExtra.graphicsQuality = window.parent.BonkUtils.customControls.quality;
  gmExtra.gameLength = window.parent.gmReplaceAccessors.gameLength;
  gmExtra.endRound = false;

  // reset stuff on new round
  if (game.state.rl == 0) {
    gmExtra.camera = {
      pos: [365 / game.state.physics.ppm,
        250 / game.state.physics.ppm],
      angle: 0,
      scale: [1, 1],
      noLerp: false,
    };
    gmExtra.drawings = [];
    for (let i = 0; i < game.lobby.allPlayerIds.length; i++) {
      gmExtra.overrides[game.lobby.allPlayerIds[i]] = {
        up: null,
        down: null,
        left: null,
        right: null,
        action: null,
        action2: null,
      };
    }
  }

  for (const id of game.lobby.allPlayerIds) {
    game.inputs[id] ??= {
      left: false,
      right: false,
      up: false,
      down: false,
      action: false,
      action2: false,
      mouse: {
        pos: [0, 0],
        left: false,
        right: false,
        center: false,
      },
    };
    game.inputs[id].mouse ??= {pos: [0, 0], left: false, right: false, middle: false};
  }

  for (let i = 0; i < game.inputs.length; i++) {
    if (!game.inputs[i]) continue;
    if (!gmExtra?.mousePosSend?.[i]) game.inputs[i].mouse.pos = [0, 0];
    game.inputs[i].mouse.allowPosSending = gmExtra.mousePosSend[i] ?? false;
  }

  game.vars = gmExtra.vars;
  game.inputs.overrides = gmExtra.overrides;
  game.graphics.quality = gmExtra.graphicsQuality;
  game.graphics.camera = gmExtra.camera;
  game.graphics.drawings = gmExtra.drawings;
  game.world.disableDeathBarrier = gmExtra.disableDeathBarrier;
};
harden(getDynamicInfo);

// get list of arguments coming from event fire
window.getEventArgs = () => copy(window.parent.gm.state.currentEventArgs);
harden(getEventArgs);

// graphics functions
window.bakeDrawing = (id, resolution, state) => copy(window.parent.gm.graphics.bakeDrawing(id, resolution, state));
harden(bakeDrawing);

window.debugLog = (mess) => window.parent.gm.graphics.debugLog(mess);
harden(debugLog);

// sound functions
window.playSound = (id, volume, panning) => window.parent.gm.audio.playSound(id, volume, panning);
harden(playSound);

window.stopAllSounds = () => window.parent.gm.audio.stopAllSounds();
harden(stopAllSounds);

// world functions

window.rayCast = (origin, end, filter) => copy(window.parent.gm.state.rayCast(origin, end, filter ? (hit) => {
  return filter(copy(hit));
} : null));
window.rayCastAll = (origin, end, filter) => copy(window.parent.gm.state.rayCast(origin, end, filter ? (hit) => {
  return filter(copy(hit));
} : null, true));

// safe math
const newMath = {};
const oldMath = Math;
const mathMeths = ['abs', 'acos', 'acosh', 'asin', 'asinh', 'atan', 'atanh', 'atan2', 'ceil', 'cbrt', 'expm1', 'clz32', 'cos', 'cosh', 'exp', 'floor', 'fround', 'hypot', 'imul', 'log', 'log1p', 'log2', 'log10', 'max', 'min', 'pow', 'random', 'round', 'sign', 'sin', 'sinh', 'sqrt', 'tan', 'tanh', 'trunc', 'E', 'LN10', 'LN2', 'LOG10E', 'LOG2E', 'PI', 'SQRT1_2', 'SQRT2'];

for (const method of mathMeths) {
  if (typeof oldMath[method] === 'number') {
    newMath[method] = oldMath.round(oldMath[method] * 1000000000) * 0.000000001;
  } else {
    newMath[method] = function() {
      return oldMath.round(oldMath[method](...arguments) * 1000000000) * 0.000000001;
    };
  }
}
newMath.sin = (a) => oldMath.round(oldMath.sin(a * (oldMath.PI / 180)) * 1000000000) * 0.000000001;
newMath.cos = (a) => oldMath.round(oldMath.cos(a * (oldMath.PI / 180)) * 1000000000) * 0.000000001;
newMath.tan = (a) => oldMath.round(oldMath.tan(a * (oldMath.PI / 180)) * 1000000000) * 0.000000001;
newMath.asin = (a) => oldMath.round(oldMath.asin(a) * (180 / oldMath.PI) * 1000000000) * 0.000000001;
newMath.acos = (a) => oldMath.round(oldMath.acos(a) * (180 / oldMath.PI) * 1000000000) * 0.000000001;
newMath.atan = (a) => oldMath.round(oldMath.atan(a) * (180 / oldMath.PI) * 1000000000) * 0.000000001;
newMath.atan2 = (a, b) => oldMath.round(oldMath.atan2(a, b) * (180 / oldMath.PI) * 1000000000) * 0.000000001;
newMath.random = () => {};
newMath.lerpAngle = (a, b, t) => {
  const anglePointA = [newMath.sin(a), newMath.cos(a)];
  const anglePointB = [newMath.sin(b), newMath.cos(b)];
  const lerpedAnglePoint = [
    (1 - t) * anglePointA[0] + t * anglePointB[0],
    (1 - t) * anglePointA[1] + t * anglePointB[1],
  ];

  return newMath.atan2(lerpedAnglePoint[0], lerpedAnglePoint[1]);
};

Math = newMath;

// vector functions
window.Vector = {
  add: (a, b) => {
    let result = [...a];

    if (typeof b === 'number') {
      for (let i = 0; i < result.length; i++) {
        result[i] += b;
      }
    } else {
      for (let i = 0; i < result.length; i++) {
        result[i] += b[i];
      }
    }

    return result;
  },
  subtract: (a, b) => {
    let result = [...a];

    if (typeof b === 'number') {
      for (let i = 0; i < result.length; i++) {
        result[i] -= b;
      }
    } else {
      for (let i = 0; i < result.length; i++) {
        result[i] -= b[i];
      }
    }

    return result;
  },
  multiply: (a, b) => {
    let result = [...a];

    if (typeof b === 'number') {
      for (let i = 0; i < result.length; i++) {
        result[i] *= b;
      }
    } else {
      for (let i = 0; i < result.length; i++) {
        result[i] *= b[i];
      }
    }

    return result;
  },
  divide: (a, b) => {
    let result = [...a];

    if (typeof b === 'number') {
      for (let i = 0; i < result.length; i++) {
        result[i] /= b;
      }
    } else {
      for (let i = 0; i < result.length; i++) {
        result[i] /= b[i];
      }
    }

    return result;
  },
  length: (v) => {
    let result = 0;

    for (let a = 0; a < v.length; a++) {
      result += newMath.pow(newMath.abs(v[a]), 2);
    }

    return newMath.sqrt(result);
  },
  distance: (a, b) => {
    let result = 0;

    for (let i = 0; i < a.length; i++) {
      result += newMath.pow(newMath.abs(b[i] - a[i]), 2);
    }

    return newMath.sqrt(result);
  },
  normalize: (v) => {
    let result = [...v];

    return Vector.divide(result, Vector.length(result));
  },
  dot: (a, b) => {
    let result = 0;

    for (let i = 0; i < a.length; i++) {
      result += a[i] * b[i];
    }

    return result;
  },
  reflect: (a, b) => {
    let result = [];
    const normalizedB = Vector.normalize(b);
    const dot = Vector.dot(a, normalizedB);

    for (let i = 0; i < a.length; i++) {
      result[i] = a[i]-2*normalizedB[i]*dot;
    }

    return result;
  },
  lerp: (a, b, t) => {
    let result = [];

    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] + (b[i] - a[i]) * t;
    }

    return result;
  },
  rotate2d: (v, a) => {
    let result = [];

    result[0] = v[0] * newMath.cos(a) - v[1] * newMath.sin(a);
    result[1] = v[0] * newMath.sin(a) + v[1] * newMath.cos(a);

    return result;
  },
  getAngle2d: (v) => {
    return -newMath.atan2(v[0], v[1]) + 90;
  },
};

window.Colour = {
  toRGBValues: function(colour) {
    return [
      colour >> 16,
      colour >> 8 & 0xff,
      colour & 0xff,
    ];
  },
  toHSVValues: function(colour) {
    const r = (colour >> 16) / 255;
    const g = (colour >> 8 & 0xff) / 255;
    const b = (colour & 0xff) / 255;

    const max = Math.max(r, Math.max(g, b));
    const min = Math.min(r, Math.min(g, b));
    const c = max - min;

    let h;

    if (c == 0) {
      h = 0;
    } else {
      switch (max) {
        case r: h = 60 * ((g - b) / c); break;
        case g: h = 60 * ((b - r) / c + 2); break;
        case b: h = 60 * ((r - g) / c + 4); break;
      }

      if (h < 0) h = 360 - h;
    }

    const s = max == 0 ? 0 : c / max;

    return [h, s, max];
  },
  fromRGBValues: function(rgb) {
    return (Math.round(rgb[0]) << 16) + (Math.round(rgb[1]) << 8) + Math.round(rgb[2]);
  },
  fromHSVValues: function(hsv) {
    const c = hsv[1] * hsv[2];
    const h = hsv[0] % 360 / 60;
    const x = c * (1 - Math.abs(h % 2 - 1));

    let rgb;

    switch (Math.floor(h)) {
      case 0: rgb = [c, x, 0]; break;
      case 1: rgb = [x, c, 0]; break;
      case 2: rgb = [0, c, x]; break;
      case 3: rgb = [0, x, c]; break;
      case 4: rgb = [x, 0, c]; break;
      case 5: rgb = [c, 0, x]; break;
    }

    const m = hsv[2] - c;
    rgb[0] = Math.floor((rgb[0] + m) * 255);
    rgb[1] = Math.floor((rgb[1] + m) * 255);
    rgb[2] = Math.floor((rgb[2] + m) * 255);

    return (Math.round(rgb[0]) << 16) + (Math.round(rgb[1]) << 8) + Math.round(rgb[2]);
  },
  blend: function(a, b, t) {
    const rgbA = this.toRGBValues(a);
    const rgbB = this.toRGBValues(b);

    return this.fromRGBValues([
      rgbA[0] + (rgbB[0] - rgbA[0]) * t,
      rgbA[1] + (rgbB[1] - rgbA[1]) * t,
      rgbA[2] + (rgbB[2] - rgbA[2]) * t,
    ]);
  },
};

// return list of methods
window.methNames = ['getStaticInfo', 'getDynamicInfo', 'getEventArgs', 'bakeDrawing', 'debugLog', 'playSound', 'stopAllSounds', 'rayCast', 'rayCastAll', 'Math', 'Vector', 'Colour'];
