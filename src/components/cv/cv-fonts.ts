import {
  DM_Sans,
  EB_Garamond,
  Fraunces,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Inter,
  Lato,
  Libre_Baskerville,
  Lora,
  Manrope,
  Merriweather,
  Nunito_Sans,
  Playfair_Display,
  Roboto,
  Source_Sans_3,
  Source_Serif_4,
  Space_Grotesk,
  Work_Sans,
} from "next/font/google";

// next/font needs each call assigned to a module-level const, with literal options. Not
// preloaded: a browser only downloads the files for the fonts a CV on screen actually uses.
const f0 = Inter({ subsets: ["latin"], display: "swap", preload: false, variable: "--cvf-inter" });
const f1 = Source_Sans_3({ subsets: ["latin"], display: "swap", preload: false, variable: "--cvf-source-sans" });
const f2 = IBM_Plex_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--cvf-plex-sans" });
const f3 = Work_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--cvf-work-sans" });
const f4 = Manrope({ subsets: ["latin"], display: "swap", preload: false, variable: "--cvf-manrope" });
const f5 = DM_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--cvf-dm-sans" });
const f6 = Lato({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "700"], variable: "--cvf-lato" });
const f7 = Nunito_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--cvf-nunito-sans" });
const f8 = Roboto({ subsets: ["latin"], display: "swap", preload: false, variable: "--cvf-roboto" });
const f9 = Space_Grotesk({ subsets: ["latin"], display: "swap", preload: false, variable: "--cvf-space-grotesk" });
const f10 = Source_Serif_4({ subsets: ["latin"], display: "swap", preload: false, variable: "--cvf-source-serif" });
const f11 = Merriweather({ subsets: ["latin"], display: "swap", preload: false, variable: "--cvf-merriweather" });
const f12 = Lora({ subsets: ["latin"], display: "swap", preload: false, variable: "--cvf-lora" });
const f13 = EB_Garamond({ subsets: ["latin"], display: "swap", preload: false, variable: "--cvf-garamond" });
const f14 = Libre_Baskerville({ subsets: ["latin"], display: "swap", preload: false, variable: "--cvf-baskerville" });
const f15 = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--cvf-playfair" });
const f16 = Fraunces({ subsets: ["latin"], display: "swap", preload: false, variable: "--cvf-fraunces" });
const f17 = IBM_Plex_Mono({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "600"], variable: "--cvf-plex-mono" });

/** Put this class on any element that contains CVs, so their font variables resolve. */
export const cvFontVariables = [f0, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12, f13, f14, f15, f16, f17].map((f) => f.variable).join(" ");
