export const loadCourseFile = async () => {
  const res = await fetch('/info.csv');
  if (!res.ok) {
    throw new Error(`Could not load info.csv (${res.status})`);
  }
  const text = await res.text();
  const data = JSON.parse(text);
  return Array.isArray(data) ? data : [data];
};

export const findCourseByIdOrSlug = (courses, courseId) => {
  if (!courses || !courseId) return null;
  const normalizedCourseId = String(courseId).toLowerCase();

  const matchById = courses.find(c => String(c.id).toLowerCase() === normalizedCourseId);
  if (matchById) return matchById;

  const matchByTitle = courses.find(c => String(c.title).toLowerCase() === normalizedCourseId);
  if (matchByTitle) return matchByTitle;

  const matchBySlug = courses.find(c => String(c.title).toLowerCase().replace(/\s+/g, '-') === normalizedCourseId);
  if (matchBySlug) return matchBySlug;

  return courses[0] || null;
};

const extractCodeFromCourse = (rawCourse) => {
  const cppSnippets = [];
  const javaSnippets = [];

  (rawCourse.sections || []).forEach(sec => {
    (sec.lessons || []).forEach(les => {
      (les.pages || []).forEach(page => {
        (page.blocks || []).forEach(block => {
          if (block.type === 'normal_code' && block.codeSnippet) {
            const lang = (block.codeSnippet.language || '').toLowerCase();
            const codeText = (block.codeSnippet.lines || []).join('\n');
            if (codeText.trim()) {
              if (lang === 'cpp' || lang === 'c++') {
                cppSnippets.push(codeText);
              } else if (lang === 'java') {
                javaSnippets.push(codeText);
              }
            }
          }
        });
      });
    });
  });

  return { cppSnippets, javaSnippets };
};

export const normalizeCourse = (rawCourse) => ({
  id: rawCourse.id,
  title: rawCourse.title,
  description: rawCourse.description || '',
  about: rawCourse.about || '',
  imageUrl: rawCourse.imageUrl || '',
  comingsoon: rawCourse.comingsoon || false,
  totalLessons: rawCourse.totalLessons || 0,
  codeIndex: extractCodeFromCourse(rawCourse),
  sections: (rawCourse.sections || [])
    .slice()
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    .map(sec => ({
      id: sec.id,
      title: sec.title,
      description: sec.description || '',
      orderIndex: sec.orderIndex || 0,
      lessons: (sec.lessons || [])
        .slice()
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
        .map(les => ({
          id: les.id,
          category: les.category || 'learning',
          chapterName: les.chapterName || '',
          title: les.title || 'Untitled Lesson',
          orderIndex: les.orderIndex || 0,
          pages: les.pages || [],
          codeSnippets: (les.pages || []).flatMap(page =>
            (page.blocks || [])
              .filter(b => b.type === 'normal_code' && b.codeSnippet)
              .map(b => ({
                language: (b.codeSnippet.language || '').toLowerCase(),
                code: (b.codeSnippet.lines || []).join('\n'),
                runnable: b.runable !== false,
              }))
          ),
        }))
    }))
});
