export const TEST_USERS = {
  customer: {
    id: 'user-customer-001',
    email: 'maria.silva@example.com',
    password: 'Test@123456',
    name: 'Maria Silva',
    cpf: '529.982.247-25',
    phone: '+55 11 99999-8888',
    address: {
      street: 'Rua Augusta, 1500',
      neighborhood: 'Consolação',
      city: 'São Paulo',
      state: 'SP',
      zip: '01304-001',
    },
  },
  pharmacyAdmin: {
    id: 'user-pharmacy-001',
    email: 'admin@drogamais.com.br',
    password: 'Admin@123456',
    name: 'Carlos Oliveira',
    pharmacyId: 'pharmacy-drogamais-001',
    pharmacyName: 'DrogaMais',
  },
  pharmacyStaff: {
    id: 'user-pharmacy-002',
    email: 'staff@drogamais.com.br',
    password: 'Staff@123456',
    name: 'Ana Costa',
    pharmacyId: 'pharmacy-drogamais-001',
    role: 'pharmacist',
  },
  superAdmin: {
    id: 'user-admin-001',
    email: 'admin@brocolis.io',
    password: 'Super@123456',
    name: 'Admin Brocolis',
    role: 'super_admin',
  },
} as const;

export const TEST_PHARMACIES = [
  {
    id: 'pharmacy-drogamais-001',
    name: 'DrogaMais',
    cnpj: '11.222.333/0001-81',
    address: {
      street: 'Av. Paulista, 1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      zip: '01310-100',
    },
    license: 'AFE-12345-SP',
    status: 'active' as const,
    commissionRate: 0.12,
    features: ['prescription_upload', 'delivery', 'telemedicine'],
  },
  {
    id: 'pharmacy-farmabem-002',
    name: 'FarmaBem',
    cnpj: '22.333.444/0001-92',
    address: {
      street: 'Rua Oscar Freire, 500',
      neighborhood: 'Jardins',
      city: 'São Paulo',
      state: 'SP',
      zip: '01426-001',
    },
    license: 'AFE-67890-SP',
    status: 'active' as const,
    commissionRate: 0.1,
    features: ['prescription_upload', 'delivery'],
  },
  {
    id: 'pharmacy-saudefacil-003',
    name: 'SaúdeFácil',
    cnpj: '33.444.555/0001-03',
    address: {
      street: 'Rua Vergueiro, 2000',
      neighborhood: 'Vila Mariana',
      city: 'São Paulo',
      state: 'SP',
      zip: '04101-000',
    },
    license: 'AFE-11111-SP',
    status: 'pending' as const,
    commissionRate: 0.08,
    features: ['delivery'],
  },
];

export const TEST_PRODUCTS = [
  {
    id: 'prod-losartana-001',
    name: 'Losartana Potássica 50mg',
    ean: '7891234560010',
    category: 'cardiovascular',
    price: 29.9,
    requiresPrescription: true,
    activeIngredient: 'Losartana Potássica',
    manufacturer: 'EMS',
    stock: {
      'pharmacy-drogamais-001': 150,
      'pharmacy-farmabem-002': 80,
    },
  },
  {
    id: 'prod-omeprazol-002',
    name: 'Omeprazol 20mg',
    ean: '7891234560027',
    category: 'gastrointestinal',
    price: 15.5,
    requiresPrescription: false,
    activeIngredient: 'Omeprazol',
    manufacturer: 'Medley',
    stock: {
      'pharmacy-drogamais-001': 200,
      'pharmacy-farmabem-002': 120,
      'pharmacy-saudefacil-003': 90,
    },
  },
  {
    id: 'prod-amoxicilina-003',
    name: 'Amoxicilina 500mg',
    ean: '7891234560034',
    category: 'antibiotics',
    price: 24.9,
    requiresPrescription: true,
    activeIngredient: 'Amoxicilina',
    manufacturer: 'Eurofarma',
    stock: {
      'pharmacy-drogamais-001': 100,
      'pharmacy-farmabem-002': 60,
    },
  },
  {
    id: 'prod-vitaminac-004',
    name: 'Vitamina C 1g Efervescente',
    ean: '7891234560041',
    category: 'vitamins',
    price: 12.9,
    requiresPrescription: false,
    activeIngredient: 'Ácido Ascórbico',
    manufacturer: 'Nestlé',
    stock: {
      'pharmacy-drogamais-001': 300,
      'pharmacy-farmabem-002': 200,
      'pharmacy-saudefacil-003': 150,
    },
  },
  {
    id: 'prod-metformina-005',
    name: 'Metformina 850mg',
    ean: '7891234560058',
    category: 'diabetes',
    price: 18.9,
    requiresPrescription: true,
    activeIngredient: 'Cloridrato de Metformina',
    manufacturer: 'Merck',
    stock: {
      'pharmacy-drogamais-001': 180,
      'pharmacy-farmabem-002': 90,
    },
  },
];

