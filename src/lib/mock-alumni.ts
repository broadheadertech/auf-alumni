export type AlumniProfile = {
  slug: string;
  name: string;
  initials: string;
  batch: number;
  program: string;
  degree: "Undergraduate" | "Graduate";
  currentRole: string;
  company: string;
  city: string;
  country: string;
  skills: string[];
  bio: string;
  experience: { role: string; company: string; years: string }[];
  education: { degree: string; program: string; school: string; year: number }[];
  openTo: ("Mentorship" | "Hiring" | "Referrals" | "Speaking")[];
  verifiedAt: string;
};

export const PROGRAMS = [
  "BS Information Technology",
  "BS Computer Science",
  "BS Business Administration",
  "BS Accountancy",
  "BS Nursing",
  "BS Architecture",
  "BS Psychology",
  "BS Civil Engineering",
] as const;

export const CITIES = [
  "Angeles City",
  "Manila",
  "Quezon City",
  "Cebu City",
  "Davao City",
  "Singapore",
  "Dubai",
  "Toronto",
  "San Francisco",
  "Tokyo",
] as const;

export const BATCHES = [2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024] as const;

export const ALUMNI: AlumniProfile[] = [
  {
    slug: "maria-santos",
    name: "Maria Santos",
    initials: "MS",
    batch: 2018,
    program: "BS Information Technology",
    degree: "Undergraduate",
    currentRole: "Senior Software Engineer",
    company: "Globe Telecom",
    city: "Manila",
    country: "Philippines",
    skills: ["TypeScript", "React", "Node.js", "AWS", "System Design"],
    bio: "AUF IT '18. Now leading a 6-person platform team at Globe. Happy to chat with juniors thinking about backend or platform engineering — I came up through frontend and the jump was harder than people make it sound.",
    experience: [
      { role: "Senior Software Engineer", company: "Globe Telecom", years: "2022 – Present" },
      { role: "Software Engineer", company: "Kalibrr", years: "2019 – 2022" },
      { role: "Junior Developer", company: "Accenture", years: "2018 – 2019" },
    ],
    education: [
      { degree: "BS Information Technology", program: "Information Technology", school: "Angeles University Foundation", year: 2018 },
    ],
    openTo: ["Mentorship", "Referrals"],
    verifiedAt: "2026-02-14",
  },
  {
    slug: "juan-dela-cruz",
    name: "Juan Dela Cruz",
    initials: "JD",
    batch: 2014,
    program: "BS Business Administration",
    degree: "Undergraduate",
    currentRole: "Head of Product",
    company: "GCash",
    city: "Manila",
    country: "Philippines",
    skills: ["Product Strategy", "Fintech", "Roadmapping", "User Research"],
    bio: "Built consumer products in fintech for the last 8 years. Always looking for AUF grads with strong analytical chops for our PM rotation program.",
    experience: [
      { role: "Head of Product", company: "GCash", years: "2023 – Present" },
      { role: "Senior PM", company: "PayMaya", years: "2019 – 2023" },
      { role: "Associate PM", company: "Lazada", years: "2016 – 2019" },
    ],
    education: [
      { degree: "BS Business Administration", program: "Business Administration", school: "Angeles University Foundation", year: 2014 },
    ],
    openTo: ["Hiring", "Mentorship"],
    verifiedAt: "2026-01-08",
  },
  {
    slug: "anna-reyes",
    name: "Anna Reyes",
    initials: "AR",
    batch: 2020,
    program: "BS Nursing",
    degree: "Undergraduate",
    currentRole: "ICU Nurse",
    company: "Toronto General Hospital",
    city: "Toronto",
    country: "Canada",
    skills: ["Critical Care", "NCLEX", "Patient Advocacy"],
    bio: "Migrated to Canada in 2022. If you're an AUF Nursing grad considering the Canadian route, I've made every mistake there is to make — please ask me first.",
    experience: [
      { role: "ICU Nurse", company: "Toronto General Hospital", years: "2023 – Present" },
      { role: "Staff Nurse", company: "The Medical City", years: "2020 – 2022" },
    ],
    education: [
      { degree: "BS Nursing", program: "Nursing", school: "Angeles University Foundation", year: 2020 },
    ],
    openTo: ["Mentorship"],
    verifiedAt: "2026-03-22",
  },
  {
    slug: "miguel-tan",
    name: "Miguel Tan",
    initials: "MT",
    batch: 2012,
    program: "BS Architecture",
    degree: "Undergraduate",
    currentRole: "Principal Architect",
    company: "Tan + Associates",
    city: "Angeles City",
    country: "Philippines",
    skills: ["Sustainable Design", "BIM", "Project Management", "Revit"],
    bio: "Started my own practice in 2019, mostly residential and small commercial in Pampanga. Hire AUF Architecture grads every intake — happy to talk OJT.",
    experience: [
      { role: "Principal Architect", company: "Tan + Associates", years: "2019 – Present" },
      { role: "Project Architect", company: "Recio + Casas", years: "2014 – 2019" },
    ],
    education: [
      { degree: "BS Architecture", program: "Architecture", school: "Angeles University Foundation", year: 2012 },
    ],
    openTo: ["Hiring", "Speaking"],
    verifiedAt: "2026-02-01",
  },
  {
    slug: "kristine-lim",
    name: "Kristine Lim",
    initials: "KL",
    batch: 2016,
    program: "BS Accountancy",
    degree: "Undergraduate",
    currentRole: "Senior Manager, Audit",
    company: "PwC Singapore",
    city: "Singapore",
    country: "Singapore",
    skills: ["IFRS", "External Audit", "Financial Reporting", "CPA"],
    bio: "Big 4 audit in SG. The CPA-to-SG path is well-trodden — I can save you about 6 months of guessing.",
    experience: [
      { role: "Senior Manager", company: "PwC Singapore", years: "2024 – Present" },
      { role: "Manager", company: "PwC Philippines", years: "2020 – 2024" },
      { role: "Associate", company: "PwC Philippines", years: "2016 – 2020" },
    ],
    education: [
      { degree: "BS Accountancy", program: "Accountancy", school: "Angeles University Foundation", year: 2016 },
    ],
    openTo: ["Mentorship", "Referrals"],
    verifiedAt: "2026-01-30",
  },
  {
    slug: "rafael-mendoza",
    name: "Rafael Mendoza",
    initials: "RM",
    batch: 2022,
    program: "BS Computer Science",
    degree: "Undergraduate",
    currentRole: "ML Engineer",
    company: "Stripe",
    city: "San Francisco",
    country: "United States",
    skills: ["Python", "PyTorch", "Fraud Models", "MLOps"],
    bio: "Got into Stripe via an alumni referral — that's literally why I want this platform to exist. DM me if you're a CS grad eyeing US tech.",
    experience: [
      { role: "ML Engineer", company: "Stripe", years: "2024 – Present" },
      { role: "Software Engineer", company: "Shopee", years: "2022 – 2024" },
    ],
    education: [
      { degree: "BS Computer Science", program: "Computer Science", school: "Angeles University Foundation", year: 2022 },
    ],
    openTo: ["Mentorship", "Referrals"],
    verifiedAt: "2026-04-02",
  },
  {
    slug: "isabella-cruz",
    name: "Isabella Cruz",
    initials: "IC",
    batch: 2010,
    program: "BS Psychology",
    degree: "Undergraduate",
    currentRole: "Organizational Psychologist",
    company: "Aboitiz Group",
    city: "Cebu City",
    country: "Philippines",
    skills: ["I/O Psychology", "Leadership Development", "Coaching"],
    bio: "L&D and exec coaching for one of the largest conglomerates in PH. I keep an eye out for AUF Psych grads moving into the corporate side.",
    experience: [
      { role: "Organizational Psychologist", company: "Aboitiz Group", years: "2018 – Present" },
      { role: "HR Business Partner", company: "Globe Telecom", years: "2013 – 2018" },
    ],
    education: [
      { degree: "MA Industrial-Organizational Psychology", program: "Psychology", school: "Ateneo de Manila University", year: 2014 },
      { degree: "BS Psychology", program: "Psychology", school: "Angeles University Foundation", year: 2010 },
    ],
    openTo: ["Mentorship", "Speaking"],
    verifiedAt: "2026-02-19",
  },
  {
    slug: "paolo-garcia",
    name: "Paolo Garcia",
    initials: "PG",
    batch: 2024,
    program: "BS Civil Engineering",
    degree: "Undergraduate",
    currentRole: "Junior Structural Engineer",
    company: "DMCI Homes",
    city: "Quezon City",
    country: "Philippines",
    skills: ["STAAD.Pro", "RCD", "AutoCAD"],
    bio: "Fresh grad, board exam taken Nov 2025, waiting on results. Happy to compare notes with anyone else recently out of CE.",
    experience: [
      { role: "Junior Structural Engineer", company: "DMCI Homes", years: "2024 – Present" },
    ],
    education: [
      { degree: "BS Civil Engineering", program: "Civil Engineering", school: "Angeles University Foundation", year: 2024 },
    ],
    openTo: ["Mentorship"],
    verifiedAt: "2026-04-30",
  },
  {
    slug: "sophia-villanueva",
    name: "Sophia Villanueva",
    initials: "SV",
    batch: 2018,
    program: "BS Information Technology",
    degree: "Undergraduate",
    currentRole: "Engineering Manager",
    company: "Grab",
    city: "Singapore",
    country: "Singapore",
    skills: ["Engineering Leadership", "Hiring", "Go", "Distributed Systems"],
    bio: "Same batch as Maria S — we joke that AUF IT '18 punched above its weight. I run a 12-person team at Grab. Always hiring senior engineers.",
    experience: [
      { role: "Engineering Manager", company: "Grab", years: "2023 – Present" },
      { role: "Tech Lead", company: "Grab", years: "2021 – 2023" },
      { role: "Senior Engineer", company: "Shopee", years: "2018 – 2021" },
    ],
    education: [
      { degree: "BS Information Technology", program: "Information Technology", school: "Angeles University Foundation", year: 2018 },
    ],
    openTo: ["Hiring", "Mentorship", "Referrals"],
    verifiedAt: "2026-01-15",
  },
  {
    slug: "diego-aquino",
    name: "Diego Aquino",
    initials: "DA",
    batch: 2014,
    program: "BS Business Administration",
    degree: "Undergraduate",
    currentRole: "Founder & CEO",
    company: "Sariling Atin Foods",
    city: "Angeles City",
    country: "Philippines",
    skills: ["Operations", "F&B", "Fundraising", "Franchising"],
    bio: "Built a 14-branch food chain starting from a single stall in Marquee Mall. Will absolutely hire AUF grads — DM me, don't be shy.",
    experience: [
      { role: "Founder & CEO", company: "Sariling Atin Foods", years: "2017 – Present" },
      { role: "Operations Manager", company: "Jollibee Foods Corp", years: "2014 – 2017" },
    ],
    education: [
      { degree: "BS Business Administration", program: "Business Administration", school: "Angeles University Foundation", year: 2014 },
    ],
    openTo: ["Hiring", "Mentorship", "Speaking"],
    verifiedAt: "2026-03-05",
  },
  {
    slug: "hannah-uy",
    name: "Hannah Uy",
    initials: "HU",
    batch: 2020,
    program: "BS Computer Science",
    degree: "Undergraduate",
    currentRole: "Security Engineer",
    company: "Mercari",
    city: "Tokyo",
    country: "Japan",
    skills: ["AppSec", "Red Teaming", "Python", "Go"],
    bio: "Security engineering in Tokyo. The Japan path is unusual for CS grads — if you're curious about it, I can break down the visa side honestly.",
    experience: [
      { role: "Security Engineer", company: "Mercari", years: "2023 – Present" },
      { role: "Software Engineer", company: "Cyber Security PH", years: "2020 – 2023" },
    ],
    education: [
      { degree: "BS Computer Science", program: "Computer Science", school: "Angeles University Foundation", year: 2020 },
    ],
    openTo: ["Mentorship"],
    verifiedAt: "2026-02-28",
  },
  {
    slug: "carlo-pineda",
    name: "Carlo Pineda",
    initials: "CP",
    batch: 2016,
    program: "BS Civil Engineering",
    degree: "Undergraduate",
    currentRole: "Project Engineer",
    company: "Emaar Properties",
    city: "Dubai",
    country: "UAE",
    skills: ["Construction Management", "High-Rise", "Primavera P6"],
    bio: "Working on high-rises in Dubai. Salary jump from PH to UAE for CE grads is wild — happy to share numbers privately.",
    experience: [
      { role: "Project Engineer", company: "Emaar Properties", years: "2021 – Present" },
      { role: "Site Engineer", company: "Megaworld", years: "2016 – 2021" },
    ],
    education: [
      { degree: "BS Civil Engineering", program: "Civil Engineering", school: "Angeles University Foundation", year: 2016 },
    ],
    openTo: ["Mentorship", "Referrals"],
    verifiedAt: "2026-01-22",
  },
];

export function getAlumniBySlug(slug: string): AlumniProfile | undefined {
  return ALUMNI.find((a) => a.slug === slug);
}
