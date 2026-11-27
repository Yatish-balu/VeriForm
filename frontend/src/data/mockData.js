/**
 * Default structures and schemas for VeriForm (Roll Call AI).
 * All mock/fake student names and mock records have been removed in favor of live data.
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
  id: '',
  fileName: '',
  fileSizeLabel: '',
  uploadedAtLabel: '',
  fileType: '',
  isSample: false,
  sheetMeta: {
    institutionHeader: '',
    formTitle: '',
    examName: '',
    roomNo: '',
    branch: '',
    semester: '',
    sessionTime: '',
    examDate: '',
    subjectCode: '',
    footerLeft: '',
    footerRight: '',
  },
  students: [],
  qualityChecks: [],
  warningBanner: null,
};

export const INITIAL_REVIEW_DOUBTS = [];

export const MOCK_FORM_HISTORY = [];

export const MOCK_ROOM_SUMMARIES = {};

export const MOCK_BRANCH_SUMMARIES = {};

export function generateMockChatReply(query, currentSheet, openDoubtsCount) {
  return 'VeriForm AI is connected to your live FastAPI backend and Supabase database. Please ensure your backend is running at http://localhost:8000 and submit your query.';
}
