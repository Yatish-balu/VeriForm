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

async function getCurrentUserId() {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.auth.getSession();
    const uid = data?.session?.user?.id;
    if (uid) return uid;
  }
  return null;
}

function getErrorMessage(err, fallback = 'Request failed') {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((item) => item?.msg || JSON.stringify(item)).join('; ');
  }
  return err?.message || fallback;
}

function normalizeFormDetail(form) {
  if (Array.isArray(form?.rows)) {
    return form;
  }
  const statusLabels = {
    present: 'Present',
    absent: 'Absent',
    unclear: 'Unclear',
  };
  const sessionMap = new Map((form?.sessions || []).map((s) => [s.id, s]));
  const rows = (form?.attendance || []).map((att, index) => {
    const session = sessionMap.get(att.session_id);
    const status = statusLabels[att.status] || 'Unclear';
    const confidence = att.confidence ?? 0;
    return {
      id: att.id,
      slNo: att.sl_no ?? index + 1,
      usn: att.student?.usn || '—',
      name: att.student?.name || '—',
      branch: att.student?.branch || '',
      sessionId: att.session_id,
      subjectCode: session?.subject_code || '',
      examDate: session?.exam_date || '',
      status,
      confidence,
      aiNote: att.ai_note || '',
      needsReview: status === 'Unclear' || confidence < 0.75,
    };
  });

  return {
    ...form,
    rows,
  };
}

export async function checkBackendHealth() {
  if (PREFER_MOCK) {
    return { connected: false, mode: 'mock', detail: 'Mock mode active (VITE_USE_MOCK_DATA=true)' };
  }
  try {
    const res = await apiClient.get('/health', { timeout: 3000 });
    return { connected: res.data?.status === 'ok', mode: 'live', detail: `FastAPI v${res.data?.version || '1.0'}` };
  } catch {
    return { connected: false, mode: 'mock', detail: 'Backend unreachable' };
  }
}

/**
 * Extract attendance from uploaded Form-B file.
 * Connects to POST /api/forms/upload when live backend is enabled.
 */
export async function extractFormAttendance({ file, documentData }) {
  if (!PREFER_MOCK) {
    if (!(file instanceof File)) {
      throw new Error('Please upload a JPG, PNG, or PDF Form-B file to run live extraction.');
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      const userId = await getCurrentUserId();
      if (userId) {
        formData.append('uploaded_by', userId);
      }
      const res = await apiClient.post('/api/forms/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      return {
        isMockResult: false,
        sourceLabel: 'Live Gemini Extraction API',
        form: normalizeFormDetail(res.data),
      };
    } catch (err) {
      throw new Error(getErrorMessage(err, 'Unable to extract attendance from this sheet.'));
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
      const res = await apiClient.get('/api/forms');
      return { isMock: false, data: res.data };
    } catch (err) {
      throw new Error(getErrorMessage(err, 'Failed to load uploaded forms.'));
    }
  }
  return { isMock: true, data: MOCK_FORM_HISTORY };
}

export async function fetchReviewDoubts() {
  if (!PREFER_MOCK) {
    try {
      const formsRes = await apiClient.get('/api/forms');
      const allDoubts = [];
      for (const f of formsRes.data || []) {
        const detailRes = await apiClient.get(`/api/forms/${f.id}`);
        const detail = detailRes.data || {};
        const attendanceById = new Map(
          (detail.attendance || []).map((att) => [att.id, att])
        );
        for (const d of detail.doubts || []) {
          const att = d.attendance_id ? attendanceById.get(d.attendance_id) : null;
          allDoubts.push({
            ...d,
            room_no: detail.room_no || f.room_no,
            exam_name: detail.exam_name || f.exam_name,
            usn: att?.student?.usn || '—',
            student_name: att?.student?.name || 'Form-level check',
            confidence: att?.confidence ?? null,
          });
        }
      }
      return { isMock: false, data: allDoubts };
    } catch (err) {
      throw new Error(getErrorMessage(err, 'Failed to load review queue doubts.'));
    }
  }
  return { isMock: true, data: INITIAL_REVIEW_DOUBTS };
}

export async function resolveDoubtDecision(doubtId, resolution) {
  if (!PREFER_MOCK) {
    try {
      const userId = await getCurrentUserId();
      const payload = userId ? { resolution, resolved_by: userId } : { resolution };
      const res = await apiClient.post(`/api/doubts/${doubtId}/resolve`, payload);
      return { isMock: false, data: res.data };
    } catch (err) {
      throw new Error(getErrorMessage(err, 'Failed to resolve doubt.'));
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
      throw new Error(getErrorMessage(err, 'Failed to finalize form.'));
    }
  }
  return { isMock: true, data: { id: formId, status: 'final' } };
}

export async function exportFormPdf(formId, fallbackFilename) {
  if (PREFER_MOCK) {
    throw new Error('PDF export requires the live backend (set VITE_USE_MOCK_DATA=false).');
  }
  try {
    const res = await apiClient.get(`/api/forms/${formId}/export`, {
      responseType: 'blob',
      timeout: 30000,
    });
    const disposition = res.headers?.['content-disposition'] || '';
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const filename = match?.[1] || fallbackFilename || `form_b_${formId}.pdf`;
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return { filename };
  } catch (err) {
    if (err?.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const parsed = JSON.parse(text);
        if (parsed?.detail) {
          throw new Error(typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail));
        }
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message && !parseErr.message.startsWith('Unexpected')) {
          throw parseErr;
        }
      }
    }
    throw new Error(getErrorMessage(err, 'Failed to export PDF report.'));
  }
}

export async function fetchRoomSummary(roomNo) {
  if (!PREFER_MOCK) {
    try {
      const res = await apiClient.get(`/api/summary/room/${encodeURIComponent(roomNo)}`);
      return { isMock: false, data: res.data };
    } catch (err) {
      throw new Error(getErrorMessage(err, `Failed to load summary for room ${roomNo}.`));
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
    } catch (err) {
      throw new Error(getErrorMessage(err, `Failed to load summary for branch ${branch}.`));
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
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('Please sign in with Supabase to query VeriForm AI.');
    }
    try {
      const res = await apiClient.post(
        '/api/chat',
        { user_id: userId, message },
        { timeout: 30000 }
      );
      const reply = res.data?.[0]?.content;
      return { isMock: false, content: reply || 'No response returned.' };
    } catch (err) {
      throw new Error(getErrorMessage(err, 'Unable to reach VeriForm AI.'));
    }
  }
  await new Promise((r) => setTimeout(r, 350));
  return {
    isMock: true,
    content: generateMockChatReply(message, currentSheet, openDoubtsCount),
  };
}
