import familyHubImg from "@/assets/screens/family-hub.webp";
import medVaultImg from "@/assets/screens/med-vault.webp";
import travelCompanionImg from "@/assets/screens/travel-companion.webp";
import interactionsSafetyImg from "@/assets/screens/interactions-safety.webp";
import wellnessTrackerImg from "@/assets/screens/wellness-tracker.webp";
import remindersScheduleImg from "@/assets/screens/reminders-schedule.webp";

export interface ScreenMediaAsset {
  src: string;
  lqip: string;
}

export const SCREEN_MEDIA = {
  familyHub: {
    src: familyHubImg,
    lqip: "data:image/webp;base64,UklGRr4AAABXRUJQVlA4ILIAAAAQBQCdASoYAA0APt1cpkyopSOiMAgBEBuJZgCdMoR4H+AOoygcdNo2K1UVAtKOVZIAAP61aTm6EfqrgLxg+9ZckY9Mb9Od0TTHcoCBC9IslwXvjiMRMKhbdaJ4lARZA9pJ2AB2SOZjZRrUBEw4A78CPJtegsRn2P0LcUvFCYAv3DLSkkkJRpN1xGQ/nV54Kb9yflyTNGld1GMTSJ+PCKycVuFE2DcmvyphzI5WW6CCAAAA",
  },
  medVault: {
    src: medVaultImg,
    lqip: "data:image/webp;base64,UklGRroAAABXRUJQVlA4IK4AAAAwBACdASoYAA0APt1apkyopSOiMAgBEBuJagCdMoAlrwlWLxPqKKnZx5AA/tRZWv/PZr8Ie0e5Rp/sRHKJT5NyMknlQglgd/VZAa1lXgpFjMrw0+4TQLMcz1REWK3yVWgsidlZd4FFriD90RnZGfX4/EoeY1rkDViD+/HmWTztahsjeNyhdMBy6zJ3PmezBOFUY+ke9RJ+Oozzu1eLLmlrBiYTYQ9k79O7A05vMAA=",
  },
  travelCompanion: {
    src: travelCompanionImg,
    lqip: "data:image/webp;base64,UklGRsgAAABXRUJQVlA4ILwAAACwBACdASoYAA0APt1apkyopSOiMAgBEBuJQBOmUGVuRAM3hVCQaCI9N1+bYMYAAP7iLUAKyc8gZ4mYuW9wE5O/rIOoY/BIh697BMuox2O5UXWojaIJrQPHJnrr64+xRSQ2Oiy9ou4SWsVdCLKF9FIrbeVfPQBdxd4f9TIQUubUIv7ac0Hh4empLU8sb7Z7cQVX+kvqGc25JiuJBWEHr//a7MKseIwZcWnvwt8R3niYxPU+VA5ejaz+BWkAAA==",
  },
  interactionsSafety: {
    src: interactionsSafetyImg,
    lqip: "data:image/webp;base64,UklGRr4AAABXRUJQVlA4ILIAAADwBACdASoYAA0APt1cpkyopSOiMAgBEBuJYgDCgYuk5gA9WP4CK4jtdTr67y83yoAA/u4xpSrrKPW0mVl99Zz8QK20ub1WeAuXqB5rAQHq+uDD+YGefJPBegJqYAECtDboQOoOpOW2e02EY53NKfjusJtEWoFlh+DT3MBeVC466ASM4eU7BHvcX9QUrY+cKwPTEWQ+cvB/W1f3zKEQti18hLALCbHXXb6uj2JROboOIAAA",
  },
  wellnessTracker: {
    src: wellnessTrackerImg,
    lqip: "data:image/webp;base64,UklGRqIAAABXRUJQVlA4IJYAAAAQBACdASoYAA0APt1apkyopSOiMAgBEBuJYwCsACFyqfPn9QJ5PQGNkAD+18//S7/akcR+nJ6CiqC7MEyLpJi7nFMY0JllcTEMBXLMGBl+C+WzUkuR5wRS1ZSUDAO+YIfgcsY/ilyDTg/gSR+Jq67mLgN8em95e3ip/h/awGojKeO+rWb2W3Z48TjuOaEmn8iM8bgAAAA=",
  },
  remindersSchedule: {
    src: remindersScheduleImg,
    lqip: "data:image/webp;base64,UklGRrIAAABXRUJQVlA4IKYAAAAQBACdASoYAA0APt1apkyopSOiMAgBEBuJQBOmUAAqiMMaVtlld7Mk9ADyX8WQfMDUFj+5ewAr/ls/k2RlmXQblE9oQe+4D1HmBn+FWHfhYpE5bZiXt1byQvb8IMouUcd4J4YBrkAZw28TvxoMbz+mNuBrl8QrAGksk1HrSqwULPgkWQ/vB1d+JG1eRMiu25blIDdaRLjXtoYJ8URhl1/i/0FvgAAA",
  },
} as const satisfies Record<string, ScreenMediaAsset>;

const LQIP_BY_SRC = new Map<string, string>(
  Object.values(SCREEN_MEDIA).map((item) => [item.src, item.lqip])
);

export function getScreenLqip(src: string): string | undefined {
  return LQIP_BY_SRC.get(src);
}
