/**
 * Admin-only mock dataset for the Alumni Relations control room.
 *
 * Powers two stakeholder-review surfaces:
 *   1. Employer roster  → /admin/employers (+ /[employerId] drill-down)
 *   2. Alumni roster    → /admin/alumni     (+ /[alumniId]   drill-down)
 *
 * The shapes here intentionally go *beyond* the current Convex schema (EQ
 * scores, certifications, MOA/NDA documents, contract windows) — these are the
 * fields the Alumni Relations office asked to see in the admin views. When the
 * backend grows to match, swap these readers for Convex queries; the page
 * components consume the derived helpers (counts, filters) not the raw arrays.
 *
 * Everything is internally consistent: an applicant on an employer posting is a
 * real alumna in ALUMNAE, and an alumna's applications point back at real
 * employer postings. "Today" for this dataset is 2026-06-28.
 */

// ------------------------------------------------------------------ shared ---

export type ApplicationStage =
  | "new"
  | "screening"
  | "interview"
  | "offered"
  | "hired"
  | "not-selected";

export const APPLICATION_STAGES: ApplicationStage[] = [
  "new",
  "screening",
  "interview",
  "offered",
  "hired",
  "not-selected",
];

export const STAGE_LABEL: Record<ApplicationStage, string> = {
  new: "New",
  screening: "Screening",
  interview: "Interview",
  offered: "Offered",
  hired: "Hired",
  "not-selected": "Not selected",
};

/** AUF colleges — the canonical "college" filter dimension. */
export const COLLEGES = [
  "College of Computer Studies",
  "College of Engineering & Architecture",
  "College of Business & Accountancy",
  "College of Nursing",
  "College of Allied Medical Professions",
  "College of Arts & Sciences",
  "College of Education",
] as const;
export type College = (typeof COLLEGES)[number];

// --------------------------------------------------------------- employers ---

export type EmployerTier = "Partner" | "Verified" | "Unverified";

export type UploadedDoc = {
  filename: string;
  uploadedAt: string; // ISO date
  sizeKb: number;
};

export type PostingStatus =
  | "published"
  | "closed"
  | "pending-moderation"
  | "draft";

export const POSTING_STATUS_LABEL: Record<PostingStatus, string> = {
  published: "Published",
  closed: "Closed",
  "pending-moderation": "Pending review",
  draft: "Draft",
};

export type PostingApplicant = {
  applicationId: string;
  alumnaId: string; // → AdminAlumna.id
  name: string;
  initials: string;
  college: College;
  batch: number;
  appliedAt: string; // ISO date
  stage: ApplicationStage;
  matchScore: number; // 0–100, how well their profile fits the posting
};

export type EmployerPosting = {
  id: string;
  title: string;
  location: string;
  employmentType: "Full-time" | "Part-time" | "Contract" | "Internship";
  status: PostingStatus;
  postedAt: string; // ISO date
  closesAt: string; // ISO date
  salaryLabel: string;
  applicants: PostingApplicant[];
};

export type AdminEmployer = {
  id: string;
  slug: string;
  name: string;
  initials: string;
  description: string;
  industry: string;
  hqCity: string;
  websiteUrl: string;
  tier: EmployerTier;
  contractStart: string; // ISO date
  contractEnd: string; // ISO date
  moa: UploadedDoc | null;
  nda: UploadedDoc | null;
  onboardedAt: string; // ISO date
  postings: EmployerPosting[];
};

// ----------------------------------------------------------------- alumnae ---

export type WorkStatus =
  | "Open to work"
  | "Hired (via AUF)"
  | "Employed"
  | "Not looking";

export type Certification = {
  name: string;
  issuer: string;
  year: number;
  credentialId?: string;
};

export type SkillRating = {
  name: string;
  level: number; // 0–100 self-assessed + endorsement weighted
  endorsements: number;
};

export type EqDimension = {
  dimension:
    | "Self-Awareness"
    | "Self-Regulation"
    | "Motivation"
    | "Empathy"
    | "Social Skills";
  score: number; // 0–100
};

export type AlumnaApplication = {
  applicationId: string;
  jobTitle: string;
  employerId: string; // → AdminEmployer.id
  company: string;
  appliedAt: string; // ISO date
  stage: ApplicationStage;
};

export type AdminAlumna = {
  id: string;
  slug: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  batch: number;
  college: College;
  program: string;
  degree: string;
  city: string;
  country: string;
  // employment signals
  workStatus: WorkStatus;
  openToWork: boolean;
  hired: boolean; // hired through an AUF posting
  currentRole: string | null;
  currentCompany: string | null;
  // assessment
  eqScore: number; // 0–100 composite
  eq: EqDimension[];
  skills: SkillRating[];
  certifications: Certification[];
  // documents
  cv: UploadedDoc | null;
  // funnel
  applications: AlumnaApplication[];
  registeredAt: string; // ISO date
  lastActiveAt: string; // ISO date
};

// -------------------------------------------------------------- the alumnae ---