export const TEST_PRESCRIPTIONS = {
  valid: {
    id: 'rx-valid-001',
    patientName: 'Maria Silva',
    patientCpf: '529.982.247-25',
    doctorName: 'Dr. Roberto Almeida',
    doctorCRM: 'CRM-SP 123456',
    issueDate: '2026-07-10',
    expiryDate: '2026-10-10',
    medications: [
      { productId: 'prod-losartana-001', dosage: '1 comprimido ao dia', quantity: 30 },
      { productId: 'prod-metformina-005', dosage: '2 comprimidos ao dia', quantity: 60 },
    ],
    digitalSignature: 'sig_abc123def456',
    imageUrl: 'https://storage.brocolis.io/prescriptions/rx-valid-001.jpg',
    ocrText: `Paciente: Maria Silva\nMedicação: Losartana Potássica 50mg\nPosologia: 1 comprimido ao dia\nQuantidade: 30\nMédico: Dr. Roberto Almeida - CRM-SP 123456\nData: 10/07/2026`,
  },
  expired: {
    id: 'rx-expired-001',
    patientName: 'João Pereira',
    patientCpf: '123.456.789-00',
    doctorName: 'Dr. Carlos Mendes',
    doctorCRM: 'CRM-SP 789012',
    issueDate: '2025-01-15',
    expiryDate: '2025-04-15',
    medications: [{ productId: 'prod-amoxicilina-003', dosage: '1 de 8 em 8 horas', quantity: 21 }],
    digitalSignature: 'sig_xyz789abc012',
    imageUrl: 'https://storage.brocolis.io/prescriptions/rx-expired-001.jpg',
    ocrText: `Paciente: João Pereira\nMedicação: Amoxicilina 500mg\nPosologia: 1 de 8 em 8 horas\nQuantidade: 21\nMédico: Dr. Carlos Mendes - CRM-SP 789012\nData: 15/01/2025`,
  },
  suspect: {
    id: 'rx-suspect-001',
    patientName: 'José Santos',
    patientCpf: '111.222.333-44',
    doctorName: 'Dr. Fake Name',
    doctorCRM: 'CRM-SP 000000',
    issueDate: '2026-07-12',
    expiryDate: '2026-10-12',
    medications: [
      { productId: 'prod-amoxicilina-003', dosage: '1 de 6 em 6 horas', quantity: 60 },
      { productId: 'prod-losartana-001', dosage: '2 comprimidos ao dia', quantity: 90 },
    ],
    digitalSignature: 'sig_fake123',
    imageUrl: 'https://storage.brocolis.io/prescriptions/rx-suspect-001.jpg',
    ocrText: `Paciente: José Santos\nMedicação: Amoxicilina 500mg, Losartana 50mg\nQuantidade: 60, 90\nMédico: Dr. Fake Name - CRM-SP 000000`,
  },
};

export const TEST_PAYMENT_DATA = {
  creditCard: {
    cardNumber: '4111111111111111',
    cardHolder: 'MARIA SILVA',
    expiryMonth: 12,
    expiryYear: 2028,
    cvv: '123',
    installments: 1,
  },
  pix: {
    key: '529.982.247-25',
    keyType: 'cpf' as const,
  },
  boleto: {
    dueDate: '2026-07-20',
    amount: 150.0,
  },
};

export const TEST_COUPONS = [
  {
    id: 'coup-primeira-001',
    code: 'PRIMEIRA10',
    type: 'percentage' as const,
    value: 10,
    minPurchase: 50,
    maxUses: 1000,
    expiresAt: '2026-12-31',
    active: true,
  },
  {
    id: 'coup-fretegratis-002',
    code: 'FRETEGRATIS',
    type: 'free_shipping' as const,
    value: 0,
    minPurchase: 80,
    maxUses: 500,
    expiresAt: '2026-12-31',
    active: true,
  },
];

