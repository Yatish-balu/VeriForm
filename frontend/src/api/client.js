import axios from 'axios';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  INITIAL_REVIEW_DOUBTS,
  MOCK_BRANCH_SUMMARIES,
  MOCK_FORM_HISTORY,
  MOCK_ROOM_SUMMARIES,
  SAMPLE_FORM_DOCUMENT,
  generateMockChatReply,
} from '../data/mockData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const USE_MOCK_ENV = import.meta.env.VITE_USE_MOCK_DATA;
// Default to mock fallback enabled unless explicitly disabled via VITE_USE_MOCK_DATA='false'
const PREFER_MOCK = USE_MOCK_ENV !== 'false';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use(async (config) => {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export async function checkBackendHealth() {
  if (PREFER_MOCK) {
    return { connected: false, mode: 'mock', detail: 'Mock mode active (VITE_USE_MOCK_DATA=true)' };
  }
  try {
    const res = await apiClient.get('/health', { timeout: 3000 });
    return { connected: res.data?.status === 'ok', mode: 'live', detail: `FastAPI v${res.data?.version || '1.0'}` };
  } catch {
    return { connected: false, mode: 'mock', detail: 'Backend unreachable — using local mock data' };
  }
}

/**
 * Extract attendance from uploaded Form-B file.
 * Connects to POST /api/forms/upload when live backend is enabled and a File object is present.
 * Clearly marks mock responses with `isMockResult: true` so the UI never pretends real AI extraction happened.
 */
export async function extractFormAttendance({ file, documentData }) {
  if (!PREFER_MOCK && file instanceof File) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/api/forms/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return {
        isMockResult: false,
        sourceLabel: 'Live Gemini Extraction API',
        form: res.data,
      };
    } catch (err) {
      // Fall through cleanly with explicit notice if backend is offline or Gemini stub raises 500
      const reason = err?.response?.data?.detail || err.message || 'Backend unavailable';
      return buildMockExtractionResult(documentData, `Backend fallback (${reason})`);
    }
  }

  // Simulate realistic short extraction latency for the UI loading state
  await new Promise((r) => setTimeout(r, 1100));
  return buildMockExtractionResult(documentData, 'Mock extraction preview (no live AI call)');
}

function buildMockExtractionResult(documentData, sourceLabel) {
  const rows = (documentData?.students || SAMPLE_FORM_DOCUMENT.students).map((row) => ({
    ...row,
    needsReview:
      row.status === 'Absent' ||
      row.status === 'Unclear' ||
      row.status === 'Needs Review' ||
      row.confidence < 0.85,
  }));

  return {
    isMockResult: true,
    sourceLabel,
    form: {
      id: documentData?.id || SAMPLE_FORM_DOCUMENT.id,
      fileName: documentData?.fileName || SAMPLE_FORM_DOCUMENT.fileName,
      room_no: documentData?.sheetMeta?.roomNo || 'CDS 105',
      exam_name: documentData?.sheetMeta?.examName || 'CIA Test-III',
      semester: documentData?.sheetMeta?.semester || 'IV',
      department: documentData?.sheetMeta?.branch || 'Cyber Security',
      session_time: documentData?.sheetMeta?.sessionTime || '09:30 AM – 11:00 AM',
      status: 'needs_review',
      rows,
      footerSignatureNote:
        documentData?.warningBanner?.title || 'Low light detected near the footer.',
    },
  };
}

export async function fetchFormsList() {
  if (!PREFER_MOCK) {
    try {
      const res = await apiClient.get('/api/forms/');
      return { isMock: false, data: res.data };
    } catch {
      // fallback below
    }
  }
  return { isMock: true, data: MOCK_FORM_HISTORY };
}

export async function fetchReviewDoubts() {
  if (!PREFER_MOCK) {
    try {
      const formsRes = await apiClient.get('/api/forms/');
      const allDoubts = [];
      for (const f of formsRes.data || []) {
        const dRes = await apiClient.get(`/api/forms/${f.id}/doubts`);
        for (const d of dRes.data || []) {
          allDoubts.push({ ...d, room_no: f.room_no, exam_name: f.exam_name });
        }
      }
      return { isMock: false, data: allDoubts };
    } catch {
      // fallback below
    }
  }
  return { isMock: true, data: INITIAL_REVIEW_DOUBTS };
}

export async function resolveDoubtDecision(doubtId, resolution) {
  if (!PREFER_MOCK) {
    try {
      const res = await apiClient.post(`/api/doubts/${doubtId}/resolve`, {
        resolution,
        resolved_by: '00000000-0000-0000-0000-000000000001',
      });
      return { isMock: false, data: res.data };
    } catch {
      // fallback below
    }
  }
  return { isMock: true, data: { id: doubtId, resolution, resolved: true } };
}

export async function finalizeFormRequest(formId) {
  if (!PREFER_MOCK) {
    try {
      const res = await apiClient.post(`/api/forms/${formId}/finalize`);
      return { isMock: false, data: res.data };
    } catch (err) {
      if (err?.response?.status === 409) {
        throw new Error(err.response.data?.detail || 'Resolve all open doubts before finalizing.');
      }
    }
  }
  return { isMock: true, data: { id: formId, status: 'final' } };
}

export async function fetchRoomSummary(roomNo) {
  if (!PREFER_MOCK) {
    try {
      const res = await apiClient.get(`/api/summary/room/${encodeURIComponent(roomNo)}`);
      return { isMock: false, data: res.data };
    } catch {
      // fallback below
    }
  }
  return {
    isMock: true,
    data: MOCK_ROOM_SUMMARIES[roomNo] || { room_no: roomNo, sessions: [] },
  };
}

export async function fetchBranchSummary(branch) {
  if (!PREFER_MOCK) {
    try {
      const res = await apiClient.get(`/api/summary/branch/${encodeURIComponent(branch)}`);
      return { isMock: false, data: res.data };
    } catch {
      // fallback below
    }
  }
  const key = branch.toUpperCase();
  return {
    isMock: true,
    data: MOCK_BRANCH_SUMMARIES[key] || { branch: key, branchName: key, sessions: [] },
  };
}

export async function askVeriFormAssistant({ message, currentSheet, openDoubtsCount }) {
  if (!PREFER_MOCK) {
    try {
      const res = await apiClient.post('/api/chat', {
        user_id: '00000000-0000-0000-0000-000000000001',
        message,
      });
      const reply = res.data?.[0]?.content;
      if (reply) {
        return { isMock: false, content: reply };
      }
    } catch {
      // fallback below
    }
  }
  await new Promise((r) => setTimeout(r, 350));
  return {
    isMock: true,
    content: generateMockChatReply(message, currentSheet, openDoubtsCount),
  };
}
