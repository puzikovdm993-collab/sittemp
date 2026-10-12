

// ═══════════════════════════════════════
// 1. Гауссово ядро
// ═══════════════════════════════════════
function makeGaussianKernel(sx, sy, r) {
    const size = 2 * r + 1;
    const k = [];
    let sum = 0;
    for (let y = -r; y <= r; y++) {
        const row = [];
        for (let x = -r; x <= r; x++) {
            const v = Math.exp(
                -(x * x) / (2 * sx * sx) -
                -(y * y) / (2 * sy * sy)
            );
            row.push(v);
            sum += v;
        }
        k.push(row);
    }
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
            k[y][x] /= sum;
    return k;
}

// ═══════════════════════════════════════
// 2. Свёртка (zero padding)
// ═══════════════════════════════════════
function convolve2D(img, kern) {
    const h = img.length, w = img[0].length;
    const kh = kern.length, kw = kern[0].length;
    const oy = Math.floor(kh / 2), ox = Math.floor(kw / 2);
    const out = Array.from({ length: h }, () => Array(w).fill(0));

    const get = (y, x) =>
        (y >= 0 && y < h && x >= 0 && x < w) ? img[y][x] : 0;

    for (let i = 0; i < h; i++)
        for (let j = 0; j < w; j++) {
            let s = 0;
            for (let ky = 0; ky < kh; ky++)
                for (let kx = 0; kx < kw; kx++)
                    s += get(i + ky - oy, j + kx - ox) * kern[ky][kx];
            out[i][j] = s;
        }
    return out;
}

// ═══════════════════════════════════════
// 3. Генерация размытого наблюдения
//    O = K * I + N
// ═══════════════════════════════════════
function generateObservation(sharp, kernel, noiseSigma = 0) {
    const blurred = convolve2D(sharp, kernel);
    if (noiseSigma <= 0) return blurred;

    // Боксовский шум (простой, без внешних библиотек)
    return blurred.map(row =>
        row.map(v => v + (Math.random() * 2 - 1) * noiseSigma)
    );
}

// ═══════════════════════════════════════
// 4. Lucy–Richardson
// ═══════════════════════════════════════
function lucyRichardson(observed, kernel, iters, lambda, eps) {
    let est = observed.map(r => r.map(v => Math.max(v, eps)));

    for (let it = 0; it < iters; it++) {
        const blurred  = convolve2D(est, kernel);
        const ratio    = observed.map((r, i) =>
            r.map((v, j) => v / Math.max(blurred[i][j], eps))
        );
        const correct  = convolve2D(ratio, kernel); // K^T = K для гаусса

        est = est.map((r, i) =>
            r.map((v, j) =>
                v * Math.pow(Math.max(correct[i][j], 0), lambda)
            )
        );
    }
    return est;
}

// ═══════════════════════════════════════
// 5. Нормировка к [0, 1]
// ═══════════════════════════════════════
function normalize(img) {
    const m = Math.max(...img.flat());
    if (m <= 0) return img;
    return img.map(r => r.map(v => v / m));
}

// ═══════════════════════════════════════
// 6. Печать
// ═══════════════════════════════════════
function printMatrix(title, mat) {
    console.log(`\n${title}`);
    mat.forEach(row =>
        console.log(row.map(v => v.toFixed(4).padStart(8)).join(''))
    );
}

  class gausse extends FilterNode {
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

      // ─── Исходное (резкое) изображение ───
const original = [
    [0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 3, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0]
];

// ─── Параметры гауссова ядра ───
const sigmaX = 12.0;
const sigmaY = 12.0;
const radius = 200;          // ядро (2*radius+1)² = 5×5

// ─── Параметры RL-восстановления ───
const iterations  = 1;
const convergence = 1.0;
const eps         = 1e-6;

// ─── Параметры шума (опционально) ───
const noiseSigma = 0.0;    // 0 = без шума

const kernel = makeGaussianKernel(sigmaX, sigmaY, radius);
const restored = lucyRichardson(inputData.data, kernel, iterations, convergence, eps);

// // Нормировка к максимуму 1.
// // Если нужно сохранить исходный масштаб, удалите normalizeToMax.
// const result = normalizeToMax(restored, 1).map(row =>
//     row.map(v => Number(v.toFixed(3)))
// );

// console.log(JSON.stringify(restored, null, 2));
console.log(restored[10][10])
        // Формируем выходные данные
        const outputData = {
            dpi:        inputData.dpi,
            width:      inputData.width,
            height:     inputData.height,
            data:       restored,
            minValue:   inputData.minValue,
            maxValue:   inputData.maxValue,
            autoscale:  inputData.autoscale,
            colormap:   inputData.colormap,
            filename:   inputData.filename,
            format:     inputData.format
        };
        this.setOutputData(0, outputData);

    }
  }
  
  LiteGraph.registerNodeType("filter/gausse", gausse);
  
