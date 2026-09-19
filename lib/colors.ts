// One stable colour per member, assigned at registration.
export const USER_COLORS = [
  { name: "indigo", solid: "#6366f1", soft: "rgba(99, 102, 241, 0.18)" },
  { name: "emerald", solid: "#10b981", soft: "rgba(16, 185, 129, 0.18)" },
  { name: "amber", solid: "#f59e0b", soft: "rgba(245, 158, 11, 0.18)" },
  { name: "rose", solid: "#f43f5e", soft: "rgba(244, 63, 94, 0.18)" },
  { name: "sky", solid: "#0ea5e9", soft: "rgba(14, 165, 233, 0.18)" },
  { name: "violet", solid: "#8b5cf6", soft: "rgba(139, 92, 246, 0.18)" },
  { name: "teal", solid: "#14b8a6", soft: "rgba(20, 184, 166, 0.18)" },
  { name: "orange", solid: "#f97316", soft: "rgba(249, 115, 22, 0.18)" },
];

export function userColor(index: number) {
  return USER_COLORS[index % USER_COLORS.length];
}
