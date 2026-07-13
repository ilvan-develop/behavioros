// ============================================================
// FinPay Integration Types
// ============================================================

export interface FinPayConfig {
  apiKey: string;
  baseUrl: string;
  webhookSecret: string;
  environment: 'sandbox' | 'production';
}

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'disputed';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  customerId: string;
  metadata: Record<string, unknown>;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export type EvidenceType = 'prescription' | 'receipt' | 'delivery_proof' | 'photo' | 'document';

export interface PaymentEvidence {
  id: string;
  paymentId: string;
  type: EvidenceType;
  fileUrl: string;
  ocrResult: OCRResult | null;
  trustScore: number;
  uploadedAt: string;
}

export interface OCRResult {
  text: string;
  confidence: number;
  fields: Record<string, string>;
  extractedAt: string;
}

export type FraudSignalType = 'duplicate_hash' | 'amount_mismatch' | 'velocity' | 'gps_anomaly';

export interface FraudSignal {
  type: FraudSignalType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
  detectedAt: string;
}

export interface TrustScoreDecision {
  decision: 'approve' | 'reject' | 'manual_review';
  score: number;
  factors: string[];
  confidence: number;
}

export interface ComplianceResult {
  passed: boolean;
  violations: string[];
  warnings: string[];
  score: number;
}

export type ValidationStatus =
  | 'pending'
  | 'ocr_complete'
  | 'compliance_complete'
  | 'fraud_complete'
  | 'trust_scored'
  | 'reconciled'
  | 'failed';

export interface ValidationPipelineResult {
  paymentId: string;
  status: ValidationStatus;
  trustScore: TrustScoreDecision;
  fraudSignals: FraudSignal[];
  complianceResult: ComplianceResult;
  recommendation: 'approve' | 'reject' | 'manual_review';
  completedAt: string | null;
}

export type ReconciliationType = 'payment' | 'refund' | 'settlement' | 'adjustment';

export interface ReconciliationEntry {
  id: string;
  paymentId: string;
  type: ReconciliationType;
  amount: number;
  timestamp: string;
  ledger: string;
}

export interface RefundResult {
  id: string;
  paymentId: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  reason: string;
  processedAt: string;
}

// --- Brocolis Marketplace Types ---

export type OrderStatus = 'created' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface BrocolisOrder {
  id: string;
  pharmacyId: string;
  items: BrocolisOrderItem[];
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  customerId: string;
  prescriptionId?: string;
  createdAt: string;
}

export interface BrocolisOrderItem {
  id: string;
  medicationName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export type PaymentMethod = 'credit_card' | 'debit_card' | 'pix' | 'bank_transfer' | 'insurance';

export interface PaymentResult {
  orderId: string;
  paymentIntent: PaymentIntent;
  validation: ValidationPipelineResult;
  success: boolean;
  error?: string;
}

export interface VerificationResult {
  prescriptionId: string;
  verified: boolean;
  paymentRequired: boolean;
  paymentIntent?: PaymentIntent;
  authenticityScore: number;
  warnings: string[];
}

export interface DeliveryPaymentResult {
  deliveryId: string;
  driverId: string;
  paymentIntent: PaymentIntent;
  splitPayments: SplitPayment[];
  success: boolean;
}

export interface SplitPayment {
  pharmacyId: string;
  amount: number;
  paymentIntentId: string;
}

export interface Invoice {
  id: string;
  orderId: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  issuedAt: string;
  dueAt: string;
  pdfUrl: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SettlementReport {
  period: { start: string; end: string };
  pharmacyId: string;
  totalTransactions: number;
  totalAmount: number;
  totalFees: number;
  netSettlement: number;
  entries: ReconciliationEntry[];
  generatedAt: string;
}

// --- AI Health Assistant Types ---

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
}

export interface InteractionResult {
  safe: boolean;
  interactions: MedicationInteraction[];
  severity: 'none' | 'mild' | 'moderate' | 'severe' | 'critical';
  recommendations: string[];
}

export interface MedicationInteraction {
  medication1: string;
  medication2: string;
  severity: 'mild' | 'moderate' | 'severe' | 'critical';
  description: string;
  recommendation: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  doctorId: string;
  medications: Medication[];
  issuedAt: string;
  expiresAt: string;
  digitalSignature: string;
  pdfUrl: string;
}

export interface AuthenticityResult {
  authentic: boolean;
  confidence: number;
  checks: AuthenticityCheck[];
  verifiedAt: string;
}

export interface AuthenticityCheck {
  name: string;
  passed: boolean;
  details: string;
}

export interface RiskAssessment {
  paymentId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  factors: RiskFactor[];
  recommendation: string;
}

export interface RiskFactor {
  type: string;
  weight: number;
  value: number;
  description: string;
}

export interface PatientProfile {
  id: string;
  age: number;
  medications: Medication[];
  allergies: string[];
  conditions: string[];
  insuranceProvider?: string;
}

export interface Recommendation {
  id: string;
  type: 'medication' | 'lifestyle' | 'follow_up' | 'warning';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  source: string;
}

export interface FraudDetection {
  prescriptionId: string;
  fraudulent: boolean;
  confidence: number;
  signals: FraudSignal[];
  trustScore: TrustScoreDecision;
  detectedAt: string;
}