export const ALUMNAE: AdminAlumna[] = [
  {
    id: "alm-001",
    slug: "maria-santos",
    name: "Maria Santos",
    initials: "MS",
    email: "maria.santos@auf.edu.ph",
    phone: "+63 917 555 0101",
    batch: 2018,
    college: "College of Computer Studies",
    program: "BS Information Technology",
    degree: "Undergraduate",
    city: "Manila",
    country: "Philippines",
    workStatus: "Employed",
    openToWork: false,
    hired: false,
    currentRole: "Senior Software Engineer",
    currentCompany: "Globe Telecom",
    eqScore: 88,
    eq: [
      { dimension: "Self-Awareness", score: 90 },
      { dimension: "Self-Regulation", score: 86 },
      { dimension: "Motivation", score: 92 },
      { dimension: "Empathy", score: 84 },
      { dimension: "Social Skills", score: 88 },
    ],
    skills: [
      { name: "TypeScript", level: 94, endorsements: 23 },
      { name: "React", level: 91, endorsements: 19 },
      { name: "System Design", level: 86, endorsements: 11 },
      { name: "AWS", level: 80, endorsements: 8 },
    ],
    certifications: [
      { name: "AWS Solutions Architect – Associate", issuer: "Amazon Web Services", year: 2023, credentialId: "AWS-SAA-22841" },
      { name: "Professional Scrum Master I", issuer: "Scrum.org", year: 2021 },
    ],
    cv: { filename: "MariaSantos_SeniorSWE_2026.pdf", uploadedAt: "2026-05-02", sizeKb: 218 },
    applications: [
      { applicationId: "app-1001", jobTitle: "Staff Engineer, Platform", employerId: "emp-globe", company: "Globe Telecom", appliedAt: "2026-06-10", stage: "interview" },
    ],
    registeredAt: "2026-02-14",
    lastActiveAt: "2026-06-26",
  },
  {
    id: "alm-002",
    slug: "rafael-mendoza",
    name: "Rafael Mendoza",
    initials: "RM",
    email: "rafael.mendoza@auf.edu.ph",
    phone: "+63 917 555 0102",
    batch: 2022,
    college: "College of Computer Studies",
    program: "BS Computer Science",
    degree: "Undergraduate",
    city: "Angeles City",
    country: "Philippines",
    workStatus: "Open to work",
    openToWork: true,
    hired: false,
    currentRole: "ML Engineer",
    currentCompany: "Shopee",
    eqScore: 79,
    eq: [
      { dimension: "Self-Awareness", score: 82 },
      { dimension: "Self-Regulation", score: 75 },
      { dimension: "Motivation", score: 88 },
      { dimension: "Empathy", score: 72 },
      { dimension: "Social Skills", score: 78 },
    ],
    skills: [
      { name: "Python", level: 92, endorsements: 17 },
      { name: "PyTorch", level: 85, endorsements: 9 },
      { name: "MLOps", level: 78, endorsements: 6 },
      { name: "Fraud Models", level: 81, endorsements: 4 },
    ],
    certifications: [
      { name: "TensorFlow Developer Certificate", issuer: "Google", year: 2023 },
      { name: "Deep Learning Specialization", issuer: "DeepLearning.AI", year: 2022 },
    ],
    cv: { filename: "RMendoza_ML_CV.pdf", uploadedAt: "2026-06-15", sizeKb: 197 },
    applications: [
      { applicationId: "app-1002", jobTitle: "Machine Learning Engineer", employerId: "emp-kollab", company: "Kollab AI", appliedAt: "2026-06-18", stage: "screening" },
      { applicationId: "app-1003", jobTitle: "Data Scientist", employerId: "emp-globe", company: "Globe Telecom", appliedAt: "2026-06-20", stage: "new" },
    ],
    registeredAt: "2026-04-02",
    lastActiveAt: "2026-06-27",
  },
  {
    id: "alm-003",
    slug: "paolo-garcia",
    name: "Paolo Garcia",
    initials: "PG",
    email: "paolo.garcia@auf.edu.ph",
    phone: "+63 917 555 0103",
    batch: 2024,
    college: "College of Engineering & Architecture",
    program: "BS Civil Engineering",
    degree: "Undergraduate",
    city: "Quezon City",
    country: "Philippines",
    workStatus: "Open to work",
    openToWork: true,
    hired: false,
    currentRole: "Junior Structural Engineer",
    currentCompany: "DMCI Homes",
    eqScore: 74,
    eq: [
      { dimension: "Self-Awareness", score: 76 },
      { dimension: "Self-Regulation", score: 80 },
      { dimension: "Motivation", score: 78 },
      { dimension: "Empathy", score: 70 },
      { dimension: "Social Skills", score: 66 },
    ],
    skills: [
      { name: "STAAD.Pro", level: 84, endorsements: 5 },
      { name: "AutoCAD", level: 88, endorsements: 7 },
      { name: "RCD", level: 79, endorsements: 3 },
    ],
    certifications: [
      { name: "Registered Civil Engineer (PRC)", issuer: "PRC", year: 2025, credentialId: "PRC-CE-0099231" },
    ],
    cv: { filename: "Paolo_Garcia_CE_2026.pdf", uploadedAt: "2026-06-21", sizeKb: 165 },
    applications: [
      { applicationId: "app-1004", jobTitle: "Site Engineer", employerId: "emp-megawide", company: "Megawide Construction", appliedAt: "2026-06-22", stage: "screening" },
      { applicationId: "app-1005", jobTitle: "Structural Design Engineer", employerId: "emp-megawide", company: "Megawide Construction", appliedAt: "2026-06-24", stage: "new" },
    ],
    registeredAt: "2026-04-30",
    lastActiveAt: "2026-06-28",
  },
  {
    id: "alm-004",
    slug: "kristine-lim",
    name: "Kristine Lim",
    initials: "KL",
    email: "kristine.lim@auf.edu.ph",
    phone: "+65 8555 0104",
    batch: 2016,
    college: "College of Business & Accountancy",
    program: "BS Accountancy",
    degree: "Undergraduate",
    city: "Singapore",
    country: "Singapore",
    workStatus: "Employed",
    openToWork: false,
    hired: false,
    currentRole: "Senior Manager, Audit",
    currentCompany: "PwC Singapore",
    eqScore: 85,
    eq: [
      { dimension: "Self-Awareness", score: 87 },
      { dimension: "Self-Regulation", score: 89 },
      { dimension: "Motivation", score: 84 },
      { dimension: "Empathy", score: 80 },
      { dimension: "Social Skills", score: 85 },
    ],
    skills: [
      { name: "IFRS", level: 93, endorsements: 14 },
      { name: "External Audit", level: 90, endorsements: 12 },
      { name: "Financial Reporting", level: 88, endorsements: 10 },
    ],
    certifications: [
      { name: "Certified Public Accountant", issuer: "PRC", year: 2017, credentialId: "PRC-CPA-0142208" },
      { name: "Chartered Accountant (Singapore)", issuer: "ISCA", year: 2021 },
    ],
    cv: { filename: "KLim_Audit_Manager.pdf", uploadedAt: "2026-03-30", sizeKb: 240 },
    applications: [],
    registeredAt: "2026-01-30",
    lastActiveAt: "2026-06-12",
  },
  {
    id: "alm-005",
    slug: "anna-reyes",
    name: "Anna Reyes",
    initials: "AR",
    email: "anna.reyes@auf.edu.ph",
    phone: "+1 416 555 0105",
    batch: 2020,
    college: "College of Nursing",
    program: "BS Nursing",
    degree: "Undergraduate",
    city: "Toronto",
    country: "Canada",
    workStatus: "Employed",
    openToWork: false,
    hired: false,
    currentRole: "ICU Nurse",
    currentCompany: "Toronto General Hospital",
    eqScore: 91,
    eq: [
      { dimension: "Self-Awareness", score: 92 },
      { dimension: "Self-Regulation", score: 90 },
      { dimension: "Motivation", score: 89 },
      { dimension: "Empathy", score: 96 },
      { dimension: "Social Skills", score: 88 },
    ],
    skills: [
      { name: "Critical Care", level: 95, endorsements: 21 },
      { name: "Patient Advocacy", level: 90, endorsements: 13 },
      { name: "NCLEX", level: 88, endorsements: 6 },
    ],
    certifications: [
      { name: "Registered Nurse (PRC)", issuer: "PRC", year: 2021, credentialId: "PRC-RN-0331882" },
      { name: "NCLEX-RN", issuer: "NCSBN", year: 2022 },
      { name: "BLS / ACLS", issuer: "American Heart Association", year: 2024 },
    ],
    cv: { filename: "AnnaReyes_RN_ICU.pdf", uploadedAt: "2026-04-01", sizeKb: 188 },
    applications: [],
    registeredAt: "2026-03-22",
    lastActiveAt: "2026-05-30",
  },
  {
    id: "alm-006",
    slug: "diego-aquino",
    name: "Diego Aquino",
    initials: "DA",
    email: "diego.aquino@auf.edu.ph",
    phone: "+63 917 555 0106",
    batch: 2014,
    college: "College of Business & Accountancy",
    program: "BS Business Administration",
    degree: "Undergraduate",
    city: "Angeles City",
    country: "Philippines",
    workStatus: "Not looking",
    openToWork: false,
    hired: false,
    currentRole: "Founder & CEO",
    currentCompany: "Sariling Atin Foods",
    eqScore: 83,
    eq: [
      { dimension: "Self-Awareness", score: 80 },
      { dimension: "Self-Regulation", score: 78 },
      { dimension: "Motivation", score: 94 },
      { dimension: "Empathy", score: 82 },
      { dimension: "Social Skills", score: 90 },
    ],
    skills: [
      { name: "Operations", level: 89, endorsements: 16 },
      { name: "Franchising", level: 85, endorsements: 9 },
      { name: "Fundraising", level: 80, endorsements: 7 },
    ],
    certifications: [],
    cv: { filename: "DAquino_Founder.pdf", uploadedAt: "2026-03-05", sizeKb: 174 },
    applications: [],
    registeredAt: "2026-03-05",
    lastActiveAt: "2026-06-18",
  },
  {
    id: "alm-007",
    slug: "hannah-uy",
    name: "Hannah Uy",
    initials: "HU",
    email: "hannah.uy@auf.edu.ph",
    phone: "+81 90 5555 0107",
    batch: 2020,
    college: "College of Computer Studies",
    program: "BS Computer Science",
    degree: "Undergraduate",
    city: "Tokyo",
    country: "Japan",
    workStatus: "Open to work",
    openToWork: true,
    hired: false,
    currentRole: "Security Engineer",
    currentCompany: "Mercari",
    eqScore: 81,
    eq: [
      { dimension: "Self-Awareness", score: 84 },
      { dimension: "Self-Regulation", score: 86 },
      { dimension: "Motivation", score: 82 },
      { dimension: "Empathy", score: 74 },
      { dimension: "Social Skills", score: 78 },
    ],
    skills: [
      { name: "AppSec", level: 90, endorsements: 11 },
      { name: "Red Teaming", level: 86, endorsements: 8 },
      { name: "Go", level: 80, endorsements: 5 },
      { name: "Python", level: 84, endorsements: 9 },
    ],
    certifications: [
      { name: "OSCP", issuer: "OffSec", year: 2023, credentialId: "OS-101-44120" },
      { name: "CISSP", issuer: "ISC²", year: 2024 },
    ],
    cv: { filename: "HannahUy_Security.pdf", uploadedAt: "2026-06-05", sizeKb: 203 },
    applications: [
      { applicationId: "app-1006", jobTitle: "Application Security Engineer", employerId: "emp-kollab", company: "Kollab AI", appliedAt: "2026-06-19", stage: "interview" },
    ],
    registeredAt: "2026-02-28",
    lastActiveAt: "2026-06-27",
  },
  {
    id: "alm-008",
    slug: "carlo-pineda",
    name: "Carlo Pineda",
    initials: "CP",
    email: "carlo.pineda@auf.edu.ph",
    phone: "+971 50 555 0108",
    batch: 2016,
    college: "College of Engineering & Architecture",
    program: "BS Civil Engineering",
    degree: "Undergraduate",
    city: "Dubai",
    country: "UAE",
    workStatus: "Hired (via AUF)",
    openToWork: false,
    hired: true,
    currentRole: "Project Engineer",
    currentCompany: "Megawide Construction",
    eqScore: 77,
    eq: [
      { dimension: "Self-Awareness", score: 79 },
      { dimension: "Self-Regulation", score: 82 },
      { dimension: "Motivation", score: 80 },
      { dimension: "Empathy", score: 72 },
      { dimension: "Social Skills", score: 74 },
    ],
    skills: [
      { name: "Construction Management", level: 88, endorsements: 12 },
      { name: "Primavera P6", level: 85, endorsements: 8 },
      { name: "High-Rise", level: 82, endorsements: 6 },
    ],
    certifications: [
      { name: "Registered Civil Engineer (PRC)", issuer: "PRC", year: 2017, credentialId: "PRC-CE-0088123" },
      { name: "PMP", issuer: "PMI", year: 2023 },
    ],
    cv: { filename: "CarloPineda_PE.pdf", uploadedAt: "2026-05-20", sizeKb: 211 },
    applications: [
      { applicationId: "app-1007", jobTitle: "Project Engineer", employerId: "emp-megawide", company: "Megawide Construction", appliedAt: "2026-04-12", stage: "hired" },
    ],
    registeredAt: "2026-01-22",
    lastActiveAt: "2026-06-20",
  },
  {
    id: "alm-009",
    slug: "sophia-villanueva",
    name: "Sophia Villanueva",
    initials: "SV",
    email: "sophia.villanueva@auf.edu.ph",
    phone: "+65 8555 0109",
    batch: 2018,
    college: "College of Computer Studies",
    program: "BS Information Technology",
    degree: "Undergraduate",
    city: "Singapore",
    country: "Singapore",
    workStatus: "Employed",
    openToWork: false,
    hired: false,
    currentRole: "Engineering Manager",
    currentCompany: "Grab",
    eqScore: 90,
    eq: [
      { dimension: "Self-Awareness", score: 91 },
      { dimension: "Self-Regulation", score: 88 },
      { dimension: "Motivation", score: 90 },
      { dimension: "Empathy", score: 89 },
      { dimension: "Social Skills", score: 93 },
    ],
    skills: [
      { name: "Engineering Leadership", level: 93, endorsements: 27 },
      { name: "Distributed Systems", level: 87, endorsements: 14 },
      { name: "Go", level: 84, endorsements: 10 },
      { name: "Hiring", level: 88, endorsements: 12 },
    ],
    certifications: [
      { name: "Certified Kubernetes Administrator", issuer: "CNCF", year: 2022 },
    ],
    cv: { filename: "SophiaV_EM.pdf", uploadedAt: "2026-02-10", sizeKb: 196 },
    applications: [],
    registeredAt: "2026-01-15",
    lastActiveAt: "2026-06-25",
  },
  {
    id: "alm-010",
    slug: "isabella-cruz",
    name: "Isabella Cruz",
    initials: "IC",
    email: "isabella.cruz@auf.edu.ph",
    phone: "+63 917 555 0110",
    batch: 2010,
    college: "College of Arts & Sciences",
    program: "BS Psychology",
    degree: "Graduate",
    city: "Cebu City",
    country: "Philippines",
    workStatus: "Employed",
    openToWork: false,
    hired: false,
    currentRole: "Organizational Psychologist",
    currentCompany: "Aboitiz Group",
    eqScore: 94,
    eq: [
      { dimension: "Self-Awareness", score: 95 },
      { dimension: "Self-Regulation", score: 92 },
      { dimension: "Motivation", score: 90 },
      { dimension: "Empathy", score: 97 },
      { dimension: "Social Skills", score: 96 },
    ],
    skills: [
      { name: "I/O Psychology", level: 95, endorsements: 18 },
      { name: "Leadership Development", level: 91, endorsements: 15 },
      { name: "Coaching", level: 93, endorsements: 16 },
    ],
    certifications: [
      { name: "Registered Psychologist (PRC)", issuer: "PRC", year: 2015, credentialId: "PRC-PSY-0021008" },
      { name: "ICF Associate Certified Coach", issuer: "International Coaching Federation", year: 2020 },
    ],
    cv: { filename: "IsabellaCruz_IOPsych.pdf", uploadedAt: "2026-02-19", sizeKb: 230 },
    applications: [],
    registeredAt: "2026-02-19",
    lastActiveAt: "2026-06-10",
  },
  {
    id: "alm-011",
    slug: "juan-dela-cruz",
    name: "Juan Dela Cruz",
    initials: "JD",
    email: "juan.delacruz@auf.edu.ph",
    phone: "+63 917 555 0111",
    batch: 2014,
    college: "College of Business & Accountancy",
    program: "BS Business Administration",
    degree: "Undergraduate",
    city: "Manila",
    country: "Philippines",
    workStatus: "Open to work",
    openToWork: true,
    hired: false,
    currentRole: "Head of Product",
    currentCompany: "GCash",
    eqScore: 87,
    eq: [
      { dimension: "Self-Awareness", score: 88 },
      { dimension: "Self-Regulation", score: 84 },
      { dimension: "Motivation", score: 90 },
      { dimension: "Empathy", score: 85 },
      { dimension: "Social Skills", score: 89 },
    ],
    skills: [
      { name: "Product Strategy", level: 92, endorsements: 22 },
      { name: "Fintech", level: 88, endorsements: 13 },
      { name: "User Research", level: 83, endorsements: 9 },
    ],
    certifications: [
      { name: "Pragmatic Institute Certified", issuer: "Pragmatic Institute", year: 2021 },
    ],
    cv: { filename: "JuanDC_Product.pdf", uploadedAt: "2026-06-08", sizeKb: 207 },
    applications: [
      { applicationId: "app-1008", jobTitle: "Director of Product", employerId: "emp-kollab", company: "Kollab AI", appliedAt: "2026-06-16", stage: "offered" },
    ],
    registeredAt: "2026-01-08",
    lastActiveAt: "2026-06-26",
  },
  {
    id: "alm-012",
    slug: "miguel-tan",
    name: "Miguel Tan",
    initials: "MT",
    email: "miguel.tan@auf.edu.ph",
    phone: "+63 917 555 0112",
    batch: 2012,
    college: "College of Engineering & Architecture",
    program: "BS Architecture",
    degree: "Undergraduate",
    city: "Angeles City",
    country: "Philippines",
    workStatus: "Not looking",
    openToWork: false,
    hired: false,
    currentRole: "Principal Architect",
    currentCompany: "Tan + Associates",
    eqScore: 80,
    eq: [
      { dimension: "Self-Awareness", score: 82 },
      { dimension: "Self-Regulation", score: 79 },
      { dimension: "Motivation", score: 85 },
      { dimension: "Empathy", score: 76 },
      { dimension: "Social Skills", score: 80 },
    ],
    skills: [
      { name: "Sustainable Design", level: 90, endorsements: 11 },
      { name: "Revit", level: 86, endorsements: 8 },
      { name: "BIM", level: 84, endorsements: 7 },
    ],
    certifications: [
      { name: "Registered Architect (PRC)", issuer: "PRC", year: 2013, credentialId: "PRC-ARC-0044190" },
      { name: "LEED Green Associate", issuer: "USGBC", year: 2019 },
    ],
    cv: { filename: "MiguelTan_Architect.pdf", uploadedAt: "2026-02-01", sizeKb: 219 },
    applications: [],
    registeredAt: "2026-02-01",
    lastActiveAt: "2026-05-22",
  },
  {
    id: "alm-013",
    slug: "grace-ocampo",
    name: "Grace Ocampo",
    initials: "GO",
    email: "grace.ocampo@auf.edu.ph",
    phone: "+63 917 555 0113",
    batch: 2023,
    college: "College of Allied Medical Professions",
    program: "BS Medical Technology",
    degree: "Undergraduate",
    city: "Angeles City",
    country: "Philippines",
    workStatus: "Hired (via AUF)",
    openToWork: false,
    hired: true,
    currentRole: "Medical Technologist",
    currentCompany: "The Medical City Clark",
    eqScore: 82,
    eq: [
      { dimension: "Self-Awareness", score: 83 },
      { dimension: "Self-Regulation", score: 85 },
      { dimension: "Motivation", score: 84 },
      { dimension: "Empathy", score: 86 },
      { dimension: "Social Skills", score: 75 },
    ],
    skills: [
      { name: "Clinical Laboratory", level: 87, endorsements: 6 },
      { name: "Hematology", level: 83, endorsements: 4 },
      { name: "Quality Control", level: 80, endorsements: 3 },
    ],
    certifications: [
      { name: "Registered Medical Technologist (PRC)", issuer: "PRC", year: 2024, credentialId: "PRC-MT-0501221" },
    ],
    cv: { filename: "GraceOcampo_MedTech.pdf", uploadedAt: "2026-05-28", sizeKb: 158 },
    applications: [
      { applicationId: "app-1009", jobTitle: "Medical Technologist", employerId: "emp-medcity", company: "The Medical City Clark", appliedAt: "2026-03-15", stage: "hired" },
    ],
    registeredAt: "2026-03-01",
    lastActiveAt: "2026-06-24",
  },
  {
    id: "alm-014",
    slug: "noel-bautista",
    name: "Noel Bautista",
    initials: "NB",
    email: "noel.bautista@auf.edu.ph",
    phone: "+63 917 555 0114",
    batch: 2024,
    college: "College of Computer Studies",
    program: "BS Information Technology",
    degree: "Undergraduate",
    city: "Angeles City",
    country: "Philippines",
    workStatus: "Open to work",
    openToWork: true,
    hired: false,
    currentRole: null,
    currentCompany: null,
    eqScore: 71,
    eq: [
      { dimension: "Self-Awareness", score: 70 },
      { dimension: "Self-Regulation", score: 72 },
      { dimension: "Motivation", score: 80 },
      { dimension: "Empathy", score: 68 },
      { dimension: "Social Skills", score: 65 },
    ],
    skills: [
      { name: "JavaScript", level: 74, endorsements: 3 },
      { name: "Next.js", level: 70, endorsements: 2 },
      { name: "SQL", level: 68, endorsements: 2 },
    ],
    certifications: [
      { name: "Meta Front-End Developer", issuer: "Meta / Coursera", year: 2025 },
    ],
    cv: { filename: "NoelBautista_Junior_Dev.pdf", uploadedAt: "2026-06-25", sizeKb: 142 },
    applications: [
      { applicationId: "app-1010", jobTitle: "Frontend Engineer", employerId: "emp-kollab", company: "Kollab AI", appliedAt: "2026-06-26", stage: "new" },
      { applicationId: "app-1011", jobTitle: "Associate Software Engineer", employerId: "emp-globe", company: "Globe Telecom", appliedAt: "2026-06-27", stage: "new" },
    ],
    registeredAt: "2026-05-15",
    lastActiveAt: "2026-06-28",
  },
];

