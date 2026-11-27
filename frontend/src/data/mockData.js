/**
 * Clearly separated mock dataset for VeriForm (Roll Call AI).
 * Used when VITE_USE_MOCK_DATA=true or when the local FastAPI backend is unreachable.
 * Never claims real Gemini AI extraction occurred when running in mock mode.
 */

export const WORKSPACES = [
  {
    id: 'ws-2025-26',
    name: 'Academic workspace',
    subtitle: 'Exam Cell · 2025–26',
    semesterScope: 'Odd & Even Semesters',
  },
  {
    id: 'ws-2024-25',
    name: 'Academic workspace',
    subtitle: 'Exam Cell · 2024–25',
    semesterScope: 'Archived Academic Cycle',
  },
  {
    id: 'ws-supp-2026',
    name: 'Supplementary cell',
    subtitle: 'Makeup Exam · 2025–26',
    semesterScope: 'Backlog & Re-exam Sheets',
  },
];

export const SAMPLE_FORM_DOCUMENT = {
  id: '11111111-1111-1111-1111-111111111111',
  fileName: 'CDS105_CIA-III_FormB.jpg',
  fileSizeLabel: '2.4 MB',
  uploadedAtLabel: 'Uploaded just now',
  fileType: 'sample/form-b',
  isSample: true,
  sheetMeta: {
    institutionHeader: 'EXAMINATION CELL',
    formTitle: 'FORM-B - ATTENDANCE RECORD',
    examName: 'CIA Test-III',
    roomNo: 'CDS 105',
    branch: 'Cyber Security',
    semester: 'IV',
    sessionTime: '09:30 AM – 11:00 AM',
    examDate: '2026-11-03',
    subjectCode: '22CY42',
    footerLeft: 'Invigilator signature',
    footerRight: 'Page 1 of 1',
  },
  students: [
    { slNo: '01', usn: '1DS23CY037', name: 'Aarav Sharma', status: 'Present', confidence: 0.98, aiNote: null },
    { slNo: '02', usn: '1DS23CY038', name: 'Ananya Rao', status: 'Present', confidence: 0.96, aiNote: null },
    { slNo: '03', usn: '1DS23CY039', name: 'Dev Patel', status: 'Absent', confidence: 0.93, aiNote: 'Written "Ab" mark detected' },
    { slNo: '04', usn: '1DS23CY040', name: 'Ishita Kumar', status: 'Present', confidence: 0.95, aiNote: null },
    { slNo: '05', usn: '1DS23CY041', name: 'Rohan Mehta', status: 'Present', confidence: 0.97, aiNote: null },
    { slNo: '06', usn: '1DS23CY042', name: 'Sana Ahmed', status: 'Present', confidence: 0.94, aiNote: null },
    { slNo: '07', usn: '1DS23CY043', name: 'Vihaan Reddy', status: 'Present', confidence: 0.92, aiNote: null },
  ],
  qualityChecks: [
    {
      id: 'sharpness',
      label: 'Image sharpness',
      description: 'Text is clear and readable',
      statusLabel: 'Sharp',
      tone: 'success',
      tooltip:
        'Laplacian edge-variance check passed (score 94/100). Printed USNs, student names, and attendance marks are crisp for OCR.',
    },
    {
      id: 'lighting',
      label: 'Lighting',
      description: 'Slightly dark at the footer',
      statusLabel: 'Low light',
      tone: 'warning',
      tooltip:
        'Lower 15% of the page has reduced luminance near the invigilator signature line. Attendance rows remain unaffected.',
    },
    {
      id: 'coverage',
      label: 'Document coverage',
      description: 'All page edges detected',
      statusLabel: 'Complete',
      tone: 'success',
      tooltip:
        'All four margins, header metadata, and table columns lie cleanly inside the frame with zero clipping.',
    },
  ],
  warningBanner: {
    title: 'Low light detected near the footer.',
    subtitle: 'Attendance rows are readable. Double-check the signature during review.',
  },
};