export const TEST_ORDER_DATA = {
  singlePharmacy: {
    items: [
      { productId: 'prod-omeprazol-002', quantity: 2 },
      { productId: 'prod-vitaminac-004', quantity: 1 },
    ],
    pharmacyId: 'pharmacy-drogamais-001',
    shippingAddress: TEST_USERS.customer.address,
  },
  multiPharmacy: {
    items: [
      { productId: 'prod-losartana-001', quantity: 1, pharmacyId: 'pharmacy-drogamais-001' },
      { productId: 'prod-omeprazol-002', quantity: 3, pharmacyId: 'pharmacy-drogamais-001' },
      { productId: 'prod-vitaminac-004', quantity: 2, pharmacyId: 'pharmacy-farmabem-002' },
    ],
    shippingAddress: TEST_USERS.customer.address,
  },
  withPrescription: {
    items: [
      { productId: 'prod-losartana-001', quantity: 1, prescriptionId: 'rx-valid-001' },
      { productId: 'prod-metformina-005', quantity: 2, prescriptionId: 'rx-valid-001' },
    ],
    pharmacyId: 'pharmacy-drogamais-001',
    shippingAddress: TEST_USERS.customer.address,
  },
};

export const API_ENDPOINTS = {
  finpay: {
    createPaymentIntent: '/v1/payment-intents',
    confirmPayment: '/v1/payment-intents/:id/confirm',
    capturePayment: '/v1/payment-intents/:id/capture',
    refund: '/v1/payment-intents/:id/refund',
    webhook: '/v1/webhooks',
    trustScore: '/v1/trust-score',
    reconcile: '/v1/reconciliation',
    evidence: '/v1/evidence',
    validate: '/v1/validate',
  },
  brocolis: {
    auth: {
      login: '/api/v1/auth/login',
      register: '/api/v1/auth/register',
      guestCheckout: '/api/v1/auth/guest-checkout',
      refreshToken: '/api/v1/auth/refresh',
    },
    products: {
      list: '/api/v1/products',
      detail: '/api/v1/products/:id',
      search: '/api/v1/products/search',
    },
    cart: {
      add: '/api/v1/cart/items',
      remove: '/api/v1/cart/items/:id',
      update: '/api/v1/cart/items/:id',
      get: '/api/v1/cart',
      clear: '/api/v1/cart',
    },
    orders: {
      create: '/api/v1/orders',
      list: '/api/v1/orders',
      detail: '/api/v1/orders/:id',
      cancel: '/api/v1/orders/:id/cancel',
      return: '/api/v1/orders/:id/return',
      track: '/api/v1/orders/:id/tracking',
    },
    checkout: {
      start: '/api/v1/checkout',
      applyCoupon: '/api/v1/checkout/coupon',
      payment: '/api/v1/checkout/payment',
      confirm: '/api/v1/checkout/confirm',
    },
    prescriptions: {
      upload: '/api/v1/prescriptions/upload',
      verify: '/api/v1/prescriptions/:id/verify',
      get: '/api/v1/prescriptions/:id',
      list: '/api/v1/prescriptions',
    },
    pharmacy: {
      dashboard: '/api/v1/pharmacy/dashboard',
      orders: '/api/v1/pharmacy/orders',
      orderUpdate: '/api/v1/pharmacy/orders/:id/status',
      inventory: '/api/v1/pharmacy/inventory',
      inventoryUpdate: '/api/v1/pharmacy/inventory/:id',
      reports: '/api/v1/pharmacy/reports',
      staff: '/api/v1/pharmacy/staff',
    },
    admin: {
      dashboard: '/api/v1/admin/dashboard',
      pharmacies: '/api/v1/admin/pharmacies',
      approvePharmacy: '/api/v1/admin/pharmacies/:id/approve',
      commissions: '/api/v1/admin/commissions',
      auditLog: '/api/v1/admin/audit-log',
      featureFlags: '/api/v1/admin/feature-flags',
    },
    delivery: {
      track: '/api/v1/delivery/:id',
      update: '/api/v1/delivery/:id/status',
    },
    aiAssistant: {
      chat: '/api/v1/ai-assistant/chat',
      askMedication: '/api/v1/ai-assistant/medication',
      recommendations: '/api/v1/ai-assistant/recommendations',
      verifyPrescription: '/api/v1/ai-assistant/verify-prescription',
    },
  },
} as const;
