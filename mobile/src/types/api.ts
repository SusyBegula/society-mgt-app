export type Page<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number;
};
export type Property = {
  id: string;
  context_type?: "unit" | "staff";
  society_id: string;
  society: string;
  tower: string;
  flat: string;
  role: "Owner" | "Tenant" | "Family Member" | "Admin" | "Secretary" | "Treasurer" | "Guard";
  address: string;
};

export type Profile = {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatar_id: string | null;
  preferences: Record<string, boolean | string>;
};
export type Bill = {
  id: string;
  period: string;
  due_date: string;
  amount: number;
  outstanding: number;
  status: string;
  items?: { id: string; label: string; amount: number }[];
};
export type Payment = {
  id: string;
  bill_id: string;
  period: string;
  amount: number;
  paid_at: string | null;
  created_at: string;
  status: string;
  method: string;
  reference: string | null;
  provider: string;
  order_id: string;
  key_id?: string;
};
export type Receipt = {
  id: string;
  amount: number;
  society: string;
  resident: string;
  flat: string;
  period: string;
  paid_at: string;
  method: string;
  reference: string;
  provider: string;
};
export type Visitor = {
  id: string;
  name: string;
  phone: string;
  kind: string;
  gate: string;
  purpose: string;
  vehicle_number: string;
  status: string;
  arrived_at: string;
  entry_at: string | null;
  exit_at: string | null;
};
export type Invitation = {
  id: string;
  name: string;
  phone: string;
  start_at: string;
  end_at: string;
  pin: string;
  qr_token: string;
  status: string;
  notes: string;
  vehicle_number: string;
};
export type Complaint = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  assigned_to: string | null;
  attachments: string[];
  rating: number | null;
  timeline?: { id: string; text: string; kind: string; created_at: string }[];
};
export type Notice = {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  published_at: string;
  attachments: string[];
};
export type Amenity = {
  id: string;
  name: string;
  icon: string;
  description: string;
  opens: number;
  closes: number;
  fee: number;
  cancel_hours: number;
};
export type Booking = {
  id: string;
  amenity_id: string;
  amenity_name: string;
  start_at: string;
  end_at: string;
  status: string;
  fee: number;
  cancel_hours: number;
};
export type Vehicle = {
  id: string;
  kind: "Car" | "Bike";
  registration: string;
  manufacturer: string;
  model: string;
  color: string;
  parking_slot: string;
};
export type FamilyMember = {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  app_access: boolean;
};
export type Staff = {
  id: string;
  name: string;
  kind: string;
  status: string;
  last_visit: StaffVisit | null;
};
export type StaffVisit = {
  id: string;
  entry_at: string;
  exit_at: string | null;
};
export type SocietyDocument = {
  id: string;
  title: string;
  category: string;
  filename: string;
  created_at: string;
};
export type Contact = {
  id: string;
  name: string;
  phone: string;
  category: string;
};
export type Notification = {
  id: string;
  title: string;
  body: string;
  category: string;
  route: string;
  read_at: string | null;
  created_at: string;
};
export type Home = {
  due: number;
  bill: Bill | null;
  visitors: Visitor[];
  active_complaints: number;
  notice: Notice | null;
  booking: Booking | null;
  unread: number;
};

export type GuardUnit = {
  id: string;
  tower: string;
  flat: string;
};

export type VerifiedPass = {
  valid: boolean;
  invitation_id: string;
  visitor_name: string;
  visitor_phone: string;
  tower: string;
  flat: string;
  host_name: string;
  valid_from: string;
  valid_until: string;
  notes: string;
};

export type ActiveVisitor = {
  id: string;
  name: string;
  phone: string;
  kind: string;
  purpose: string;
  tower: string;
  flat: string;
  entry_at: string;
};

export type ActiveParcel = {
  id: string;
  courier: string;
  recipient_name: string;
  tracking_code: string;
  tower: string;
  flat: string;
  created_at: string;
};

export type AdminStats = {
  open_complaints: number;
  active_visitors: number;
  active_parcels: number;
  total_units: number;
  total_members: number;
};

export type AdminComplaint = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  tower: string;
  flat: string;
  resident_name: string;
  resident_phone: string;
  created_at: string;
};

export type AdminMember = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  role: string;
  tower: string;
  flat: string;
  active: boolean;
  created_at: string;
};

export type FinanceSummary = {
  total_billed: number;
  total_collected: number;
  total_outstanding: number;
  defaulters_count: number;
};

export type DefaulterBill = {
  id: string;
  period: string;
  amount: number;
  outstanding: number;
  due_date: string;
  is_overdue: boolean;
};

export type DefaulterUnit = {
  unit_id: string;
  tower: string;
  flat: string;
  resident_name: string;
  resident_phone: string;
  total_outstanding: number;
  oldest_due_date: string;
  bills_count: number;
  bills: DefaulterBill[];
};

