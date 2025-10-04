export type Student = {
  id: string;
  name: string;
  age?: number;
  isElderly?: boolean;
  email?: string;
  phone?: string;
  address?: string;
  emergencyContacts?: string;
  parentGuardianName?: string;
  parentGuardianEmail?: string;
  parentGuardianPhone?: string;
  medications?: string; // optional medical/medications disclosure
  marketingConsent?: boolean;
  allergies?: string;
  instruments?: string[];
  bandName?: string;
};

const KEY = 'inTuneStudents';

export function getStudents(): Student[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveStudents(list: Student[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function addStudent(s: Omit<Student,'id'>): Student {
  const students = getStudents();
  const newS: Student = { id: String(Date.now()), ...s };
  const next = [newS, ...students];
  saveStudents(next);
  return newS;
}

export function updateStudent(id: string, patch: Partial<Student>) {
  const students = getStudents();
  const next = students.map(s => s.id === id ? { ...s, ...patch } : s);
  saveStudents(next);
  return next.find(s=>s.id===id) || null;
}

export function removeStudent(id: string) {
  const students = getStudents();
  const next = students.filter(s=>s.id!==id);
  saveStudents(next);
}

export function getStudentById(id: string) {
  const students = getStudents();
  return students.find(s=>s.id===id) || null;
}
