import re
from typing import List, Dict, Set, Tuple, Any
from ..models.schemas import (
    PresentationData,
    DocumentStructure,
    ValidationReport,
    ValidationMetricCheck,
)


class SemanticValidator:
    """
    Validates numerical integrity, named entities, and completeness
    between the original PPT presentation and generated Word document structure.
    """

    # Regex patterns for metrics, percentages, currency, version numbers
    NUMBER_PATTERN = re.compile(r"\b\d+(?:\.\d+)?%?|\$\d+(?:,\d{3})*(?:\.\d+)?\b")
    TECH_TERM_PATTERN = re.compile(r"\b[A-Z][a-zA-Z0-9_-]+(?:[0-9]+[a-zA-Z]*|[A-Z][a-z]+)\b")

    def validate(
        self, original: PresentationData, generated: DocumentStructure
    ) -> ValidationReport:
        metric_checks: List[ValidationMetricCheck] = []
        terminology_checks: List[Dict[str, Any]] = []
        warnings: List[str] = []

        total_checked = 0
        verified_count = 0
        flagged_count = 0

        # Build full generated text map per slide
        generated_slide_texts: Dict[int, str] = {}
        full_generated_text = (generated.title or "") + " " + (generated.executive_summary or "")
        for sec in generated.sections:
            sec_text = sec.section_title + " "
            for p in sec.paragraphs:
                sec_text += p.text + " "
            for c in sec.diagram_callouts:
                sec_text += c + " "
            for t in sec.tables:
                sec_text += " ".join(t.headers) + " "
                for row in t.rows:
                    sec_text += " ".join(row) + " "
            generated_slide_texts[sec.slide_number] = sec_text
            full_generated_text += " " + sec_text

        # 1. Check Numerical Consistency per Slide
        for orig_slide in original.slides:
            s_num = orig_slide.slide_number
            slide_raw = (orig_slide.title or "") + " "
            slide_raw += " ".join(orig_slide.raw_paragraphs) + " "
            slide_raw += " ".join(b.text for b in orig_slide.bullets) + " "
            for t in orig_slide.tables:
                slide_raw += " ".join(t.headers) + " "
                for row in t.rows:
                    slide_raw += " ".join(row) + " "
            if orig_slide.speaker_notes:
                slide_raw += " " + orig_slide.speaker_notes
            for vis in orig_slide.visual_elements:
                if vis.ocr_text:
                    slide_raw += " " + vis.ocr_text

            # Extract numbers from original slide
            orig_numbers = set(self.NUMBER_PATTERN.findall(slide_raw))
            gen_text = generated_slide_texts.get(s_num, full_generated_text)

            for num in orig_numbers:
                if not num or len(num) < 2 and not num.isdigit():
                    continue
                total_checked += 1

                # Check if number appears in generated text
                if num in gen_text or num in full_generated_text:
                    verified_count += 1
                    metric_checks.append(
                        ValidationMetricCheck(
                            metric=num,
                            original_context=self._extract_surrounding_context(slide_raw, num),
                            generated_context=self._extract_surrounding_context(gen_text, num),
                            status="VERIFIED",
                            slide_number=s_num,
                            note="Exact match verified across generated document.",
                        )
                    )
                else:
                    flagged_count += 1
                    warning_msg = f"Slide {s_num}: Metric '{num}' was found in original slide but might be missing or altered in output."
                    warnings.append(warning_msg)
                    metric_checks.append(
                        ValidationMetricCheck(
                            metric=num,
                            original_context=self._extract_surrounding_context(slide_raw, num),
                            generated_context="[Not found in slide section]",
                            status="FLAGGED",
                            slide_number=s_num,
                            note="Potential discrepancy or missing metric.",
                        )
                    )

            # 2. Check Technical Terminology
            orig_terms = set(self.TECH_TERM_PATTERN.findall(slide_raw))
            for term in orig_terms:
                if len(term) <= 3 or term in ["The", "This", "That", "When", "What", "Slide"]:
                    continue
                term_in_doc = term in full_generated_text
                terminology_checks.append({
                    "term": term,
                    "slide_number": s_num,
                    "status": "VERIFIED" if term_in_doc else "FLAGGED",
                })
                if not term_in_doc:
                    warnings.append(f"Slide {s_num}: Terminology '{term}' was omitted in generated document.")

        # 3. Completeness check on sections
        if len(generated.sections) < len(original.slides):
            warnings.append(
                f"Generated document has {len(generated.sections)} sections vs {len(original.slides)} original slides."
            )

        # Calculate Confidence Score
        confidence = 100.0
        if total_checked > 0:
            confidence = round((verified_count / total_checked) * 100, 1)

        return ValidationReport(
            total_metrics_checked=total_checked,
            verified_count=verified_count,
            flagged_count=flagged_count,
            confidence_score=confidence,
            metric_checks=metric_checks,
            terminology_checks=terminology_checks[:15],
            warnings=warnings,
        )

    def _extract_surrounding_context(self, text: str, target: str, window: int = 40) -> str:
        idx = text.find(target)
        if idx == -1:
            return "N/A"
        start = max(0, idx - window)
        end = min(len(text), idx + len(target) + window)
        prefix = "..." if start > 0 else ""
        suffix = "..." if end < len(text) else ""
        return f"{prefix}{text[start:end].strip()}{suffix}"
