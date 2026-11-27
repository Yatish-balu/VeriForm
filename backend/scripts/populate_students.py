"""
Populate Supabase PostgreSQL students table with authentic student lists from:
- Student list Semester -3.pdf (71 students)
- student list Semester-5.pdf (66 students)
Total: 137 real students
"""

import asyncio
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import select, func

from app.db.database import AsyncSessionLocal
from app.models.orm import Student
from scripts.extract_rosters import get_all_roster_students

def format_student_name(raw: str) -> str:
    parts = raw.strip().split()
    formatted = []
    for p in parts:
        if len(p) == 1:
            formatted.append(p.upper())
        elif p.upper() in ["II", "III", "IV", "V"]:
            formatted.append(p.upper())
        else:
            formatted.append(p.capitalize())
    return " ".join(formatted)

async def populate():
    s3, s5 = get_all_roster_students()
    all_students = s3 + s5
    
    print(f"Total students to upsert: {len(all_students)} (Sem3: {len(s3)}, Sem5: {len(s5)})")

    records = []
    for st in all_students:
        cleaned_name = format_student_name(st["name"])
        records.append({
            "usn": st["usn"].strip().upper(),
            "name": cleaned_name,
            "branch": "CY"
        })

    async with AsyncSessionLocal() as session:
        for r in records:
            stmt = (
                insert(Student)
                .values(usn=r["usn"], name=r["name"], branch=r["branch"])
                .on_conflict_do_update(
                    index_elements=[Student.usn],
                    set_={"name": r["name"], "branch": r["branch"]}
                )
            )
            await session.execute(stmt)
        await session.commit()

        # Verify count
        total = await session.scalar(select(func.count(Student.id)))
        print(f"Successfully populated! Total students now in database: {total}")

if __name__ == "__main__":
    asyncio.run(populate())
