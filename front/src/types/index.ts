export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  address_line1?: string;
  address_line2?: string;
  zip_code?: string;
  city?: string;
  country?: string;
  created_at: string;
  logo_data?: string;
}

export interface AuthResponse {
  token: string;
  user?: User;
}

export interface Client {
  id: number;
  user_id: number;
  name: string;
  email: string;
  company?: string;
  address_line1: string;
  address_line2?: string;
  zip_code: string;
  city: string;
  country: string;
  created_at: string;
}

export interface Service {
  id: number;
  user_id: number;
  label: string;
  hourly_rate: string;
  created_at: string;
}

export interface InvoiceLine {
  id: number;
  invoice_id: number;
  service_id: number;
  quantity: string;
  unit_price: string;
  total: string;
}

export interface Invoice {
  id: number;
  user_id: number;
  client_id: number;
  status: InvoiceStatus;
  total_ht: string;
  tva_rate: string;
  total_ttc: string;
  issued_at?: string;
  created_at: string;
  Client?: Client;
  InvoiceLines?: InvoiceLine[];
  lines?: Partial<InvoiceLine>[];
}