export function getAlumnaById(id: string): AdminAlumna | undefined {
  return ALUMNAE.find((a) => a.id === id);
}

// ------------------------------------------------- the employers + postings ---

/** Build a posting applicant from an alumna + application metadata. */
function applicant(
  applicationId: string,
  alumnaId: string,
  appliedAt: string,
  stage: ApplicationStage,
  matchScore: number,
): PostingApplicant {
  const a = getAlumnaById(alumnaId)!;
  return {
    applicationId,
    alumnaId,
    name: a.name,
    initials: a.initials,
    college: a.college,
    batch: a.batch,
    appliedAt,
    stage,
    matchScore,
  };
}

export const EMPLOYERS: AdminEmployer[] = [
  {
    id: "emp-globe",
    slug: "globe-telecom",
    name: "Globe Telecom",
    initials: "GT",
    description:
      "Leading digital solutions and telecommunications provider in the Philippines. Hiring across platform engineering, data, and network operations.",
    industry: "Telecommunications",
    hqCity: "Taguig",
    websiteUrl: "https://www.globe.com.ph",
    tier: "Partner",
    contractStart: "2025-08-01",
    contractEnd: "2026-07-31",
    moa: { filename: "MOA_Globe_AUF_2025.pdf", uploadedAt: "2025-07-22", sizeKb: 512 },
    nda: { filename: "NDA_Globe_AUF.pdf", uploadedAt: "2025-07-22", sizeKb: 188 },
    onboardedAt: "2025-07-25",
    postings: [
      {
        id: "job-globe-1",
        title: "Staff Engineer, Platform",
        location: "Taguig (Hybrid)",
        employmentType: "Full-time",
        status: "published",
        postedAt: "2026-06-01",
        closesAt: "2026-07-15",
        salaryLabel: "₱180k–₱240k / mo",
        applicants: [applicant("app-1001", "alm-001", "2026-06-10", "interview", 92)],
      },
      {
        id: "job-globe-2",
        title: "Data Scientist",
        location: "Taguig (Hybrid)",
        employmentType: "Full-time",
        status: "published",
        postedAt: "2026-06-12",
        closesAt: "2026-07-20",
        salaryLabel: "₱110k–₱150k / mo",
        applicants: [applicant("app-1003", "alm-002", "2026-06-20", "new", 78)],
      },
      {
        id: "job-globe-3",
        title: "Associate Software Engineer",
        location: "Cebu (Onsite)",
        employmentType: "Full-time",
        status: "published",
        postedAt: "2026-06-20",
        closesAt: "2026-08-01",
        salaryLabel: "₱45k–₱60k / mo",
        applicants: [applicant("app-1011", "alm-014", "2026-06-27", "new", 61)],
      },
    ],
  },
  {
    id: "emp-kollab",
    slug: "kollab-ai",
    name: "Kollab AI",
    initials: "KA",
    description:
      "Series A AI startup building agentic workflow tooling for SE Asia enterprises. Fast-growing engineering and product org.",
    industry: "Software / AI",
    hqCity: "Makati",
    websiteUrl: "https://kollab.ai",
    tier: "Verified",
    contractStart: "2026-01-15",
    contractEnd: "2027-01-14",
    moa: { filename: "MOA_KollabAI_AUF_2026.pdf", uploadedAt: "2026-01-10", sizeKb: 466 },
    nda: null,
    onboardedAt: "2026-01-12",
    postings: [
      {
        id: "job-kollab-1",
        title: "Machine Learning Engineer",
        location: "Makati (Remote-first)",
        employmentType: "Full-time",
        status: "published",
        postedAt: "2026-06-05",
        closesAt: "2026-07-10",
        salaryLabel: "₱160k–₱210k / mo",
        applicants: [applicant("app-1002", "alm-002", "2026-06-18", "screening", 88)],
      },
      {
        id: "job-kollab-2",
        title: "Application Security Engineer",
        location: "Remote",
        employmentType: "Full-time",
        status: "published",
        postedAt: "2026-06-08",
        closesAt: "2026-07-12",
        salaryLabel: "₱150k–₱200k / mo",
        applicants: [applicant("app-1006", "alm-007", "2026-06-19", "interview", 90)],
      },
      {
        id: "job-kollab-3",
        title: "Director of Product",
        location: "Makati (Hybrid)",
        employmentType: "Full-time",
        status: "published",
        postedAt: "2026-06-02",
        closesAt: "2026-07-05",
        salaryLabel: "₱280k–₱350k / mo",
        applicants: [applicant("app-1008", "alm-011", "2026-06-16", "offered", 94)],
      },
      {
        id: "job-kollab-4",
        title: "Frontend Engineer",
        location: "Remote",
        employmentType: "Full-time",
        status: "pending-moderation",
        postedAt: "2026-06-25",
        closesAt: "2026-08-01",
        salaryLabel: "₱70k–₱110k / mo",
        applicants: [applicant("app-1010", "alm-014", "2026-06-26", "new", 66)],
      },
    ],
  },
  {
    id: "emp-megawide",
    slug: "megawide-construction",
    name: "Megawide Construction",
    initials: "MC",
    description:
      "Engineering-led infrastructure and construction conglomerate. Recruits civil, structural, and project engineers each intake.",
    industry: "Construction / Infrastructure",
    hqCity: "Quezon City",
    websiteUrl: "https://www.megawide.com.ph",
    tier: "Partner",
    contractStart: "2025-09-01",
    contractEnd: "2026-08-31",
    moa: { filename: "MOA_Megawide_AUF_2025.pdf", uploadedAt: "2025-08-20", sizeKb: 498 },
    nda: { filename: "NDA_Megawide.pdf", uploadedAt: "2025-08-20", sizeKb: 176 },
    onboardedAt: "2025-08-24",
    postings: [
      {
        id: "job-megawide-1",
        title: "Project Engineer",
        location: "Quezon City (Onsite)",
        employmentType: "Full-time",
        status: "closed",
        postedAt: "2026-03-20",
        closesAt: "2026-04-30",
        salaryLabel: "₱55k–₱75k / mo",
        applicants: [applicant("app-1007", "alm-008", "2026-04-12", "hired", 89)],
      },
      {
        id: "job-megawide-2",
        title: "Site Engineer",
        location: "Pampanga (Onsite)",
        employmentType: "Full-time",
        status: "published",
        postedAt: "2026-06-10",
        closesAt: "2026-07-25",
        salaryLabel: "₱40k–₱55k / mo",
        applicants: [applicant("app-1004", "alm-003", "2026-06-22", "screening", 80)],
      },
      {
        id: "job-megawide-3",
        title: "Structural Design Engineer",
        location: "Quezon City (Hybrid)",
        employmentType: "Full-time",
        status: "published",
        postedAt: "2026-06-18",
        closesAt: "2026-08-05",
        salaryLabel: "₱60k–₱85k / mo",
        applicants: [applicant("app-1005", "alm-003", "2026-06-24", "new", 76)],
      },
    ],
  },
  {
    id: "emp-medcity",
    slug: "medical-city-clark",
    name: "The Medical City Clark",
    initials: "MC",
    description:
      "Tertiary hospital and medical center in Clark, Pampanga. Continuous demand for nursing and allied-medical graduates.",
    industry: "Healthcare",
    hqCity: "Clark, Pampanga",
    websiteUrl: "https://www.themedicalcityclark.com",
    tier: "Verified",
    contractStart: "2025-11-01",
    contractEnd: "2026-10-31",
    moa: { filename: "MOA_TMC_Clark_AUF.pdf", uploadedAt: "2025-10-25", sizeKb: 444 },
    nda: null,
    onboardedAt: "2025-10-28",
    postings: [
      {
        id: "job-medcity-1",
        title: "Medical Technologist",
        location: "Clark (Onsite)",
        employmentType: "Full-time",
        status: "closed",
        postedAt: "2026-02-15",
        closesAt: "2026-03-31",
        salaryLabel: "₱28k–₱36k / mo",
        applicants: [applicant("app-1009", "alm-013", "2026-03-15", "hired", 85)],
      },
      {
        id: "job-medcity-2",
        title: "Staff Nurse – ICU",
        location: "Clark (Onsite)",
        employmentType: "Full-time",
        status: "published",
        postedAt: "2026-06-14",
        closesAt: "2026-07-30",
        salaryLabel: "₱26k–₱34k / mo",
        applicants: [],
      },
    ],
  },
  {
    id: "emp-aboitiz",
    slug: "aboitiz-group",
    name: "Aboitiz Group",
    initials: "AG",
    description:
      "Diversified conglomerate spanning power, banking, food, and infrastructure. Corporate management and L&D pipelines.",
    industry: "Conglomerate",
    hqCity: "Taguig",
    websiteUrl: "https://aboitiz.com",
    tier: "Verified",
    contractStart: "2026-02-01",
    contractEnd: "2026-07-31",
    moa: { filename: "MOA_Aboitiz_AUF_2026.pdf", uploadedAt: "2026-01-28", sizeKb: 472 },
    nda: { filename: "NDA_Aboitiz.pdf", uploadedAt: "2026-01-28", sizeKb: 169 },
    onboardedAt: "2026-01-30",
    postings: [
      {
        id: "job-aboitiz-1",
        title: "Management Trainee – HR",
        location: "Cebu (Hybrid)",
        employmentType: "Full-time",
        status: "published",
        postedAt: "2026-06-22",
        closesAt: "2026-08-10",
        salaryLabel: "₱35k–₱45k / mo",
        applicants: [],
      },
    ],
  },
  {
    id: "emp-startech",
    slug: "startech-bpo",
    name: "StarTech BPO",
    initials: "SB",
    description:
      "Mid-size BPO providing customer experience and back-office services. Applying for AUF partnership; documents under review.",
    industry: "BPO / Outsourcing",
    hqCity: "Angeles City",
    websiteUrl: "https://startechbpo.com",
    tier: "Unverified",
    contractStart: "2026-06-15",
    contractEnd: "2026-12-15",
    moa: null,
    nda: null,
    onboardedAt: "2026-06-15",
    postings: [
      {
        id: "job-startech-1",
        title: "Customer Experience Associate",
        location: "Angeles City (Onsite)",
        employmentType: "Full-time",
        status: "pending-moderation",
        postedAt: "2026-06-24",
        closesAt: "2026-08-15",
        salaryLabel: "₱22k–₱28k / mo",
        applicants: [],
      },
      {
        id: "job-startech-2",
        title: "Team Lead – Operations",
        location: "Angeles City (Onsite)",
        employmentType: "Full-time",
        status: "draft",
        postedAt: "2026-06-26",
        closesAt: "2026-08-20",
        salaryLabel: "₱40k–₱55k / mo",
        applicants: [],
      },
    ],
  },
];

