import fs from "fs";
import path from "path";

export interface TrainingMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  lossHistory: number[];
  weights: Record<string, number>;
  bias: number;
  sampleCount: number;
  epochs: number;
}

export interface PredictionResult {
  probability: number;
  burnoutRisk: number; // 0 or 1
  riskLevel: string; // "Low Risk", "Medium Risk", "High Risk"
}

// 17 Selected features to match dataset fields
export const FEATURE_NAMES = [
  "Age",
  "YearsAtCompany",
  "WorkHoursPerWeek",
  "RemoteWork", // No=0, Hybrid=0.5, Yes=1
  "JobSatisfaction",
  "StressLevel",
  "ProductivityScore",
  "SleepHours",
  "PhysicalActivityHrs",
  "CommuteTime",
  "HasMentalHealthSupport", // No=0, Yes=1
  "ManagerSupportScore",
  "HasTherapyAccess", // No=0, Yes=1
  "MentalHealthDaysOff",
  "WorkLifeBalanceScore",
  "TeamSize",
  "CareerGrowthScore"
];

export class BurnoutMLModel {
  private weights: number[] = [];
  private bias: number = 0;
  private means: number[] = [];
  private stds: number[] = [];
  private isTrained: boolean = false;

  constructor() {
    this.weights = new Array(FEATURE_NAMES.length).fill(0);
  }

  /**
   * Helper to parse the CSV dataset
   */
  private parseCSV(filePath: string): { X: number[][]; y: number[] } {
    const rawContent = fs.readFileSync(filePath, "utf-8");
    const lines = rawContent.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    
    if (lines.length <= 1) {
      throw new Error("CSV dataset is empty or invalid");
    }

    const headers = lines[0].split(",");
    
    // Create headers index map for alignment
    const headerIndices: Record<string, number> = {};
    headers.forEach((h, i) => {
      headerIndices[h.trim()] = i;
    });

    const X: number[][] = [];
    const y: number[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(",");
      if (row.length < headers.length) continue;

      const getVal = (colName: string): string => {
        const idx = headerIndices[colName];
        return idx !== undefined ? row[idx].trim() : "";
      };

      // Extract numerical and standardized categorical values
      const age = parseFloat(getVal("Age")) || 35;
      const years = parseFloat(getVal("YearsAtCompany")) || 5;
      const workHours = parseFloat(getVal("WorkHoursPerWeek")) || 40;
      
      const remoteStr = getVal("RemoteWork").toLowerCase();
      const remote = remoteStr === "yes" ? 1.0 : (remoteStr === "hybrid" ? 0.5 : 0.0);

      const satisfaction = parseFloat(getVal("JobSatisfaction")) || 5.0;
      const stress = parseFloat(getVal("StressLevel")) || 5.0;
      const productivity = parseFloat(getVal("ProductivityScore")) || 5.0;
      const sleep = parseFloat(getVal("SleepHours")) || 7.0;
      const physical = parseFloat(getVal("PhysicalActivityHrs")) || 3.0;
      const commute = parseFloat(getVal("CommuteTime")) || 30;

      const supportStr = getVal("HasMentalHealthSupport").toLowerCase();
      const support = supportStr === "yes" ? 1.0 : 0.0;

      const manager = parseFloat(getVal("ManagerSupportScore")) || 5.0;

      const therapyStr = getVal("HasTherapyAccess").toLowerCase();
      const therapy = therapyStr === "yes" ? 1.0 : 0.0;

      const daysOff = parseFloat(getVal("MentalHealthDaysOff")) || 2;
      const wlb = parseFloat(getVal("WorkLifeBalanceScore")) || 5.0;
      const teamSize = parseFloat(getVal("TeamSize")) || 5;
      const careerGrowth = parseFloat(getVal("CareerGrowthScore")) || 5.0;

      const risk = parseInt(getVal("BurnoutRisk"), 10) === 1 ? 1 : 0;

      const features = [
        age,
        years,
        workHours,
        remote,
        satisfaction,
        stress,
        productivity,
        sleep,
        physical,
        commute,
        support,
        manager,
        therapy,
        daysOff,
        wlb,
        teamSize,
        careerGrowth
      ];

      X.push(features);
      y.push(risk);
    }

    return { X, y };
  }

  /**
   * Z-Score Normalization
   */
  private normalizeAndScale(X: number[][]): number[][] {
    const numSamples = X.length;
    const numFeatures = FEATURE_NAMES.length;

    this.means = new Array(numFeatures).fill(0);
    this.stds = new Array(numFeatures).fill(0);

    // Compute means
    for (let j = 0; j < numFeatures; j++) {
      let sum = 0;
      for (let i = 0; i < numSamples; i++) {
        sum += X[i][j];
      }
      this.means[j] = sum / numSamples;
    }

    // Compute standard deviations
    for (let j = 0; j < numFeatures; j++) {
      let sumSqDiff = 0;
      for (let i = 0; i < numSamples; i++) {
        sumSqDiff += Math.pow(X[i][j] - this.means[j], 2);
      }
      this.stds[j] = Math.sqrt(sumSqDiff / numSamples) || 1e-5; // Prevent division by zero
    }

    // Normalize X
    return X.map(row => 
      row.map((val, j) => (val - this.means[j]) / this.stds[j])
    );
  }

