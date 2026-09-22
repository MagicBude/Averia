export type DemoPerson = {
  id: string;
  slug: string;
  name: string;
  originalName: string;
  romanizedName: string;
  status: "活跃" | "引退" | "资料待确认";
  debutYear: number;
  workCount: number;
  initials: string;
  tone: string;
  aliases: string[];
  biography: string;
  timeline: Array<{ year: number; label: string; detail: string }>;
};

export type DemoWork = {
  id: string;
  slug: string;
  code: string;
  title: string;
  originalTitle: string;
  releaseYear: number;
  maker: string;
  cast: string[];
  tone: string;
  runtimeMinutes: number;
  tags: string[];
  synopsis: string;
};

// 公开预览只使用虚构数据，避免把功能开发与真实成人资料混在一起。
export const demoPeople: DemoPerson[] = [
  {
    id: "p1",
    slug: "haruka-amami",
    name: "天海遥",
    originalName: "天海はるか",
    romanizedName: "Haruka Amami",
    status: "活跃",
    debutYear: 2022,
    workCount: 38,
    initials: "AH",
    tone: "coral",
    aliases: ["天海はるか", "Haruka Amami"],
    biography: "以清晰的多语言署名和稳定的作品关系为示例建立的虚构人物档案。",
    timeline: [
      { year: 2022, label: "出道", detail: "首次公开职业活动记录" },
      { year: 2024, label: "艺名确认", detail: "中文译名与罗马字完成来源核对" },
    ],
  },
  {
    id: "p2",
    slug: "mio-shiraishi",
    name: "白石澪",
    originalName: "白石みお",
    romanizedName: "Mio Shiraishi",
    status: "活跃",
    debutYear: 2021,
    workCount: 54,
    initials: "MS",
    tone: "sage",
    aliases: ["白石みお", "Mio Shiraishi"],
    biography: "用于展示活跃年份、厂牌合作和多人作品关系的虚构档案。",
    timeline: [
      { year: 2021, label: "出道", detail: "首次公开职业活动记录" },
      { year: 2025, label: "合作记录", detail: "新增白昼制作合作关系" },
    ],
  },
  {
    id: "p3",
    slug: "rin-mizuhara",
    name: "水原凛",
    originalName: "水原りん",
    romanizedName: "Rin Mizuhara",
    status: "引退",
    debutYear: 2018,
    workCount: 72,
    initials: "RM",
    tone: "ink",
    aliases: ["水原りん", "Rin Mizuhara"],
    biography: "用于展示完整职业时间线与引退状态的虚构人物档案。",
    timeline: [
      { year: 2018, label: "出道", detail: "首次公开职业活动记录" },
      { year: 2024, label: "引退", detail: "公开职业活动结束" },
    ],
  },
  {
    id: "p4",
    slug: "hazuki-hoshino",
    name: "星乃叶月",
    originalName: "星乃はづき",
    romanizedName: "Hazuki Hoshino",
    status: "资料待确认",
    debutYear: 2024,
    workCount: 11,
    initials: "HH",
    tone: "gold",
    aliases: ["星乃はづき", "Hazuki Hoshino"],
    biography: "用于展示来源尚未完全确认时，前台如何克制表达不确定性的虚构档案。",
    timeline: [{ year: 2024, label: "首次记录", detail: "来源之间存在日期精度差异，等待审核" }],
  },
];

export const demoWorks: DemoWork[] = [
  {
    id: "w1",
    slug: "paper-moon-record",
    code: "DEMO-001",
    title: "纸月的记录",
    originalTitle: "紙月の記録",
    releaseYear: 2026,
    maker: "月光映画",
    cast: ["天海遥"],
    tone: "moon",
    runtimeMinutes: 128,
    tags: ["单体作品", "数字发行"],
    synopsis: "用于演示作品主记录与发行版本关系的虚构作品。",
  },
  {
    id: "w2",
    slug: "three-in-the-afternoon",
    code: "DEMO-014",
    title: "午后三点",
    originalTitle: "午後三時",
    releaseYear: 2025,
    maker: "白昼制作",
    cast: ["白石澪", "水原凛"],
    tone: "afternoon",
    runtimeMinutes: 142,
    tags: ["多人出演", "数字发行"],
    synopsis: "用于演示多人出演关系和跨人物跳转的虚构作品。",
  },
  {
    id: "w3",
    slug: "coastal-train",
    code: "DEMO-028",
    title: "沿海列车",
    originalTitle: "海沿いの列車",
    releaseYear: 2026,
    maker: "青波社",
    cast: ["星乃叶月"],
    tone: "coast",
    runtimeMinutes: 116,
    tags: ["单体作品", "系列作品"],
    synopsis: "用于演示系列与发行商字段的虚构作品。",
  },
  {
    id: "w4",
    slug: "silent-garden",
    code: "DEMO-036",
    title: "无声花园",
    originalTitle: "静かな庭",
    releaseYear: 2024,
    maker: "庭园企画",
    cast: ["天海遥", "白石澪"],
    tone: "garden",
    runtimeMinutes: 135,
    tags: ["多人出演", "实体发行"],
    synopsis: "用于演示同一内容拥有不同发行版本的虚构作品。",
  },
];
