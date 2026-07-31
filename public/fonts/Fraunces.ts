import { Fraunces } from "next/font/google";

export const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"], // Explicitly load italics
  axes: ["WONK", "SOFT", "opsz"], // Unlock variable features
});
