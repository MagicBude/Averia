export type DemoPerson = {
  id: string;
  name: string;
  originalName: string;
  romanizedName: string;
  status: "活跃" | "引退" | "资料待确认";
  debutYear: number;
  workCount: number;
  initials: string;
  tone: string;
};

export type DemoWork = {
  id: string;
  code: string;
  title: string;
  originalTitle: string;
  releaseYear: number;
  maker: string;
  cast: string[];
  tone: string;
};

// 公开预览只使用虚构数据，避免把功能开发与真实成人资料混在一起。
export const demoPeople: DemoPerson[] = [
  {
    id: "p1",
    name: "天海遥",
    originalName: "天海はるか",
    romanizedName: "Haruka Amami",
    status: "活跃",
    debutYear: 2022,
    workCount: 38,
    initials: "AH",
    tone: "coral",
  },
  {
    id: "p2",
    name: "白石澪",
    originalName: "白石みお",
    romanizedName: "Mio Shiraishi",
    status: "活跃",
    debutYear: 2021,
    workCount: 54,
    initials: "MS",
    tone: "sage",
  },
  {
    id: "p3",
    name: "水原凛",
    originalName: "水原りん",
    romanizedName: "Rin Mizuhara",
    status: "引退",
    debutYear: 2018,
    workCount: 72,
    initials: "RM",
    tone: "ink",
  },
  {
    id: "p4",
    name: "星乃叶月",
    originalName: "星乃はづき",
    romanizedName: "Hazuki Hoshino",
    status: "资料待确认",
    debutYear: 2024,
    workCount: 11,
    initials: "HH",
    tone: "gold",
  },
];

export const demoWorks: DemoWork[] = [
  {
    id: "w1",
    code: "DEMO-001",
    title: "纸月的记录",
    originalTitle: "紙月の記録",
    releaseYear: 2026,
    maker: "月光映画",
    cast: ["天海遥"],
    tone: "moon",
  },
  {
    id: "w2",
    code: "DEMO-014",
    title: "午后三点",
    originalTitle: "午後三時",
    releaseYear: 2025,
    maker: "白昼制作",
    cast: ["白石澪", "水原凛"],
    tone: "afternoon",
  },
  {
    id: "w3",
    code: "DEMO-028",
    title: "沿海列车",
    originalTitle: "海沿いの列車",
    releaseYear: 2026,
    maker: "青波社",
    cast: ["星乃叶月"],
    tone: "coast",
  },
  {
    id: "w4",
    code: "DEMO-036",
    title: "无声花园",
    originalTitle: "静かな庭",
    releaseYear: 2024,
    maker: "庭园企画",
    cast: ["天海遥", "白石澪"],
    tone: "garden",
  },
];