export function getEmployerById(id: string): AdminEmployer | undefined {
  return EMPLOYERS.find((e) => e.id === id);
}

// ------------------------------------------------------------- derivations ---

export function postingCount(e: AdminEmployer): number {
  return e.postings.length;
}

export function applicantCount(e: AdminEmployer): number {
  return e.postings.reduce((sum, p) => sum + p.applicants.length, 0);
}

export function hiredCount(e: AdminEmployer): number {
  return e.postings.reduce(
    (sum, p) => sum + p.applicants.filter((a) => a.stage === "hired").length,
    0,
  );
}

/** Days until contract end relative to the dataset's "today" (2026-06-28). */
export const TODAY = new Date("2026-06-28T00:00:00Z");

export function daysUntil(iso: string): number {
  const d = new Date(iso + "T00:00:00Z");
  return Math.round((d.getTime() - TODAY.getTime()) / 86_400_000);
}

export type ContractState = "active" | "expiring" | "expired";

export function contractState(e: AdminEmployer): ContractState {
  const left = daysUntil(e.contractEnd);
  if (left < 0) return "expired";
  if (left <= 45) return "expiring";
  return "active";
}

/** Distinct companies that have postings — for the alumni "company" filter. */
export const COMPANIES = EMPLOYERS.map((e) => e.name).sort();

