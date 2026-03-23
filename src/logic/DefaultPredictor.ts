// ═══════════════════════════════════════════════════════════════
// src/logic/DefaultPredictor.ts — ML Model for Default Prediction
// Galactica Lending Bot | Hackathon 2026
// ═══════════════════════════════════════════════════════════════
//
// Bonus Feature: Machine learning model that predicts the probability
// of loan default based on historical data and borrower characteristics.
//
// Uses a simple logistic regression model trained on historical loan data.
// ═══════════════════════════════════════════════════════════════

import { LocalStore } from '@/db/LocalStore';
import { CreditProfile } from '@/types';
import Logger from '@/utils/logger';

interface TrainingData {
  creditScore: number;
  loanAmount: number;
  apr: number;
  durationDays: number;
  btcBalance: number;
  txCount: number;
  accountAgeMonths: number;
  tapTokensValue: number;
  defaulted: boolean;
}

interface ModelWeights {
  creditScore: number;
  loanAmount: number;
  apr: number;
  durationDays: number;
  btcBalance: number;
  txCount: number;
  accountAgeMonths: number;
  tapTokensValue: number;
  intercept: number;
}

export class DefaultPredictor {
  private static model: ModelWeights | null = null;

  /**
   * Predict the probability of default for a loan application.
   */
  static async predictDefaultProbability(
    creditProfile: CreditProfile,
    loanAmount: number,
    apr: number,
    durationDays: number
  ): Promise<number> {
    // Ensure model is trained
    if (!this.model) {
      await this.trainModel();
    }

    if (!this.model) {
      // Fallback to rule-based estimation
      return this.ruleBasedPrediction(creditProfile, loanAmount, apr, durationDays);
    }

    // Normalize features
    const features = this.extractFeatures(creditProfile, loanAmount, apr, durationDays);

    // Calculate logit
    const logit = this.model.intercept +
      this.model.creditScore * features.creditScore +
      this.model.loanAmount * features.loanAmount +
      this.model.apr * features.apr +
      this.model.durationDays * features.durationDays +
      this.model.btcBalance * features.btcBalance +
      this.model.txCount * features.txCount +
      this.model.accountAgeMonths * features.accountAgeMonths +
      this.model.tapTokensValue * features.tapTokensValue;

    // Convert to probability using sigmoid
    const probability = 1 / (1 + Math.exp(-logit));

    Logger.info('[DefaultPredictor] ML prediction', {
      probability: (probability * 100).toFixed(2) + '%',
      features,
    });

    return probability;
  }

