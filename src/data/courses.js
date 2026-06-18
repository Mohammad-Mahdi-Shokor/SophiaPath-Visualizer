// Load course data from public/info.csv (which is actually JSON)
let _coursesCache = null;

export async function loadCourses() {
  if (_coursesCache) return _coursesCache;
  try {
    const res = await fetch('/info.csv');
    if (!res.ok) throw new Error('Failed to load info.csv');
    const text = await res.text();
    const data = JSON.parse(text);
    // info.csv contains a single course object or an array
    const courses = Array.isArray(data) ? data : [data];
    _coursesCache = courses;
    return courses;
  } catch (err) {
    console.error('Failed to load courses from info.csv:', err);
    _coursesCache = [];
    return [];
  }
}

export function getCachedCourses() {
  return _coursesCache || [];
}

export async function getCourseById(courseId) {
  const courses = await loadCourses();
  return courses.find(c => String(c.id) === String(courseId));
}

export async function getLessonById(courseId, sectionId, lessonId) {
  const course = await getCourseById(courseId);
  if (!course) return null;
  const section = (course.sections || []).find(s => String(s.id) === String(sectionId));
  if (!section) return null;
  const lesson = (section.lessons || []).find(l => String(l.id) === String(lessonId));
  return lesson || null;
}