export const INDUSTRIES = Array.from(
  new Set(EMPLOYERS.map((e) => e.industry)),
).sort();

export const BATCHES = Array.from(new Set(ALUMNAE.map((a) => a.batch))).sort(
  (a, b) => b - a,
);

export const WORK_STATUSES: WorkStatus[] = [
  "Open to work",
  "Hired (via AUF)",
  "Employed",
  "Not looking",
];

export const EMPLOYER_TIERS: EmployerTier[] = [
  "Partner",
  "Verified",
  "Unverified",
];

/** Pretty date — "Jun 28, 2026". Stable, locale-independent. */
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
export function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

// ----------------------------------------------- alumnus approval queue ---

/**
 * Pending alumnus registrations awaiting admin verification (Epic 2).
 *
 * These people are NOT yet in ALUMNAE — they've signed up and submitted
 * verification evidence, and the admin must approve / reject / request more
 * info before they're admitted to the verified network. Mirrors the live
 * Convex `verificationSubmissions` flow at /admin/queue, but populated so the
 * approval UX is demoable without a backend.
 */

/** Reference "now" for queue-age math (a working afternoon on 2026-06-28). */
export const NOW = new Date("2026-06-28T14:00:00Z");

export type VerificationMethod =
  | "School email"
  | "Registry match"
  | "ID upload"
  | "Diploma upload";

export type ApprovalFlag =
  | "name-mismatch"
  | "no-registry-match"
  | "id-quality-low"
  | "duplicate-account"
  | "batch-mismatch";

export const APPROVAL_FLAG_LABEL: Record<ApprovalFlag, string> = {
  "name-mismatch": "Name mismatch",
  "no-registry-match": "No registry match",
  "id-quality-low": "ID image quality low",
  "duplicate-account": "Possible duplicate",
  "batch-mismatch": "Batch mismatch",
};

export type PendingAlumnus = {
  id: string;
  name: string;
  initials: string;
  email: string;
  claimedBatch: number;
  claimedProgram: string;
  college: College;
  city: string;
  submittedAt: string; // ISO datetime
  method: VerificationMethod;
  registryMatched: boolean;
  registryConfidence: number | null; // 0–1, null when no match
  registryRecord: { name: string; batch: number; program: string } | null;
  flags: ApprovalFlag[];
  idDoc: UploadedDoc | null;
  diplomaDoc: UploadedDoc | null;
  note: string | null;
};

export const PENDING_ALUMNI: PendingAlumnus[] = [
  {
    id: "ver-001",
    name: "Patricia Gomez",
    initials: "PG",
    email: "patricia.gomez@auf.edu.ph",
    claimedBatch: 2025,
    claimedProgram: "BS Information Technology",
    college: "College of Computer Studies",
    city: "Angeles City",
    submittedAt: "2026-06-28T09:42:00Z",
    method: "School email",
    registryMatched: true,
    registryConfidence: 0.98,
    registryRecord: { name: "Patricia A. Gomez", batch: 2025, program: "BS Information Technology" },
    flags: [],
    idDoc: { filename: "PGomez_AUF_ID.jpg", uploadedAt: "2026-06-28", sizeKb: 842 },
    diplomaDoc: { filename: "PGomez_TOR.pdf", uploadedAt: "2026-06-28", sizeKb: 410 },
    note: null,
  },
  {
    id: "ver-002",
    name: "Marco Villaroman",
    initials: "MV",
    email: "marco.villaroman@gmail.com",
    claimedBatch: 2019,
    claimedProgram: "BS Civil Engineering",
    college: "College of Engineering & Architecture",
    city: "San Fernando",
    submittedAt: "2026-06-27T16:10:00Z",
    method: "ID upload",
    registryMatched: true,
    registryConfidence: 0.74,
    registryRecord: { name: "Marco D. Villaroman", batch: 2019, program: "BS Civil Engineering" },
    flags: ["id-quality-low"],
    idDoc: { filename: "marco_id_photo.jpg", uploadedAt: "2026-06-27", sizeKb: 119 },
    diplomaDoc: null,
    note: "Personal email — could not auto-verify via school domain.",
  },
  {
    id: "ver-003",
    name: "Bea Manalang",
    initials: "BM",
    email: "bea.manalang@auf.edu.ph",
    claimedBatch: 2021,
    claimedProgram: "BS Nursing",
    college: "College of Nursing",
    city: "Mabalacat",
    submittedAt: "2026-06-27T11:05:00Z",
    method: "Registry match",
    registryMatched: true,
    registryConfidence: 0.91,
    registryRecord: { name: "Beatriz Manalang", batch: 2021, program: "BS Nursing" },
    flags: ["name-mismatch"],
    idDoc: { filename: "BManalang_ID.png", uploadedAt: "2026-06-27", sizeKb: 656 },
    diplomaDoc: { filename: "BManalang_Diploma.pdf", uploadedAt: "2026-06-27", sizeKb: 388 },
    note: "Goes by 'Bea'; registry has full legal name 'Beatriz'.",
  },
  {
    id: "ver-004",
    name: "Joshua Lim",
    initials: "JL",
    email: "joshua.lim.dev@outlook.com",
    claimedBatch: 2017,
    claimedProgram: "BS Computer Science",
    college: "College of Computer Studies",
    city: "Manila",
    submittedAt: "2026-06-26T08:20:00Z",
    method: "Diploma upload",
    registryMatched: false,
    registryConfidence: null,
    registryRecord: null,
    flags: ["no-registry-match"],
    idDoc: null,
    diplomaDoc: { filename: "jlim_diploma_scan.pdf", uploadedAt: "2026-06-26", sizeKb: 503 },
    note: "No registry hit (stub mode). Diploma looks legitimate — needs manual cross-check.",
  },
  {
    id: "ver-005",
    name: "Andrea Salcedo",
    initials: "AS",
    email: "andrea.salcedo@students.auf.edu.ph",
    claimedBatch: 2024,
    claimedProgram: "BS Psychology",
    college: "College of Arts & Sciences",
    city: "Angeles City",
    submittedAt: "2026-06-25T13:55:00Z",
    method: "School email",
    registryMatched: true,
    registryConfidence: 0.96,
    registryRecord: { name: "Andrea M. Salcedo", batch: 2024, program: "BS Psychology" },
    flags: [],
    idDoc: { filename: "ASalcedo_ID.jpg", uploadedAt: "2026-06-25", sizeKb: 724 },
    diplomaDoc: null,
    note: null,
  },
  {
    id: "ver-006",
    name: "Kevin Reyes",
    initials: "KR",
    email: "kevin.reyes@auf.edu.ph",
    claimedBatch: 2016,
    claimedProgram: "BS Accountancy",
    college: "College of Business & Accountancy",
    city: "Angeles City",
    submittedAt: "2026-06-24T10:30:00Z",
    method: "ID upload",
    registryMatched: true,
    registryConfidence: 0.81,
    registryRecord: { name: "Kevin P. Reyes", batch: 2015, program: "BS Accountancy" },
    flags: ["batch-mismatch", "duplicate-account"],
    idDoc: { filename: "KReyes_ID.jpg", uploadedAt: "2026-06-24", sizeKb: 690 },
    diplomaDoc: { filename: "KReyes_TOR.pdf", uploadedAt: "2026-06-24", sizeKb: 455 },
    note: "Claims batch 2025 but registry shows 2024. Email matches an existing account.",
  },
];