export const INITIAL_REVIEW_DOUBTS = [
  {
    id: 'doubt-101',
    form_id: '11111111-1111-1111-1111-111111111111',
    room_no: 'CDS 105',
    exam_name: 'CIA Test-III · 22CY42',
    sl_no: 3,
    usn: '1DS23CY039',
    student_name: 'Dev Patel',
    type: 'ab_mark',
    message: 'Row 03 (1DS23CY039): "Ab" entry detected in red ink — confirm Absent status.',
    ai_guess: 'absent',
    confidence: 0.72,
    resolved: false,
    resolution: null,
  },
  {
    id: 'doubt-102',
    form_id: '22222222-2222-2222-2222-222222222222',
    room_no: 'CDS 108',
    exam_name: 'CIA Test-III · 22CY44',
    sl_no: 14,
    usn: '1DS23CY051',
    student_name: 'Karthik Nair',
    type: 'low_confidence',
    message: 'Row 14 (1DS23CY051): Faint diagonal stroke in signature cell (confidence 64%).',
    ai_guess: 'unclear',
    confidence: 0.64,
    resolved: false,
    resolution: null,
  },
  {
    id: 'doubt-103',
    form_id: '22222222-2222-2222-2222-222222222222',
    room_no: 'CDS 108',
    exam_name: 'CIA Test-III · 22CY44',
    sl_no: null,
    usn: 'FOOTER',
    student_name: 'Sheet Total Check',
    type: 'footer_mismatch',
    message: 'Footer written count says "30+1" present, AI counted 30 definite signatures.',
    ai_guess: 'present',
    confidence: 0.69,
    resolved: false,
    resolution: null,
  },
  {
    id: 'doubt-104',
    form_id: '33333333-3333-3333-3333-333333333333',
    room_no: 'CSE 204',
    exam_name: 'CIA Test-III · 22CS41',
    sl_no: 22,
    usn: '1DS23CS088',
    student_name: 'Meera Krishnan',
    type: 'present_then_absent',
    message: 'Row 22 (1DS23CS088): Present in 09:30 AM session, marked absent in afternoon sheet.',
    ai_guess: 'absent',
    confidence: 0.74,
    resolved: false,
    resolution: null,
  },
];

export const MOCK_FORM_HISTORY = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    file_name: 'CDS105_CIA-III_FormB.jpg',
    room_no: 'CDS 105',
    exam_name: 'CIA Test-III · Cyber Security',
    semester: 'IV',
    department: 'Cyber Security',
    status: 'needs_review',
    open_doubts: 1,
    total_students: 7,
    present_count: 6,
    absent_count: 1,
    created_at: '2026-11-27T01:30:00Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    file_name: 'CDS108_CIA-III_FormB.jpg',
    room_no: 'CDS 108',
    exam_name: 'CIA Test-III · Cyber Security',
    semester: 'IV',
    department: 'Cyber Security',
    status: 'needs_review',
    open_doubts: 2,
    total_students: 36,
    present_count: 30,
    absent_count: 5,
    created_at: '2026-11-26T16:45:00Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    file_name: 'CSE204_CIA-III_FormB.jpg',
    room_no: 'CSE 204',
    exam_name: 'CIA Test-III · Computer Science',
    semester: 'IV',
    department: 'Computer Science',
    status: 'needs_review',
    open_doubts: 1,
    total_students: 42,
    present_count: 39,
    absent_count: 3,
    created_at: '2026-11-26T14:20:00Z',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    file_name: 'CDS102_CIA-III_FormB.jpg',
    room_no: 'CDS 102',
    exam_name: 'CIA Test-III · Cyber Security',
    semester: 'VI',
    department: 'Cyber Security',
    status: 'final',
    open_doubts: 0,
    total_students: 34,
    present_count: 33,
    absent_count: 1,
    created_at: '2026-11-25T11:10:00Z',
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    file_name: 'ISE301_CIA-III_FormB.jpg',
    room_no: 'ISE 301',
    exam_name: 'CIA Test-III · Information Science',
    semester: 'IV',
    department: 'Information Science',
    status: 'final',
    open_doubts: 0,
    total_students: 40,
    present_count: 38,
    absent_count: 2,
    created_at: '2026-11-24T09:50:00Z',
  },
];

export const MOCK_ROOM_SUMMARIES = {
  'CDS 105': {
    room_no: 'CDS 105',
    sessions: [
      {
        session_id: 's-cds105-1',
        exam_date: '2026-11-03',
        subject_code: '22CY42',
        total: 7,
        present: 6,
        absent: 1,
        unclear: 0,
        percentage: 85.7,
        present_students: [
          { usn: '1DS23CY037', name: 'Aarav Sharma', branch: 'CY' },
          { usn: '1DS23CY038', name: 'Ananya Rao', branch: 'CY' },
          { usn: '1DS23CY040', name: 'Ishita Kumar', branch: 'CY' },
          { usn: '1DS23CY041', name: 'Rohan Mehta', branch: 'CY' },
          { usn: '1DS23CY042', name: 'Sana Ahmed', branch: 'CY' },
          { usn: '1DS23CY043', name: 'Vihaan Reddy', branch: 'CY' },
        ],
        absent_students: [{ usn: '1DS23CY039', name: 'Dev Patel', branch: 'CY' }],
      },
    ],
  },
  'CDS 108': {
    room_no: 'CDS 108',
    sessions: [
      {
        session_id: 's-cds108-1',
        exam_date: '2026-11-03',
        subject_code: '22CY44',
        total: 36,
        present: 30,
        absent: 5,
        unclear: 1,
        percentage: 83.3,
        present_students: [
          { usn: '1DS23CY044', name: 'Aditi Joshi', branch: 'CY' },
          { usn: '1DS23CY045', name: 'Nikhil Verma', branch: 'CY' },
        ],
        absent_students: [
          { usn: '1DS23CY052', name: 'Pranav Kulkarni', branch: 'CY' },
          { usn: '1DS23CY059', name: 'Tanya Sen', branch: 'CY' },
        ],
      },
    ],
  },
  'CSE 204': {
    room_no: 'CSE 204',
    sessions: [
      {
        session_id: 's-cse204-1',
        exam_date: '2026-11-04',
        subject_code: '22CS41',
        total: 42,
        present: 39,
        absent: 3,
        unclear: 0,
        percentage: 92.9,
        present_students: [
          { usn: '1DS23CS080', name: 'Vikram Singh', branch: 'CS' },
          { usn: '1DS23CS081', name: 'Neha Hegde', branch: 'CS' },
        ],
        absent_students: [{ usn: '1DS23CS088', name: 'Meera Krishnan', branch: 'CS' }],
      },
    ],
  },
};

