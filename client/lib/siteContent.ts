export type SiteContent = {
  siteTitle: string;
  heroHeading: string;
  heroSubheading: string;
  ctaPrimary: string;
  ctaSecondary: string;
  programsIntro: string;
  aboutHtml: string;
  address: string;
  email: string;
  phone: string;
};

const DEFAULT: SiteContent = {
  siteTitle: "InTune Music Tuition",
  heroHeading: "InTune Music Tuition",
  heroSubheading: "Based in Seafield, West Lothian — individual and group lessons for all ages. First lesson free of charge.",
  ctaPrimary: "Enquire now",
  ctaSecondary: "Our lessons",
  programsIntro: "Lessons available in-person and online via Skype or Zoom. Group sessions and masterclasses available.",
  aboutHtml: `InTune Music Tuition is based in Seafield, West Lothian. We provide modern, approachable lessons for all ages and levels — from beginners to advanced students preparing for performances and exams. Our tutors are qualified, friendly and experienced, offering both 1-2-1 and group sessions, as well as online lessons via Skype or Zoom.`,
  address: "Music Studio, East Pavilion, Blackburn House, Redhouse Road, Seafield, West Lothian, EH47 7AQ, UK",
  email: "bookings@intunemusictuition.co.uk",
  phone: "+44 7359 224618",
};

export function getSiteContent(): SiteContent {
  try {
    const raw = localStorage.getItem('inTuneContent');
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...(JSON.parse(raw) as Partial<SiteContent>) };
  } catch (e) {
    return DEFAULT;
  }
}

export function setSiteContent(content: Partial<SiteContent>) {
  const next = { ...getSiteContent(), ...content };
  localStorage.setItem('inTuneContent', JSON.stringify(next));
}

export { DEFAULT as DEFAULT_SITE_CONTENT };