/** Human age string from an ISO datetime, relative to NOW. */
export function ageSince(iso: string): string {
  const ms = NOW.getTime() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = ms / 3_600_000;
  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Hours waiting in the queue — for SLA / sort. */
export function waitHours(iso: string): number {
  return (NOW.getTime() - new Date(iso).getTime()) / 3_600_000;
}

// ------------------------------------------------------- job analytics ---

/**
 * Flat application-history records for job analytics (hiring rate, funnel,
 * time-to-hire, monthly trend). Deterministically generated — no randomness,
 * so server and client render identically — spanning Jan–Jun 2026 across the
 * partner employers and AUF colleges.
 *
 * This is a synthetic *aggregate* history (the per-applicant pipeline lives on
 * the employer postings). When real data exists, replace JOB_APPLICATIONS with
 * a Convex aggregation over `applications`.
 */
export type JobApplicationRecord = {
  id: string;
  company: string;
  college: College;
  jobTitle: string;
  appliedAt: string; // ISO date
  stage: ApplicationStage;
  hired: boolean;
  timeToHireDays: number | null; // set on hired records
};

const ANALYTICS_MONTHS = [
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
];

type AnalyticsSeed = {
  company: string;
  colleges: College[];
  titles: string[];
  baseVolume: number;
  hireEvery: number; // 1-in-N applications results in a hire
};

const ANALYTICS_SEEDS: AnalyticsSeed[] = [
  {
    company: "Globe Telecom",
    colleges: ["College of Computer Studies", "College of Engineering & Architecture"],
    titles: ["Software Engineer", "Data Scientist", "Network Engineer", "QA Analyst"],
    baseVolume: 6,
    hireEvery: 6,
  },
  {
    company: "Kollab AI",
    colleges: ["College of Computer Studies"],
    titles: ["ML Engineer", "Frontend Engineer", "Security Engineer", "Product Manager"],
    baseVolume: 4,
    hireEvery: 8,
  },
  {
    company: "Megawide Construction",
    colleges: ["College of Engineering & Architecture"],
    titles: ["Site Engineer", "Project Engineer", "Structural Engineer", "Estimator"],
    baseVolume: 5,
    hireEvery: 5,
  },
  {
    company: "The Medical City Clark",
    colleges: ["College of Nursing", "College of Allied Medical Professions"],
    titles: ["Staff Nurse", "Medical Technologist", "Radiologic Technologist", "Pharmacist"],
    baseVolume: 5,
    hireEvery: 4,
  },
  {
    company: "Aboitiz Group",
    colleges: ["College of Business & Accountancy", "College of Arts & Sciences"],
    titles: ["Management Trainee", "Financial Analyst", "HR Associate", "Comms Officer"],
    baseVolume: 4,
    hireEvery: 6,
  },
  {
    company: "StarTech BPO",
    colleges: [
      "College of Business & Accountancy",
      "College of Arts & Sciences",
      "College of Education",
    ],
    titles: ["CX Associate", "Team Lead", "Workforce Analyst", "Trainer"],
    baseVolume: 7,
    hireEvery: 5,
  },
];

const ACTIVE_STAGES: ApplicationStage[] = ["new", "screening", "interview", "offered"];
const RESOLVED_STAGES: ApplicationStage[] = [
  "not-selected",
  "not-selected",
  "screening",
  "interview",
];

function buildJobApplications(): JobApplicationRecord[] {
  const recs: JobApplicationRecord[] = [];
  let seq = 0;
  for (let si = 0; si < ANALYTICS_SEEDS.length; si++) {
    const s = ANALYTICS_SEEDS[si];
    ANALYTICS_MONTHS.forEach((month, mi) => {
      const volume = s.baseVolume + (mi % 3); // gentle deterministic variation
      for (let i = 0; i < volume; i++) {
        seq++;
        const college = s.colleges[(i + mi) % s.colleges.length];
        const jobTitle = s.titles[(i + si) % s.titles.length];
        const day = ((i * 7 + mi * 3 + si) % 27) + 1;
        const appliedAt = `${month}-${String(day).padStart(2, "0")}`;
        const hired = (seq + mi) % s.hireEvery === 0;
        let stage: ApplicationStage;
        let timeToHireDays: number | null = null;
        if (hired) {
          stage = "hired";
          timeToHireDays = 12 + ((seq * 3) % 34); // 12–45 days, deterministic
        } else {
          // recent months keep more candidates active; older ones resolved
          const pool = mi >= 4 ? ACTIVE_STAGES : RESOLVED_STAGES;
          stage = pool[(seq + i) % pool.length];
        }
        recs.push({
          id: `jar-${seq}`,
          company: s.company,
          college,
          jobTitle,
          appliedAt,
          stage,
          hired,
          timeToHireDays,
        });
      }
    });
  }
  return recs;
}

export const JOB_APPLICATIONS: JobApplicationRecord[] = buildJobApplications();

export const ANALYTICS_DATE_MIN = "2026-01-01";
export const ANALYTICS_DATE_MAX = "2026-06-30";

/** Month key "2026-03" → "Mar 2026". */
export function fmtMonth(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

// ------------------------------------------------------------- events ---

/**
 * Alumni events with audience targeting. An event is sent to one of:
 *   • everyone  — all verified alumni
 *   • college   — one or more colleges
 *   • batch     — one or more graduating years
 *
 * The admin sees a live "reach" estimate when composing. Reach is computed
 * against a notional alumni population (the real network is far larger than
 * the 14 sample alumnae), so the preview shows realistic numbers. Mirrors the
 * Convex `events` table (audienceFilter) at /admin/events/new, extended with
 * college-level targeting.
 */

export type EventCategory =
  | "reunion"
  | "webinar"
  | "meetup"
  | "fundraiser"
  | "career-fair"
  | "other";

export const EVENT_CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: "reunion", label: "Reunion" },
  { value: "webinar", label: "Webinar" },
  { value: "meetup", label: "Meetup" },
  { value: "fundraiser", label: "Fundraiser" },
  { value: "career-fair", label: "Career fair" },
  { value: "other", label: "Other" },
];

export const EVENT_CATEGORY_LABEL: Record<EventCategory, string> =
  Object.fromEntries(EVENT_CATEGORIES.map((c) => [c.value, c.label])) as Record<
    EventCategory,
    string
  >;

export type AudienceKind = "everyone" | "college" | "batch";

export type EventAudience =
  | { kind: "everyone" }
  | { kind: "college"; colleges: College[] }
  | { kind: "batch"; batches: number[] };

export type AdminEvent = {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  startsAt: string; // ISO datetime, "2026-07-15T18:00"
  location: string;
  onlineUrl: string | null;
  capacity: number | null;
  audience: EventAudience;
  rsvpYes: number;
  rsvpMaybe: number;
  createdAt: string; // ISO date
};

