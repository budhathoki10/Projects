import type { Profile } from "@/lib/model/types";

/** A made-up person used for template thumbnails and the public gallery. */
export const SAMPLE_PROFILE: Profile = {
  name: "Maya Thapa",
  headline: "Operations Coordinator",
  email: "maya.thapa@example.com",
  phone: "+977 9800000000",
  location: "Lalitpur, Nepal",
  links: ["linkedin.com/in/mayathapa"],
  summary:
    "Operations coordinator with five years keeping busy teams on schedule. Good with suppliers, spreadsheets and people under pressure. Looking for a role where planning and follow-through make a visible difference.",
  experience: [
    {
      id: "e1",
      title: "Operations Coordinator",
      company: "Himal Logistics",
      location: "Kathmandu",
      start: "Mar 2022",
      end: "Present",
      bullets: [
        "Planned weekly delivery routes for 14 drivers, cutting late deliveries from 18% to 6%",
        "Set up a shared stock sheet that three warehouses now use every day",
        "Handled supplier calls and resolved 30 to 40 order problems a week",
      ],
    },
    {
      id: "e2",
      title: "Office Assistant",
      company: "Everest Travel Co.",
      location: "Pokhara",
      start: "Jun 2019",
      end: "Feb 2022",
      bullets: [
        "Booked travel for 200+ guests a season and kept every booking record up to date",
        "Trained 4 new staff on the booking system and front desk routine",
      ],
    },
  ],
  education: [{ id: "d1", school: "Tribhuvan University", degree: "BBA, Management", start: "2015", end: "2019", details: [] }],
  skills: ["Excel", "Route planning", "Supplier management", "Inventory", "Customer service", "Google Workspace"],
  projects: [],
  certifications: ["Google Project Management Certificate"],
  languages: ["Nepali", "English", "Hindi"],
};
