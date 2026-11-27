"""
Extract real student rosters from Semester-3 and Semester-5 PDFs.
"""

import re
from pathlib import Path
import pypdf

def parse_students_from_tokens(tokens: list[str]) -> list[dict]:
    students = []
    usn_pattern = re.compile(r'^(1DS\d{2}[A-Z]{2}\d{3}|26UGDS\d{4})$')
    
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        if re.match(r'^\d+\.?$', tok):
            if i + 1 < len(tokens) and usn_pattern.match(tokens[i+1]):
                sl = int(tok.rstrip('.'))
                usn = tokens[i+1]
                name_parts = []
                j = i + 2
                while j < len(tokens):
                    if re.match(r'^\d+\.?$', tokens[j]) and j + 1 < len(tokens) and usn_pattern.match(tokens[j+1]):
                        break
                    if tokens[j] in ['Head,', 'Principal', 'Dept.', 'Department']:
                        break
                    name_parts.append(tokens[j])
                    j += 1
                name = ' '.join(name_parts)
                branch = "CY"
                students.append({'sl_no': sl, 'usn': usn, 'name': name, 'branch': branch})
                i = j - 1
        i += 1
    return students

def get_all_roster_students():
    p3 = Path(__file__).resolve().parent.parent.parent / "Student list Semester -3.pdf"
    p5 = Path(__file__).resolve().parent.parent.parent / "student list Semester-5.pdf"

    t3 = [t.strip() for t in pypdf.PdfReader(str(p3)).pages[0].extract_text().split() if t.strip()]
    s3 = parse_students_from_tokens(t3)

    t5 = [t.strip() for t in pypdf.PdfReader(str(p5)).pages[0].extract_text().split() if t.strip()]
    s5 = parse_students_from_tokens(t5)

    return s3, s5

if __name__ == "__main__":
    s3, s5 = get_all_roster_students()
    print(f"Sem 3 students extracted: {len(s3)} (Max sl: {s3[-1]['sl_no'] if s3 else 0})")
    print(f"Sem 5 students extracted: {len(s5)} (Max sl: {s5[-1]['sl_no'] if s5 else 0})")
    
    print("\nSample Sem 3:")
    for s in s3[:5]:
        print(s)
    print("...")
    for s in s3[-5:]:
        print(s)

    print("\nSample Sem 5:")
    for s in s5[:5]:
        print(s)
    print("...")
    for s in s5[-5:]:
        print(s)