export const MOCK_BRANCH_SUMMARIES = {
  CY: {
    branch: 'CY',
    branchName: 'Cyber Security',
    sessions: [
      {
        session_id: 'b-cy-1',
        exam_date: '2026-11-02',
        subject_code: '22CY41',
        total: 43,
        present: 40,
        absent: 3,
        percentage: 93.0,
      },
      {
        session_id: 'b-cy-2',
        exam_date: '2026-11-03',
        subject_code: '22CY42',
        total: 43,
        present: 36,
        absent: 7,
        percentage: 83.7,
      },
      {
        session_id: 'b-cy-3',
        exam_date: '2026-11-05',
        subject_code: '22CY44',
        total: 43,
        present: 41,
        absent: 2,
        percentage: 95.3,
      },
    ],
  },
  CS: {
    branch: 'CS',
    branchName: 'Computer Science & Engineering',
    sessions: [
      {
        session_id: 'b-cs-1',
        exam_date: '2026-11-04',
        subject_code: '22CS41',
        total: 42,
        present: 39,
        absent: 3,
        percentage: 92.9,
      },
    ],
  },
  IS: {
    branch: 'IS',
    branchName: 'Information Science & Engineering',
    sessions: [
      {
        session_id: 'b-is-1',
        exam_date: '2026-11-04',
        subject_code: '22IS41',
        total: 40,
        present: 38,
        absent: 2,
        percentage: 95.0,
      },
    ],
  },
};

export function generateMockChatReply(query, currentSheet, openDoubtsCount) {
  const q = query.toLowerCase();
  const absentees = currentSheet.students.filter((s) => s.status === 'Absent');
  const presents = currentSheet.students.filter((s) => s.status === 'Present');

  if (q.includes('absent') || q.includes('missing') || q.includes('cds 105')) {
    const names = absentees.map((s) => `${s.name} (${s.usn})`).join(', ') || 'None recorded';
    return `In **${currentSheet.sheetMeta.roomNo}** (${currentSheet.sheetMeta.examName}, ${currentSheet.sheetMeta.branch}):\n• Present: ${presents.length} of ${currentSheet.students.length}\n• Absent: ${absentees.length} — ${names}\n\n[Demo mode: answered from local sheet data, not live backend Gemini API]`;
  }

  if (q.includes('review') || q.includes('doubt') || q.includes('flag') || q.includes('queue')) {
    return `There are currently **${openDoubtsCount} open items** in the Review Queue across uploaded Form-B sheets, including low-light footer verification on \`${currentSheet.fileName}\` and an \`Ab\` confirmation for Dev Patel (\`1DS23CY039\`).\n\n[Demo mode: answered from local review queue]`;
  }

  if (q.includes('branch') || q.includes('cyber') || q.includes('cy') || q.includes('summary')) {
    return `**Cyber Security (CY)** summary across recent CIA Test-III sessions:\n• 22CY41: 40/43 present (93.0%)\n• 22CY42: 36/43 present (83.7%)\n• 22CY44: 41/43 present (95.3%)\n\n[Demo mode: answered from mock branch summaries]`;
  }

  return `I inspected **${currentSheet.fileName}** (Room ${currentSheet.sheetMeta.roomNo}, ${currentSheet.sheetMeta.branch}, Sem ${currentSheet.sheetMeta.semester}): ${presents.length} Present, ${absentees.length} Absent. Note that lighting is slightly dark near the footer, so verify the invigilator signature during review.\n\n[Demo mode: local workspace response — connect FastAPI backend for live Gemini function calling]`;
}