/**
 * Notional alumni population by college — the live network is much larger than
 * the sample roster, so targeting previews use these figures. Replace with a
 * Convex count when wired.
 */
export const COLLEGE_ALUMNI: Record<College, number> = {
  "College of Computer Studies": 1480,
  "College of Engineering & Architecture": 1320,
  "College of Business & Accountancy": 2100,
  "College of Nursing": 1650,
  "College of Allied Medical Professions": 720,
  "College of Arts & Sciences": 760,
  "College of Education": 420,
};

export const ALUMNI_POPULATION = Object.values(COLLEGE_ALUMNI).reduce(
  (a, b) => a + b,
  0,
); // 8,450

/** Graduating years available for event targeting (2008–2025, newest first). */
export const GRAD_YEARS = Array.from(
  { length: 2025 - 2008 + 1 },
  (_, i) => 2025 - i,
);

/** Deterministic notional cohort size for a graduating year. */
export function batchSize(year: number): number {
  // Newer cohorts skew a little larger; stable, no randomness.
  return 360 + ((year - 2008) % 12) * 14;
}

/** Estimated number of alumni an event's audience reaches. */
export function audienceReach(a: EventAudience): number {
  switch (a.kind) {
    case "everyone":
      return ALUMNI_POPULATION;
    case "college":
      return a.colleges.reduce((s, c) => s + (COLLEGE_ALUMNI[c] ?? 0), 0);
    case "batch":
      return a.batches.reduce((s, b) => s + batchSize(b), 0);
  }
}

/** Human description of an event audience. */
export function describeAudience(a: EventAudience): string {
  switch (a.kind) {
    case "everyone":
      return "All verified alumni";
    case "college":
      if (a.colleges.length === 0) return "No college selected";
      if (a.colleges.length === 1)
        return a.colleges[0].replace("College of ", "");
      return `${a.colleges.length} colleges`;
    case "batch":
      if (a.batches.length === 0) return "No year selected";
      if (a.batches.length === 1) return `Class of ${a.batches[0]}`;
      return `${a.batches.length} graduating years`;
  }
}

const EVENT_TODAY = "2026-06-28";
export function isUpcoming(ev: AdminEvent): boolean {
  return ev.startsAt.slice(0, 10) >= EVENT_TODAY;
}

