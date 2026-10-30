export type DashboardSummary = {
  tasks: Array<{ key: string; label: string; count: number; tone: "orange" | "red" | "blue" | "green" }>;
  today: { confirmedCreators: number; confirmedVideos: number; confirmedAmount: number; publishedCreators: number; publishedVideos: number; publishedAmount: number };
  syncSources: Array<{ name: string; status: string; lastSync: string | null }>;
};

export type Creator = { id: number; creatorName: string; platform: string; operator: string; cooperationCount: number; status: string };
