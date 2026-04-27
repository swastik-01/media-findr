/**
 * AWS Backend API client.
 * All calls attach the Cognito JWT ID token for authentication.
 * Search endpoint is public (no token needed — attendees search without accounts).
 */

import { cognitoGetIdToken } from "./auth";

const API_URL = import.meta.env.VITE_AWS_API_URL || (import.meta.env.DEV ? "http://localhost:8000" : "");

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await cognitoGetIdToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  requireAuth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (requireAuth) {
    const authHeaders = await getAuthHeaders();
    Object.assign(headers, authHeaders);
  }

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `API Error: ${response.status}`);
  }

  return response.json();
}

// ─────────────────── USER ───────────────────

export interface UserProfile {
  user_id: string;
  email: string;
  name: string;
  credits: number;
  is_admin: boolean;
  created_at: string;
}

export async function getUserProfile(): Promise<UserProfile> {
  return apiRequest("/user/me");
}

// ─────────────────── EVENTS ─────────────────

export interface EventInfo {
  event_id: string;
  event_name: string;
  event_type: string;
  image_count: number;
  face_count: number;
  status: string;
  created_at: string;
  expires_at?: string | null;
  creator_name?: string;
  creator_email?: string;
}

export interface CreateEventResponse {
  event_id: string;
  collection_id: string;
  s3_prefix: string;
  status: string;
}

export async function createEvent(
  eventName: string,
  eventType: string,
  requireGuestDetails: boolean = false
): Promise<CreateEventResponse> {
  return apiRequest("/events/create", {
    method: "POST",
    body: JSON.stringify({ 
      event_name: eventName, 
      event_type: eventType,
    }),
  });
}

export async function getUserEvents(): Promise<{ events: EventInfo[] }> {
  return apiRequest("/user/events");
}

// ─────────────────── UPLOAD ─────────────────

export interface UploadResponse {
  uploaded: number;
  faces_indexed: number;
  errors: Array<{ file: string; error: string }>;
}

export async function uploadImages(
  eventId: string,
  files: File[],
): Promise<UploadResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  return apiRequest(`/events/${eventId}/upload`, {
    method: "POST",
    body: formData,
  });
}

// ─────────────────── SEARCH ─────────────────

export interface SearchResult {
  id: string;
  fileName: string;
  similarity: number;
  url: string;
  downloadUrl: string;
}

export interface SearchResponse {
  event_name: string;
  total_matches: number;
  results: SearchResult[];
}

export async function searchByImage(
  eventId: string,
  file: File,
  guestId: string,
  name?: string,
  phone?: string,
): Promise<SearchResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("guest_id", guestId);
  if (name) formData.append("name", name);
  if (phone) formData.append("phone", phone);

  // Search is public — no auth required
  return apiRequest(`/events/${eventId}/search`, {
    method: "POST",
    body: formData,
  }, false);
}

export async function getEventGuests(eventId: string) {
  return apiRequest<{ guests: any[] }>(`/events/${eventId}/guests`, {
    method: "GET"
  });
}

// ─────────────────── PAYMENTS ─────────────────

export interface PaymentOrderResponse {
  id: string;
  amount: number;
  currency: string;
  key_id: string;
}

export async function createPaymentOrder(
  amount: number,
  credits: number
): Promise<PaymentOrderResponse> {
  return apiRequest("/payments/create-order", {
    method: "POST",
    body: JSON.stringify({ amount, credits }),
  });
}

export async function verifyPayment(
  razorpay_order_id: string,
  razorpay_payment_id: string,
  razorpay_signature: string,
  amount: number,
  credits: number
): Promise<{ status: string; message: string }> {
  return apiRequest("/payments/verify", {
    method: "POST",
    body: JSON.stringify({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
      credits,
    }),
  });
}

// ─────────────────── ADMIN ──────────────────

export interface AdminUser {
  user_id: string;
  email: string;
  name: string;
  credits: number;
  credits_used: number;
  total_spent: number;
  is_admin: boolean;
  created_at: string;
}

export async function getAllUsers(): Promise<{ users: AdminUser[] }> {
  return apiRequest("/admin/users");
}

export async function getAllEvents(): Promise<{ events: EventInfo[] }> {
  return apiRequest("/admin/events");
}

export async function deleteEvent(eventId: string): Promise<{ message: string }> {
  return apiRequest(`/admin/events/${eventId}`, { method: "DELETE" });
}

export async function reindexEvent(eventId: string): Promise<{ message: string }> {
  return apiRequest(`/admin/events/${eventId}/reindex`, { method: "POST" });
}

export interface AdminStats {
  total_users: number;
  total_events: number;
  total_images: number;
  total_faces: number;
  region?: string;
  bucket?: string;
  auth_provider?: string;
}

export async function getAdminStats(): Promise<AdminStats> {
  return apiRequest("/admin/stats");
}


export interface CleanupResult {
  cleaned: number;
  total_expired_found: number;
  details: Array<{ event_id: string; event_name: string; steps: string[] }>;
}

export async function cleanupExpiredEvents(): Promise<CleanupResult> {
  return apiRequest("/admin/cleanup-expired", { method: "DELETE" });
}