/** "Jul 15, 2026 · 6:00 PM" from an ISO datetime-local string. */
export function fmtDateTime(iso: string): string {
  const [date, time] = iso.split("T");
  const d = new Date(date + "T00:00:00Z");
  const datePart = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  if (!time) return datePart;
  const [hStr, m] = time.split(":");
  let h = Number(hStr);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${datePart} · ${h}:${m} ${ampm}`;
}

export const EVENTS: AdminEvent[] = [
  {
    id: "evt-001",
    title: "AUF Grand Alumni Homecoming 2026",
    description:
      "Our flagship annual reunion — all colleges, all batches. Dinner, awarding of distinguished alumni, and the AUF Got Talent finals.",
    category: "reunion",
    startsAt: "2026-08-22T17:00",
    location: "AUF Gymnasium, Angeles City",
    onlineUrl: null,
    capacity: 1200,
    audience: { kind: "everyone" },
    rsvpYes: 612,
    rsvpMaybe: 188,
    createdAt: "2026-05-30",
  },
  {
    id: "evt-002",
    title: "Tech Careers After AUF: A CCS Webinar",
    description:
      "Computer Studies alumni working at Globe, Grab, and Stripe share how they broke into top tech roles. Live Q&A.",
    category: "webinar",
    startsAt: "2026-07-10T19:00",
    location: "Online (Zoom)",
    onlineUrl: "https://zoom.us/j/auf-ccs",
    capacity: null,
    audience: { kind: "college", colleges: ["College of Computer Studies"] },
    rsvpYes: 143,
    rsvpMaybe: 67,
    createdAt: "2026-06-12",
  },
  {
    id: "evt-003",
    title: "Class of 2018 — 8-Year Reunion",
    description:
      "Batch 2018, it's been eight years! Casual dinner and drinks at Marquee Mall. Bring your families.",
    category: "reunion",
    startsAt: "2026-07-26T18:30",
    location: "Marquee Mall Atrium, Pampanga",
    onlineUrl: null,
    capacity: 200,
    audience: { kind: "batch", batches: [2018] },
    rsvpYes: 74,
    rsvpMaybe: 31,
    createdAt: "2026-06-18",
  },
  {
    id: "evt-004",
    title: "Healthcare Alumni Career Fair",
    description:
      "Nursing and Allied Medical Professions alumni — meet 12 hiring hospitals and agencies recruiting locally and abroad.",
    category: "career-fair",
    startsAt: "2026-09-05T09:00",
    location: "AUF Allied Medical Building",
    onlineUrl: null,
    capacity: 400,
    audience: {
      kind: "college",
      colleges: [
        "College of Nursing",
        "College of Allied Medical Professions",
      ],
    },
    rsvpYes: 98,
    rsvpMaybe: 52,
    createdAt: "2026-06-20",
  },
  {
    id: "evt-005",
    title: "AUF Scholarship Fund — Benefit Gala",
    description:
      "An evening to raise funds for deserving AUF students. Open to all alumni who want to give back.",
    category: "fundraiser",
    startsAt: "2026-10-18T18:00",
    location: "Clark Marriott Hotel",
    onlineUrl: null,
    capacity: 300,
    audience: { kind: "everyone" },
    rsvpYes: 41,
    rsvpMaybe: 96,
    createdAt: "2026-06-25",
  },
  {
    id: "evt-006",
    title: "Young Alumni Mixer (Batches 2022–2024)",
    description:
      "Recent grads — network with peers and near-peers over coffee. Light, casual, great for first jobs and referrals.",
    category: "meetup",
    startsAt: "2026-05-17T16:00",
    location: "The Nest Cafe, Angeles City",
    onlineUrl: null,
    capacity: 80,
    audience: { kind: "batch", batches: [2022, 2023, 2024] },
    rsvpYes: 63,
    rsvpMaybe: 12,
    createdAt: "2026-04-20",
  },
];

// ------------------------------------------------ employer (self) view ---

/**
 * The employer-facing surface (dashboard, postings, applicants, analytics,
 * reports) is scoped to one signed-in employer org. For the prototype that's
 * Kollab AI — its identity, contract, and postings come from EMPLOYERS, and
 * the live applicant pipeline below references its real posting ids.
 *
 * An employer only ever sees applicants to its own postings (privacy). These
 * applicant rows are self-contained — they do NOT link to the admin alumni
 * profiles (EQ, full directory) which are not an employer's to see.
 */
export const CURRENT_EMPLOYER_ID = "emp-kollab";

export function currentEmployer(): AdminEmployer {
  return getEmployerById(CURRENT_EMPLOYER_ID)!;
}

export type EmployerApplicant = {
  id: string;
  name: string;
  initials: string;
  email: string;
  college: College;
  batch: number;
  city: string;
  jobId: string; // → currentEmployer().postings[].id
  jobTitle: string;
  appliedAt: string; // ISO date
  stage: ApplicationStage;
  matchScore: number; // 0–100
  cv: UploadedDoc | null;
  topSkills: string[];
  currentRole: string | null;
  yearsExperience: number;
};

export const EMPLOYER_APPLICANTS: EmployerApplicant[] = [
  // job-kollab-1 · Machine Learning Engineer
  { id: "ea-01", name: "Rafael Mendoza", initials: "RM", email: "rafael.mendoza@auf.edu.ph", college: "College of Computer Studies", batch: 2022, city: "Angeles City", jobId: "job-kollab-1", jobTitle: "Machine Learning Engineer", appliedAt: "2026-06-18", stage: "interview", matchScore: 92, cv: { filename: "RMendoza_ML_CV.pdf", uploadedAt: "2026-06-18", sizeKb: 197 }, topSkills: ["Python", "PyTorch", "MLOps"], currentRole: "ML Engineer @ Shopee", yearsExperience: 4 },
  { id: "ea-02", name: "Liza Tan", initials: "LT", email: "liza.tan@auf.edu.ph", college: "College of Computer Studies", batch: 2021, city: "Manila", jobId: "job-kollab-1", jobTitle: "Machine Learning Engineer", appliedAt: "2026-06-19", stage: "screening", matchScore: 84, cv: { filename: "LizaTan_DS.pdf", uploadedAt: "2026-06-19", sizeKb: 180 }, topSkills: ["Python", "scikit-learn", "SQL"], currentRole: "Data Scientist @ Kalibrr", yearsExperience: 5 },
  { id: "ea-03", name: "Mark Aquino", initials: "MA", email: "mark.aquino@auf.edu.ph", college: "College of Computer Studies", batch: 2023, city: "Angeles City", jobId: "job-kollab-1", jobTitle: "Machine Learning Engineer", appliedAt: "2026-06-24", stage: "new", matchScore: 71, cv: { filename: "MAquino_CV.pdf", uploadedAt: "2026-06-24", sizeKb: 152 }, topSkills: ["Python", "TensorFlow"], currentRole: "Junior Data Analyst", yearsExperience: 2 },
  { id: "ea-04", name: "Patricia Cruz", initials: "PC", email: "patricia.cruz@auf.edu.ph", college: "College of Computer Studies", batch: 2020, city: "Taguig", jobId: "job-kollab-1", jobTitle: "Machine Learning Engineer", appliedAt: "2026-06-08", stage: "hired", matchScore: 88, cv: { filename: "PCruz_MLE.pdf", uploadedAt: "2026-06-08", sizeKb: 205 }, topSkills: ["Python", "PyTorch", "AWS"], currentRole: "ML Engineer @ Voyager", yearsExperience: 6 },
  { id: "ea-05", name: "Dan Lim", initials: "DL", email: "dan.lim@auf.edu.ph", college: "College of Engineering & Architecture", batch: 2019, city: "San Fernando", jobId: "job-kollab-1", jobTitle: "Machine Learning Engineer", appliedAt: "2026-06-12", stage: "not-selected", matchScore: 63, cv: { filename: "DanLim_CV.pdf", uploadedAt: "2026-06-12", sizeKb: 168 }, topSkills: ["MATLAB", "Python"], currentRole: "Controls Engineer", yearsExperience: 7 },
  { id: "ea-06", name: "Joy Santos", initials: "JS", email: "joy.santos@auf.edu.ph", college: "College of Computer Studies", batch: 2024, city: "Angeles City", jobId: "job-kollab-1", jobTitle: "Machine Learning Engineer", appliedAt: "2026-06-26", stage: "new", matchScore: 69, cv: null, topSkills: ["Python", "Pandas"], currentRole: null, yearsExperience: 0 },

  // job-kollab-2 · Application Security Engineer
  { id: "ea-07", name: "Hannah Uy", initials: "HU", email: "hannah.uy@auf.edu.ph", college: "College of Computer Studies", batch: 2020, city: "Tokyo", jobId: "job-kollab-2", jobTitle: "Application Security Engineer", appliedAt: "2026-06-19", stage: "interview", matchScore: 90, cv: { filename: "HannahUy_Security.pdf", uploadedAt: "2026-06-19", sizeKb: 203 }, topSkills: ["AppSec", "Red Teaming", "Go"], currentRole: "Security Engineer @ Mercari", yearsExperience: 6 },
  { id: "ea-08", name: "Carlo Reyes", initials: "CR", email: "carlo.reyes@auf.edu.ph", college: "College of Computer Studies", batch: 2021, city: "Cebu City", jobId: "job-kollab-2", jobTitle: "Application Security Engineer", appliedAt: "2026-06-21", stage: "screening", matchScore: 80, cv: { filename: "CReyes_SecOps.pdf", uploadedAt: "2026-06-21", sizeKb: 191 }, topSkills: ["SIEM", "Python", "Cloud Security"], currentRole: "SOC Analyst", yearsExperience: 4 },
  { id: "ea-09", name: "Bea Cruz", initials: "BC", email: "bea.cruz@auf.edu.ph", college: "College of Computer Studies", batch: 2022, city: "Manila", jobId: "job-kollab-2", jobTitle: "Application Security Engineer", appliedAt: "2026-06-25", stage: "new", matchScore: 74, cv: { filename: "BeaCruz_CV.pdf", uploadedAt: "2026-06-25", sizeKb: 160 }, topSkills: ["Pentesting", "Burp Suite"], currentRole: "Junior Security Analyst", yearsExperience: 2 },
  { id: "ea-10", name: "Niko Dela Cruz", initials: "ND", email: "niko.delacruz@auf.edu.ph", college: "College of Computer Studies", batch: 2019, city: "Quezon City", jobId: "job-kollab-2", jobTitle: "Application Security Engineer", appliedAt: "2026-06-14", stage: "not-selected", matchScore: 66, cv: { filename: "NDelacruz_CV.pdf", uploadedAt: "2026-06-14", sizeKb: 172 }, topSkills: ["Networking", "Linux"], currentRole: "SysAdmin", yearsExperience: 7 },

  // job-kollab-3 · Director of Product
  { id: "ea-11", name: "Juan Dela Cruz", initials: "JD", email: "juan.delacruz@auf.edu.ph", college: "College of Business & Accountancy", batch: 2014, city: "Manila", jobId: "job-kollab-3", jobTitle: "Director of Product", appliedAt: "2026-06-16", stage: "offered", matchScore: 94, cv: { filename: "JuanDC_Product.pdf", uploadedAt: "2026-06-16", sizeKb: 207 }, topSkills: ["Product Strategy", "Fintech", "Roadmapping"], currentRole: "Head of Product @ GCash", yearsExperience: 10 },
  { id: "ea-12", name: "Maria Lopez", initials: "ML", email: "maria.lopez@auf.edu.ph", college: "College of Business & Accountancy", batch: 2013, city: "Singapore", jobId: "job-kollab-3", jobTitle: "Director of Product", appliedAt: "2026-06-17", stage: "interview", matchScore: 88, cv: { filename: "MLopez_PM.pdf", uploadedAt: "2026-06-17", sizeKb: 214 }, topSkills: ["Product Management", "Growth", "Analytics"], currentRole: "Group PM @ Sea", yearsExperience: 11 },
  { id: "ea-13", name: "Ron Garcia", initials: "RG", email: "ron.garcia@auf.edu.ph", college: "College of Business & Accountancy", batch: 2016, city: "Makati", jobId: "job-kollab-3", jobTitle: "Director of Product", appliedAt: "2026-06-20", stage: "screening", matchScore: 79, cv: { filename: "RonGarcia_CV.pdf", uploadedAt: "2026-06-20", sizeKb: 188 }, topSkills: ["Product Ops", "B2B SaaS"], currentRole: "Senior PM @ Sprout", yearsExperience: 8 },
  { id: "ea-14", name: "Ella Tan", initials: "ET", email: "ella.tan@auf.edu.ph", college: "College of Arts & Sciences", batch: 2015, city: "Manila", jobId: "job-kollab-3", jobTitle: "Director of Product", appliedAt: "2026-06-23", stage: "new", matchScore: 72, cv: { filename: "EllaTan_CV.pdf", uploadedAt: "2026-06-23", sizeKb: 176 }, topSkills: ["UX Research", "Strategy"], currentRole: "Product Lead @ Startup", yearsExperience: 9 },

  // job-kollab-4 · Frontend Engineer
  { id: "ea-15", name: "Noel Bautista", initials: "NB", email: "noel.bautista@auf.edu.ph", college: "College of Computer Studies", batch: 2024, city: "Angeles City", jobId: "job-kollab-4", jobTitle: "Frontend Engineer", appliedAt: "2026-06-26", stage: "new", matchScore: 66, cv: { filename: "NoelBautista_Junior_Dev.pdf", uploadedAt: "2026-06-26", sizeKb: 142 }, topSkills: ["JavaScript", "Next.js", "SQL"], currentRole: null, yearsExperience: 0 },
  { id: "ea-16", name: "Kim Reyes", initials: "KR", email: "kim.reyes@auf.edu.ph", college: "College of Computer Studies", batch: 2023, city: "Manila", jobId: "job-kollab-4", jobTitle: "Frontend Engineer", appliedAt: "2026-06-24", stage: "screening", matchScore: 78, cv: { filename: "KimReyes_FE.pdf", uploadedAt: "2026-06-24", sizeKb: 165 }, topSkills: ["React", "TypeScript", "Tailwind"], currentRole: "Frontend Dev @ Agency", yearsExperience: 3 },
  { id: "ea-17", name: "Sam Cruz", initials: "SC", email: "sam.cruz@auf.edu.ph", college: "College of Computer Studies", batch: 2022, city: "Cebu City", jobId: "job-kollab-4", jobTitle: "Frontend Engineer", appliedAt: "2026-06-22", stage: "interview", matchScore: 83, cv: { filename: "SamCruz_FE.pdf", uploadedAt: "2026-06-22", sizeKb: 178 }, topSkills: ["React", "Next.js", "GraphQL"], currentRole: "Frontend Engineer @ Sprout", yearsExperience: 4 },
  { id: "ea-18", name: "Andrea Lim", initials: "AL", email: "andrea.lim@auf.edu.ph", college: "College of Computer Studies", batch: 2024, city: "Angeles City", jobId: "job-kollab-4", jobTitle: "Frontend Engineer", appliedAt: "2026-06-27", stage: "new", matchScore: 70, cv: { filename: "AndreaLim_CV.pdf", uploadedAt: "2026-06-27", sizeKb: 149 }, topSkills: ["JavaScript", "Vue", "CSS"], currentRole: null, yearsExperience: 1 },
];

export function employerApplicantsForJob(jobId: string): EmployerApplicant[] {
  return EMPLOYER_APPLICANTS.filter((a) => a.jobId === jobId);
}

/** Applications history for the current employer (for analytics/reports). */
export function currentEmployerHistory(): JobApplicationRecord[] {
  const name = currentEmployer().name;
  return JOB_APPLICATIONS.filter((r) => r.company === name);
}
