import type { Profile } from "@/lib/model/types";
import { changeLayout, hasSidebar, type TemplateSpec } from "@/lib/templates/spec";
import { CvDocument } from "./cv-document";

/**
 * A cover letter that matches the CV: the same header, fonts, colours and page. Sidebar layouts
 * use a split header, since a letter reads best as one column.
 */
export function LetterDocument({ spec, cv, text, photoUrl }: { spec: TemplateSpec; cv: Profile; text: string; photoUrl?: string | null }) {
  const letterSpec = hasSidebar(spec.layout) ? changeLayout(spec, "split-header") : spec;
  const header: Profile = { ...cv, summary: "", experience: [], education: [], skills: [], projects: [], certifications: [], languages: [] };
  return (
    <div className="cv-letter">
      <CvDocument spec={letterSpec} cv={header} photoUrl={photoUrl} label="Cover letter">
        <div className="cv-letter-body">
          {text
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p, i) => (
              <p key={i}>
                {p.split("\n").map((line, j) => (
                  <span key={j}>
                    {j > 0 && <br />}
                    {line}
                  </span>
                ))}
              </p>
            ))}
        </div>
      </CvDocument>
    </div>
  );
}
