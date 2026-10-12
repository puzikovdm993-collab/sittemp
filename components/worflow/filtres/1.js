// Оптимизированный вариант.
// Внутренне представление: плоские Float32Array.
// Формат входа/выхода сохраняется: 2D -> 2D, flat -> flat.

function is2DArray(data, w, h) {
    return Array.isArray(data) &&
      data.length === h &&
      data[0] != null &&
      data[0].length === w;
  }
  
  function toFlat(data, w, h) {
    const n = w * h;
    const out = new Float32Array(n);
  
    if (is2DArray(data, w, h)) {
      for (let y = 0; y < h; y++) {
        const row = data[y];
        const off = y * w;
        for (let x = 0; x < w; x++) {
          out[off + x] = row[x];
        }
      }
    } else {
      for (let i = 0; i < n; i++) {
        out[i] = data[i];
      }
    }
  
    return out;
  }
  
  function fromFlat(flat, w, h, as2D) {
    if (!as2D) return flat;
  
    const out = new Array(h);
    for (let y = 0; y < h; y++) {
      const row = new Array(w);
      const off = y * w;
      for (let x = 0; x < w; x++) {
        row[x] = flat[off + x];
      }
      out[y] = row;
    }
  
    return out;
  }
  
  function normalizeFlat(arr) {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      sum += arr[i];
    }
  
    if (!Number.isFinite(sum) || sum === 0) {
      throw new Error("Kernel sum is zero");
    }
  
    const inv = 1 / sum;
    for (let i = 0; i < arr.length; i++) {
      arr[i] *= inv;
    }
  
    return arr;
  }
  
  function makeGaussian1D(sigma, radiusFactor = 4) {
    const s = Math.max(1e-6, Number(sigma) || 1e-6);
  
    let size = Math.max(1, Math.ceil(2 * radiusFactor * s));
    if (size % 2 === 0) size++;
  
    const c = (size - 1) / 2;
    const k = new Float32Array(size);
  
    for (let i = 0; i < size; i++) {
      const dx = i - c;
      k[i] = Math.exp(-(dx * dx) / (2 * s * s));
    }
  
    return normalizeFlat(k);
  }
  
  function makeGaussianKernel(sigmaX, sigmaY, radiusFactor = 4) {
    const row = makeGaussian1D(sigmaX, radiusFactor);
    const col = makeGaussian1D(sigmaY, radiusFactor);
  
    return {
      type: "separable",
      row,
      col,
      width: row.length,
      height: col.length
    };
  }
  
  function makeLorentzKernel(R, stupidity = 1, width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error("Lorentz kernel: некорректные размеры");
    }
  
    const r = Number(R);
    if (!Number.isFinite(r) || r <= 0) {
      throw new Error("Lorentz kernel: R должен быть > 0");
    }
  
    const p = Number(stupidity) || 1;
    const data = new Float32Array(width * height);
  
    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    const inv2pi = 1 / (2 * Math.PI);
  
    for (let y = 0; y < height; y++) {
      const dy = y - cy;
      const off = y * width;
  
      for (let x = 0; x < width; x++) {
        const dx = x - cx;
        const r2 = dx * dx + dy * dy;
  
        data[off + x] =
          inv2pi *
          (r / Math.pow(r2 + r * r, (3 * p) / 2));
      }
    }
  
    normalizeFlat(data);
  
    return {
      type: "direct",
      data,
      width,
      height
    };
  }
  
  function convolve1DHorizontal(src, dst, w, h, kernel, padding) {
    const k = kernel.length;
    const rLeft = (k - 1) >> 1;
    const rRight = k - 1 - rLeft;
    const pw = w + rLeft + rRight;
  
    const padded = new Float32Array(pw);
  
    for (let y = 0; y < h; y++) {
      const srcOff = y * w;
  
      for (let px = 0; px < pw; px++) {
        const sx0 = px - rLeft;
        let val;
  
        if (sx0 >= 0 && sx0 < w) {
          val = src[srcOff + sx0];
        } else if (padding === "zero") {
          val = 0;
        } else if (padding === "replicate") {
          const sx = sx0 < 0 ? 0 : (sx0 >= w ? w - 1 : sx0);
          val = src[srcOff + sx];
        } else if (padding === "reflect") {
          if (w > 1) {
            let sx = sx0;
            if (sx < 0) sx = -sx;
            else if (sx >= w) sx = 2 * w - 2 - sx;
            sx = sx < 0 ? 0 : (sx >= w ? w - 1 : sx);
            val = src[srcOff + sx];
          } else {
            val = src[srcOff];
          }
        } else {
          throw new Error("Unknown padding: " + padding);
        }
  
        padded[px] = val;
      }
  
      const dstOff = y * w;
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let nx = 0; nx < k; nx++) {
          sum += kernel[nx] * padded[x + nx];
        }
        dst[dstOff + x] = sum;
      }
    }
  
    return dst;
  }
  
  function convolve1DVertical(src, dst, w, h, kernel, padding) {
    const k = kernel.length;
    const rLeft = (k - 1) >> 1;
    const rRight = k - 1 - rLeft;
  
    const ph = h + rLeft + rRight;
    const pw = w;
  
    const padded = new Float32Array(ph * pw);
  
    for (let py = 0; py < ph; py++) {
      const sy0 = py - rLeft;
      let sy;
  
      if (sy0 >= 0 && sy0 < h) {
        sy = sy0;
      } else if (padding === "zero") {
        continue;
      } else if (padding === "replicate") {
        sy = sy0 < 0 ? 0 : (sy0 >= h ? h - 1 : sy0);
      } else if (padding === "reflect") {
        if (h > 1) {
          sy = sy0;
          if (sy < 0) sy = -sy;
          else if (sy >= h) sy = 2 * h - 2 - sy;
          sy = sy < 0 ? 0 : (sy >= h ? h - 1 : sy);
        } else {
          sy = 0;
        }
      } else {
        throw new Error("Unknown padding: " + padding);
      }
  
      const srcOff = sy * w;
      const dstOff = py * pw;
  
      for (let x = 0; x < w; x++) {
        padded[dstOff + x] = src[srcOff + x];
      }
    }
  
    for (let y = 0; y < h; y++) {
      const dstOff = y * w;
  
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let ny = 0; ny < k; ny++) {
          sum += kernel[ny] * padded[(y + ny) * pw + x];
        }
        dst[dstOff + x] = sum;
      }
    }
  
    return dst;
  }
  
  function convolveSeparable(src, w, h, row, col, padding) {
    const n = w * h;
    const temp = new Float32Array(n);
    const out = new Float32Array(n);
  
    convolve1DHorizontal(src, temp, w, h, row, padding);
    convolve1DVertical(temp, out, w, h, col, padding);
  
    return out;
  }
  
  function convolveDirect(src, w, h, kernel, kw, kh, padding) {
    const cx = (kw - 1) >> 1;
    const rx = kw - 1 - cx;
    const cy = (kh - 1) >> 1;
    const ry = kh - 1 - cy;
  
    const pw = w + cx + rx;
    const ph = h + cy + ry;
  
    const padded = new Float32Array(pw * ph);
  
    for (let py = 0; py < ph; py++) {
      const sy0 = py - cy;
      let sy;
  
      if (sy0 >= 0 && sy0 < h) {
        sy = sy0;
      } else if (padding === "zero") {
        continue;
      } else if (padding === "replicate") {
        sy = sy0 < 0 ? 0 : (sy0 >= h ? h - 1 : sy0);
      } else if (padding === "reflect") {
        if (h > 1) {
          sy = sy0;
          if (sy < 0) sy = -sy;
          else if (sy >= h) sy = 2 * h - 2 - sy;
          sy = sy < 0 ? 0 : (sy >= h ? h - 1 : sy);
        } else {
          sy = 0;
        }
      } else {
        throw new Error("Unknown padding: " + padding);
      }
  
      const srcRow = sy * w;
      const dstRow = py * pw;
  
      for (let px = 0; px < pw; px++) {
        const sx0 = px - cx;
        let sx;
  
        if (sx0 >= 0 && sx0 < w) {
          sx = sx0;
        } else if (padding === "zero") {
          continue;
        } else if (padding === "replicate") {
          sx = sx0 < 0 ? 0 : (sx0 >= w ? w - 1 : sx0);
        } else if (padding === "reflect") {
          if (w > 1) {
            sx = sx0;
            if (sx < 0) sx = -sx;
            else if (sx >= w) sx = 2 * w - 2 - sx;
            sx = sx < 0 ? 0 : (sx >= w ? w - 1 : sx);
          } else {
            sx = 0;
          }
        } else {
          throw new Error("Unknown padding: " + padding);
        }
  
        padded[dstRow + px] = src[srcRow + sx];
      }
    }
  
    const out = new Float32Array(w * h);
  
    for (let y = 0; y < h; y++) {
      const dstOff = y * w;
  
      for (let x = 0; x < w; x++) {
        let sum = 0;
  
        for (let ny = 0; ny < kh; ny++) {
          const pRow = (y + ny) * pw;
          const kRow = ny * kw;
  
          for (let nx = 0; nx < kw; nx++) {
            sum += kernel[kRow + nx] * padded[pRow + x + nx];
          }
        }
  
        out[dstOff + x] = sum;
      }
    }
  
    return out;
  }
  
  function convolve(src, w, h, kernel, padding) {
    if (kernel.type === "separable") {
      return convolveSeparable(src, w, h, kernel.row, kernel.col, padding);
    }
  
    return convolveDirect(src, w, h, kernel.data, kernel.width, kernel.height, padding);
  }
  
  function lucyRichardson(image, kernel, options = {}) {
    const w = Number(options.width);
    const h = Number(options.height);
  
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      throw new Error("lucyRichardson: некорректные размеры");
    }
  
    const iterations = Math.max(0, Math.floor(Number(options.iterations ?? 10) || 0));
    const lambda = Number(options.lambda ?? 0.5);
    const mode = options.mode ?? "multiplicative";
    const padding = options.padding ?? "reflect";
    const nonNeg = Boolean(options.nonNegative);
  
    // observed  — сравниваем blurred с исходным изображением g
    // current   — сравниваем blurred с текущей оценкой f
    const compareWith = options.compareWith ?? "observed";
  
    const as2D = is2DArray(image, w, h);
    const src = toFlat(image, w, h);
  
    const g = src.slice();
    let f = src.slice();
  
    let min = Infinity;
    for (let i = 0; i < f.length; i++) {
      if (f[i] < min) min = f[i];
    }
  
    const shift = min < 0 ? -2 * min : 0;
  
    if (shift !== 0) {
      for (let i = 0; i < f.length; i++) {
        f[i] += shift;
        g[i] += shift;
      }
    }
  
    for (let it = 0; it < iterations; it++) {
      const blurred = convolve(f, w, h, kernel, padding);
      const next = new Float32Array(w * h);
  
      const ref = compareWith === "current" ? f : g;
  
      if (mode === "multiplicative") {
        for (let i = 0; i < next.length; i++) {
          const fi = f[i];
          const ri = ref[i];
  
          if (ri === 0) {
            next[i] = fi;
            continue;
          }
  
          const r = blurred[i] / ri;
          const denom = 1 + lambda * (r - 1);
  
          let val = Math.abs(denom) < 1e-12 ? fi : fi / denom;
  
          if (!Number.isFinite(val)) val = fi;
          if (nonNeg && val < 0) val = 0;
  
          next[i] = val;
        }
      } else if (mode === "additive") {
        for (let i = 0; i < next.length; i++) {
          const fi = f[i];
          const r = blurred[i] - ref[i];
  
          let val = fi - lambda * r;
  
          if (!Number.isFinite(val)) val = fi;
          if (nonNeg && val < 0) val = 0;
  
          next[i] = val;
        }
      } else {
        throw new Error("Unknown mode: " + mode);
      }
  
      f = next;
    }
  
    if (shift !== 0) {
      for (let i = 0; i < f.length; i++) {
        f[i] -= shift;
      }
    }
  
    return fromFlat(f, w, h, as2D);
  }
  
  class LR extends FilterNode {
    constructor() {
      super();
  
      this.title = "LR";
      this.icon =
        "data:image/svg+xml;base64," +
        btoa(
          `<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#007acc" stroke-width="2" width="25" height="25" viewBox="0 0 25 25" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/></svg>`
        );
  
      // --- параметры ядра ---
      this.properties.kernelType = "gauss"; // "gauss" | "lorentz"
      this.properties.sigmaX = 12;
      this.properties.sigmaY = 12;
      this.properties.lorentzR = 7;
      this.properties.stupidity = 1;
  
      // --- параметры алгоритма ---
      this.properties.iterations = 1;
      this.properties.lambda = 0.5;
      this.properties.mode = "multiplicative";
  
      // --- виджеты ---
      this.addWidget(
        "combo",
        "Ядро",
        this.properties.kernelType,
        v => {
          this.properties.kernelType = v;
        },
        {
          property: "kernelType",
          values: ["gauss", "lorentz"]
        }
      );
  
      this.addWidget(
        "number",
        "σX",
        this.properties.sigmaX,
        v => {
          this.properties.sigmaX = Number(v);
        },
        { property: "sigmaX", min: 0.1, max: 100, step: 0.5, precision: 1 }
      );
  
      this.addWidget(
        "number",
        "σY",
        this.properties.sigmaY,
        v => {
          this.properties.sigmaY = Number(v);
        },
        { property: "sigmaY", min: 0.1, max: 100, step: 0.5, precision: 1 }
      );
  
      this.addWidget(
        "number",
        "R (Лоренц)",
        this.properties.lorentzR,
        v => {
          this.properties.lorentzR = Number(v);
        },
        { property: "lorentzR", min: 0.1, max: 1000, step: 1, precision: 1 }
      );
  
      this.addWidget(
        "number",
        "Степень",
        this.properties.stupidity,
        v => {
          this.properties.stupidity = Number(v);
        },
        { property: "stupidity", min: 0.1, max: 10, step: 0.1, precision: 2 }
      );
  
      this.addWidget(
        "number",
        "Итерации",
        this.properties.iterations,
        v => {
          this.properties.iterations = Number(v);
        },
        { property: "iterations", min: 1, max: 1000, step: 1, precision: 0 }
      );
  
      this.addWidget(
        "number",
        "Коэф-т сходимости",
        this.properties.lambda,
        v => {
          this.properties.lambda = Number(v);
        },
        { property: "lambda", min: 0.01, max: 10, step: 0.05, precision: 2 }
      );
  
      this.addWidget(
        "select",
        "Режим",
        this.properties.mode,
        v => {
          this.properties.mode = v;
        },
        {
          property: "mode",
          options: {
            multiplicative: "Мультиплик.",
            additive: "Аддитивный"
          }
        }
      );
  
      this.size = [250, 280];
      this.resizable = false;
    }
  
    onExecute() {
      const inputData = this.getInputData(0);
  
      if (!inputData || !inputData.data || inputData.data.length === 0) {
        console.error("LR: нет входных данных");
        return;
      }
  
      const h = Number(inputData.height);
      const w = Number(inputData.width);
  
      if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0 || w <= 0) {
        console.error("LR: некорректные размеры", h, w);
        return;
      }
  
      const data = inputData.data;
      const is2D = is2DArray(data, w, h);
  
      if (!is2D && data.length !== w * h) {
        console.error("LR: размер входных данных не совпадает с width/height");
        return;
      }
  
      const key = [
        this.properties.kernelType,
        this.properties.sigmaX,
        this.properties.sigmaY,
        this.properties.lorentzR,
        this.properties.stupidity,
        w,
        h
      ].join("|");
  
      if (!this._kernelCache || this._kernelCache.key !== key) {
        let kernel;
  
        // if (this.properties.kernelType === "gauss") {
          kernel = makeGaussianKernel(
            this.properties.sigmaX,
            this.properties.sigmaY
          );
        // } else {
        //   kernel = makeLorentzKernel(
        //     this.properties.lorentzR,
        //     this.properties.stupidity,
        //     w,
        //     h
        //   );
        // }
  
        this._kernelCache = { key, kernel };
      }
  
      const result = lucyRichardson(data, this._kernelCache.kernel, {
        width: w,
        height: h,
        iterations: this.properties.iterations,
        lambda: this.properties.lambda,
        mode: this.properties.mode,
        padding: "reflect",
        nonNegative: false,
  
        // Если нужно сохранить старое поведение из активного кода:
        // compareWith: "current"
        compareWith: "observed"
      });
  
      this.setOutputData(0, {
        dpi: inputData.dpi,
        width: w,
        height: h,
        data: result,
        minValue: inputData.minValue,
        maxValue: inputData.maxValue,
        autoscale: inputData.autoscale,
        colormap: inputData.colormap,
        filename: inputData.filename,
        format: inputData.format
      });
    }
  }
  
  LiteGraph.registerNodeType("filter/LR", LR);
  