  /**
   * Train the logistic regression model on historical data.
   */
  private static async trainModel(): Promise<void> {
    try {
      const historicalData = await this.getTrainingData();

      if (historicalData.length < 10) {
        Logger.warn('[DefaultPredictor] Insufficient training data, using rule-based prediction');
        return;
      }

      // Simple gradient descent training
      this.model = this.trainLogisticRegression(historicalData);

      Logger.success('[DefaultPredictor] Model trained', {
        trainingSamples: historicalData.length,
        weights: this.model,
      });

    } catch (err) {
      Logger.error('[DefaultPredictor] Failed to train model', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Get historical loan data for training.
   */
  private static async getTrainingData(): Promise<TrainingData[]> {
    const allLoans = await LocalStore.getAllLoans();
    const trainingData: TrainingData[] = [];

    for (const loan of allLoans) {
      // Skip loans that are still active
      if (loan.status === 'ACTIVE') continue;

      // Get credit profile at time of loan (this is simplified)
      const creditScore = loan.creditScore;
      const defaulted = loan.status === 'DEFAULTED';

      trainingData.push({
        creditScore,
        loanAmount: loan.amount,
        apr: loan.aprPercent,
        durationDays: loan.durationDays,
        btcBalance: 0, // Would need historical data
        txCount: 0,    // Would need historical data
        accountAgeMonths: 0, // Would need historical data
        tapTokensValue: 0,   // Would need historical data
        defaulted,
      });
    }

    return trainingData;
  }

  /**
   * Simple logistic regression training using gradient descent.
   */
  private static trainLogisticRegression(data: TrainingData[]): ModelWeights {
    // Initialize weights
    const weights: ModelWeights = {
      creditScore: 0,
      loanAmount: 0,
      apr: 0,
      durationDays: 0,
      btcBalance: 0,
      txCount: 0,
      accountAgeMonths: 0,
      tapTokensValue: 0,
      intercept: 0,
    };

    const learningRate = 0.01;
    const epochs = 100;

    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0;

      for (const sample of data) {
        const features = this.extractFeaturesFromSample(sample);
        const prediction = this.sigmoid(this.dotProduct(weights, features));
        const error = prediction - (sample.defaulted ? 1 : 0);

        // Update weights
        weights.intercept -= learningRate * error;
        weights.creditScore -= learningRate * error * features.creditScore;
        weights.loanAmount -= learningRate * error * features.loanAmount;
        weights.apr -= learningRate * error * features.apr;
        weights.durationDays -= learningRate * error * features.durationDays;
        weights.btcBalance -= learningRate * error * features.btcBalance;
        weights.txCount -= learningRate * error * features.txCount;
        weights.accountAgeMonths -= learningRate * error * features.accountAgeMonths;
        weights.tapTokensValue -= learningRate * error * features.tapTokensValue;

        totalLoss += error * error;
      }

      if (epoch % 20 === 0) {
        Logger.info(`[DefaultPredictor] Training epoch ${epoch}, loss: ${totalLoss}`);
      }
    }

    return weights;
  }

  /**
   * Rule-based fallback prediction.
   */
  private static ruleBasedPrediction(
    creditProfile: CreditProfile,
    loanAmount: number,
    apr: number,
    durationDays: number
  ): number {
    let riskScore = 0;

    // Credit score factor
    if (creditProfile.score < 40) riskScore += 0.8;
    else if (creditProfile.score < 60) riskScore += 0.4;
    else if (creditProfile.score < 80) riskScore += 0.2;

    // Loan amount factor (relative to max eligible)
    const amountRatio = loanAmount / creditProfile.maxLoanUSDt;
    if (amountRatio > 0.8) riskScore += 0.3;
    else if (amountRatio > 0.5) riskScore += 0.1;

    // APR factor
    if (apr > 25) riskScore += 0.2;
    else if (apr > 15) riskScore += 0.1;

    // Duration factor
    if (durationDays > 60) riskScore += 0.2;
    else if (durationDays > 30) riskScore += 0.1;

    // Reputation factor
    const reputationSignals = creditProfile.breakdown.reputationBonus;
    if (reputationSignals < -5) riskScore += 0.3;
    else if (reputationSignals < 0) riskScore += 0.1;

    const probability = Math.min(0.95, Math.max(0.01, riskScore));

    Logger.info('[DefaultPredictor] Rule-based prediction', {
      probability: (probability * 100).toFixed(2) + '%',
      riskScore,
    });

    return probability;
  }

  /**
   * Extract features from credit profile and loan details.
   */
  private static extractFeatures(
    creditProfile: CreditProfile,
    loanAmount: number,
    apr: number,
    durationDays: number
  ): Record<keyof ModelWeights, number> {
    return {
      creditScore: creditProfile.score / 100, // Normalize to 0-1
      loanAmount: loanAmount / 10000, // Normalize by $10k
      apr: apr / 100, // Convert percentage to decimal
      durationDays: durationDays / 30, // Normalize by months
      btcBalance: 0, // Would need from Intercom profile
      txCount: 0,    // Would need from Intercom profile
      accountAgeMonths: 0, // Would need from Intercom profile
      tapTokensValue: 0,   // Would need from Intercom profile
      intercept: 1,
    };
  }

  /**
   * Extract features from training sample.
   */
  private static extractFeaturesFromSample(sample: TrainingData): Record<keyof ModelWeights, number> {
    return {
      creditScore: sample.creditScore / 100,
      loanAmount: sample.loanAmount / 10000,
      apr: sample.apr / 100,
      durationDays: sample.durationDays / 30,
      btcBalance: sample.btcBalance / 10000, // Normalize BTC balance
      txCount: sample.txCount / 1000, // Normalize tx count
      accountAgeMonths: sample.accountAgeMonths / 12, // Normalize to years
      tapTokensValue: sample.tapTokensValue / 1000, // Normalize TAP value
      intercept: 1,
    };
  }

  private static sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private static dotProduct(weights: ModelWeights, features: Record<keyof ModelWeights, number>): number {
    return weights.intercept * features.intercept +
           weights.creditScore * features.creditScore +
           weights.loanAmount * features.loanAmount +
           weights.apr * features.apr +
           weights.durationDays * features.durationDays +
           weights.btcBalance * features.btcBalance +
           weights.txCount * features.txCount +
           weights.accountAgeMonths * features.accountAgeMonths +
           weights.tapTokensValue * features.tapTokensValue;
  }
}

export default DefaultPredictor;