  /**
   * Sigmoid Activation
   */
  private sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-z));
  }

  /**
   * Train Logistic Regression Model
   */
  public trainModel(learningRate: number = 0.05, epochs: number = 600): TrainingMetrics {
    const csvPath = path.join(process.cwd(), "server", "employee_burnout.csv");
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Training dataset not found at ${csvPath}`);
    }

    const { X, y } = this.parseCSV(csvPath);
    const scaledX = this.normalizeAndScale(X);
    const numSamples = scaledX.length;
    const numFeatures = FEATURE_NAMES.length;

    // Reset weights and bias
    this.weights = new Array(numFeatures).fill(0);
    this.bias = 0;

    const lossHistory: number[] = [];

    // Gradient descent loop
    for (let epoch = 0; epoch < epochs; epoch++) {
      let dw = new Array(numFeatures).fill(0);
      let db = 0;
      let totalLoss = 0;

      for (let i = 0; i < numSamples; i++) {
        const linearModel = scaledX[i].reduce((sum, val, idx) => sum + val * this.weights[idx], 0) + this.bias;
        const yPred = this.sigmoid(linearModel);
        
        // Binary cross-entropy loss computation
        const loss = - (y[i] * Math.log(yPred + 1e-15) + (1 - y[i]) * Math.log(1 - yPred + 1e-15));
        totalLoss += loss;

        const error = yPred - y[i];

        // Sum gradients
        for (let j = 0; j < numFeatures; j++) {
          dw[j] += error * scaledX[i][j];
        }
        db += error;
      }

      // Update weights and bias
      for (let j = 0; j < numFeatures; j++) {
        this.weights[j] -= learningRate * (dw[j] / numSamples);
      }
      this.bias -= learningRate * (db / numSamples);

      // Save loss metrics at intervals
      if (epoch % Math.max(1, Math.floor(epochs / 10)) === 0 || epoch === epochs - 1) {
        lossHistory.push(parseFloat((totalLoss / numSamples).toFixed(4)));
      }
    }

    // Compute evaluation metrics
    let truePos = 0;
    let trueNeg = 0;
    let falsePos = 0;
    let falseNeg = 0;

    for (let i = 0; i < numSamples; i++) {
      const pred = this.predictRowRaw(X[i]);
      const binaryPred = pred >= 0.5 ? 1 : 0;

      if (binaryPred === 1 && y[i] === 1) truePos++;
      else if (binaryPred === 0 && y[i] === 0) trueNeg++;
      else if (binaryPred === 1 && y[i] === 0) falsePos++;
      else if (binaryPred === 0 && y[i] === 1) falseNeg++;
    }

    const accuracy = (truePos + trueNeg) / numSamples;
    const precision = truePos / (truePos + falsePos) || 0;
    const recall = truePos / (truePos + falseNeg) || 0;
    const f1Score = (2 * precision * recall) / (precision + recall) || 0;

    this.isTrained = true;

    // Map weights to features for transparent interpretation
    const weightMap: Record<string, number> = {};
    FEATURE_NAMES.forEach((name, idx) => {
      weightMap[name] = parseFloat(this.weights[idx].toFixed(4));
    });

    return {
      accuracy: parseFloat(accuracy.toFixed(4)),
      precision: parseFloat(precision.toFixed(4)),
      recall: parseFloat(recall.toFixed(4)),
      f1Score: parseFloat(f1Score.toFixed(4)),
      lossHistory,
      weights: weightMap,
      bias: parseFloat(this.bias.toFixed(4)),
      sampleCount: numSamples,
      epochs
    };
  }

  /**
   * Internal raw predict
   */
  private predictRaw(X_row: number[]): number {
    // Standardize input row using global weights and bias
    const scaledRow = X_row.map((val, idx) => val); 
    const linearModel = scaledRow.reduce((sum, val, idx) => sum + val * this.weights[idx], 0) + this.bias;
    return this.sigmoid(linearModel);
  }

  /**
   * Public prediction API
   */
  public predictRowRaw(row: number[]): number {
    if (this.means.length === 0 || this.stds.length === 0) {
      return 0.5; // fallback neutral
    }
    // Scale features using the trained means and std deviations
    const scaledRow = row.map((val, j) => (val - this.means[j]) / this.stds[j]);
    const linearModel = scaledRow.reduce((sum, val, idx) => sum + val * this.weights[idx], 0) + this.bias;
    return this.sigmoid(linearModel);
  }

  /**
   * Run custom input parameters predict
   */
  public predict(inputs: Record<string, number>): PredictionResult {
    if (!this.isTrained) {
      // Force quick baseline training on setup
      this.trainModel();
    }

    // Convert inputs dict to index-aligned array
    const row: number[] = FEATURE_NAMES.map((name, idx) => {
      return inputs[name] !== undefined ? inputs[name] : this.means[idx];
    });

    const probability = this.predictRowRaw(row);
    const burnoutRisk = probability >= 0.5 ? 1 : 0;
    
    let riskLevel = "Low Risk";
    if (probability >= 0.75) {
      riskLevel = "High Risk";
    } else if (probability >= 0.45) {
      riskLevel = "Moderate Risk";
    }

    return {
      probability: parseFloat(probability.toFixed(4)),
      burnoutRisk,
      riskLevel
    };
  }
}

// Persistent model singleton instance
export const globalBurnoutModel = new BurnoutMLModel();
