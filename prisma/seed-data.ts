import type { Role, UnitType } from "../src/generated/prisma/client.ts";

export const SEED_PASSWORD = "AqarLite#2026";

type SeedData = {
  readonly companies: readonly { readonly id: string; readonly name: string }[];
  readonly users: readonly {
    readonly id: string;
    readonly companyId: string;
    readonly name: string;
    readonly email: string;
    readonly role: Role;
  }[];
  readonly units: readonly {
    readonly id: string;
    readonly companyId: string;
    readonly projectName: string;
    readonly number: string;
    readonly type: UnitType;
    readonly area: number;
    readonly rooms: number;
    readonly price: bigint;
    readonly status: "AVAILABLE";
  }[];
  readonly clients: readonly {
    readonly id: string;
    readonly companyId: string;
    readonly salesRepId: string;
    readonly name: string;
    readonly phone: string;
    readonly notes: string | null;
  }[];
};

export const SEED_DATA: SeedData = {
  companies: [
    { id: "10000000-0000-4000-8000-000000000001", name: "شركة الأفق للتطوير العقاري" },
    { id: "10000000-0000-4000-8000-000000000002", name: "شركة النخبة العقارية" },
  ],
  users: [
    {
      id: "10000000-0000-4000-8000-000000000010",
      companyId: "10000000-0000-4000-8000-000000000001",
      name: "مدير الأفق",
      email: "manager@ufuq.test",
      role: "MANAGER",
    },
    {
      id: "10000000-0000-4000-8000-000000000011",
      companyId: "10000000-0000-4000-8000-000000000001",
      name: "محاسب الأفق",
      email: "accountant@ufuq.test",
      role: "ACCOUNTANT",
    },
    {
      id: "10000000-0000-4000-8000-000000000012",
      companyId: "10000000-0000-4000-8000-000000000001",
      name: "مندوب الأفق 1",
      email: "sales1@ufuq.test",
      role: "SALES",
    },
    {
      id: "10000000-0000-4000-8000-000000000013",
      companyId: "10000000-0000-4000-8000-000000000001",
      name: "مندوب الأفق 2",
      email: "sales2@ufuq.test",
      role: "SALES",
    },
    {
      id: "10000000-0000-4000-8000-000000000014",
      companyId: "10000000-0000-4000-8000-000000000002",
      name: "مدير النخبة",
      email: "manager@nukhba.test",
      role: "MANAGER",
    },
    {
      id: "10000000-0000-4000-8000-000000000015",
      companyId: "10000000-0000-4000-8000-000000000002",
      name: "محاسب النخبة",
      email: "accountant@nukhba.test",
      role: "ACCOUNTANT",
    },
    {
      id: "10000000-0000-4000-8000-000000000016",
      companyId: "10000000-0000-4000-8000-000000000002",
      name: "مندوب النخبة 1",
      email: "sales1@nukhba.test",
      role: "SALES",
    },
    {
      id: "10000000-0000-4000-8000-000000000017",
      companyId: "10000000-0000-4000-8000-000000000002",
      name: "مندوب النخبة 2",
      email: "sales2@nukhba.test",
      role: "SALES",
    },
  ],
  units: [
    {
      id: "10000000-0000-4000-8000-000000000100",
      companyId: "10000000-0000-4000-8000-000000000001",
      projectName: "مشروع الورد",
      number: "001",
      type: "APARTMENT",
      area: 85,
      rooms: 1,
      price: 45_000_000n, // 450,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000101",
      companyId: "10000000-0000-4000-8000-000000000001",
      projectName: "مشروع الورد",
      number: "002",
      type: "VILLA",
      area: 110,
      rooms: 2,
      price: 60_000_000n, // 600,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000102",
      companyId: "10000000-0000-4000-8000-000000000001",
      projectName: "مشروع الورد",
      number: "003",
      type: "TOWNHOUSE",
      area: 220,
      rooms: 4,
      price: 120_000_000n, // 1,200,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000103",
      companyId: "10000000-0000-4000-8000-000000000001",
      projectName: "مشروع الورد",
      number: "004",
      type: "DUPLEX",
      area: 180,
      rooms: 3,
      price: 95_000_000n, // 950,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000104",
      companyId: "10000000-0000-4000-8000-000000000001",
      projectName: "مشروع النخيل",
      number: "005",
      type: "APARTMENT",
      area: 130,
      rooms: 3,
      price: 75_000_000n, // 750,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000105",
      companyId: "10000000-0000-4000-8000-000000000001",
      projectName: "مشروع النخيل",
      number: "006",
      type: "VILLA",
      area: 300,
      rooms: 5,
      price: 180_000_000n, // 1,800,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000106",
      companyId: "10000000-0000-4000-8000-000000000001",
      projectName: "مشروع النخيل",
      number: "007",
      type: "TOWNHOUSE",
      area: 250,
      rooms: 4,
      price: 140_000_000n, // 1,400,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000107",
      companyId: "10000000-0000-4000-8000-000000000001",
      projectName: "مشروع النخيل",
      number: "008",
      type: "DUPLEX",
      area: 280,
      rooms: 5,
      price: 160_000_000n, // 1,600,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000108",
      companyId: "10000000-0000-4000-8000-000000000001",
      projectName: "مشروع الروضة",
      number: "009",
      type: "APARTMENT",
      area: 150,
      rooms: 3,
      price: 85_000_000n, // 850,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000109",
      companyId: "10000000-0000-4000-8000-000000000001",
      projectName: "مشروع الروضة",
      number: "010",
      type: "VILLA",
      area: 450,
      rooms: 7,
      price: 320_000_000n, // 3,200,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000110",
      companyId: "10000000-0000-4000-8000-000000000001",
      projectName: "مشروع الروضة",
      number: "011",
      type: "TOWNHOUSE",
      area: 350,
      rooms: 6,
      price: 210_000_000n, // 2,100,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000111",
      companyId: "10000000-0000-4000-8000-000000000001",
      projectName: "مشروع الروضة",
      number: "012",
      type: "DUPLEX",
      area: 400,
      rooms: 6,
      price: 250_000_000n, // 2,500,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000112",
      companyId: "10000000-0000-4000-8000-000000000002",
      projectName: "مشروع الورد",
      number: "001",
      type: "APARTMENT",
      area: 85,
      rooms: 1,
      price: 45_000_000n, // 450,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000113",
      companyId: "10000000-0000-4000-8000-000000000002",
      projectName: "مشروع الورد",
      number: "002",
      type: "VILLA",
      area: 110,
      rooms: 2,
      price: 60_000_000n, // 600,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000114",
      companyId: "10000000-0000-4000-8000-000000000002",
      projectName: "مشروع الورد",
      number: "003",
      type: "TOWNHOUSE",
      area: 220,
      rooms: 4,
      price: 120_000_000n, // 1,200,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000115",
      companyId: "10000000-0000-4000-8000-000000000002",
      projectName: "مشروع الورد",
      number: "004",
      type: "DUPLEX",
      area: 180,
      rooms: 3,
      price: 95_000_000n, // 950,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000116",
      companyId: "10000000-0000-4000-8000-000000000002",
      projectName: "مشروع النخيل",
      number: "005",
      type: "APARTMENT",
      area: 130,
      rooms: 3,
      price: 75_000_000n, // 750,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000117",
      companyId: "10000000-0000-4000-8000-000000000002",
      projectName: "مشروع النخيل",
      number: "006",
      type: "VILLA",
      area: 300,
      rooms: 5,
      price: 180_000_000n, // 1,800,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000118",
      companyId: "10000000-0000-4000-8000-000000000002",
      projectName: "مشروع النخيل",
      number: "007",
      type: "TOWNHOUSE",
      area: 250,
      rooms: 4,
      price: 140_000_000n, // 1,400,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000119",
      companyId: "10000000-0000-4000-8000-000000000002",
      projectName: "مشروع النخيل",
      number: "008",
      type: "DUPLEX",
      area: 280,
      rooms: 5,
      price: 160_000_000n, // 1,600,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000120",
      companyId: "10000000-0000-4000-8000-000000000002",
      projectName: "مشروع الروضة",
      number: "009",
      type: "APARTMENT",
      area: 150,
      rooms: 3,
      price: 85_000_000n, // 850,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000121",
      companyId: "10000000-0000-4000-8000-000000000002",
      projectName: "مشروع الروضة",
      number: "010",
      type: "VILLA",
      area: 450,
      rooms: 7,
      price: 320_000_000n, // 3,200,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000122",
      companyId: "10000000-0000-4000-8000-000000000002",
      projectName: "مشروع الروضة",
      number: "011",
      type: "TOWNHOUSE",
      area: 350,
      rooms: 6,
      price: 210_000_000n, // 2,100,000 SAR
      status: "AVAILABLE",
    },
    {
      id: "10000000-0000-4000-8000-000000000123",
      companyId: "10000000-0000-4000-8000-000000000002",
      projectName: "مشروع الروضة",
      number: "012",
      type: "DUPLEX",
      area: 400,
      rooms: 6,
      price: 250_000_000n, // 2,500,000 SAR
      status: "AVAILABLE",
    },
  ],
  clients: [
    {
      id: "10000000-0000-4000-8000-000000000200",
      companyId: "10000000-0000-4000-8000-000000000001",
      salesRepId: "10000000-0000-4000-8000-000000000012",
      name: "خالد السالم",
      phone: "0500000001",
      notes: "يفضل التواصل مساءً",
    },
    {
      id: "10000000-0000-4000-8000-000000000201",
      companyId: "10000000-0000-4000-8000-000000000001",
      salesRepId: "10000000-0000-4000-8000-000000000012",
      name: "سارة الناصر",
      phone: "0500000002",
      notes: null,
    },
    {
      id: "10000000-0000-4000-8000-000000000202",
      companyId: "10000000-0000-4000-8000-000000000001",
      salesRepId: "10000000-0000-4000-8000-000000000012",
      name: "عبدالله فهد",
      phone: "0500000003",
      notes: null,
    },
    {
      id: "10000000-0000-4000-8000-000000000203",
      companyId: "10000000-0000-4000-8000-000000000001",
      salesRepId: "10000000-0000-4000-8000-000000000013",
      name: "نورة العلي",
      phone: "0500000004",
      notes: "يفضل التواصل مساءً",
    },
    {
      id: "10000000-0000-4000-8000-000000000204",
      companyId: "10000000-0000-4000-8000-000000000001",
      salesRepId: "10000000-0000-4000-8000-000000000013",
      name: "يوسف حسن",
      phone: "0500000005",
      notes: null,
    },
    {
      id: "10000000-0000-4000-8000-000000000205",
      companyId: "10000000-0000-4000-8000-000000000001",
      salesRepId: "10000000-0000-4000-8000-000000000013",
      name: "ريم منصور",
      phone: "0500000006",
      notes: null,
    },
    {
      id: "10000000-0000-4000-8000-000000000206",
      companyId: "10000000-0000-4000-8000-000000000002",
      salesRepId: "10000000-0000-4000-8000-000000000016",
      name: "أحمد راشد",
      phone: "0500000007",
      notes: "يفضل التواصل مساءً",
    },
    {
      id: "10000000-0000-4000-8000-000000000207",
      companyId: "10000000-0000-4000-8000-000000000002",
      salesRepId: "10000000-0000-4000-8000-000000000016",
      name: "هند سعد",
      phone: "0500000008",
      notes: null,
    },
    {
      id: "10000000-0000-4000-8000-000000000208",
      companyId: "10000000-0000-4000-8000-000000000002",
      salesRepId: "10000000-0000-4000-8000-000000000016",
      name: "عمر ناصر",
      phone: "0500000009",
      notes: null,
    },
    {
      id: "10000000-0000-4000-8000-000000000209",
      companyId: "10000000-0000-4000-8000-000000000002",
      salesRepId: "10000000-0000-4000-8000-000000000017",
      name: "ليلى حمد",
      phone: "0500000010",
      notes: "يفضل التواصل مساءً",
    },
    {
      id: "10000000-0000-4000-8000-000000000210",
      companyId: "10000000-0000-4000-8000-000000000002",
      salesRepId: "10000000-0000-4000-8000-000000000017",
      name: "فهد ماجد",
      phone: "0500000011",
      notes: null,
    },
    {
      id: "10000000-0000-4000-8000-000000000211",
      companyId: "10000000-0000-4000-8000-000000000002",
      salesRepId: "10000000-0000-4000-8000-000000000017",
      name: "مها صالح",
      phone: "0500000012",
      notes: null,
    },
  ],
};
